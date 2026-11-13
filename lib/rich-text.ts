// Lexical rich text built from plain text and read back as plain text. Writers: the seed and the catalogue import.
// Readers: the product page (meta description) and the catalogue export. Plus the plain text of light Markdown
// (event descriptions): card previews and meta descriptions.

const textNode = (value: string) => ({ type: 'text', text: value, version: 1, format: 0, mode: 'normal', style: '', detail: 0 });

export const richNode = (type: 'paragraph' | 'quote', value: string) => ({
  type,
  version: 1,
  children: [textNode(value)],
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  ...(type === 'paragraph' ? { textFormat: 0 } : {}),
});

export const richText = (...children: ReturnType<typeof richNode>[]) => ({
  root: { type: 'root', version: 1, children, direction: 'ltr' as const, format: '' as const, indent: 0 },
});

/** One paragraph per block of text; blocks are separated by a blank line. Empty text → null (no description). */
export function fromPlainText(value: string) {
  const paragraphs = value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.length ? richText(...paragraphs.map((p) => richNode('paragraph', p))) : null;
}

/** The text of a Lexical value, one block per paragraph separated by a blank line (the reverse of fromPlainText). */
export function plainText(value: unknown): string {
  const root = (value as { root?: { children?: unknown[] } } | null | undefined)?.root;
  const inline = (node: unknown): string => {
    const n = node as { type?: string; text?: string; children?: unknown[] };
    return n.type === 'linebreak' ? '\n' : (n.text ?? '') + (n.children ?? []).map(inline).join('');
  };
  return (root?.children ?? []).map((block) => inline(block).trim()).filter(Boolean).join('\n\n');
}

/**
 * The words of light Markdown, without its marks (QA 12 Nov, GG-14): `## Programme` → "Programme", `**Fado**` →
 * "Fado", list dashes and link targets dropped. For the event card preview and the meta description.
 */
export const stripMarkdown = (text: string) =>
  text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|[.,;:!?]|$)/g, '$1$2')
    .replace(/`([^`\n]*)`/g, '$1')
    .trim();
