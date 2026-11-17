'use client';

import { toast } from '@payloadcms/ui';
import { Check, ChevronDown, Crown, KeyRound, Pencil, Search, ShieldCheck, UserCheck, UserPlus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import type { Grantable, Grants, Role } from '@/lib/access';
import { LOCALE_NAMES } from '@/lib/i18n';
import { createTeamMember, saveAccessGrants, updateTeamMember } from '../actions';
import { TEAM_TEXT } from './team-text';

// Team & access, client side (team-view.tsx): the team table with Payload's own drawer for adding or editing a person,
// and the access table. Every save goes through an owner-only action, then the page reloads with the new rules.

type Lang = 'fr' | 'en' | 'de' | 'pt';
type Person = { id: string; name: string; email: string; roles: Role[]; extra: string[]; active: boolean; locale: Lang };
type RoleOption = { value: Role; label: string; detail: string };
type Result = { ok: true } | { ok: false; error: string; message?: string; fieldErrors?: Record<string, string[]> };


function failure(t: (typeof TEAM_TEXT)['fr'], r: Exclude<Result, { ok: true }>) {
  const key = r.message ?? Object.values(r.fieldErrors ?? {})[0]?.[0] ?? '';
  return (t.errors as Record<string, string>)[key] ?? t.errors.other;
}

function PersonForm({ lang, roles, person, me, onDone, onCancel }: { lang: Lang; roles: RoleOption[]; person: Person | null; me: string; onDone: () => void; onCancel: () => void }) {
  const t = TEAM_TEXT[lang];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Role[]>(person?.roles ?? ['sales']);
  const self = person?.id === me;
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const base = { name: String(data.get('name') ?? ''), roles: picked, active: data.get('active') === 'on', locale: String(data.get('locale')) as Lang };
    setBusy(true);
    setError('');
    const res: Result = person
      ? await updateTeamMember(null, { id: person.id, ...base, password: String(data.get('password') ?? '') })
      : await createTeamMember(null, { ...base, email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') });
    setBusy(false);
    if (!res.ok) return setError(failure(t, res));
    toast.success(person ? t.saved : t.created);
    onDone();
  }
  return (
    <form
      className="gg-team__form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <header className="gg-team__form-head">
        <h2>{person ? `${t.edit} · ${person.name}` : t.add}</h2>
        {person && <p>{person.email}</p>}
      </header>
      <label>
        <span>{t.name}</span>
        <input name="name" required minLength={2} maxLength={80} defaultValue={person?.name} autoComplete="off" />
      </label>
      {!person && (
        <label>
          <span>{t.email}</span>
          <input name="email" type="email" required maxLength={200} autoComplete="off" />
        </label>
      )}
      <div className="gg-team__field">
        <label>
          <span>{person ? t.newPassword : t.password}</span>
          {/* Its own box: the reveal eye (password-toggle.tsx) centres on the input's parent. */}
          <span className="gg-team__pw">
            <input name="password" type="password" minLength={10} maxLength={200} required={!person} autoComplete="new-password" aria-describedby="gg-team-pw" />
          </span>
        </label>
        <small id="gg-team-pw">{t.passwordHint}</small>
      </div>
      <fieldset>
        <legend>{t.roles}</legend>
        {roles.map((r) => (
          <label key={r.value} className="gg-team__check">
            <input
              type="checkbox"
              checked={picked.includes(r.value)}
              disabled={self && r.value === 'admin'}
              onChange={(e) => setPicked(e.target.checked ? [...picked, r.value] : picked.filter((x) => x !== r.value))}
            />
            <span>
              <b>{r.label}</b>
              <small> · {r.detail.split(':')[1]?.trim()}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="gg-team__row">
        <label>
          <span>{t.language}</span>
          <select name="locale" defaultValue={person?.locale ?? lang}>
            {(Object.keys(LOCALE_NAMES) as Lang[]).map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="gg-team__check">
          <input name="active" type="checkbox" defaultChecked={person?.active ?? true} disabled={self} />
          <span>{t.active}</span>
        </label>
        {self && <input type="hidden" name="active" value="on" />}
      </div>
      {error && (
        <p className="gg-team__error" role="alert">
          {error}
        </p>
      )}
      <footer className="gg-team__form-foot">
        <button type="button" className="gg-btn" onClick={onCancel}>
          <span>{t.cancel}</span>
        </button>
        <button type="submit" className="gg-btn gg-btn--primary" disabled={busy || picked.length === 0}>
          <Check />
          <span>{busy ? t.saving : person ? t.save : t.create}</span>
        </button>
      </footer>
    </form>
  );
}

type Opens = { label: string; off: boolean }[];
export type Area = { role: Grantable; label: string; detail: string; members: number; staff: Opens; admin: Opens };

/** What a role opens with these areas: a screen opens if any of its areas opens it (lib/access.ts, `hasRole`). */
const union = (lists: Opens[]) => {
  const seen = new Map<string, boolean>();
  for (const list of lists) for (const item of list) seen.set(item.label, (seen.get(item.label) ?? true) && item.off);
  return [...seen].map(([label, off]) => ({ label, off }));
};

function Chips({ items, empty, testid }: { items: Opens; empty: string; testid: string }) {
  return (
    <ul className="gg-team__chips" data-testid={testid}>
      {items.length ? items.map((s) => <li key={s.label} data-off={s.off || undefined}>{s.label}</li>) : <li data-off>{empty}</li>}
    </ul>
  );
}

/**
 * Team & access (/admin/team): the figures, then two tabs. People: search, filter by role, add and edit in the
 * shared pop-up. Roles & access: a card per role with switches for the other areas it may also use, what it opens
 * (worked out live from the switches), and a bar to save or discard the changes.
 */
export function TeamPage({ lang, owner, me, roles, people, areas, grants, initialTab }: { lang: Lang; owner: boolean; me: string; roles: RoleOption[]; people: Person[]; areas: Area[]; grants: Grants; initialTab: 'people' | 'access' }) {
  const t = TEAM_TEXT[lang];
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  // People
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Role | 'all'>('all');
  const [open, setOpen] = useState<Person | 'new' | null>(null);
  const [key, setKey] = useState(0);
  const label = new Map(roles.map((r) => [r.value, r.label]));
  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => (filter === 'all' || p.roles.includes(filter)) && (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
  const show = (target: Person | 'new') => {
    setKey(key + 1);
    setOpen(target);
  };
  const done = () => {
    setOpen(null);
    // In place: the confirmation stays on screen while the list updates.
    router.refresh();
  };
  // Access
  const [value, setValue] = useState<Grants>(grants);
  const [busy, setBusy] = useState(false);
  const norm = (g: Grants) => JSON.stringify(Object.fromEntries(Object.entries(g).filter(([, v]) => v?.length).map(([k, v]) => [k, [...(v ?? [])].sort()]).sort()));
  const changed = norm(value) !== norm(grants);
  const toggle = (role: Grantable, area: Grantable) => {
    const now = value[role] ?? [];
    setValue({ ...value, [role]: now.includes(area) ? now.filter((a) => a !== area) : [...now, area] });
  };
  async function save() {
    setBusy(true);
    const res = await saveAccessGrants(null, { grants: value as Record<string, string[]> });
    setBusy(false);
    if (!res.ok) return void toast.error(failure(t, res));
    toast.success(t.accessSaved);
    router.refresh();
  }
  const byRole = new Map(areas.map((a) => [a.role, a]));

  const stats = [
    { icon: <Users />, label: t.statPeople, value: people.length },
    { icon: <UserCheck />, label: t.statActive, value: people.filter((p) => p.active).length },
    { icon: <Crown />, label: t.statOwners, value: people.filter((p) => p.roles.includes('admin')).length },
  ];

  return (
    <>
      <div className="gg-team__stats">
        {stats.map((s) => (
          <div key={s.label} className="gg-team__stat">
            <span className="gg-team__stat-icon">{s.icon}</span>
            <span>
              <b>{s.value}</b>
              <small>{s.label}</small>
            </span>
          </div>
        ))}
      </div>

      <nav className="gg-tabs gg-team__tabs" role="tablist" aria-label={t.title}>
        {(['people', 'access'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className="gg-tabs__tab" data-active={tab === k || undefined} onClick={() => setTab(k)}>
            {k === 'people' ? t.tabPeople : t.tabAccess}
            {k === 'people' && <span className="gg-tabs__count">{people.length}</span>}
          </button>
        ))}
      </nav>

      {!owner && <div className="gg-callout gg-team__note">{t.readOnly}</div>}

      {tab === 'people' ? (
        <section className="gg-card gg-team__panel" data-testid="team">
          <div className="gg-team__toolbar">
            <label className="gg-team__search">
              <Search aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} />
            </label>
            <div className="gg-team__filters" role="group" aria-label={t.roles}>
              {(['all', ...roles.map((r) => r.value)] as const).map((r) => (
                <button key={r} type="button" className="gg-team__filter" aria-pressed={filter === r} onClick={() => setFilter(r)}>
                  {r === 'all' ? t.all : label.get(r)}
                </button>
              ))}
            </div>
            {owner && (
              <button type="button" className="gg-btn gg-btn--primary gg-team__add" onClick={() => show('new')}>
                <UserPlus />
                <span>{t.add}</span>
              </button>
            )}
          </div>
          <div className="gg-team__head" aria-hidden>
            <span>{t.person}</span>
            <span>{t.roles}</span>
            <span>{t.status}</span>
            <span />
          </div>
          {shown.length === 0 ? (
            <p className="gg-card__empty">{t.noMatch}</p>
          ) : (
            <ul className="gg-team__people">
              {shown.map((p) => (
                <li key={p.id} data-person={p.email} data-off={!p.active || undefined}>
                  <span className="gg-team__who">
                    <span className="gg-team__avatar" aria-hidden>
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="gg-team__id">
                      <b>
                        {p.name}
                        {p.id === me && <small className="gg-team__you">{t.you}</small>}
                      </b>
                      <small>{p.email}</small>
                    </span>
                  </span>
                  <span className="gg-team__roles">
                    {p.roles.map((r) => (
                      <span key={r} className={`gg-badge ${r === 'admin' ? 'gg-badge--warning' : 'gg-badge--info'}`}>
                        {label.get(r)}
                      </span>
                    ))}
                    {p.extra.length > 0 && (
                      <span className="gg-team__extra">
                        + {t.extra} {p.extra.join(', ')}
                      </span>
                    )}
                  </span>
                  <span className="gg-team__status">
                    <span className={`gg-badge ${p.active ? 'gg-badge--success' : 'gg-badge--neutral'}`}>{p.active ? t.statusActive : t.inactive}</span>
                  </span>
                  <span className="gg-team__act">
                    {owner && (
                      <button type="button" className="gg-btn" aria-label={`${t.edit} ${p.name}`} onClick={() => show(p)}>
                        <Pencil />
                        <span>{t.edit}</span>
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="gg-team__panel" data-testid="access">
          <p className="gg-team__intro">{t.accessHint}</p>
          <div className="gg-team__cards">
            <article className="gg-card gg-team__card gg-team__card--owner">
              <header>
                <span className="gg-team__card-icon">
                  <Crown aria-hidden />
                </span>
                <div>
                  <h3>{label.get('admin')}</h3>
                  <p>{t.ownerHint}</p>
                </div>
                <span className="gg-team__members">{t.members(people.filter((p) => p.roles.includes('admin')).length)}</span>
              </header>
            </article>
            {areas.map((a) => {
              const given = (value[a.role] ?? []).filter((x) => x !== a.role);
              const lists = [a, ...given.map((g) => byRole.get(g)!)];
              const staff = union(lists.map((l) => l.staff));
              const admin = union(lists.map((l) => l.admin));
              return (
                <article key={a.role} className="gg-card gg-team__card" data-role={a.role}>
                  <header>
                    <span className="gg-team__card-icon">
                      <KeyRound aria-hidden />
                    </span>
                    <div>
                      <h3>
                        {a.label}
                        {given.length > 0 && (
                          <span className="gg-team__extra">
                            + {t.extra} {given.map((g) => byRole.get(g)!.label).join(', ')}
                          </span>
                        )}
                      </h3>
                      <p>{a.detail}</p>
                    </div>
                    <span className="gg-team__members">{t.members(a.members)}</span>
                  </header>
                  <div className="gg-team__also">
                    <p>{t.alsoHint}</p>
                    <div className="gg-team__switches">
                      {areas
                        .filter((o) => o.role !== a.role)
                        .map((o) => (
                          <label key={o.role} className="gg-switch">
                            <input type="checkbox" role="switch" aria-label={`${a.label} → ${o.label}`} checked={given.includes(o.role)} disabled={!owner} onChange={() => toggle(a.role, o.role)} />
                            <span className="gg-switch__track" aria-hidden />
                            <span className="gg-switch__text">
                              <b>{o.label}</b>
                              <small>{o.detail}</small>
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                  <details className="gg-team__opens">
                    <summary>
                      <ChevronDown aria-hidden />
                      <span>{t.showWhat}</span>
                      <small>{t.opensSummary(staff.length, admin.length)}</small>
                    </summary>
                    <p className="gg-team__what">{t.staffApp}</p>
                    <Chips items={staff} empty={t.nothing} testid={`opens-staff-${a.role}`} />
                    <p className="gg-team__what">{t.adminArea}</p>
                    <Chips items={admin} empty={t.nothing} testid={`opens-admin-${a.role}`} />
                  </details>
                </article>
              );
            })}
          </div>
          {owner && changed && (
            <div className="gg-team__savebar" role="region" aria-label={t.unsaved}>
              <span>
                <ShieldCheck aria-hidden />
                {t.unsaved}
              </span>
              <span className="gg-team__savebar-actions">
                <button type="button" className="gg-btn" disabled={busy} onClick={() => setValue(grants)}>
                  {t.discard}
                </button>
                <button type="button" className="gg-btn gg-btn--primary" disabled={busy} onClick={() => void save()}>
                  <Check />
                  <span>{busy ? t.saving : t.saveChanges}</span>
                </button>
              </span>
            </div>
          )}
        </section>
      )}

      {owner && (
        // The shared pop-up (animated in and out, Escape, scroll kept still), styled for the admin: a centred card on
        // a laptop, a sheet from the bottom on a phone (custom.css, `.gg-admin-modal`).
        <Sheet
          open={open !== null}
          onOpenChange={(v) => !v && setOpen(null)}
          label={open === 'new' ? t.add : open ? `${t.edit} · ${open.name}` : t.add}
          closeLabel={t.close}
          variant="center"
          className="gg-admin-modal__panel"
          dialogClassName="gg-admin-modal"
        >
          {open && <PersonForm key={key} lang={lang} roles={roles} person={open === 'new' ? null : open} me={me} onDone={done} onCancel={() => setOpen(null)} />}
        </Sheet>
      )}
    </>
  );
}
