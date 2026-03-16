import React, { createContext, useContext, useRef, useState } from 'react';

interface SoundContextType {
  rainEnabled: boolean;
  fireEnabled: boolean;
  toggleRain: () => void;
  toggleFire: () => void;
  playPageTurn: () => void;
  playArrivalSound: () => void;
  setTyping: (isTyping: boolean) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

function getAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

// ── Noise buffers ─────────────────────────────────────────────────────────────

function createWhiteNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Pink noise via Paul Kellett's method – more natural than white
function createPinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886*b0 + w*0.0555179;
    b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520;
    b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522;
    b5 = -0.7616*b5 - w*0.0168980;
    d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

// Brown (red) noise – deeper, richer than white
function createBrownNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = (last + 0.02 * w) / 1.02;
    last = d[i];
    d[i] *= 3.5;
  }
  return buf;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createLoopSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  // randomise loop start to prevent phase artefacts between layers
  src.loopStart = Math.random() * buf.duration;
  src.loopEnd = buf.duration;
  return src;
}

function createLFO(ctx: AudioContext, hz: number, depth: number, target: AudioParam) {
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = hz;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain);
  lfoGain.connect(target);
  lfo.start();
  return lfo;
}

// ── Rain ──────────────────────────────────────────────────────────────────────
//
//  Layer 1 – pink noise → low-pass 1800 Hz  (main rain wash)
//  Layer 2 – white noise → band-pass 4500 Hz (fine drizzle / surface hiss)
//  Layer 3 – white noise → low-pass  90 Hz  (distant low rumble)
//  LFO on master gain – 0.07 Hz, depth 0.07  (rain naturally swells & quiets)

function startRain(ctx: AudioContext): { stop: () => void } {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.65, ctx.currentTime + 3);  // softer, slower fade-in
  master.connect(ctx.destination);

  // Layer 1 – main rainfall (pink noise, warm low-pass)
  const pinkBuf = createPinkNoiseBuffer(ctx, 6);
  const pink = createLoopSource(ctx, pinkBuf);
  const lpMain = ctx.createBiquadFilter();
  lpMain.type = 'lowpass'; lpMain.frequency.value = 1400; lpMain.Q.value = 0.3; // softer cutoff
  const gMain = ctx.createGain(); gMain.gain.value = 0.55;
  pink.connect(lpMain); lpMain.connect(gMain); gMain.connect(master);

  // Layer 2 – gentle drizzle (lowered freq to avoid harshness)
  const wb1 = createWhiteNoiseBuffer(ctx, 4);
  const hiss = createLoopSource(ctx, wb1);
  const bpHiss = ctx.createBiquadFilter();
  bpHiss.type = 'bandpass'; bpHiss.frequency.value = 3200; bpHiss.Q.value = 0.4; // less sharp
  const gHiss = ctx.createGain(); gHiss.gain.value = 0.10;  // quieter
  hiss.connect(bpHiss); bpHiss.connect(gHiss); gHiss.connect(master);

  // Layer 3 – soft distant rumble
  const wb2 = createWhiteNoiseBuffer(ctx, 8);
  const rumble = createLoopSource(ctx, wb2);
  const lpRumble = ctx.createBiquadFilter();
  lpRumble.type = 'lowpass'; lpRumble.frequency.value = 80;
  const gRumble = ctx.createGain(); gRumble.gain.value = 0.09;
  rumble.connect(lpRumble); lpRumble.connect(gRumble); gRumble.connect(master);

  // Very slow LFO – barely perceptible swell
  const lfo = createLFO(ctx, 0.05, 0.04, master.gain);

  pink.start(); hiss.start(); rumble.start();

  return {
    stop: () => {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
      setTimeout(() => { pink.stop(); hiss.stop(); rumble.stop(); lfo.stop(); }, 2600);
    },
  };
}

// ── Fire ──────────────────────────────────────────────────────────────────────
//
//  Layer 1 – brown noise → band-pass 220 Hz  (deep crackle base)
//  Layer 2 – brown noise → band-pass 700 Hz  (mid warmth)
//  Layer 3 – white noise → band-pass 1400 Hz (flame hiss)
//  LFO on master – 0.12 Hz                   (fire breathing / flicker)
//  Random crackle scheduler – 180–700 ms     (individual pops)

function triggerCrackle(ctx: AudioContext, dest: AudioNode, stopped: { v: boolean }) {
  if (stopped.v) return;
  const dur = 0.025 + Math.random() * 0.06;  // longer, softer pops
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // smooth bell-curve envelope baked into buffer
  for (let i = 0; i < n; i++) {
    const env = Math.sin((i / n) * Math.PI);
    d[i] = (Math.random() * 2 - 1) * env;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300 + Math.random() * 700;  // lower, warmer frequencies
  bp.Q.value = 0.6 + Math.random() * 0.8;          // softer resonance

  const g = ctx.createGain();
  const vol = 0.02 + Math.random() * 0.07;          // much quieter
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur + 0.03);

  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start();
}

function startFire(ctx: AudioContext): { stop: () => void } {
  const stopped = { v: false };

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.62, ctx.currentTime + 3);  // softer, slower
  master.connect(ctx.destination);

  // Layer 1 – deep crackle base (warm low end)
  const bb1 = createBrownNoiseBuffer(ctx, 5);
  const base = createLoopSource(ctx, bb1);
  const bpBase = ctx.createBiquadFilter();
  bpBase.type = 'bandpass'; bpBase.frequency.value = 200; bpBase.Q.value = 0.5; // wider, softer
  const gBase = ctx.createGain(); gBase.gain.value = 0.50;
  base.connect(bpBase); bpBase.connect(gBase); gBase.connect(master);

  // Layer 2 – mid warmth
  const bb2 = createBrownNoiseBuffer(ctx, 7);
  const mid = createLoopSource(ctx, bb2);
  const bpMid = ctx.createBiquadFilter();
  bpMid.type = 'bandpass'; bpMid.frequency.value = 600; bpMid.Q.value = 0.6;
  const gMid = ctx.createGain(); gMid.gain.value = 0.22;
  mid.connect(bpMid); bpMid.connect(gMid); gMid.connect(master);

  // Layer 3 – very subtle flame breath (lowered, quieter)
  const wb = createWhiteNoiseBuffer(ctx, 4);
  const flame = createLoopSource(ctx, wb);
  const bpFlame = ctx.createBiquadFilter();
  bpFlame.type = 'bandpass'; bpFlame.frequency.value = 1000; bpFlame.Q.value = 0.7;
  const gFlame = ctx.createGain(); gFlame.gain.value = 0.07;  // very subtle
  flame.connect(bpFlame); bpFlame.connect(gFlame); gFlame.connect(master);

  // Slow, barely-perceptible LFO – gentle fire breathing
  const lfo = createLFO(ctx, 0.07, 0.06, master.gain);

  base.start(); mid.start(); flame.start();

  // Crackle scheduler – less frequent for calm ambiance
  const scheduleCrackle = () => {
    if (stopped.v) return;
    const delay = 400 + Math.random() * 1100;  // 0.4–1.5s between crackles
    setTimeout(() => {
      triggerCrackle(ctx, master, stopped);
      scheduleCrackle();
    }, delay);
  };
  scheduleCrackle();

  return {
    stop: () => {
      stopped.v = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
      setTimeout(() => { base.stop(); mid.stop(); flame.stop(); lfo.stop(); }, 2600);
    },
  };
}

// ── One-shot sounds ───────────────────────────────────────────────────────────

// Calm paper unfold (for opening a letter) – slow rise, long gentle decay
function playRustle(ctx: AudioContext) {
  const dur = 0.55;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource(); src.buffer = buf;

  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.5;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.12);   // very soft attack
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); // long decay

  src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start();
}

// Letter arrival: soft unfold → brief settle (two gentle rustle bursts)
function playLetterArrival(ctx: AudioContext) {
  const makeRustleBurst = (startAt: number, dur: number, freq: number, vol: number) => {
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource(); src.buffer = buf;

    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(vol, startAt + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + dur);

    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start(startAt);
  };

  // First burst: gentle paper unfold
  makeRustleBurst(ctx.currentTime,        0.32, 2800, 0.16);
  // Second burst: soft settle
  makeRustleBurst(ctx.currentTime + 0.40, 0.22, 2400, 0.10);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [rainEnabled, setRainEnabled] = useState(false);
  const [fireEnabled, setFireEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const rainStopRef = useRef<(() => void) | null>(null);
  const fireStopRef = useRef<(() => void) | null>(null);

  function ctx(): AudioContext | null {
    if (!ctxRef.current) ctxRef.current = getAudioContext();
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }

  const toggleRain = () => {
    if (rainEnabled) {
      rainStopRef.current?.(); rainStopRef.current = null; setRainEnabled(false);
    } else {
      const c = ctx(); if (!c) return;
      rainStopRef.current = startRain(c).stop; setRainEnabled(true);
    }
  };

  const toggleFire = () => {
    if (fireEnabled) {
      fireStopRef.current?.(); fireStopRef.current = null; setFireEnabled(false);
    } else {
      const c = ctx(); if (!c) return;
      fireStopRef.current = startFire(c).stop; setFireEnabled(true);
    }
  };

  const playPageTurn = () => { const c = ctx(); if (c) playRustle(c); };
  const playArrivalSound = () => { const c = ctx(); if (c) playLetterArrival(c); };
  const setTyping = (_: boolean) => {};

  return (
    <SoundContext.Provider value={{ rainEnabled, fireEnabled, toggleRain, toggleFire, playPageTurn, playArrivalSound, setTyping }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) throw new Error('useSound must be used within a SoundProvider');
  return context;
}
