import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../components/AuthContext';
import { useVault } from '../components/VaultContext';
import { useSound } from '../components/SoundContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { rankMentors } from '../services/ai';
import { useTranslation } from 'react-i18next';
import { usePlan, FREE_LETTER_LIMIT, STANDARD_LETTER_LIMIT } from '../hooks/usePlan';
import UpgradeModal from '../components/UpgradeModal';

// ── 위기 키워드 (클라이언트 사이드) ──────────────────────────────────────────

const CRISIS_PATTERNS = [
  '죽고 싶', '죽고싶', '자살', '자해',
  '사라지고 싶', '사라지고싶', '없어지고 싶', '없어지고싶',
  '스스로 목숨', '삶을 끝', '살기 싫',
];

function hasCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some(k => text.includes(k));
}

function getTimePeriod(hour: number): string {
  if (hour >= 0 && hour < 5) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export default function Home() {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [crisisEntryId, setCrisisEntryId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('');
  const [timePeriod, setTimePeriod] = useState('night');
  const { user, setShowAuthModal } = useAuth();
  const { encrypt } = useVault();
  const { setTyping } = useSound();
  const navigate = useNavigate();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { isAdmin, isStandard, planLoaded, upgrade, checkLetterLimit } = usePlan();
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<{ used: number } >({ used: 0 });

  // 오늘 편지 사용량 조회 (free & standard 모두)
  useEffect(() => {
    if (!user || !planLoaded || isAdmin) return;
    checkLetterLimit().then(({ used }) => setMonthlyUsed(used));
  }, [user, planLoaded, isAdmin]);

  useEffect(() => {
    const period = getTimePeriod(new Date().getHours());
    setTimePeriod(period);
    const greetings = t(`home.time.${period}.greetings`, { returnObjects: true }) as string[];
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(false);
    };
  }, [setTyping]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // 플랜 한도 확인 (admin 제외)
    if (!isAdmin) {
      const { allowed, used } = await checkLetterLimit();
      if (!allowed) {
        setUpgradeReason({ used });
        setShowUpgradeModal(true);
        return;
      }
    }

    const isCrisis = hasCrisis(trimmed);
    setIsSubmitting(true);

    try {
      const entryRef = await addDoc(collection(db, 'entries'), {
        uid: user.uid,
        content: await encrypt(trimmed),
        emotion: 'unknown',
        createdAt: serverTimestamp(),
        status: 'replied',
      });

      const rankedMentors = rankMentors(trimmed);
      const writtenHour = new Date().getHours();

      await addDoc(collection(db, 'reply_jobs'), {
        uid: user.uid,
        entryId: entryRef.id,
        content: trimmed,
        writtenHour,
        rankedMentors,
        createdAt: serverTimestamp(),
      });

      if (!isCrisis) setShowAnimation(true);

      const submittedAt = Date.now();

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      const deliverTimes: Record<string, number> = {};
      const maxDelaysMs = [0, 60 * 1000, 2 * 60 * 1000, 3 * 60 * 1000];
      rankedMentors.forEach((mentorId, idx) => {
        deliverTimes[mentorId] = submittedAt + Math.random() * maxDelaysMs[idx];
      });
      localStorage.setItem('pendingEntryId', entryRef.id);
      localStorage.setItem('pendingDeliverTimes', JSON.stringify(deliverTimes));
      window.dispatchEvent(new Event('pendingEntryUpdated'));

      if (isCrisis) {
        setCrisisEntryId(entryRef.id);
      }
    } catch (error) {
      console.error('Error submitting entry:', error);
      setIsSubmitting(false);
      setShowAnimation(false);
    }
  };

  // ── 위기 상황 UI ─────────────────────────────────────────────────────────────
  if (crisisEntryId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="w-full max-w-sm flex flex-col items-center text-center gap-7 py-10"
      >
        <div className="flex items-center gap-3 opacity-25">
          <div className="w-10 h-px bg-ink" />
          <div className="w-1 h-1 rotate-45 bg-ink" />
          <div className="w-10 h-px bg-ink" />
        </div>

        <p className="font-serif text-xl leading-relaxed opacity-85">
          {t('home.crisis.title')}
        </p>
        <p className="font-serif text-sm leading-[1.9] opacity-55" style={{ whiteSpace: 'pre-line' }}>
          {t('home.crisis.subtitle')}
        </p>

        <div className="border border-ink/15 bg-[#fdfbf7] w-full px-8 py-7 flex flex-col items-center gap-2">
          <p className="text-[9px] uppercase tracking-[0.35em] opacity-35 mb-1">{t('home.crisis.hotlineLabel')}</p>
          <a
            href="tel:1393"
            className="font-serif text-4xl font-bold tracking-widest opacity-75 hover:opacity-100 transition-opacity"
          >
            1393
          </a>
          <p className="text-[10px] opacity-35">{t('home.crisis.hotlineDesc')}</p>
        </div>

        <a
          href="tel:1577-0199"
          className="text-xs opacity-35 hover:opacity-60 transition-opacity"
        >
          {t('home.crisis.mentalHealth')}
        </a>

        <div className="flex flex-col items-center gap-3 mt-2">
          <p className="text-xs opacity-35 font-serif italic">
            {t('home.crisis.mentorLetters')}
          </p>
          <Link
            to={`/mailbox?entryId=${crisisEntryId}`}
            className="font-serif text-sm italic opacity-55 hover:opacity-90 transition-opacity border-b border-ink/20 pb-px"
          >
            {t('home.crisis.checkLetters')}
          </Link>
        </div>

        <button
          onClick={() => { setCrisisEntryId(null); setContent(''); setIsSubmitting(false); }}
          className="mt-2 font-serif text-xs italic opacity-30 hover:opacity-55 transition-opacity"
        >
          {t('home.crisis.back')}
        </button>
      </motion.div>
    );
  }

  // ── 발송 애니메이션 ──────────────────────────────────────────────────────────
  if (showAnimation) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center justify-center text-center gap-8 py-8"
      >
        {/* 봉투 일러스트 */}
        <div className="w-24 h-16 bg-ink/10 relative flex items-center justify-center shadow-md">
          <div className="absolute inset-0 border border-ink/20 m-1" />
          <div className="w-6 h-6 rounded-full bg-red-800/80 flex items-center justify-center shadow-sm">
            <span className="text-[8px] text-white/80 font-serif">M</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-serif italic opacity-75 tracking-widest">{t('home.sentTitle')}</p>
          <p className="text-sm font-serif opacity-45 leading-relaxed break-keep" style={{ wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>
            {t('home.sentSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 opacity-20 w-24">
          <div className="flex-1 h-px bg-ink" />
          <div className="w-1 h-1 rotate-45 bg-[#D4AF37]" />
          <div className="flex-1 h-px bg-ink" />
        </div>

        <Link
          to="/study"
          className="font-serif italic text-sm opacity-50 hover:opacity-85 transition-opacity duration-300 border-b border-ink/20 pb-px"
        >
          {t('home.browseLibrary')}
        </Link>

        <button
          onClick={() => { setShowAnimation(false); setContent(''); setIsSubmitting(false); }}
          className="font-serif text-xs italic opacity-25 hover:opacity-50 transition-opacity duration-300 mt-2"
        >
          {t('home.backToDesk')}
        </button>
      </motion.div>
    );
  }

  // ── 메인 폼 ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-4">{t('home.title')}</h1>
        <p className="opacity-60 italic text-sm whitespace-pre-line break-keep" style={{ wordBreak: 'keep-all' }}>
          {t(`home.time.${timePeriod}.subtitle`)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        <div className="w-full relative">
          <textarea
            value={content}
            onChange={handleTextChange}
            maxLength={100}
            placeholder={greeting}
            className="w-full h-40 bg-transparent border-b-2 border-ink/20 resize-none focus:outline-none focus:border-ink/60 transition-colors p-4 text-center text-xl font-serif leading-relaxed break-keep"
            style={{ wordBreak: 'keep-all' }}
            disabled={isSubmitting}
          />
          <div className="absolute bottom-2 right-2 text-xs opacity-40 font-mono">
            {content.length} / 100
          </div>
        </div>

        <button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="mt-10 px-8 py-3 border border-ink/30 rounded-full hover:bg-ink hover:text-paper transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink tracking-widest uppercase text-sm"
        >
          {isSubmitting ? t('home.sending') : t('home.sendButton')}
        </button>

        {/* 일일 편지 사용량 표시 (admin 제외) */}
        {planLoaded && !isAdmin && user && (
          <p className="mt-4 font-serif text-[11px] italic opacity-30 tracking-wide">
            오늘 편지 {monthlyUsed} / {isStandard ? STANDARD_LETTER_LIMIT : FREE_LETTER_LIMIT}통 사용
          </p>
        )}
      </form>

      <AnimatePresence>
        {showUpgradeModal && (
          <UpgradeModal
            reason="letter"
            used={upgradeReason.used}
            onUpgrade={upgrade}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
