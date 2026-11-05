let context;
let enabled = true;
const notes = { start: [392, 523, 659], lift: [220], dump: [440, 523, 659], repack: [392, 330], count: [660], submit: [523, 659, 784], retry: [330, 440], success: [659, 784, 988, 1318], error: [196, 147], select: [480], message: [392, 494, 587], trade: [784, 988] };
function audioContext() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!context) context = new AudioContextClass();
  if (context.state === 'closed') return null;
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}
export function setSoundEnabled(value) { enabled = value; }
export function playSound(name, variation = 0) {
  if (!enabled) return;
  let ctx;
  try { ctx = audioContext(); } catch { return; }
  if (!ctx) return;
  const sequence = name === 'mumble' ? [140 + (variation % 5) * 18] : notes[name] || [440];
  const now = ctx.currentTime;
  sequence.forEach((base, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const frequency = name === 'count' ? base * Math.pow(2, (variation % 12) / 12) : base;
    oscillator.type = ['lift', 'mumble', 'error'].includes(name) ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now + index * .065);
    if (name === 'mumble') oscillator.frequency.exponentialRampToValueAtTime(frequency * .7, now + .09);
    if (name === 'lift') oscillator.frequency.exponentialRampToValueAtTime(140, now + .16);
    if (name === 'error') oscillator.frequency.exponentialRampToValueAtTime(base * .72, now + .2 + index * .065);
    gain.gain.setValueAtTime(.0001, now + index * .065);
    gain.gain.exponentialRampToValueAtTime(name === 'count' ? .035 : .055, now + index * .065 + .012);
    const duration = name === 'success' ? .24 : name === 'error' ? .26 : name === 'dump' ? .19 : .14;
    gain.gain.exponentialRampToValueAtTime(.0001, now + index * .065 + duration);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(now + index * .065); oscillator.stop(now + index * .065 + duration + .02);
  });
}
