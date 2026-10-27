// All sounds are synthesized with the Web Audio API, so the game needs no audio files.

let ac = null;
let master = null;
let noiseBuf = null;
let muted = false;

export function unlockAudio() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.8;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.8;
}
export const isMuted = () => muted;

const rand = (a, b) => a + Math.random() * (b - a);

function noise({ dur = 0.3, type = 'highpass', freq = 2000, freqEnd, q = 0.8, gain = 0.5, attack = 0.002, delay = 0 }) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = rand(0.8, 1.2);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, rand(0, 1));
  src.stop(t + dur + 0.05);
}

function tone({ freq = 440, freqEnd, dur = 0.2, type = 'sine', gain = 0.2, delay = 0 }) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function tinkles(count, spread, lo, hi, gain) {
  for (let i = 0; i < count; i++) {
    tone({ freq: rand(lo, hi), dur: rand(0.08, 0.4), gain: gain * rand(0.4, 1), delay: rand(0, spread) });
  }
}

let lastClink = 0;

export const sfx = {
  whoosh() {
    noise({ dur: 0.22, type: 'bandpass', freq: 350, freqEnd: 1600, q: 1.2, gain: 0.35, attack: 0.08 });
  },
  thud() {
    tone({ freq: 110, freqEnd: 40, dur: 0.22, gain: 0.9 });
    noise({ dur: 0.12, type: 'lowpass', freq: 600, gain: 0.5 });
  },
  clink(strength = 1) {
    if (!ac || ac.currentTime - lastClink < 0.04) return;
    lastClink = ac.currentTime;
    tone({ freq: rand(2500, 5000), dur: rand(0.06, 0.18), gain: 0.05 * Math.min(strength, 1.5) });
  },
  glass(power = 1) {
    noise({ dur: 0.4, type: 'highpass', freq: 2600, gain: 0.55 * Math.min(power, 1.2) });
    noise({ dur: 0.12, type: 'bandpass', freq: 5000, q: 2, gain: 0.4 });
    tinkles(7, 0.08, 2500, 7000, 0.08);
    tinkles(6, 0.6, 3000, 7500, 0.04); // falling pieces
    tone({ freq: 160, freqEnd: 60, dur: 0.12, gain: 0.35 });
  },
  ceramic(power = 1) {
    noise({ dur: 0.28, type: 'bandpass', freq: 1700, q: 0.7, gain: 0.7 * Math.min(power, 1.2) });
    tone({ freq: 140, freqEnd: 55, dur: 0.18, gain: 0.6 });
    tinkles(4, 0.1, 1200, 3200, 0.07);
    noise({ dur: 0.15, type: 'bandpass', freq: 2500, q: 1, gain: 0.25, delay: 0.2 });
  },
  crack() {
    tone({ freq: 90, freqEnd: 45, dur: 0.25, gain: 0.9 });
    noise({ dur: 0.18, type: 'highpass', freq: 3000, gain: 0.45 });
    tone({ freq: 900, freqEnd: 120, dur: 0.25, type: 'sawtooth', gain: 0.08 });
  },
  punch() {
    tone({ freq: 140, freqEnd: 60, dur: 0.12, gain: 0.7 });
    noise({ dur: 0.08, type: 'lowpass', freq: 900, gain: 0.5 });
  },
  metal(power = 1) {
    // Inharmonic partials sound like a struck car panel
    const base = rand(180, 260);
    for (const r of [1, 2.76, 5.4, 8.9]) tone({ freq: base * r, dur: rand(0.25, 0.6), type: 'triangle', gain: 0.12 * power / Math.sqrt(r) });
    noise({ dur: 0.1, type: 'bandpass', freq: 1500, q: 1, gain: 0.5 * power });
    tone({ freq: 90, freqEnd: 40, dur: 0.2, gain: 0.6 * power });
  },
  wood() {
    noise({ dur: 0.25, type: 'bandpass', freq: 700, q: 0.9, gain: 0.8 });
    tone({ freq: 170, freqEnd: 70, dur: 0.18, gain: 0.7 });
    noise({ dur: 0.08, type: 'highpass', freq: 2500, gain: 0.3, delay: 0.03 });
  },
  honk() {
    for (const f of [311, 392]) tone({ freq: f, dur: 0.7, type: 'square', gain: 0.07 });
  },
  // Classic two-tone car alarm. Returns a function that silences it early.
  alarm(seconds = 5) {
    if (!ac) return () => {};
    const t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'square';
    for (let k = 0; k < seconds * 4; k++) o.frequency.setValueAtTime(k % 2 ? 640 : 960, t + k * 0.25);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.setValueAtTime(0.0001, t + seconds);
    o.connect(g); g.connect(master);
    o.start(t);
    o.stop(t + seconds + 0.05);
    return () => { try { o.stop(); } catch (_) { /* already stopped */ } };
  },
  // Fabric tearing under a blade
  rip() {
    noise({ dur: 0.28, type: 'bandpass', freq: 900, freqEnd: 3200, q: 2.5, gain: 0.55 });
    for (let i = 0; i < 4; i++) noise({ dur: 0.04, type: 'highpass', freq: 3000, gain: 0.2, delay: 0.03 + i * 0.05 });
  },
  // Air rushing out of a punctured tyre
  hiss() {
    noise({ dur: 1.8, type: 'highpass', freq: 3800, gain: 0.3, attack: 0.02 });
    noise({ dur: 0.15, type: 'lowpass', freq: 500, gain: 0.5 });
  },
  // Blade dragged across paint
  scrape() {
    noise({ dur: 0.35, type: 'bandpass', freq: 5000, freqEnd: 2500, q: 6, gain: 0.35, attack: 0.03 });
    tone({ freq: 2400, freqEnd: 1800, dur: 0.3, type: 'sawtooth', gain: 0.03 });
  },
  softThump() {
    tone({ freq: 90, freqEnd: 50, dur: 0.12, gain: 0.5 });
    noise({ dur: 0.1, type: 'lowpass', freq: 400, gain: 0.35 });
  },
  explode() {
    noise({ dur: 0.9, type: 'lowpass', freq: 1400, freqEnd: 200, gain: 1 });
    tone({ freq: 80, freqEnd: 30, dur: 0.5, gain: 1 });
    noise({ dur: 0.5, type: 'highpass', freq: 2800, gain: 0.5 });
    tone({ freq: 1200, freqEnd: 60, dur: 0.45, type: 'sawtooth', gain: 0.12 });
    tinkles(10, 0.9, 2500, 7000, 0.05);
  },
};
