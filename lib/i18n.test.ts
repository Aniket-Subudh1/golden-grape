import { describe, expect, it } from 'vitest';
import de from '@/dictionaries/de.json';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';
import pt from '@/dictionaries/pt.json';
import { alternates, interpolate, isLocale, localePath, rich } from './i18n';

// Every leaf path of a JSON tree, e.g. "hero.titleA" or "marquee.words.0".
const leaves = (node: unknown, prefix = ''): [string, unknown][] =>
  node !== null && typeof node === 'object'
    ? Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
    : [[prefix, node]];

const get = (tree: unknown, path: string) =>
  path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);

describe('i18n', () => {
  it('builds 4 hreflang alternates plus x-default and a canonical', () => {
    expect(alternates('/shop', 'de')).toEqual({
      canonical: '/de/shop',
      languages: { fr: '/fr/shop', en: '/en/shop', de: '/de/shop', pt: '/pt/shop', 'x-default': '/fr/shop' },
    });
    expect(alternates('/', 'fr').languages.en).toBe('/en');
  });

  it.each([
    ['fr', true],
    ['pt', true],
    ['es', false],
    ['FR', false],
    [undefined, false],
  ])('isLocale(%s) = %s', (value, expected) => {
    expect(isLocale(value)).toBe(expected);
  });

  it('prefixes paths with the locale', () => {
    expect(localePath('pt', '/contact')).toBe('/pt/contact');
    expect(localePath('pt')).toBe('/pt');
  });

  it('interpolates known placeholders and leaves unknown ones', () => {
    expect(interpolate('© {{year}} GG {{x}}', { year: 2026 })).toBe('© 2026 GG {{x}}');
  });

  it('splits gold chunks for the caller to render', () => {
    expect(rich('a <gold>b</gold> c', (chunk, key) => `[${chunk}:${key}]`)).toEqual(['a ', '[b:1]', ' c']);
  });

  it.each([
    ['en', en],
    ['de', de],
    ['pt', pt],
  ])('%s has every fr key, none empty', (_, dict) => {
    const missing = leaves(fr)
      .map(([path]) => path)
      .filter((path) => {
        const value = get(dict, path);
        return typeof value !== 'string' || value.trim() === '';
      });
    expect(missing).toEqual([]);
  });
});
