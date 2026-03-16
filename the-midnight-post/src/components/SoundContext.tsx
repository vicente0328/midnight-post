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

// ── AudioContext singleton ────────────────────────────────────────────────────

function getAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

// ── Buffer cache ─────────────────────────────────────────────────────────────

const bufferCache: Record<string, AudioBuffer> = {};

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  if (bufferCache[url]) return bufferCache[url];
  const res = await fetch(url);
  const raw = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(raw);
  bufferCache[url] = buf;
  return buf;
}

// ── Ambient loop player ───────────────────────────────────────────────────────

async function startAmbient(
  ctx: AudioContext,
  url: string,
  volume: number,
): Promise<{ stop: () => void }> {
  const buf = await loadBuffer(ctx, url);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2.5);
  master.connect(ctx.destination);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(master);
  src.start();

  return {
    stop: () => {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => { try { src.stop(); } catch {} }, 2200);
    },
  };
}

// ── One-shot player ───────────────────────────────────────────────────────────

async function playOneShot(ctx: AudioContext, url: string, volume = 1) {
  const buf = await loadBuffer(ctx, url);
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(ctx.destination);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(g);
  src.start();
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
      rainStopRef.current?.();
      rainStopRef.current = null;
      setRainEnabled(false);
    } else {
      const c = ctx();
      if (!c) return;
      startAmbient(c, '/rain_loop.mp3', 0.85).then(({ stop }) => {
        rainStopRef.current = stop;
      });
      setRainEnabled(true);
    }
  };

  const toggleFire = () => {
    if (fireEnabled) {
      fireStopRef.current?.();
      fireStopRef.current = null;
      setFireEnabled(false);
    } else {
      const c = ctx();
      if (!c) return;
      startAmbient(c, '/fire_loop.mp3', 0.75).then(({ stop }) => {
        fireStopRef.current = stop;
      });
      setFireEnabled(true);
    }
  };

  const playPageTurn = () => {
    const c = ctx();
    if (c) playOneShot(c, '/page_turn.mp3', 0.9);
  };

  const playArrivalSound = () => {
    const c = ctx();
    if (c) playOneShot(c, '/letter_arrival.mp3', 1.0);
  };

  const setTyping = (_: boolean) => {};

  return (
    <SoundContext.Provider value={{
      rainEnabled, fireEnabled,
      toggleRain, toggleFire,
      playPageTurn, playArrivalSound, setTyping,
    }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) throw new Error('useSound must be used within a SoundProvider');
  return context;
}
