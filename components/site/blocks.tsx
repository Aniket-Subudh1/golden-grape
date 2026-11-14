import { RichText } from '@payloadcms/richtext-lexical/react';
import Image from 'next/image';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { type Locale, localePath } from '@/lib/i18n';
import { mediaOf } from '@/modules/cms/service';
import type { Page } from '@/payload-types';
import { Container } from './container';
import { PageHero } from './page-hero';
import { Reveal } from './reveal';

type Block = NonNullable<Page['layout']>[number];
type Heading = { eyebrow?: string | null; titleA?: string | null; titleB?: string | null };

const PROSE = [
  'space-y-6 text-lg leading-relaxed font-light text-ink/70',
  '[&_a]:text-gold-deep [&_a]:underline [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:text-ink [&_h3]:font-serif [&_h3]:text-2xl [&_h3]:text-ink [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_strong]:font-medium [&_strong]:text-ink',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-gold-deep [&_blockquote]:pl-6 [&_blockquote]:font-serif [&_blockquote]:text-2xl [&_blockquote]:text-ink [&_blockquote]:italic',
];

/** Lexical rich text with the site's typography (pages and legal texts). */
export function Prose({ data, className }: { data: ComponentProps<typeof RichText>['data']; className?: string }) {
  return <RichText data={data} className={cn(...PROSE, className)} />;
}

/**
 * Text typed with light Markdown (`## Titre`, `**gras**`, `*italique*`, `- liste`) in the same typography: event
 * descriptions (QA 12 Nov, GG-14). Rendered on the server; HTML typed in the text stays text, images are not shown,
 * and a `#` title becomes a section heading under the page's own.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn(...PROSE, className)}>
      <ReactMarkdown disallowedElements={['img']} unwrapDisallowed components={{ h1: 'h2' }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function Title({ as: Tag = 'h2', titleA, titleB, className }: Heading & { as?: 'h1' | 'h2'; className: string }) {
  if (!titleA) return null;
  return (
    <Tag className={cn('font-serif', className)}>
      {titleA} {titleB && <em className="text-gold-deep italic">{titleB}</em>}
    </Tag>
  );
}

function Eyebrow({ text, className = 'text-gold-deep' }: { text?: string | null; className?: string }) {
  return text ? <p className={cn('eyebrow mb-6', className)}>{text}</p> : null;
}

function BlockView({ block, locale, first }: { block: Block; locale: Locale; first: boolean }) {
  switch (block.blockType) {
    case 'hero':
      // The page header every inner page has (GG-25), with the block's photo behind it.
      return (
        <PageHero as={first ? 'h1' : 'h2'} eyebrow={block.eyebrow} title={[block.titleA ?? '', block.titleB ?? undefined]} subtitle={block.subtitle} image={mediaOf(block.image)} eager={first} />
      );
    case 'richText':
      return (
        <section className="py-16 md:py-24">
          <Container size="md" className="max-w-3xl px-6">
            <Prose data={block.body} />
          </Container>
        </section>
      );
    case 'mediaText': {
      const image = mediaOf(block.image);
      return (
        <section className="px-6 py-24 md:px-10 md:py-32">
          <div className="mx-auto grid max-w-[1200px] items-center gap-12 md:grid-cols-2 md:gap-20">
            <Reveal className={cn(block.imagePosition === 'right' && 'md:order-2')}>
              <div className="relative aspect-[4/5] overflow-hidden">
                {image && <Image src={image.src} alt={image.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />}
              </div>
            </Reveal>
            <Reveal delay={150}>
              <Eyebrow text={block.eyebrow} />
              <Title {...block} className="text-4xl leading-tight md:text-5xl" />
              {block.body && <Prose data={block.body} className="mt-8" />}
            </Reveal>
          </div>
        </section>
      );
    }
    case 'cardGrid': {
      const dark = block.variant === 'dark';
      return (
        <section className={cn('px-6 py-24 md:px-10 md:py-32', block.variant === 'hairline' && 'bg-champagne/40', dark && 'bg-ink text-bone')}>
          <div className="mx-auto max-w-[1400px]">
            {block.titleA && (
              <div className="mb-16 max-w-2xl">
                <Eyebrow text={block.eyebrow} />
                <Title {...block} className="text-4xl leading-tight md:text-6xl" />
              </div>
            )}
            <div
              className={cn(
                'grid grid-cols-1',
                block.variant === 'hairline' && 'gap-px bg-border sm:grid-cols-2 lg:grid-cols-3',
                block.variant === 'cards' && 'gap-6 md:grid-cols-3 md:gap-8',
                dark && 'gap-12 md:grid-cols-3',
              )}
            >
              {(block.cards ?? []).map((card, i) => {
                const image = mediaOf(card.image);
                return (
                  <Reveal key={card.id ?? i} delay={i * (block.variant === 'hairline' ? 60 : 110)}>
                    {block.variant === 'hairline' ? (
                      <div className="h-full bg-bone p-8 md:p-10">
                        <p className="font-serif text-3xl md:text-4xl">{card.title}</p>
                        {card.text && <p className="mt-4 leading-relaxed font-light text-ink/60">{card.text}</p>}
                      </div>
                    ) : (
                      <article className="group">
                        {image && (
                          <div className={cn('relative overflow-hidden', dark ? 'aspect-[4/3]' : 'aspect-[4/5]')}>
                            <Image
                              src={image.src}
                              alt={image.alt}
                              fill
                              sizes="(min-width: 768px) 33vw, 100vw"
                              className={cn('object-cover', !dark && 'transition-transform duration-[1400ms] group-hover:scale-105')}
                            />
                          </div>
                        )}
                        {dark ? (
                          <>
                            {card.eyebrow && <p className="eyebrow mt-6 text-gold">{card.eyebrow}</p>}
                            <p className="mt-3 font-serif text-2xl leading-snug font-light">{card.title}</p>
                          </>
                        ) : (
                          <div className="pt-5">
                            {card.eyebrow && <p className="eyebrow text-gold-deep">{card.eyebrow}</p>}
                            <h3 className="mt-2 font-serif text-2xl">{card.title}</h3>
                            {card.text && <p className="mt-1 text-sm text-ink/50">{card.text}</p>}
                          </div>
                        )}
                      </article>
                    )}
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      );
    }
    case 'cta':
      return (
        <section className="px-6 py-24 text-center md:px-10 md:py-32">
          <div className="mx-auto max-w-2xl">
            <Eyebrow text={block.eyebrow} />
            <Title {...block} className="text-4xl leading-tight md:text-6xl" />
            {block.subtitle && <p className="mt-6 font-light text-ink/60">{block.subtitle}</p>}
            {block.buttons && block.buttons.length > 0 && (
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                {block.buttons.map((b, i) => (
                  <Button key={b.id ?? i} asChild size="lg" variant={b.style === 'outline' ? 'outline' : 'solid'}>
                    {b.href ? <Link href={localePath(locale, b.href)}>{b.label}</Link> : <span>{b.label}</span>}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>
      );
  }
}

/** Renders a page's `layout` blocks in order (05 §4). */
export function Blocks({ blocks, locale }: { blocks: Page['layout']; locale: Locale }) {
  return (blocks ?? []).map((block, i) => <BlockView key={block.id ?? i} block={block} locale={locale} first={i === 0} />);
}
