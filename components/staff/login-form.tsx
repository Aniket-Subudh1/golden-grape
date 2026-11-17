'use client';

import { useRouter } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { staffSignInAction } from '@/modules/settings/actions';

type Texts = { email: string; password: string; submit: string; pending: string };

/** Staff sign-in: on success, back to the screen that asked for it (`next`, always under /staff). */
export function LoginForm({ next, t, messages }: { next: string; t: Texts; messages: { error: string; fields: Record<string, string> } & Record<string, unknown> }) {
  const router = useRouter();
  return (
    <ActionForm
      action={staffSignInAction}
      messages={messages}
      onSuccess={() => {
        router.replace(next);
        router.refresh();
      }}
      className="space-y-6"
    >
      <Field label={t.email} name="email" type="email" autoComplete="username" inputMode="email" required size="lg" />
      <Field label={t.password} name="password" type="password" autoComplete="current-password" required size="lg" />
      <SubmitButton label={t.submit} pendingLabel={t.pending} className="w-full" />
    </ActionForm>
  );
}
