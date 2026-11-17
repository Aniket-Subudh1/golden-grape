import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import fr from '../../dictionaries/fr.json';

// Journey #4 (06 §3.3, M3.2 T6): a business customer sees their list price in the shop; staff send them a quotation
// from the phone sale, turn it into an order on the customer's page, issue the invoice from the orders screen, and its
// PDF downloads with the next invoice number. Each run creates its own product, price list, customer and staff member
// through the REST API as the seeded admin (CI: ci-admin@example.test).

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'ci-admin@example.test', password: process.env.E2E_ADMIN_PASSWORD ?? 'ci-only-password-1' };
const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PASSWORD = 'E2E-Password-1';

async function adminApi(request: APIRequestContext) {
  const login = await request.post('/api/users/login', { data: ADMIN });
  expect(login.ok(), 'the seeded admin signs in').toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  const headers = { Authorization: `JWT ${token}` };
  return async <T>(method: 'get' | 'post' | 'patch', path: string, data?: unknown): Promise<T> => {
    const res = await request[method](`/api/${path}`, { headers, data });
    expect(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as { doc?: T } & T;
    return body.doc ?? body;
  };
}

async function scan(page: Page, value: string) {
  const field = page.locator('#scan:visible');
  await field.fill(value);
  await field.press('Enter');
}

/** The invoice number that comes after the last one issued this year (gapless series, 5 digits). */
const nextInvoice = (last: string | undefined) => {
  const year = new Date().getFullYear();
  const n = last?.startsWith(`FAC-${year}-`) ? Number(last.split('-')[2]) + 1 : 1;
  return `FAC-${year}-${String(n).padStart(5, '0')}`;
};

test('B2B: list price in the shop → quotation → order → invoice PDF with the next number', async ({ browser, request }, testInfo) => {
  // One project: invoice numbers are one series, so three devices at once would race for "the next number".
  test.skip(testInfo.project.name !== 'desktop', 'one shared invoice series: desktop only');
  const api = await adminApi(request);
  await api('post', 'globals/BusinessSettings', { modules: { b2b: true, promotions: true } });
  const { docs: categories } = await api<{ docs: { id: string }[] }>('get', 'categories?where[kind][equals]=shop&limit=1');
  const barcode = `30${run}`.slice(0, 13);
  const product = await api<{ id: string; slug: string }>('post', 'products?depth=0', {
    name: `Vinho B2B ${run}`,
    kind: 'wine',
    category: categories[0].id,
    vatClass: 'intermediate',
    status: 'active',
    firstVariant: { priceCents: 1800, barcode },
  });
  const { docs: variants } = await api<{ docs: { id: string }[] }>('get', `variants?where[product][equals]=${product.id}&depth=0`);
  // Stock moves only through postMovements (no API write): an untracked bottle needs none for this journey.
  await api('patch', `variants/${variants[0].id}?depth=0`, { trackStock: false });
  // 10,00 net + 14 % VAT = 11,40 a bottle, instead of 18,00.
  const list = await api<{ id: string }>('post', 'priceLists?depth=0', { name: `Liste ${run}`, pricesInclVat: false, lines: [{ variant: variants[0].id, priceCents: 1000 }] });
  const company = `Restaurante E2E ${run}`;
  const customer = await api<{ id: string }>('post', 'customers?depth=0', {
    name: 'Rui E2E',
    email: `e2e-b2b-${run}@example.test`,
    password: PASSWORD,
    phone: '+352 621 000 004',
    type: 'business',
    company,
    locale: 'fr',
    priceList: list.id,
    paymentTerm: '30',
  });
  const staff = { email: `e2e-sales-${run}@example.test`, password: PASSWORD };
  await api('post', 'users?depth=0', { ...staff, name: 'E2E Vente', roles: ['sales'], locale: 'fr' });

  // The customer, signed in, sees their list price on the product page.
  const shop = await browser.newContext();
  await shop.addCookies([{ name: 'gg_consent', value: 'essential', url: testInfo.project.use.baseURL! }]);
  const site = await shop.newPage();
  await site.goto('/fr/auth');
  await site.locator('form').filter({ has: site.locator('input[type=password]') }).first().locator('input[type=email]').fill(`e2e-b2b-${run}@example.test`);
  await site.locator('input[type=password]').first().fill(PASSWORD);
  await site.locator('input[type=password]').first().press('Enter');
  await expect(site).toHaveURL(/\/fr\/account/);
  await site.goto(`/fr/shop/${product.slug}`);
  await expect(site.locator('main')).toContainText('11,40');
  // Only the product's own part: the "you may also like" strip below lists other products.
  const own = (await site.locator('main').innerText()).split(new RegExp(fr.shop.related.eyebrow, 'i'))[0];
  expect(own).not.toContain('18,00');
  await shop.close();

  // Staff: a quotation from the phone sale, at that price.
  const page = await browser.newPage();
  await page.goto('/staff/sale');
  await expect(page).toHaveURL(/\/staff\/login/);
  await page.fill('#email', staff.email);
  await page.fill('#password', staff.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/staff\/sale$/);
  await page.getByPlaceholder(fr.staff.customers.search.placeholder).fill(company);
  await page.getByRole('button', { name: new RegExp(company) }).click();
  await expect(page.getByTestId('sale-customer')).toContainText(company);
  await scan(page, barcode);
  await scan(page, barcode);
  await expect(page.getByTestId('sale-total')).toContainText('22,80');
  await page.getByTestId('send-quotation').click();
  await expect(page.getByText(fr.staff.sale.quoteSentTitle)).toBeVisible();
  const quotation = (await page.getByTestId('order-number').textContent())!.trim();
  expect(quotation).toMatch(/^DEV-\d{4}-\d{4}$/);

  // On the customer's page: "Create order" at the quoted prices.
  await page.goto(`/staff/customers/${customer.id}`);
  const row = page.locator(`[data-quotation="${quotation}"]`);
  await row.getByRole('button', { name: fr.staff.customers.createOrder }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
  await expect(row).toContainText(/Commande CMD-\d{4}-\d{5}/);
  const order = (await row.textContent())!.match(/CMD-\d{4}-\d{5}/)![0];

  // The orders screen: issue the invoice; its PDF has the next number.
  const { docs: last } = await api<{ docs: { number: string }[] }>('get', 'invoices?sort=-number&limit=1&depth=0');
  const expected = nextInvoice(last[0]?.number);
  await page.goto('/staff/orders');
  const card = page.locator(`[data-order="${order}"]`);
  await card.getByRole('button', { name: 'Émettre la facture' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
  const link = card.getByRole('link', { name: expected });
  await expect(link).toBeVisible();
  const pdf = await page.request.get((await link.getAttribute('href'))!);
  expect(pdf.ok()).toBeTruthy();
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect(pdf.headers()['content-disposition']).toContain(`${expected}.pdf`);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
});
