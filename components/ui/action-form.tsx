'use client';

import { Check } from 'lucide-react';
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/action';
import { Button } from './button';

type FieldErrors = Record<string, string[] | undefined>;
const FieldErrorsContext = createContext<{ errors: FieldErrors; texts: Record<string, string> }>({ errors: {}, texts: {} });

/**
 * The first error for a field of the enclosing ActionForm, translated. Schemas and services report message
 * keys (`required`, `email`, `dateTooSoon`, …); anything else shows the generic `invalid` text.
 */
export function useFieldError(name: string) {
  const { errors, texts } = useContext(FieldErrorsContext);
  const key = errors[name]?.[0];
  return key && (texts[key] ?? texts.invalid ?? key);
}

type Props<T> = Omit<ComponentProps<'form'>, 'action' | 'onSubmit'> & {
  action: (prev: ActionResult<T> | null, input: FormData) => Promise<ActionResult<T>>;
  /** `form` block of the dictionary: generic error, per-code errors (e.g. RATE_LIMITED) and field texts. */
  messages: { success?: string; error: string; fields: Record<string, string> } & Record<string, unknown>;
  /** Shown instead of the form after a successful submit. */
  done?: (data: T) => ReactNode;
  /** Called once after a successful submit (refresh the page, close an editor…). */
  onSuccess?: (data: T) => void;
  /** Keep what was typed after success (an edited profile stays on screen); otherwise the form is cleared. */
  keepValues?: boolean;
};

// Submits through the server action without React's automatic form reset, so a failed submit keeps
// what the user typed; the form is reset only on success.
export function ActionForm<T>({ action, messages, done, onSuccess, keepValues, children, ...props }: Props<T>) {
  const [state, formAction] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (messages.success) toast.success(messages.success);
      if (!keepValues) form.current?.reset();
      onSuccess?.(state.data);
    } else if (!state.fieldErrors) {
      const byCode = messages[state.error];
      toast.error(typeof byCode === 'string' ? byCode : messages.error);
    }
    // Only a new result triggers this; the callbacks are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state?.ok && done) return done(state.data);

  return (
    <FieldErrorsContext value={{ errors: (state && !state.ok && state.fieldErrors) || {}, texts: messages.fields }}>
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

/** The "thank you" panel that replaces a submitted form (contact, catering). */
export function FormDone({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/20">
        <Check className="h-8 w-8 text-gold-deep" />
      </div>
      <h2 className="mt-6 font-serif text-3xl md:text-4xl">{title}</h2>
      <p className="mt-3 text-ink/60">{subtitle}</p>
    </div>
  );
}
