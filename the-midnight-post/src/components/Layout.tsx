import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import { LogOut, BookOpen, PenTool, FlaskConical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BottomNav from './BottomNav';

export default function Layout() {
  const { user, setShowAuthModal, signOut } = useAuth();
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
              <button onClick={signOut} className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Logout">
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="hover:opacity-70 transition-opacity">
              Login
            </button>
          )}
        </nav>

        {/* 모바일: 비로그인 시에만 Login 버튼 표시 */}
        {!user && (
          <button
            onClick={() => setShowAuthModal(true)}
            className="sm:hidden hover:opacity-70 transition-opacity text-sm tracking-widest uppercase"
          >
            Login
          </button>
        )}
      </header>

      <main className="flex-1 w-full flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full flex flex-col items-center"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
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
