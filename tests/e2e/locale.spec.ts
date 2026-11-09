import { expect, test } from '@playwright/test';
import de from '../../dictionaries/de.json';
import en from '../../dictionaries/en.json';
import fr from '../../dictionaries/fr.json';
import pt from '../../dictionaries/pt.json';
import seed from '../../scripts/seed-content.json';

// Journey #1 (06 §3.3): French entry, the switcher keeps the path, no other-language text on any page.
// Needs a seeded database (npm run seed).

const DICTS = { fr, en, de, pt };
type Locale = keyof typeof DICTS;
const LOCALES = Object.keys(DICTS) as Locale[];
const ROUTES = ['', '/maison', '/events', '/catering', '/contact'];

/** Distinctive strings of a locale: dictionary keys plus a localized CMS field (the Maison hero). */
const samples = (l: Locale) => [
  DICTS[l].hero.titleA,
  DICTS[l].contactPage.titleA,
  DICTS[l].cateringPage.subtitle,
  DICTS[l].eventsPage.subtitle,
  DICTS[l].footer.moderation,
  DICTS[l].footer.welcome, // APPLUX §5: the footer's big welcome follows the language
  seed[l].maison.subtitle,
];

test('/ without a language cookie goes to /fr, whatever the browser language', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('the language switcher keeps the path and remembers the choice', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop navigation');
  await page.goto('/fr/contact');
  await page.getByRole('navigation').getByRole('button', { name: /Langue/ }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Deutsch' }).click();
  await expect(page).toHaveURL(/\/de\/contact$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.goto('/');
  await expect(page).toHaveURL(/\/de$/);
});

for (const locale of LOCALES) {
  test(`no text from another language on the ${locale.toUpperCase()} pages`, async ({ page }) => {
    const own = new Set(samples(locale));
    const foreign = LOCALES.filter((l) => l !== locale).flatMap(samples).filter((s) => !own.has(s));
    for (const route of ROUTES) {
      await page.goto(`/${locale}${route}`);
      await page.waitForLoadState('networkidle');
      const visible = await page.locator('body').innerText();
      for (const text of foreign) expect.soft(visible, `${locale}${route} shows "${text}"`).not.toContain(text);
    }
  });
}
