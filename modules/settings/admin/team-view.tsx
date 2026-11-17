import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps, Payload } from 'payload';
import { SCREENS, type Screen } from '@/app/(staff)/staff/screens';
import { GROUPS } from '@/components/admin/nav';
import { adminText } from '@/components/admin/text';
import { getDictionary } from '@/lib/i18n';
import { effectiveRoles, GRANTABLE, type Grants, hasRole, type Role, ROLES } from '@/lib/access';
import { langOf } from '@/modules/sales/admin/text';
import { getSettingsPrivate } from '../service';
import { ROLE_LABELS } from '../collections';
import { AccessMatrix, TeamTable } from './team-client';
import { TEAM_TEXT } from './team-text';

// Team & access (/admin/team): the team (add a person, change roles, switch off, a new password), the areas each
// role is given (Settings `access.grants`, enforced by lib/access.ts through every account's effective roles), and
// what each role then opens, read from the same rules the app enforces: the staff screens (screens.ts) and the back
// office menu with each section's own visibility rule. Owners change it; managers read it.

type Lang = 'fr' | 'en' | 'de' | 'pt';

/** The menu sections a person with these effective roles sees, by the same rules as the menu (nav.tsx). */
function adminSections(payload: Payload, roles: Role[], lang: Lang, modules: Record<string, unknown>) {
  const user = { collection: 'users', roles, effectiveRoles: roles };
  const t = adminText(lang).nav;
  const visible = (i: (typeof GROUPS)[number]['items'][number]) => {
    if (i.path) return hasRole(user, i.roles ?? []);
    const config = i.global ? payload.config.globals.find((g) => g.slug === i.slug) : payload.config.collections.find((c) => c.slug === i.slug);
    const hidden = config?.admin?.hidden;
    return Boolean(config) && !(typeof hidden === 'function' ? hidden({ user: user as never }) : hidden);
  };
  return GROUPS.flatMap((g) => g.items.filter(visible).map((i) => ({ label: t[i.label], off: Boolean(i.module && modules[i.module] !== true) })));
}

/** The team app's screens a person with these effective roles opens (screens.ts), home left out. */
function staffScreens(roles: Role[], lang: Lang, modules: Record<string, unknown>, tabs: Record<string, string>) {
  const user = { collection: 'users', roles, effectiveRoles: roles };
  return (Object.keys(SCREENS) as Screen[])
    .filter((s) => s !== 'home' && s !== 'stock' && hasRole(user, SCREENS[s].roles))
    .map((s) => {
      const needs = 'module' in SCREENS[s] ? (SCREENS[s] as { module: string }).module : null;
      return { label: tabs[s] ?? s, off: Boolean(needs && modules[needs] !== true) };
    });
}

export default async function TeamView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, locale, visibleEntities } = initPageResult;
  if (req.user?.collection !== 'users') redirect('/admin/login?redirect=%2Fadmin%2Fteam');
  const lang = langOf(req.i18n.language) as Lang;
  const t = TEAM_TEXT[lang];
  const canRead = hasRole(req.user, ['manager']);
  const owner = hasRole(req.user, ['admin']);
  const [settings, people, dict] = await Promise.all([
    getSettingsPrivate(),
    canRead ? req.payload.find({ collection: 'users', sort: 'name', limit: 0, pagination: false, depth: 0, overrideAccess: true }) : null,
    getDictionary(lang),
  ]);
  const grants = (settings.access?.grants ?? {}) as Grants;
  const modules = (settings.modules ?? {}) as Record<string, unknown>;
  const label = (r: Role) => ROLE_LABELS[r][lang].split(':')[0];
  const roles = ROLES.map((r) => ({ value: r, label: label(r), detail: ROLE_LABELS[r][lang] }));
  const opens = GRANTABLE.map((r) => {
    const eff = effectiveRoles([r], grants);
    return { role: r, label: label(r), extra: eff.filter((x) => x !== r).map(label), staff: staffScreens(eff, lang, modules, dict.staff.tabs as Record<string, string>), admin: adminSections(req.payload, eff, lang, modules) };
  });
  const areas = GRANTABLE.map((r) => ({
    role: r,
    label: label(r),
    detail: ROLE_LABELS[r][lang].split(':')[1]?.trim() ?? '',
    staff: staffScreens([r], lang, modules, dict.staff.tabs as Record<string, string>).map((s) => s.label),
  }));

  return (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user} visibleEntities={visibleEntities}>
      <Gutter>
        <div className="gg-home gg-team">
          <div className="gg-home__title">
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          {!canRead || !people ? (
            <p className="gg-card__empty">{adminText(lang).importExport.forbidden}</p>
          ) : (
            <>
              {!owner && <div className="gg-callout">{t.readOnly}</div>}
              <TeamTable
                lang={lang}
                owner={owner}
                me={req.user.id}
                roles={roles}
                people={people.docs.map((p) => ({
                  id: p.id,
                  name: p.name ?? '',
                  email: p.email,
                  roles: (p.roles ?? []) as Role[],
                  extra: (p.effectiveRoles ?? []).filter((r) => !(p.roles ?? []).includes(r)).map((r) => label(r as Role)),
                  active: p.active !== false,
                  locale: (p.locale ?? 'fr') as Lang,
                }))}
              />
              <AccessMatrix lang={lang} owner={owner} areas={areas} grants={grants} />
              <section className="gg-card" data-testid="role-opens">
                <header className="gg-card__head">
                  <div>
                    <h2>{t.opensTitle}</h2>
                    <p>{t.opensHint}</p>
                  </div>
                </header>
                <div className="gg-team__opens">
                  {opens.map((o) => (
                    <article key={o.role} className="gg-team__role" data-role={o.role}>
                      <h3>
                        {o.label}
                        {o.extra.length > 0 && (
                          <span className="gg-team__extra">
                            + {t.extra} {o.extra.join(', ')}
                          </span>
                        )}
                      </h3>
                      <p className="gg-team__what">{t.staffApp}</p>
                      <ul className="gg-team__chips" data-testid={`opens-staff-${o.role}`}>
                        {o.staff.length ? o.staff.map((s) => <li key={s.label} data-off={s.off || undefined} title={s.off ? t.moduleOff : undefined}>{s.label}</li>) : <li data-off>{t.nothing}</li>}
                      </ul>
                      <p className="gg-team__what">{t.adminArea}</p>
                      <ul className="gg-team__chips" data-testid={`opens-admin-${o.role}`}>
                        {o.admin.length ? o.admin.map((s) => <li key={s.label} data-off={s.off || undefined} title={s.off ? t.moduleOff : undefined}>{s.label}</li>) : <li data-off>{t.nothing}</li>}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>
              <p className="gg-team__more">
                <Link href="/admin/collections/users">{t.allAccounts}</Link>
              </p>
            </>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  );
}
