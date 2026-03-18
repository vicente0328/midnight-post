import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import { LogOut, BookOpen, PenTool, Feather, Mail, Menu, X, UserRound, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BottomNav from './BottomNav';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const MENTOR_NAMES: Record<string, string> = {
  hyewoon: '혜운 스님',
  benedicto: '베네딕토 신부',
  theodore: '테오도르 교수',
  yeonam: '연암 선생',
};

interface ToastItem {
  id: string;
  mentorId: string;
  entryId: string;
}

export default function Layout() {
  const { user, setShowAuthModal, setShowGuideModal, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pendingRepliesRef = useRef<Map<string, any>>(new Map());
  const notifiedRef = useRef<Set<string>>(new Set());

  // 전역 편지 도착 감지
  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      unsubscribe?.();
      if (interval) clearInterval(interval);
    };

    const initListener = () => {
      cleanup();
      pendingRepliesRef.current.clear();

      const pendingEntryId = localStorage.getItem('pendingEntryId');
      if (!pendingEntryId) return;

      const q = query(
        collection(db, 'replies'),
        where('uid', '==', user.uid),
        where('entryId', '==', pendingEntryId)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.forEach((doc) => {
          pendingRepliesRef.current.set(doc.id, { ...doc.data(), id: doc.id });
        });
      });

      // 5초마다 deliverTimes 체크
      interval = setInterval(() => {
        const nowMs = Date.now();
        let deliverTimes: Record<string, number> = {};
        try { deliverTimes = JSON.parse(localStorage.getItem('pendingDeliverTimes') ?? '{}'); } catch {}

        const newlyArrived: ToastItem[] = [];
        pendingRepliesRef.current.forEach((data, docId) => {
          const deliverMs = deliverTimes[data.mentorId];
          if (deliverMs && deliverMs <= nowMs && !notifiedRef.current.has(docId)) {
            notifiedRef.current.add(docId);
            newlyArrived.push({ id: docId, mentorId: data.mentorId, entryId: pendingEntryId });
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`${MENTOR_NAMES[data.mentorId] ?? '현자'}의 편지가 도착했습니다`, {
                body: '오늘의 일기에 대한 답장이 왔습니다. 확인해보세요.',
                icon: '/icon-192x192.png',
              });
            }
          }
        });
        if (newlyArrived.length > 0) {
          setToasts(prev => [...prev, ...newlyArrived]);
        }
        if (notifiedRef.current.size >= 4) {
          localStorage.removeItem('pendingEntryId');
          localStorage.removeItem('pendingDeliverTimes');
          cleanup();
        }
      }, 5000);
    };

    initListener();
    window.addEventListener('pendingEntryUpdated', initListener);

    return () => {
      cleanup();
      window.removeEventListener('pendingEntryUpdated', initListener);
    };
  }, [user]);

  useEffect(() => {
    if (!showMobileMenu) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [showMobileMenu]);

  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div className="min-h-screen flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-8 pb-24 sm:pb-8">
      <header className="w-full flex justify-between items-center mb-12 border-b border-ink/10 pb-4 relative">
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
              <Link to="/mailbox" className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Mailbox">
                <Inbox size={16} />
                <span>Mailbox</span>
              </Link>
              <Link to="/study" className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="멘토의 연구실">
                <BookOpen size={16} />
                <span>Library</span>
              </Link>
              <Link to="/archive" className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Archive">
                <Feather size={16} strokeWidth={1.4} />
                <span>Archive</span>
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

        {/* 모바일 우측: 햄버거 메뉴 + 드롭다운 */}
        <div ref={mobileMenuRef} className="sm:hidden relative flex items-center gap-3">
          {user ? (
            <button
              onClick={() => setShowMobileMenu(prev => !prev)}
              className="flex items-center transition-opacity"
              style={{ opacity: showMobileMenu ? 0.85 : 0.45 }}
              onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
              onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.opacity = showMobileMenu ? '0.85' : '0.45'; }}
              title="Menu"
            >
              {showMobileMenu
                ? <X size={20} strokeWidth={1.3} />
                : <Menu size={20} strokeWidth={1.3} />
              }
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="hover:opacity-70 transition-opacity text-sm tracking-widest uppercase"
            >
              Login
            </button>
          )}

          {/* 모바일 드롭다운 메뉴 */}
          <AnimatePresence>
            {showMobileMenu && user && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute top-full right-0 mt-2 z-50 border border-ink/12 shadow-lg min-w-[160px]"
                style={{
                  backgroundColor: '#fdfbf7',
                  backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
                }}
              >
                <div className="flex flex-col py-2">
                  <button
                    onClick={() => { setShowMobileMenu(false); setShowGuideModal(true); }}
                    className="flex items-center gap-3 px-5 py-3 text-sm font-serif opacity-55 hover:opacity-90 transition-opacity text-left"
                  >
                    <Feather size={14} strokeWidth={1.4} />
                    <span>Guide</span>
                  </button>
                  <Link
                    to="/account"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-5 py-3 text-sm font-serif opacity-55 hover:opacity-90 transition-opacity"
                  >
                    <UserRound size={14} strokeWidth={1.4} />
                    <span>Account</span>
                  </Link>
                  <div className="mx-5 my-1 h-px bg-ink/8" />
                  <button
                    onClick={() => { setShowMobileMenu(false); signOut(); }}
                    className="flex items-center gap-3 px-5 py-3 text-sm font-serif opacity-40 hover:opacity-75 transition-opacity text-left"
                  >
                    <LogOut size={14} strokeWidth={1.4} />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

      {/* 편지 도착 토스트 */}
      <div className="fixed bottom-24 sm:bottom-6 right-4 z-50 flex flex-col gap-2 items-end">
        <AnimatePresence>
          {toasts.map((toast) => (
            <LetterToast
              key={toast.id}
              mentorName={MENTOR_NAMES[toast.mentorId] ?? '현자'}
              onOpen={() => { dismissToast(toast.id); navigate(`/mailbox?entryId=${toast.entryId}`); }}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      <footer className="hidden sm:block w-full text-center mt-12 pt-4 border-t border-ink/10 text-xs opacity-50 uppercase tracking-widest">
        &copy; {new Date().getFullYear()} The Midnight Post. All rights reserved.
      </footer>
    </div>
  );
}

function LetterToast({
  mentorName,
  onOpen,
  onDismiss,
}: {
  mentorName: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  // 8초 후 자동 닫기
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#fdfbf7] border border-[#D4AF37]/40 shadow-lg px-5 py-4 flex items-center gap-4 max-w-xs"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
    >
      <Mail size={18} className="text-[#D4AF37] shrink-0" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="font-serif text-sm text-ink/90 leading-snug">
          <span className="font-semibold">{mentorName}</span>의 편지가 도착했습니다
        </p>
      </div>
      <button
        onClick={onOpen}
        className="font-serif italic text-[11px] text-[#8B7355] hover:text-ink transition-colors shrink-0 border-b border-[#8B7355]/40"
      >
        열어보기
      </button>
    </motion.div>
  );
}
