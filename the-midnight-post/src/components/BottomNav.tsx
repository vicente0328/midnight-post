import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PenTool, BookOpen, FlaskConical, Scroll } from 'lucide-react';

const TABS = [
  { path: '/',        icon: PenTool,      label: 'Desk'    },
  { path: '/archive', icon: BookOpen,     label: 'Archive' },
  { path: '/study',   icon: FlaskConical, label: 'Library' },
  { path: '/account', icon: Scroll,       label: 'Account' },
] as const;

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper border-t border-ink/10 flex safe-bottom">
      {TABS.map(({ path, icon: Icon }) => {
        const isActive =
          path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

        return (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex items-center justify-center py-7 relative transition-all duration-200 ${
              isActive ? 'opacity-90' : 'opacity-30 active:opacity-60'
            }`}
            style={{ touchAction: 'manipulation', minHeight: '72px' }}
          >
            {/* 활성 탭: 상단 금색 라인 */}
            <div
              className={`absolute top-0 h-px transition-all duration-300 ${
                isActive ? 'bg-[#D4AF37] w-10' : 'bg-transparent w-0'
              }`}
            />
            <Icon
              size={26}
              strokeWidth={isActive ? 1.8 : 1.5}
              className={isActive ? 'text-ink' : 'text-ink/60'}
            />
          </Link>
        );
      })}
    </nav>
  );
}
