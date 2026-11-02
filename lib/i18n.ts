import type { ReactNode } from 'react';
import type fr from '@/dictionaries/fr.json';

export const LOCALES = ['fr', 'en', 'de', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';
export type Dictionary = typeof fr;

export const isLocale = (value: string | undefined): value is Locale =>
  (LOCALES as readonly (string | undefined)[]).includes(value);

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import('@/dictionaries/fr.json').then((m) => m.default),
  en: () => import('@/dictionaries/en.json').then((m) => m.default),
  de: () => import('@/dictionaries/de.json').then((m) => m.default),
  pt: () => import('@/dictionaries/pt.json').then((m) => m.default),
};

export const getDictionary = (locale: Locale) => loaders[locale]();

/** `localePath('de', '/shop')` → `/de/shop`; the home path is `/de`. */
export const localePath = (locale: Locale, path = '/') => `/${locale}${path === '/' ? '' : path}`;

/** Next `metadata.alternates` for a path without locale: canonical, 4 hreflang entries and x-default. */
export function alternates(path: string, locale: Locale) {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)]));
  languages['x-default'] = localePath(DEFAULT_LOCALE, path);
  return { canonical: localePath(locale, path), languages };
}

/** Replaces `{{name}}` placeholders; unknown names are left as they are. */
export const interpolate = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));

/** Splits `a <gold>b</gold> c` and lets the caller render each gold chunk (with its key). */
export const rich = (text: string, gold: (chunk: string, key: number) => ReactNode): ReactNode[] =>
  text.split(/<gold>(.*?)<\/gold>/).map((part, i) => (i % 2 === 1 ? gold(part, i) : part));
