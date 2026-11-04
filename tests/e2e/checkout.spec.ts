import { expect, type Page, test } from '@playwright/test';
import de from '../../dictionaries/de.json';
import en from '../../dictionaries/en.json';
import fr from '../../dictionaries/fr.json';

// Journey #2 (06 §3.3): a snack and a wine → pickup → slot → confirmation page (and the e-mail in the chosen language
// when MAILPIT_URL is set); delivery with the zone fee; a table with a pre-order, left pending.
// Needs a seeded database with stock (npm run seed, then stock entered) and SMTP pointed at Mailpit for the e-mails.

const MAILPIT = process.env.MAILPIT_URL;
const unique = (name: string) => `${name.toLowerCase()}+${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;

/** Adds Bifanas from the counter: "+" on the card, then the card's stepper for more. */
async function addBifana(page: Page, locale: string, qty = 1, plus = 'plus') {
  await page.goto(`/${locale}/snack`);
  const card = page.locator('article', { hasText: 'Bifana' }).first();
  await card.getByRole('button').first().click();
  for (let i = 1; i < qty; i++) await card.getByRole('button', { name: plus }).click();
}

async function addWine(page: Page, locale: string, addLabel: string) {
  await page.goto(`/${locale}/shop/douro-reserva`);
  await page.getByRole('button', { name: addLabel }).click();
  await page.keyboard.press('Escape');
}

/** A free day and time, picked at random: the three device projects run at once and must not fill one slot. */
async function pickTime(page: Page) {
  // Day chips are the rounded cards with a date in them (mode and payment cards have none).
  const days = page.locator('button[role=radio].rounded-2xl:not([disabled])').filter({ hasText: /\d/ });
  await days.first().waitFor();
  await days.nth(Math.floor(Math.random() * Math.min(5, await days.count()))).click();
  const times = page.getByRole('radio', { name: /^\d\d:\d\d$/ }).and(page.locator(':not([disabled])'));
  await times.first().waitFor();
  await times.nth(Math.floor(Math.random() * (await times.count()))).click();
}

async function details(page: Page, name: string, email: string) {
  await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#phone', '+352 621 000 000');
}

async function expectMail(to: string, subjectStart: string) {
  if (!MAILPIT) return;
  await expect
    .poll(async () => {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
      const { messages } = (await res.json()) as { messages: { Subject: string }[] };
      return messages.map((m) => m.Subject);
    })
    .toEqual([expect.stringContaining(subjectStart)]);
}

test('pickup in French: confirmation page and one e-mail in French', async ({ page }) => {
  const email = unique('ana');
  await addBifana(page, 'fr');
  await addWine(page, 'fr', fr.shop.buy.add);
  await page.goto('/fr/checkout');
  await pickTime(page);
  await details(page, 'Ana Silva', email);
  await page.getByRole('button', { name: fr.checkout.submit }).click();
  await expect(page).toHaveURL(/\/fr\/order\/[a-f0-9]{24}\?t=/);
  await expect(page.getByText(fr.order.status.confirmed).first()).toBeVisible();
  await expect(page.getByText('Bifana').first()).toBeVisible();
  await page.reload(); // a reload shows the same order, never a second one
  await expect(page.getByText(fr.order.status.confirmed).first()).toBeVisible();
  await expectMail(email, fr.mail.order.subject.split(' {{')[0]);
});

test('delivery in English: zone fee shown, transfer details on the confirmation page', async ({ page }) => {
  const email = unique('john');
  await addBifana(page, 'en', 5, en.cart.plus);
  await page.goto('/en/checkout');
  await page.getByRole('radio', { name: new RegExp(en.cart.modes.delivery) }).click();
  await page.fill('#postalCode', '1009');
  await expect(page.getByText(en.checkout.zone.outside).first()).toBeVisible();
  await page.fill('#line1', 'Rue Principale 12');
  await page.fill('#postalCode', 'L-7795');
  await page.fill('#city', 'Bissen');
  await expect(page.getByText(/^Delivery €/).first()).toBeVisible();
  await pickTime(page);
  await details(page, 'John Smith', email);
  await page.getByRole('button', { name: en.checkout.submit }).click();
  await expect(page).toHaveURL(/\/en\/order\//);
  await expect(page.getByText(en.order.status.awaiting_payment).first()).toBeVisible();
  await expect(page.getByText(en.order.transfer.title).first()).toBeVisible();
  await expectMail(email, en.mail.order.subject.split(' {{')[0]);
});

test('table with a pre-order in German: request pending', async ({ page }) => {
  const email = unique('hans');
  await addBifana(page, 'de');
  await page.goto('/de/checkout?mode=table');
  await pickTime(page);
  await details(page, 'Hans Müller', email);
  await page.getByRole('button', { name: de.checkout.submitTable }).click();
  await expect(page).toHaveURL(/\/de\/order\//);
  await expect(page.getByText(de.order.reservationStatus.pending).first()).toBeVisible();
  await expect(page.getByText('Bifana').first()).toBeVisible();
  await expectMail(email, de.mail.reservation.pendingSubject.split(' {{')[0]);
});
