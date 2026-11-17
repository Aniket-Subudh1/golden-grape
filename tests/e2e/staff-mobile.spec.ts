import { type APIRequestContext, expect, type Page, test } from '@playwright/test';

// Journey #3 (06 §3.3, M3.1 T7): on a phone, a staff member receives a purchase order by typing barcodes into the scan
// field (as a Bluetooth scanner would; the camera is not automated), sells to a customer created at the till, and the
// stock shows both. Each run creates its own product, staff member, supplier and order through the REST API as the
// seeded admin (CI: ci-admin@example.test), so the three device projects never share stock.

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'ci-admin@example.test', password: process.env.E2E_ADMIN_PASSWORD ?? 'ci-only-password-1' };
const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const code = (prefix: string) => `${prefix}${run}`.slice(0, 13);

async function adminApi(request: APIRequestContext) {
  const login = await request.post('/api/users/login', { data: ADMIN });
  expect(login.ok(), 'the seeded admin signs in').toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  const headers = { Authorization: `JWT ${token}` };
  const call = async <T>(method: 'get' | 'post', path: string, data?: unknown): Promise<T> => {
    const res = await request[method](`/api/${path}`, { headers, data });
    expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as { doc?: T } & T;
    return body.doc ?? body;
  };
  return call;
}

async function scan(page: Page, value: string) {
  const field = page.locator('#scan:visible');
  await field.fill(value);
  await field.press('Enter');
}

test('receive a purchase order by scanning, sell to a new customer, stock shows both', async ({ page, request }, testInfo) => {
  // A phone journey (06 §3.3: Pixel 7). One project only: the admin it signs in as keeps one session list, and three
  // simultaneous sign-ins of one account would race on it.
  test.skip(testInfo.project.name !== 'pixel-7', 'phone journey: Pixel 7 only');
  const api = await adminApi(request);
  // Purchasing must be on for the receive screen (Réglages › Modules et alertes).
  await api('post', 'globals/BusinessSettings', { modules: { purchasing: true } });
  const { docs: categories } = await api<{ docs: { id: string }[] }>('get', 'categories?where[kind][equals]=shop&limit=1');
  const bottle = code('20');
  const box = code('21');
  const product = await api<{ id: string }>('post', 'products?depth=0', {
    name: `Vinho E2E ${run}`,
    kind: 'wine',
    category: categories[0].id,
    vatClass: 'intermediate',
    status: 'active',
    firstVariant: { priceCents: 1800, barcode: bottle },
  });
  const { docs: variants } = await api<{ docs: { id: string }[] }>('get', `variants?where[product][equals]=${product.id}&depth=0`);
  const unit = await api<{ id: string }>('post', 'packagingUnits?depth=0', { variant: variants[0].id, factor: 6, label: 'Carton de 6', barcode: box });
  const supplier = await api<{ id: string }>('post', 'suppliers?depth=0', { name: `Quinta E2E ${run}` });
  const po = await api<{ number: string }>('post', 'purchaseOrders?depth=0', { supplier: supplier.id, status: 'ordered', lines: [{ variant: variants[0].id, unit: unit.id, unitQty: 2, costCents: 6000 }] });
  const staff = { email: `e2e-staff-${run}@example.test`, password: 'E2E-Password-1' };
  await api('post', 'users?depth=0', { ...staff, name: 'E2E Équipe', roles: ['stock', 'sales'], locale: 'fr' });

  // Sign in on the phone.
  await page.goto('/staff/receive');
  await expect(page).toHaveURL(/\/staff\/login/);
  await page.fill('#email', staff.email);
  await page.fill('#password', staff.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/staff\/receive$/);

  // Receive: two scans of the box barcode → 2 boxes of 6 = 12 bottles.
  await page.getByRole('link', { name: new RegExp(po.number) }).click();
  await scan(page, box);
  await scan(page, box);
  await expect(page.getByLabel(/Quantité reçue Vinho E2E/)).toHaveValue('2');
  await page.getByRole('button', { name: 'Valider la réception' }).click();
  await expect(page.getByText('La commande est entièrement reçue')).toBeVisible();

  // Sell two bottles to a customer created at the till (no e-mail), paid on site.
  await page.goto('/staff/sale');
  await page.getByRole('button', { name: 'Nouveau client' }).click();
  await page.fill('#name', `Client E2E ${run}`);
  await page.fill('#phone', '+352 621 000 000');
  await page.getByRole('button', { name: 'Créer le client' }).click();
  await expect(page.getByTestId('sale-customer')).toContainText(`Client E2E ${run}`);
  await scan(page, bottle);
  await scan(page, bottle);
  await expect(page.getByTestId('sale-total')).toContainText('36,00');
  await page.getByRole('button', { name: /Valider la vente/ }).click();
  await expect(page.getByTestId('order-number')).toHaveText(/^CMD-\d{4}-\d{5}$/);

  // Stock: +12 received − 2 sold.
  await page.goto('/staff/scan');
  await scan(page, bottle);
  await expect(page.locator('[data-testid=on-hand]:visible')).toHaveText('10');
});
