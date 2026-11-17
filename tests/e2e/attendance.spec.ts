import { type APIRequestContext, expect, test } from '@playwright/test';

// Journey #5 (06 §3.3, M3.3): a manager opens the venue QR; an employee opens its link on their phone, checks in, then
// out; the shift appears in the manager's monthly report. Its own manager and employee are created through the REST
// API as the seeded admin (CI: ci-admin@example.test).

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'ci-admin@example.test', password: process.env.E2E_ADMIN_PASSWORD ?? 'ci-only-password-1' };
const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const PASSWORD = 'E2E-Password-1';

async function adminApi(request: APIRequestContext) {
  const login = await request.post('/api/users/login', { data: ADMIN });
  expect(login.ok(), 'the seeded admin signs in').toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  return async (path: string, data: unknown) => {
    const res = await request.post(`/api/${path}`, { headers: { Authorization: `JWT ${token}` }, data });
    expect(res.ok(), `${path}: ${res.status()} ${await res.text()}`).toBeTruthy();
  };
}

test('venue QR → check in → check out → the hours in the monthly report', async ({ browser, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-7', 'phone journey: Pixel 7 only');
  test.setTimeout(90_000);
  const post = await adminApi(request);
  await post('globals/BusinessSettings', { modules: { attendance: true } });
  const manager = { email: `e2e-manager-${run}@example.test`, password: PASSWORD };
  const employee = { email: `e2e-clock-${run}@example.test`, password: PASSWORD, name: `Clock E2E ${run}` };
  await post('users?depth=0', { ...manager, name: 'E2E Manager', roles: ['manager'], locale: 'en' });
  await post('users?depth=0', { ...employee, roles: ['attendance'], locale: 'en' });

  const signIn = async (page: import('@playwright/test').Page, who: { email: string; password: string }) => {
    await page.fill('#email', who.email);
    await page.fill('#password', who.password);
    await page.locator('form button[type=submit]').click();
  };

  // The venue display (manager).
  const boss = await browser.newPage();
  await boss.goto('/staff/attendance/qr');
  await signIn(boss, manager);
  const qr = boss.getByTestId('venue-qr');
  await expect(qr.locator('svg')).toBeVisible();
  const url = new URL((await qr.getAttribute('data-url'))!);

  // The employee's phone: the QR's link → sign-in → Check in, then Check out.
  const phone = await browser.newPage();
  await phone.goto(url.pathname + url.search);
  await expect(phone).toHaveURL(/\/staff\/login/);
  await signIn(phone, employee);
  await phone.getByRole('button', { name: 'Check in' }).click();
  await expect(phone.getByTestId('attendance-result')).toContainText('Checked in at');
  // One tap per 30 s per person (a double tap is not a check-out).
  await phone.waitForTimeout(31_000);
  await phone.goto(url.pathname + url.search);
  await phone.getByRole('button', { name: 'Check out' }).click();
  await expect(phone.getByTestId('attendance-result')).toContainText('Checked out at');

  // The manager's month.
  await boss.goto('/staff/attendance?tab=month');
  const person = boss.locator(`[data-person="${employee.name}"]`);
  await expect(person).toBeVisible();
  await expect(person.getByTestId('person-total')).toHaveText(/^\d+ h \d\d$/);
});
