'use client';

import { type ComponentProps, createContext, startTransition, useActionState, useContext, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/action';
import { Button } from './button';

type FieldErrors = Record<string, string[] | undefined>;
const FieldErrorsContext = createContext<FieldErrors>({});

/** The first error for a field of the enclosing ActionForm, if any. */
export const useFieldError = (name: string) => useContext(FieldErrorsContext)[name]?.[0];

type Props<T> = Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: (prev: ActionResult<T> | null, input: FormData) => Promise<ActionResult<T>>;
  messages: { success: string; error: string };
};

// Submits through the server action without React's automatic form reset, so a failed submit keeps
// what the user typed; the form is reset only on success.
export function ActionForm<T>({ action, messages, children, ...props }: Props<T>) {
  const [state, formAction] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(messages.success);
      form.current?.reset();
    } else if (!state.fieldErrors) {
      toast.error(messages.error);
    }
  }, [state, messages]);

  return (
    <FieldErrorsContext value={(state && !state.ok && state.fieldErrors) || {}}>
      <form
        ref={form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        {...props}
      >
        {children}
      </form>
    </FieldErrorsContext>
  );
}

/** Submit button that shows `pendingLabel` and is disabled while the action runs. */
export function SubmitButton({ label, pendingLabel, ...props }: ComponentProps<typeof Button> & { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
