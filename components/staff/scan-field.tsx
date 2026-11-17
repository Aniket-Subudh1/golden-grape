'use client';

import { Camera, ScanBarcode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';

export type ScanTexts = {
  label: string;
  placeholder: string;
  camera: string;
  cameraTitle: string;
  cameraHint: string;
  cameraError: string;
  close: string;
};

type Props = {
  /** A code from the scanner, the camera, or typed then Enter. */
  onScan: (code: string) => void | Promise<void>;
  t: ScanTexts;
  busy?: boolean;
};

/**
 * The one scanner of the staff screens (M3.1 T2, 05 §5). A text input that keeps the focus: a Bluetooth or USB scanner
 * paired as a keyboard types the code and Enter sends it. The camera button opens the rear camera in a bottom sheet
 * (EAN-13, EAN-8, UPC-A, Code 128); a decode closes the sheet and sends the code. Closing the sheet always
 * stops the camera.
 */
export function ScanField({ onScan, t, busy = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const send = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    await onScan(code);
    input.current?.focus();
  };

  return (
    <div className="flex items-end gap-2">
      <form
        className="min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          const value = input.current?.value ?? '';
          if (input.current) input.current.value = '';
          void send(value);
        }}
      >
        <label htmlFor="scan" className="eyebrow text-ink/60 mb-1.5 block">
          {t.label}
        </label>
        <div className="gg-card focus-within:border-gold-deep flex h-12 items-center gap-2 px-3">
          <ScanBarcode className="text-ink/40 h-5 w-5 shrink-0" />
          <input
            ref={input}
            id="scan"
            name="code"
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            enterKeyHint="search"
            disabled={busy}
            placeholder={t.placeholder}
            className="placeholder:text-ink/35 h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>
      </form>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.camera}
        className="bg-ink text-bone grid h-12 w-12 shrink-0 place-items-center rounded-xl transition active:scale-95"
      >
        <Camera className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} label={t.cameraTitle} closeLabel={t.close} variant="bottom">
        {open && (
          <CameraScanner
            t={t}
            onCode={(code) => {
              setOpen(false);
              void send(code);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

/** Mounted only while the sheet is open: the camera starts on mount and every track is stopped on unmount. */
function CameraScanner({ t, onCode }: { t: ScanTexts; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    const element = video.current;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128],
          ],
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
        if (stopped || !element) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          element,
          (result, _error, ctl) => {
            if (!result || stopped) return;
            stopped = true;
            ctl.stop();
            onCode(result.getText());
          },
        );
        if (stopped) controls.stop();
      } catch {
        if (!stopped) setError(true);
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
      // Belt and braces: no camera track outlives the sheet, whatever the library did.
      const stream = element?.srcObject;
      if (stream instanceof MediaStream) for (const track of stream.getTracks()) track.stop();
      if (element) element.srcObject = null;
    };
    // The scanner starts once per opening of the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-5 pt-6">
      <h2 className="mb-1 font-serif text-2xl">{t.cameraTitle}</h2>
      <p className="text-ink/60 mb-4 text-sm">{error ? t.cameraError : t.cameraHint}</p>
      <div className="bg-ink relative aspect-[3/4] overflow-hidden rounded-xl">
        <video ref={video} muted playsInline className="h-full w-full object-cover" />
        <div className="border-gold/80 pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2" />
      </div>
    </div>
  );
}
