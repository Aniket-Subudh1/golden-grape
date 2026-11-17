'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { staffSignInAction } from '@/modules/settings/actions';

type Texts = { email: string; password: string; submit: string; pending: string; show: string; hide: string };

/** Staff sign-in: on success, back to the screen that asked for it (`next`, always under /staff). */
export function LoginForm({
  next,
  t,
  messages,
}: {
  next: string;
  t: Texts;
  messages: { error: string; fields: Record<string, string> } & Record<string, unknown>;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  return (
    <ActionForm
      action={staffSignInAction}
      messages={messages}
      onSuccess={() => {
        router.replace(next);
        router.refresh();
      }}
      className="space-y-5"
    >
      <Field
        label={t.email}
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        size="lg"
        look="box"
      />
      <Field
        label={t.password}
        name="password"
        type={shown ? 'text' : 'password'}
        autoComplete="current-password"
        required
        size="lg"
        look="box"
        trailing={
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-label={shown ? t.hide : t.show}
            aria-pressed={shown}
            className="text-ink/55 hover:text-ink grid h-9 w-9 place-items-center rounded-md"
          >
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <SubmitButton
        label={t.submit}
        pendingLabel={t.pending}
        className="h-11 w-full rounded-md text-sm font-medium tracking-normal normal-case"
      />
    </ActionForm>
  );
}
