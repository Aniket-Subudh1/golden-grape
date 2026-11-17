import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import QRCode from 'qrcode';
import { hasRole } from '@/lib/access';
import { appUrl, env } from '@/lib/env';
import { dayStamp } from '@/lib/time';
import { langOf } from '@/modules/sales/admin/text';
import { getSettingsPrivate } from '@/modules/settings/service';
import type { CachedReview } from '../service';
import { RefreshReviews } from './refresh-button';

// Google reviews (/admin/reviews, M3.3 T1): the rating, the latest reviews as cached, when they were read, "Refresh
// now", and the review QR to print (PNG, SVG). Replies need Google Business Profile API access (DEP-09), not granted:
// the page links to the Business Profile instead (AC-M3.3-03).

const TEXT = {
  fr: { title: 'Avis Google', subtitle: 'La note et les derniers avis de Google Maps, lus chaque jour, et le QR qui mène au formulaire d’avis.', off: 'Le module Avis Google est éteint (Infos de la boutique › Modules et alertes).', forbidden: 'Votre rôle ne permet pas de voir cette page.', rating: 'Note', total: 'Avis', fetched: 'Lus le', never: 'jamais', lastError: 'Dernière erreur', refresh: 'Actualiser maintenant', done: 'Avis actualisés.', failed: 'Lecture impossible', setupTitle: 'Connecter Google', setup: ['Dans Google Cloud, activez « Places API (New) » et créez une clé limitée à l’adresse IP du serveur.', 'Mettez la clé dans GOOGLE_PLACES_API_KEY (fichier .env du serveur), puis redémarrez le site.', 'Dans Infos de la boutique › Modules et alertes › Avis Google, collez l’identifiant du lieu (outil « Place ID Finder » de Google).', 'Revenez ici et cliquez « Actualiser maintenant ». La section apparaît sur l’accueil dès qu’il y a des avis.'], noReviews: 'Aucun avis en mémoire.', hidden: 'Sur le site, les avis ne sont montrés que s’ils ont été lus il y a moins de 3 jours.', qrTitle: 'QR « Laisser un avis »', qrText: 'Pour les cartes de table, les tickets et les emballages. Il mène à', noLink: 'Indiquez d’abord l’identifiant du lieu (ou un lien d’avis) dans les réglages.', png: 'Télécharger en PNG', svg: 'Télécharger en SVG', replyTitle: 'Répondre aux avis', reply: 'Les réponses se font dans votre fiche Google Business Profile (l’accès à son API n’a pas été accordé).', openProfile: 'Ouvrir Google Business Profile', openMaps: 'Voir le lieu sur Google Maps' },
  en: { title: 'Google reviews', subtitle: 'The Google Maps rating and latest reviews, read daily, and the QR that leads to the review form.', off: 'The Google reviews module is switched off (Shop details › Modules and alerts).', forbidden: 'Your role cannot see this page.', rating: 'Rating', total: 'Reviews', fetched: 'Read on', never: 'never', lastError: 'Last error', refresh: 'Refresh now', done: 'Reviews refreshed.', failed: 'Could not read them', setupTitle: 'Connect Google', setup: ['In Google Cloud, enable “Places API (New)” and create a key restricted to the server’s IP address.', 'Put the key in GOOGLE_PLACES_API_KEY (the server’s .env file), then restart the site.', 'In Shop details › Modules and alerts › Google reviews, paste the place ID (Google’s “Place ID Finder”).', 'Come back here and click “Refresh now”. The section appears on the home page as soon as there are reviews.'], noReviews: 'No reviews stored.', hidden: 'On the website, reviews are shown only if they were read less than 3 days ago.', qrTitle: '“Leave a review” QR', qrText: 'For table cards, receipts and packaging. It leads to', noLink: 'Set the place ID (or a review link) in the settings first.', png: 'Download PNG', svg: 'Download SVG', replyTitle: 'Reply to reviews', reply: 'Replies are made in your Google Business Profile (access to its API was not granted).', openProfile: 'Open Google Business Profile', openMaps: 'See the place on Google Maps' },
  de: { title: 'Google-Bewertungen', subtitle: 'Die Google-Maps-Bewertung und die neuesten Bewertungen, täglich gelesen, und der QR-Code zum Bewertungsformular.', off: 'Das Modul Google-Bewertungen ist ausgeschaltet (Geschäftsdaten › Module und Warnungen).', forbidden: 'Ihre Rolle darf diese Seite nicht sehen.', rating: 'Bewertung', total: 'Bewertungen', fetched: 'Gelesen am', never: 'nie', lastError: 'Letzter Fehler', refresh: 'Jetzt aktualisieren', done: 'Bewertungen aktualisiert.', failed: 'Lesen nicht möglich', setupTitle: 'Google verbinden', setup: ['In Google Cloud „Places API (New)“ aktivieren und einen auf die Server-IP beschränkten Schlüssel anlegen.', 'Den Schlüssel in GOOGLE_PLACES_API_KEY (.env des Servers) eintragen und die Website neu starten.', 'Unter Geschäftsdaten › Module und Warnungen › Google-Bewertungen die Place ID einfügen (Googles „Place ID Finder“).', 'Hierher zurückkehren und „Jetzt aktualisieren“ klicken. Der Bereich erscheint auf der Startseite, sobald es Bewertungen gibt.'], noReviews: 'Keine Bewertungen gespeichert.', hidden: 'Auf der Website werden Bewertungen nur gezeigt, wenn sie vor weniger als 3 Tagen gelesen wurden.', qrTitle: 'QR „Bewertung schreiben“', qrText: 'Für Tischkarten, Bons und Verpackungen. Er führt zu', noLink: 'Zuerst die Place ID (oder einen Bewertungslink) in den Einstellungen eintragen.', png: 'Als PNG laden', svg: 'Als SVG laden', replyTitle: 'Auf Bewertungen antworten', reply: 'Antworten erfolgen in Ihrem Google-Unternehmensprofil (Zugang zu dessen API wurde nicht erteilt).', openProfile: 'Google-Unternehmensprofil öffnen', openMaps: 'Ort auf Google Maps ansehen' },
  pt: { title: 'Avaliações Google', subtitle: 'A nota e as últimas avaliações do Google Maps, lidas todos os dias, e o QR que leva ao formulário de avaliação.', off: 'O módulo Avaliações Google está desligado (Dados da loja › Módulos e alertas).', forbidden: 'A sua função não permite ver esta página.', rating: 'Nota', total: 'Avaliações', fetched: 'Lidas em', never: 'nunca', lastError: 'Último erro', refresh: 'Atualizar agora', done: 'Avaliações atualizadas.', failed: 'Não foi possível lê-las', setupTitle: 'Ligar o Google', setup: ['No Google Cloud, ative «Places API (New)» e crie uma chave limitada ao IP do servidor.', 'Coloque a chave em GOOGLE_PLACES_API_KEY (.env do servidor) e reinicie o site.', 'Em Dados da loja › Módulos e alertas › Avaliações Google, cole o Place ID (ferramenta «Place ID Finder» do Google).', 'Volte aqui e clique «Atualizar agora». A secção aparece na página inicial logo que haja avaliações.'], noReviews: 'Nenhuma avaliação guardada.', hidden: 'No site, as avaliações só aparecem se foram lidas há menos de 3 dias.', qrTitle: 'QR «Deixar uma avaliação»', qrText: 'Para cartões de mesa, talões e embalagens. Leva a', noLink: 'Indique primeiro o Place ID (ou uma ligação de avaliação) nas definições.', png: 'Descarregar PNG', svg: 'Descarregar SVG', replyTitle: 'Responder às avaliações', reply: 'As respostas fazem-se no seu Perfil da Empresa no Google (o acesso à sua API não foi concedido).', openProfile: 'Abrir o Perfil da Empresa', openMaps: 'Ver o local no Google Maps' },
};

export default async function ReviewsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult;
  if (req.user?.collection !== 'users') redirect('/admin/login?redirect=%2Fadmin%2Freviews');
  const lang = langOf(req.i18n.language);
  const t = TEXT[lang];
  const allowed = hasRole(req.user, ['manager']);
  const settings = await getSettingsPrivate();
  const on = settings.modules?.reviews === true;
  const cache = allowed && on ? await req.payload.findGlobal({ slug: 'ReviewsCache', depth: 0, overrideAccess: true }) : null;
  const configured = Boolean(env.GOOGLE_PLACES_API_KEY && (settings.reviews?.placeId || env.GOOGLE_PLACE_ID));
  const hasLink = Boolean(settings.reviews?.reviewUrl || cache?.writeReviewUri || settings.reviews?.placeId || env.GOOGLE_PLACE_ID);
  const short = `${appUrl()}/r`;
  const [svg, png] = hasLink ? await Promise.all([QRCode.toString(short, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }), QRCode.toDataURL(short, { margin: 2, width: 1024, errorCorrectionLevel: 'M' })]) : [null, null];
  const reviews = (cache?.reviews ?? []) as CachedReview[];

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
          ) : !on || !cache ? (
            <p className="gg-card__empty">{t.off}</p>
          ) : (
            <>
              <div className="gg-tiles">
                <div className="gg-tile">
                  <span className="gg-tile__label">{t.rating}</span>
                  <span className="gg-tile__value">{cache.rating ? `${cache.rating.toFixed(1)} ★` : '—'}</span>
                </div>
                <div className="gg-tile">
                  <span className="gg-tile__label">{t.total}</span>
                  <span className="gg-tile__value">{cache.total ?? '—'}</span>
                </div>
                <div className="gg-tile">
                  <span className="gg-tile__label">{t.fetched}</span>
                  <span className="gg-tile__value" style={{ fontSize: 18 }}>{cache.fetchedAt ? dayStamp(new Date(cache.fetchedAt)) : t.never}</span>
                  {cache.lastError && (
                    <span className="gg-tile__hint">
                      {t.lastError}: {cache.lastError}
                    </span>
                  )}
                </div>
              </div>

              {!configured && (
                <section className="gg-card">
                  <header className="gg-card__head">
                    <div>
                      <h2>{t.setupTitle}</h2>
                    </div>
                  </header>
                  <ol style={{ margin: 0, padding: '4px 20px 20px 40px', display: 'grid', gap: 8, fontSize: 14 }}>
                    {t.setup.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="gg-card">
                <header className="gg-card__head">
                  <div>
                    <h2>{t.total}</h2>
                    <p>{t.hidden}</p>
                  </div>
                  {configured && <RefreshReviews label={t.refresh} done={t.done} failed={t.failed} />}
                </header>
                {reviews.length === 0 ? (
                  <p className="gg-card__empty">{t.noReviews}</p>
                ) : (
                  <ul className="gg-list">
                    {reviews.map((r, i) => (
                      <li key={i} className="gg-list__row">
                        <span className="gg-list__text">
                          <span className="gg-list__title">
                            {'★'.repeat(r.rating)} {r.author} {r.relative ? `· ${r.relative}` : ''}
                          </span>
                          <span className="gg-list__detail">{r.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="gg-card">
                <header className="gg-card__head">
                  <div>
                    <h2>{t.qrTitle}</h2>
                    <p>
                      {t.qrText} <a href={short}>{short}</a>
                    </p>
                  </div>
                </header>
                {svg && png ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', padding: '0 20px 20px' }}>
                    {/* qrcode's own SVG of our short link. */}
                    <div style={{ width: 180 }} dangerouslySetInnerHTML={{ __html: svg }} data-testid="review-qr" />
                    <div className="gg-actions">
                      <a className="gg-btn gg-btn--primary" href={png} download="golden-grape-avis-qr.png">
                        <span>{t.png}</span>
                      </a>
                      <a className="gg-btn" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} download="golden-grape-avis-qr.svg">
                        <span>{t.svg}</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="gg-card__empty">{t.noLink}</p>
                )}
              </section>

              <section className="gg-card">
                <header className="gg-card__head">
                  <div>
                    <h2>{t.replyTitle}</h2>
                    <p>{t.reply}</p>
                  </div>
                </header>
                <div className="gg-actions" style={{ padding: '0 20px 20px' }}>
                  <a className="gg-btn" href="https://business.google.com/" target="_blank" rel="noopener noreferrer">
                    <span>{t.openProfile}</span>
                  </a>
                  {cache.mapsUri && (
                    <a className="gg-btn" href={cache.mapsUri} target="_blank" rel="noopener noreferrer">
                      <span>{t.openMaps}</span>
                    </a>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
