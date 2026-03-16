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

// White noise → low-pass filter → rain sound
function startRain(ctx: AudioContext): { stop: () => void } {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 450;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 1.5);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  return {
    stop: () => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => source.stop(), 1300);
    },
  };
}

// Brown noise → fire/crackling sound
function startFire(ctx: AudioContext): { stop: () => void } {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 700;
  filter.Q.value = 0.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.5);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();

  return {
    stop: () => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => source.stop(), 1300);
    },
  };
}

// Short chime for arrival
function playChime(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.8);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.8);
}

// Paper rustle for page turn
function playRustle(ctx: AudioContext) {
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [rainEnabled, setRainEnabled] = useState(false);
  const [fireEnabled, setFireEnabled] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rainStopRef = useRef<(() => void) | null>(null);
  const fireStopRef = useRef<(() => void) | null>(null);

  function ensureCtx(): AudioContext | null {
    if (!audioCtxRef.current) {
      audioCtxRef.current = getAudioContext();
    }
    // Resume if suspended (autoplay policy)
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  const toggleRain = () => {
    if (rainEnabled) {
      rainStopRef.current?.();
      rainStopRef.current = null;
      setRainEnabled(false);
    } else {
      const ctx = ensureCtx();
      if (!ctx) return;
      rainStopRef.current = startRain(ctx).stop;
      setRainEnabled(true);
    }
  };

  const toggleFire = () => {
    if (fireEnabled) {
      fireStopRef.current?.();
      fireStopRef.current = null;
      setFireEnabled(false);
    } else {
      const ctx = ensureCtx();
      if (!ctx) return;
      fireStopRef.current = startFire(ctx).stop;
      setFireEnabled(true);
    }
  };

  const playPageTurn = () => {
    const ctx = ensureCtx();
    if (ctx) playRustle(ctx);
  };

  const playArrivalSound = () => {
    const ctx = ensureCtx();
    if (ctx) playChime(ctx);
  };

  const setTyping = (_isTyping: boolean) => {
    // typing sound omitted — pen scratching via Web Audio is complex
  };

  return (
    <SoundContext.Provider value={{ rainEnabled, fireEnabled, toggleRain, toggleFire, playPageTurn, playArrivalSound, setTyping }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
