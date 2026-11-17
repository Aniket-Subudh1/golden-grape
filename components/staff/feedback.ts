// The staff app's sounds and buzzes (owner request, 17 Nov): a scanner beep when a code is found, a low buzz when it is
// not, and a short chime when a sale or a receipt is done. Made with Web Audio (no files to load); quiet, and silent
// where the browser has no audio. Phones only play sound after a first touch, so the context is opened on the first
// tap or key press.

let audio: AudioContext | null = null;

function context() {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  }
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    context();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** One note: `freq` Hz from `at` seconds for `length` seconds, a quick attack and a soft fade. */
function note(freq: number, at: number, length: number, type: OscillatorType = 'sine', volume = 0.12) {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** A code was found: the till scanner's short high beep, and a tap of vibration. */
export function scanned() {
  note(1975, 0, 0.09, 'square', 0.05);
  navigator.vibrate?.(40);
}

/** Nothing for that code: two low buzzes. */
export function missed() {
  note(196, 0, 0.12, 'triangle', 0.14);
  note(165, 0.14, 0.16, 'triangle', 0.14);
  navigator.vibrate?.([60, 40, 60]);
}

/** A sale or a receipt is done: a rising "cha-ching" (C6, E6, G6, then a bright C7). */
export function celebrate() {
  note(1047, 0, 0.18, 'triangle');
  note(1319, 0.08, 0.18, 'triangle');
  note(1568, 0.16, 0.22, 'triangle');
  note(2093, 0.26, 0.5, 'sine', 0.1);
  navigator.vibrate?.([30, 50, 80]);
}
