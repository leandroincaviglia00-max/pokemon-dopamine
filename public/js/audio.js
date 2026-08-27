import { state } from './storage.js';
let ctx;
const ac = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());

export function sfx(type) {
  if (!state.sound) return;
  try {
    const a = ac(), t = a.currentTime;
    if (type === 'tear') {
      const b = a.createBuffer(1, a.sampleRate * 0.14, a.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(); s.buffer = b;
      const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
      s.connect(f).connect(a.destination); s.start();
      return;
    }
    const [freq, dur] = { flip: [620, 0.08], add: [880, 0.12], rare: [1320, 0.6], open: [330, 0.2] }[type] || [440, 0.1];
    const o = a.createOscillator(), g = a.createGain();
    o.connect(g).connect(a.destination);
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur);
  } catch {}
}
