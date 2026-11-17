'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { staffSignOutAction } from '@/modules/settings/actions';

export function SignOut({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={label}
      onClick={() =>
        start(async () => {
          await staffSignOutAction(null, {});
          router.replace('/staff/login');
          router.refresh();
        })
      }
      className="text-ink/60 hover:bg-champagne grid h-11 w-11 place-items-center rounded-full transition"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
