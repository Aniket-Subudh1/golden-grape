'use client';

import { LogOut, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { LOCALE_NAMES, LOCALES, type Dictionary } from '@/lib/i18n';
import type { CustomerAddress } from '../service';
import { changePasswordAction, deleteAddressAction, saveAddressAction, setDefaultAddressAction, signOutAction, updateProfileAction } from '../actions';

type T = Dictionary['account'];
type Messages = Dictionary['form'];
const merge = (m: Messages, t: T, success?: string) => ({ ...m, success, fields: { ...m.fields, ...t.errors } });

type Profile = { name: string; phone?: string | null; locale: string; marketingConsent?: boolean | null; type: string; company?: string | null; vatNumber?: string | null };

export function ProfileForm({ t, m, profile }: { t: T; m: Messages; profile: Profile }) {
  const router = useRouter();
  return (
    <ActionForm action={updateProfileAction} messages={merge(m, t, t.saved)} keepValues onSuccess={() => router.refresh()} className="space-y-6">
      <div className="grid items-end gap-6 sm:grid-cols-2">
        <Field label={t.fields.name} name="name" defaultValue={profile.name} autoComplete="name" required size="lg" />
        <Field label={t.fields.phone} name="phone" defaultValue={profile.phone ?? ''} type="tel" autoComplete="tel" size="lg" />
      </div>
      {profile.type === 'business' && (
        <div className="grid items-end gap-6 sm:grid-cols-2">
          <Field label={t.fields.company} name="company" defaultValue={profile.company ?? ''} autoComplete="organization" required size="lg" />
          <Field label={t.fields.vatNumber} name="vatNumber" defaultValue={profile.vatNumber ?? ''} required size="lg" />
        </div>
      )}
      <Field as="select" label={t.fields.locale} name="locale" defaultValue={profile.locale} size="lg">
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </Field>
      <label className="flex items-start gap-3 text-sm text-ink/70">
        <input type="checkbox" name="marketingConsent" defaultChecked={Boolean(profile.marketingConsent)} className="mt-1 accent-gold-deep" />
        {t.fields.marketing}
      </label>
      <SubmitButton label={t.save} pendingLabel={t.saving} />
    </ActionForm>
  );
}

export function PasswordForm({ t, m }: { t: T; m: Messages }) {
  return (
    <ActionForm action={changePasswordAction} messages={merge(m, t, t.passwordSaved)} className="space-y-6">
      <Field label={t.fields.current} name="current" type="password" autoComplete="current-password" required size="lg" />
      <div className="grid items-end gap-6 sm:grid-cols-2">
        <Field label={t.fields.newPassword} name="password" type="password" autoComplete="new-password" minLength={8} required size="lg" />
        <Field label={t.fields.confirm} name="confirm" type="password" autoComplete="new-password" required size="lg" />
      </div>
      <SubmitButton label={t.changePassword} pendingLabel={t.saving} variant="outline" />
    </ActionForm>
  );
}

function AddressForm({ t, m, address, onDone, first }: { t: T; m: Messages; address?: CustomerAddress; onDone: () => void; first: boolean }) {
  const router = useRouter();
  return (
    <ActionForm
      action={saveAddressAction}
      messages={merge(m, t, t.addressSaved)}
      onSuccess={() => {
        onDone();
        router.refresh();
      }}
      className="space-y-6 border border-border bg-bone p-6 md:p-8"
    >
      {address?.id && <input type="hidden" name="id" value={address.id} />}
      <div className="grid items-end gap-6 sm:grid-cols-2">
        <Field label={t.fields.addressLabel} name="label" defaultValue={address?.label ?? ''} placeholder={t.addressLabelPh} />
        <Field label={t.fields.country} name="country" defaultValue={address?.country ?? 'LU'} maxLength={2} autoComplete="country" required />
      </div>
      <Field label={t.fields.line1} name="line1" defaultValue={address?.line1 ?? ''} autoComplete="address-line1" required />
      <Field label={t.fields.line2} name="line2" defaultValue={address?.line2 ?? ''} autoComplete="address-line2" />
      <div className="grid gap-6 sm:grid-cols-[1fr_2fr]">
        <Field label={t.fields.postalCode} name="postalCode" defaultValue={address?.postalCode ?? ''} autoComplete="postal-code" required />
        <Field label={t.fields.city} name="city" defaultValue={address?.city ?? ''} autoComplete="address-level2" required />
      </div>
      {!first && (
        <label className="flex items-center gap-3 text-sm text-ink/70">
          <input type="checkbox" name="isDefault" defaultChecked={Boolean(address?.isDefault)} className="accent-gold-deep" />
          {t.makeDefault}
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <SubmitButton label={t.saveAddress} pendingLabel={t.saving} />
        <Button type="button" variant="outline" onClick={onDone}>
          {t.cancel}
        </Button>
      </div>
    </ActionForm>
  );
}

export function AddressBook({ t, m, addresses }: { t: T; m: Messages; addresses: CustomerAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(addresses.length === 0 ? 'new' : null);
  const [pending, start] = useTransition();

  const run = (action: typeof deleteAddressAction, id: string, message: string) =>
    start(async () => {
      const result = await action(null, { id });
      if (result.ok) {
        toast.success(message);
        router.refresh();
      } else toast.error(m.error);
    });

  return (
    <div className="space-y-4">
      {addresses.map((a) =>
        editing === a.id ? (
          <AddressForm key={a.id} t={t} m={m} address={a} first={false} onDone={() => setEditing(null)} />
        ) : (
          <article key={a.id} className="flex flex-col gap-4 border border-border bg-bone p-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" />
              <div>
                <p className="flex flex-wrap items-center gap-2 font-serif text-xl">
                  {a.label || t.address}
                  {a.isDefault && <span className="eyebrow bg-gold/20 px-2 py-0.5 text-[9px] text-gold-deep">{t.default}</span>}
                </p>
                <p className="mt-1 text-sm leading-relaxed font-light text-ink/70">
                  {a.line1}
                  {a.line2 && <>, {a.line2}</>}
                  <br />
                  {a.postalCode} {a.city} · {a.country}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {!a.isDefault && (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => a.id && run(setDefaultAddressAction, a.id, t.defaultSet)}>
                  <Star className="h-3.5 w-3.5" /> {t.makeDefaultShort}
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(a.id ?? null)}>
                <Pencil className="h-3.5 w-3.5" /> {t.edit}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => a.id && window.confirm(t.confirmDelete) && run(deleteAddressAction, a.id, t.addressDeleted)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t.delete}
              </Button>
            </div>
          </article>
        ),
      )}
      {editing === 'new' ? (
        <AddressForm t={t} m={m} first={addresses.length === 0} onDone={() => setEditing(addresses.length === 0 ? 'new' : null)} />
      ) : (
        <Button variant="outline" onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" /> {t.addAddress}
        </Button>
      )}
    </div>
  );
}

export function SignOutButton({ label, home }: { label: string; home: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOutAction(null, {});
          router.replace(home);
          router.refresh();
        })
      }
      className="eyebrow inline-flex items-center gap-2 text-ink/50 transition hover:text-gold-deep"
    >
      <LogOut className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
