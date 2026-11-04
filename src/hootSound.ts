/** A soft "hoo, hoo, hooo", made with the Web Audio API, so the app needs no sound file. */
const NOTES: [start: number, length: number, from: number, to: number][] = [
  [0, 0.28, 420, 360],
  [0.4, 0.28, 420, 360],
  [0.8, 0.6, 400, 300],
];
const VOLUME = 0.18;

export function playHoot() {
  try {
    const ctx = new AudioContext();
    void ctx.resume();
    const t0 = ctx.currentTime + 0.05;
    for (const [start, length, from, to] of NOTES) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(from, t0 + start);
      osc.frequency.exponentialRampToValueAtTime(to, t0 + start + length);
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(VOLUME, t0 + start + 0.06); // a soft attack, so it does not click
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + start + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + length + 0.05);
    }
    setTimeout(() => void ctx.close(), 2000);
  } catch {
    // No audio device, or the webview refuses sound: the popup is still useful without it.
  }
}
