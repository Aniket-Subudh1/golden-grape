'use client';

import { toast, useTranslation } from '@payloadcms/ui';
import { Bell as BellIcon, CalendarCheck, ClipboardList, FileSignature, RotateCcw, ShoppingBag, Ticket, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { slotLabel } from '@/lib/time';
import type { AlertItem, Alerts } from './alerts';
import { loadAlerts } from './alerts-action';
import { adminText } from './text';

// The sidebar counters and the header bell share one copy of "what waits" (GG-002). The sidebar seeds it with the
// figures of each page it renders (so a page reload after a decision is current at once); while a page stays open it
// is refreshed every 30 s and when the window gets the focus back, so new orders show up without a reload.

const EVERY_MS = 30_000;
const SEEN_KEY = 'gg_alerts_seen';

// Each refresh is about ten small queries: never more than one per 10 s (focus events come in bursts).
const MIN_GAP_MS = 10_000;

let current: Alerts | null = null;
let fetchedAt = 0;
const listeners = new Set<() => void>();
const publish = (next: Alerts) => {
  current = next;
  fetchedAt = Date.now();
  listeners.forEach((l) => l());
};

async function refresh() {
  if (document.visibilityState === 'hidden' || Date.now() - fetchedAt < MIN_GAP_MS) return;
  fetchedAt = Date.now();
  const result = await loadAlerts(null, {}).catch(() => null);
  if (result?.ok) publish(result.data);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  let stop = () => {};
  if (listeners.size === 1) {
    const timer = window.setInterval(refresh, EVERY_MS);
    window.addEventListener('focus', refresh);
    stop = () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** The shared figures; `fresh` (from a server render) replaces them whenever a new one arrives. */
export function useAlerts(fresh?: Alerts) {
  useEffect(() => {
    if (fresh) publish(fresh);
  }, [fresh]);
  return useSyncExternalStore(
    subscribe,
    () => current ?? fresh ?? null,
    () => fresh ?? null,
  );
}

const noop = () => () => {};

const ICONS = {
  order: ShoppingBag,
  reservation: CalendarCheck,
  booking: Ticket,
  catering: ClipboardList,
  quotation: FileSignature,
  refund: RotateCcw,
  lowStock: TriangleAlert,
};

/**
 * The header bell (Payload `admin.components.actions`), GG-017. "To do": what needs a decision, newest first, marked
 * "New" until the bell is opened after it arrived, then "Pending" until someone handles it. "Handled in the last 24 h":
 * greyed, with the status it ended in. The red badge counts only new arrivals: never something already handled.
 */
export default function Bell() {
  const { i18n } = useTranslation();
  const t = adminText(i18n.language).alerts;
  const alerts = useAlerts();
  const [open, setOpen] = useState(false);
  // `seen`: the newest item the user has looked at (kept per browser); `since`: what this opening marks as new.
  const stored = useSyncExternalStore(
    noop,
    () => localStorage.getItem(SEEN_KEY) ?? '',
    () => '',
  );
  const [opened, setOpened] = useState<string | null>(null);
  const seen = opened ?? stored;
  const [since, setSince] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const known = useRef<Set<string> | null>(null);

  // The sidebar seeds the figures on every page. Where it is not drawn, load them once (after it had its chance,
  // so a normal page load makes no extra request).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!current) void refresh();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const items = alerts?.items ?? [];
  const waiting = items.filter((i) => i.state !== 'done');
  const handled = items.filter((i) => i.state === 'done');
  const title = (item: AlertItem) =>
    item.kind === 'lowStock'
      ? t.lowStock(item.count ?? 0)
      : [t.kinds[item.kind], item.ref, item.name].filter(Boolean).join(' · ');

  // A toast for each order, table, request or seat that arrives while the page is open (never for a handled one).
  useEffect(() => {
    if (!alerts) return;
    const keys = new Set(alerts.items.map((i) => i.key));
    if (known.current)
      for (const item of alerts.items) if (item.at && item.state !== 'done' && !known.current.has(item.key)) toast.info(t.arrived(title(item)));
    known.current = keys;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per new set of figures only
  }, [alerts]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const unseen = waiting.filter((i) => i.at && i.at > seen).length;
  function toggle() {
    if (!open) {
      const latest = waiting.reduce((max, i) => (i.at > max ? i.at : max), seen);
      localStorage.setItem(SEEN_KEY, latest);
      setSince(seen);
      setOpened(latest);
    }
    setOpen(!open);
  }

  const lang = i18n.language as keyof NonNullable<AlertItem['status']>;
  const line = (item: AlertItem) => {
    const Icon = ICONS[item.kind];
    const isNew = item.state !== 'done' && Boolean(item.at && item.at > since);
    const detail =
      item.state === 'done'
        ? ''
        : item.state === 'info'
          ? item.status
            ? (item.status[lang] ?? item.status.fr)
            : t.detail.info
          : item.awaitingTransfer
            ? t.detail.transfer
            : [t.detail[item.kind], item.preorder && t.withPreorder].filter(Boolean).join(' · ');
    return (
      <li key={item.key}>
        <Link href={item.href} className="gg-bell__item" data-state={item.state} onClick={() => setOpen(false)}>
          <span className="gg-bell__icon">
            <Icon />
          </span>
          <span className="gg-bell__text">
            <b>{title(item)}</b>
            <small>{[detail, item.slot ? slotLabel(item.slot, i18n.language, 'short') : ''].filter(Boolean).join(' · ')}</small>
          </span>
          {isNew ? (
            <span className="gg-bell__tag gg-bell__tag--new">{t.new}</span>
          ) : item.state === 'pending' ? (
            <span className="gg-bell__tag">{t.pending}</span>
          ) : item.state === 'done' && item.status ? (
            <span className="gg-bell__tag gg-bell__tag--done">{item.status[lang] ?? item.status.fr}</span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <div className="gg-bell" ref={box}>
      <button type="button" className="gg-bell__button" aria-label={t.bell} aria-expanded={open} onClick={toggle}>
        <BellIcon />
        {unseen > 0 && <span className="gg-bell__count">{unseen}</span>}
      </button>
      {open && (
        <div className="gg-bell__panel" role="dialog" aria-label={t.bell}>
          <p className="gg-bell__title">{t.title}</p>
          {waiting.length === 0 ? <p className="gg-bell__empty">{t.empty}</p> : <ul>{waiting.map(line)}</ul>}
          {handled.length > 0 && (
            <>
              <p className="gg-bell__title">{t.recent}</p>
              <ul>{handled.map(line)}</ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
