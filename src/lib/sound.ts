/**
 * HALOCK — Session-complete chime synthesized with WebAudio.
 * No audio assets required; respects the sound settings.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Gentle two-note chime (E5 → A5) with a soft envelope. */
export function playChime(volume = 0.5): void {
  const audio = getCtx();
  if (!audio) return;
  const gain = audio.createGain();
  gain.gain.value = Math.min(1, Math.max(0, volume)) * 0.25;
  gain.connect(audio.destination);

  const now = audio.currentTime;
  const notes = [
    { freq: 659.25, at: now, dur: 0.35 },
    { freq: 880.0, at: now + 0.18, dur: 0.55 },
  ];

  for (const note of notes) {
    const osc = audio.createOscillator();
    const noteGain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = note.freq;
    noteGain.gain.setValueAtTime(0.0001, note.at);
    noteGain.gain.exponentialRampToValueAtTime(1, note.at + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, note.at + note.dur);
    osc.connect(noteGain);
    noteGain.connect(gain);
    osc.start(note.at);
    osc.stop(note.at + note.dur + 0.05);
  }
}

/** Very soft tick for the last seconds (optional, low volume). */
export function playTick(volume = 0.5): void {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = 1200;
  const now = audio.currentTime;
  gain.gain.setValueAtTime(Math.min(1, Math.max(0, volume)) * 0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Must be called from a user gesture to unlock audio on mobile browsers. */
export function unlockAudio(): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
}
