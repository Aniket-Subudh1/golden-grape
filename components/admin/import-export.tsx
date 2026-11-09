import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps, Field } from 'payload';
import { hasRole } from '@/lib/access';
import CatalogueFiles, { type FieldOptions } from '@/modules/catalogue/admin/catalogue-files';
import { TEMPLATE_COLUMNS } from '@/modules/catalogue/import';
import StockFiles from '@/modules/inventory/admin/stock-files';
import { adminText } from './text';

// The back-office Import / Export page (`admin.components.views.importExport`, /admin/import-export): products in and
// out as spreadsheets, a stock count from a file, the stock movements as CSV (client request, 7 Nov). Managers and
// stock staff; every action checks the role again on the server.

type Lang = 'fr' | 'en' | 'de' | 'pt';
type Option = { value: string; label: Record<Lang, string> };

/** The options of a select field of the products collection, with the labels staff see in its form. */
function optionsOf(fields: Field[], path: string[]): Option[] {
  for (const field of fields) {
    if ('name' in field && field.name === path[0]) {
      if (path.length > 1 && 'fields' in field) return optionsOf(field.fields, path.slice(1));
      if (field.type === 'select') return field.options.map((o) => (typeof o === 'string' ? { value: o, label: { fr: o, en: o, de: o, pt: o } } : { value: o.value, label: o.label as Record<Lang, string> }));
    } else if ('fields' in field && !('name' in field)) {
      const found = optionsOf(field.fields, path);
      if (found.length) return found;
    } else if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const found = optionsOf(tab.fields, path);
        if (found.length) return found;
      }
    }
  }
  return [];
}

export default async function ImportExportView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult;
  if (req.user?.collection !== 'users') redirect('/admin/login?redirect=%2Fadmin%2Fimport-export');
  const t = adminText(req.i18n.language).importExport;
  const allowed = hasRole(req.user, ['manager', 'stock']);

  let columns: string[] = [];
  let options: FieldOptions | null = null;
  if (allowed) {
    const fields = req.payload.collections.products.config.fields;
    const { docs: categories } = await req.payload.find({ collection: 'categories', sort: 'order', limit: 0, depth: 0, locale: 'all', overrideAccess: true, select: { slug: true, name: true } });
    // Suppliers are kept by the command-line import only, until purchasing (M3.1) has a place for them.
    columns = TEMPLATE_COLUMNS.filter((c) => c !== 'supplier' && c !== 'supplier_ref');
    options = {
      kind: optionsOf(fields, ['kind']),
      vat_class: optionsOf(fields, ['vatClass']),
      status: optionsOf(fields, ['status']),
      colour: optionsOf(fields, ['wine', 'colour']),
      category_slug: categories.map((c) => ({ value: c.slug, label: c.name as unknown as Record<Lang, string> })),
    };
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <div className="gg-home">
          <div className="gg-home__title">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          {options ? (
            <>
              <CatalogueFiles columns={columns} options={options} />
              <StockFiles />
            </>
          ) : (
            <p className="gg-card__empty">{t.forbidden}</p>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
