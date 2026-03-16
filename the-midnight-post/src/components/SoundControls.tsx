import React from 'react';
import { CloudRain, Flame } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSound } from './SoundContext';

export default function SoundControls() {
  const { rainEnabled, fireEnabled, toggleRain, toggleFire } = useSound();
  const { pathname } = useLocation();

  // 담소 화면에서는 사운드 버튼 숨김 (UI 겹침 방지)
  if (pathname.startsWith('/damso')) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-3">
      <button
        onClick={toggleFire}
        className={`p-3 rounded-full backdrop-blur-md transition-all duration-300 border ${
          fireEnabled 
            ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.3)]' 
            : 'bg-ink/5 border-ink/10 text-ink/40 hover:bg-ink/10 hover:text-ink/60'
        }`}
        title="장작 소리 (Firewood)"
      >
        <Flame size={20} strokeWidth={fireEnabled ? 2 : 1.5} />
      </button>
      
      <button
        onClick={toggleRain}
        className={`p-3 rounded-full backdrop-blur-md transition-all duration-300 border ${
          rainEnabled 
            ? 'bg-blue-900/10 border-blue-900/30 text-blue-800 shadow-[0_0_15px_rgba(30,58,138,0.2)]' 
            : 'bg-ink/5 border-ink/10 text-ink/40 hover:bg-ink/10 hover:text-ink/60'
        }`}
        title="빗소리 (Rain)"
      >
        <CloudRain size={20} strokeWidth={rainEnabled ? 2 : 1.5} />
      </button>
    </div>
  );
}
