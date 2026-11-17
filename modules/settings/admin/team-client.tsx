'use client';

import { toast } from '@payloadcms/ui';
import { Check, KeyRound, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
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

export function TeamTable({ lang, owner, me, roles, people }: { lang: Lang; owner: boolean; me: string; roles: RoleOption[]; people: Person[] }) {
  const t = TEAM_TEXT[lang];
  const router = useRouter();
  // `null` closed, `'new'` adding, a person: editing them.
  const [open, setOpen] = useState<Person | 'new' | null>(null);
  const [key, setKey] = useState(0);
  const label = new Map(roles.map((r) => [r.value, r.label]));
  const show = (target: Person | 'new') => {
    setKey(key + 1);
    setOpen(target);
  };
  const done = () => {
    setOpen(null);
    // In place: the confirmation stays on screen while the list updates.
    router.refresh();
  };
  return (
    <section className="gg-card" data-testid="team">
      <header className="gg-card__head">
        <div>
          <h2>{t.team}</h2>
          <p>{t.teamHint}</p>
        </div>
        {owner && (
          <button
            type="button"
            className="gg-btn gg-btn--primary"
            onClick={() => show('new')}
          >
            <UserPlus />
            <span>{t.add}</span>
          </button>
        )}
      </header>
      <ul className="gg-team__people">
        {people.map((p) => (
          <li key={p.id} data-person={p.email} data-off={!p.active || undefined}>
            <span className="gg-team__avatar" aria-hidden>
              {p.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="gg-team__who">
              <b>
                {p.name}
                {p.id === me && <small> · {t.you}</small>}
              </b>
              <small>{p.email}</small>
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
              {!p.active && <span className="gg-badge gg-badge--neutral">{t.inactive}</span>}
            </span>
            {owner && (
              <button
                type="button"
                className="gg-btn"
                aria-label={`${t.edit} ${p.name}`}
                onClick={() => show(p)}
              >
                <Pencil />
                <span>{t.edit}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
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
    </section>
  );
}

export function AccessMatrix({ lang, owner, areas, grants }: { lang: Lang; owner: boolean; areas: { role: Grantable; label: string; detail: string; staff: string[] }[]; grants: Grants }) {
  const t = TEAM_TEXT[lang];
  const router = useRouter();
  const [value, setValue] = useState<Grants>(grants);
  const [busy, setBusy] = useState(false);
  // Compared as sets: the saved order may differ from the order ticked.
  const norm = (g: Grants) => JSON.stringify(Object.fromEntries(Object.entries(g).filter(([, v]) => v?.length).map(([k, v]) => [k, [...(v ?? [])].sort()]).sort()));
  const changed = norm(value) !== norm(grants);
  const has = (role: Grantable, area: Grantable) => role === area || Boolean(value[role]?.includes(area));
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
  return (
    <section className="gg-card" data-testid="access">
      <header className="gg-card__head">
        <div>
          <h2>{t.accessTitle}</h2>
          <p>{t.accessHint}</p>
        </div>
        {owner && (
          <button type="button" className="gg-btn gg-btn--primary" disabled={!changed || busy} onClick={() => void save()}>
            <ShieldCheck />
            <span>{t.saveAccess}</span>
          </button>
        )}
      </header>
      {/* Phones: one block per area, a checkbox per role (the table needs more width than a phone has). */}
      <ul className="gg-team__areas">
        {areas.map((area) => (
          <li key={area.role}>
            <b>{area.label}</b>
            <small>{area.detail}</small>
            <div className="gg-team__area-roles">
              {areas.map((col) =>
                col.role === area.role ? (
                  <span key={col.role} className="gg-team__check gg-team__own-chip">
                    <KeyRound aria-hidden /> {col.label}
                  </span>
                ) : (
                  <label key={col.role} className="gg-team__check">
                    <input type="checkbox" aria-label={`${col.label} → ${area.label}`} checked={has(col.role, area.role)} disabled={!owner} onChange={() => toggle(col.role, area.role)} />
                    <span>{col.label}</span>
                  </label>
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="gg-reorder gg-team__matrix-wrap">
        <div className="table">
          <table className="gg-team__matrix">
            <thead>
              <tr>
                <th>{t.area}</th>
                {areas.map((a) => (
                  <th key={a.role}>{a.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.role} data-area={area.role}>
                  <td>
                    <b>{area.label}</b>
                    <small>{area.detail}</small>
                    {area.staff.length > 0 && <small className="gg-team__tabs">{area.staff.join(' · ')}</small>}
                  </td>
                  {areas.map((col) => (
                    <td key={col.role} className="gg-team__cell">
                      {col.role === area.role ? (
                        <span className="gg-team__own" title={t.own}>
                          <KeyRound aria-hidden />
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`${col.label} → ${area.label}`}
                          checked={has(col.role, area.role)}
                          disabled={!owner}
                          onChange={() => toggle(col.role, area.role)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
