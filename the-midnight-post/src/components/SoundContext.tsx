import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

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

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [rainEnabled, setRainEnabled] = useState(false);
  const [fireEnabled, setFireEnabled] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const rainAudio = useRef<HTMLAudioElement | null>(null);
  const fireAudio = useRef<HTMLAudioElement | null>(null);
  const penAudio = useRef<HTMLAudioElement | null>(null);
  const pageAudio = useRef<HTMLAudioElement | null>(null);
  const arrivalAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio objects
    rainAudio.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3');
    if (rainAudio.current) {
      rainAudio.current.loop = true;
      rainAudio.current.volume = 0.2;
    }

    fireAudio.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-campfire-crackles-1330.mp3');
    if (fireAudio.current) {
      fireAudio.current.loop = true;
      fireAudio.current.volume = 0.4;
    }

    penAudio.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-writing-on-paper-2668.mp3');
    if (penAudio.current) {
      penAudio.current.loop = true;
      penAudio.current.volume = 0.5;
    }

    pageAudio.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-page-turn-single-1104.mp3');
    if (pageAudio.current) {
      pageAudio.current.volume = 0.6;
    }

    arrivalAudio.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-magical-coin-win-1936.mp3');
    if (arrivalAudio.current) {
      arrivalAudio.current.volume = 0.3;
    }

    return () => {
      rainAudio.current?.pause();
      fireAudio.current?.pause();
      penAudio.current?.pause();
      pageAudio.current?.pause();
    };
  }, []);

  const toggleRain = () => {
    if (!rainEnabled) {
      rainAudio.current?.play().catch(e => {
        console.error("Audio play failed:", e);
      });
      setRainEnabled(true);
    } else {
      rainAudio.current?.pause();
      setRainEnabled(false);
    }
  };

  const toggleFire = () => {
    if (!fireEnabled) {
      fireAudio.current?.play().catch(e => {
        console.error("Audio play failed:", e);
      });
      setFireEnabled(true);
    } else {
      fireAudio.current?.pause();
      setFireEnabled(false);
    }
  };

  const setTyping = (typing: boolean) => {
    setIsTyping(typing);
    if (typing) {
      penAudio.current?.play().catch(() => {});
    } else {
      penAudio.current?.pause();
    }
  };
  
  const playPageTurn = () => {
    if (pageAudio.current) {
      pageAudio.current.currentTime = 0;
      pageAudio.current.play().catch(() => {});
    }
  };

  const playArrivalSound = () => {
    if (arrivalAudio.current) {
      arrivalAudio.current.currentTime = 0;
      arrivalAudio.current.play().catch(() => {});
    }
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
