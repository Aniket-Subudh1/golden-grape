import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import { hasRole } from '@/lib/access';
import { formatMoney } from '@/lib/money';
import { langOf } from '@/modules/sales/admin/text';
import { isModuleOn } from '@/modules/settings/service';
import { bySupplier, reorderList } from '../service';
import { ReorderForm } from './reorder-form';

// "À recommander" (/admin/reorder, M3.1 T4): low-stock sizes grouped by their cheapest supplier, with the suggested
// quantity in that supplier's unit. A suggestion only; managers turn the ticked rows into a draft purchase order.

const TEXT = {
  fr: { title: 'À recommander', subtitle: 'Les articles en stock bas, avec le fournisseur le moins cher et la quantité suggérée (deux fois le seuil, moins le stock). Rien n’est commandé automatiquement.', none: 'Rien à recommander : aucun article n’a atteint son seuil.', noSupplier: 'Sans fournisseur connu', noSupplierHelp: 'Ajoutez un prix d’achat (Achats › Prix d’achat) pour qu’il soit proposé.', forbidden: 'Votre rôle ne permet pas de voir cette page.', off: 'Le module Achats est éteint (Infos de la boutique › Modules et alertes).', item: 'Article', onHand: 'En stock', level: 'Seuil', buy: 'À commander', cost: 'Prix d’achat HT', create: 'Créer une commande brouillon', creating: 'Création…', error: 'La commande n’a pas pu être créée.', noneSelected: 'Cochez au moins un article.' },
  en: { title: 'To reorder', subtitle: 'Items low on stock, with the cheapest supplier and the suggested quantity (twice the level, minus the stock). Nothing is ordered automatically.', none: 'Nothing to reorder: no item has reached its level.', noSupplier: 'No known supplier', noSupplierHelp: 'Add a purchase price (Purchasing › Purchase prices) for it to be offered.', forbidden: 'Your role cannot see this page.', off: 'The Purchasing module is switched off (Shop details › Modules and alerts).', item: 'Item', onHand: 'In stock', level: 'Level', buy: 'To order', cost: 'Purchase price excl. VAT', create: 'Create a draft purchase order', creating: 'Creating…', error: 'The order could not be created.', noneSelected: 'Tick at least one item.' },
  de: { title: 'Nachbestellen', subtitle: 'Artikel mit niedrigem Bestand, mit dem günstigsten Lieferanten und der vorgeschlagenen Menge (doppelte Schwelle minus Bestand). Nichts wird automatisch bestellt.', none: 'Nichts nachzubestellen: kein Artikel hat seine Schwelle erreicht.', noSupplier: 'Kein Lieferant bekannt', noSupplierHelp: 'Fügen Sie einen Einkaufspreis hinzu (Einkauf › Einkaufspreise), damit er vorgeschlagen wird.', forbidden: 'Ihre Rolle darf diese Seite nicht sehen.', off: 'Das Modul Einkauf ist ausgeschaltet (Geschäftsdaten › Module und Warnungen).', item: 'Artikel', onHand: 'Auf Lager', level: 'Schwelle', buy: 'Zu bestellen', cost: 'Einkaufspreis netto', create: 'Bestellentwurf anlegen', creating: 'Wird angelegt…', error: 'Die Bestellung konnte nicht angelegt werden.', noneSelected: 'Mindestens einen Artikel ankreuzen.' },
  pt: { title: 'A encomendar', subtitle: 'Artigos com stock baixo, com o fornecedor mais barato e a quantidade sugerida (o dobro do nível, menos o stock). Nada é encomendado automaticamente.', none: 'Nada a encomendar: nenhum artigo atingiu o nível.', noSupplier: 'Sem fornecedor conhecido', noSupplierHelp: 'Junte um preço de compra (Compras › Preços de compra) para que seja proposto.', forbidden: 'A sua função não permite ver esta página.', off: 'O módulo Compras está desligado (Dados da loja › Módulos e alertas).', item: 'Artigo', onHand: 'Em stock', level: 'Nível', buy: 'A encomendar', cost: 'Preço de compra s/ IVA', create: 'Criar encomenda em rascunho', creating: 'A criar…', error: 'Não foi possível criar a encomenda.', noneSelected: 'Assinale pelo menos um artigo.' },
};

export default async function ReorderView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult;
  if (req.user?.collection !== 'users') redirect('/admin/login?redirect=%2Fadmin%2Freorder');
  const lang = langOf(req.i18n.language);
  const t = TEXT[lang];
  const allowed = hasRole(req.user, ['manager', 'stock']);
  const on = await isModuleOn('purchasing');
  const groups = allowed && on ? bySupplier(await reorderList(req.payload, lang)) : [];
  const canCreate = hasRole(req.user, ['manager']);

  return (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user} visibleEntities={visibleEntities}>
      <Gutter>
        <div className="gg-home">
          <div className="gg-home__title">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          {!allowed ? (
            <p className="gg-card__empty">{t.forbidden}</p>
          ) : !on ? (
            <p className="gg-card__empty">{t.off}</p>
          ) : groups.length === 0 ? (
            <p className="gg-card__empty">{t.none}</p>
          ) : (
            groups.map((g) => (
              <section key={g.id ?? 'none'} className="gg-card">
                <header className="gg-card__head">
                  <div>
                    <h2>{g.name ?? t.noSupplier}</h2>
                    {!g.id && <p>{t.noSupplierHelp}</p>}
                  </div>
                </header>
                <ReorderForm
                  supplier={g.id ?? ''}
                  canCreate={canCreate && Boolean(g.id)}
                  t={t}
                  money={Object.fromEntries(g.rows.map((r) => [r.variant, r.offer ? formatMoney(r.offer.costCents, lang) : '']))}
                  rows={g.rows.map((r) => ({ variant: r.variant, name: r.name, sku: r.sku, onHand: r.onHand, threshold: r.threshold, unit: r.offer?.unit ?? null, costCents: r.offer?.costCents ?? null, suggested: r.suggested }))}
                />
              </section>
            ))
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
