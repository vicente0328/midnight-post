import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import { LogOut, BookOpen, PenTool, FlaskConical, Feather } from 'lucide-react';
import { motion } from 'motion/react';
import BottomNav from './BottomNav';

export default function Layout() {
  const { user, setShowAuthModal, setShowGuideModal, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-8 pb-24 sm:pb-8">
      <header className="w-full flex justify-between items-center mb-12 border-b border-ink/10 pb-4">
        <Link to="/" className="font-bold tracking-widest uppercase">
          <span className="hidden sm:inline text-2xl">The Midnight Post</span>
          <span className="sm:hidden text-base">The Midnight Post</span>
        </Link>

        {/* 데스크톱 nav — 모바일에서 숨김 */}
        <nav className="hidden sm:flex gap-4 items-center text-sm tracking-widest uppercase">
          {user ? (
            <>
              <Link to="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Desk">
                <PenTool size={16} />
                <span>Desk</span>
              </Link>
              <Link to="/archive" className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Archive">
                <BookOpen size={16} />
                <span>Archive</span>
              </Link>
              <Link to="/study" className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="멘토의 연구실">
                <FlaskConical size={16} />
                <span>Library</span>
              </Link>
              <button
                onClick={() => setShowGuideModal(true)}
                className="flex items-center gap-1.5 hover:opacity-70 transition-opacity opacity-50"
                title="Guide"
              >
                <Feather size={15} strokeWidth={1.4} />
                <span>Guide</span>
              </button>
              <button onClick={signOut} className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Logout">
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowGuideModal(true)}
                className="flex items-center gap-1.5 hover:opacity-70 transition-opacity opacity-50"
                title="Guide"
              >
                <Feather size={15} strokeWidth={1.4} />
                <span>Guide</span>
              </button>
              <button onClick={() => setShowAuthModal(true)} className="hover:opacity-70 transition-opacity">
                Login
              </button>
            </>
          )}
        </nav>

        {/* 모바일 우측: Guide 아이콘 (항상) + 비로그인시 Login */}
        <div className="sm:hidden flex items-center gap-3">
          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 transition-opacity"
            style={{ opacity: 0.45 }}
            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.45'; }}
            title="Guide"
          >
            <Feather size={15} strokeWidth={1.4} />
          </button>
          {!user && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="hover:opacity-70 transition-opacity text-sm tracking-widest uppercase"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col items-center justify-center">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full flex flex-col items-center"
        >
          <Outlet />
        </motion.div>
      </main>

      <AuthModal />

      {/* 모바일 하단 탭바 — 로그인된 경우만 */}
      {user && <BottomNav />}

      <footer className="hidden sm:block w-full text-center mt-12 pt-4 border-t border-ink/10 text-xs opacity-50 uppercase tracking-widest">
        &copy; {new Date().getFullYear()} The Midnight Post. All rights reserved.
      </footer>
    </div>
  );
}
