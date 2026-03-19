import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, setDoc, deleteDoc, getDocs, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useVault } from '../components/VaultContext';
import { useSound } from '../components/SoundContext';
import { MentorReply } from '../services/ai';
import { prefetchDamso, type MentorId } from '../services/damso';
import { X, Feather, Flower2, Cross, Brush, MessageCircle, Bookmark, ChevronLeft } from 'lucide-react';
import { ShareCardButton } from '../utils/shareCard';
import { useTranslation } from 'react-i18next';


const MENTOR_ICONS: Record<string, { icon: React.ReactElement; color: string }> = {
  hyewoon:   { icon: <Flower2 className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-stone-700 to-stone-900' },
  benedicto: { icon: <Cross   className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-red-900 to-red-950' },
  theodore:  { icon: <Feather className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-slate-800 to-slate-950' },
  yeonam:    { icon: <Brush   className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-emerald-900 to-emerald-950' },
};

// 항상 고정 순서로 4칸 유지 — 레이아웃 흔들림 방지
const MENTOR_ORDER = ['hyewoon', 'benedicto', 'theodore', 'yeonam'] as const;

export default function Envelopes() {
  const { entryId } = useParams();
  const { user } = useAuth();
  const { decrypt } = useVault();
  const { playArrivalSound } = useSound();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [allReplies, setAllReplies] = useState<MentorReply[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [selectedReply, setSelectedReply] = useState<MentorReply | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  // 페이지 전환 완료 후 애니메이션 시작 — 전환 중 글리치 방지
  const [ready, setReady] = useState(false);

  const waitingPhrases = t('envelopes.waitingPhrases', { returnObjects: true }) as string[];

  // localStorage의 deliverTimes 기준 필터링
  const pendingEntryId = localStorage.getItem('pendingEntryId');
  const deliverTimes: Record<string, number> = (() => {
    try { return JSON.parse(localStorage.getItem('pendingDeliverTimes') ?? '{}'); } catch { return {}; }
  })();
  const replies = allReplies.filter(r => {
    if (entryId !== pendingEntryId) return true; // 이전 편지함은 바로 표시
    const deliverMs = deliverTimes[r.mentorId];
    return !deliverMs || deliverMs <= now.getTime();
  });

  // 도착 순서 추적 (stagger delay 계산용)
  const arrivalOrderRef = React.useRef<string[]>([]);
  const prevRepliesRef = React.useRef<MentorReply[]>([]);

  // 페이지 마운트 후 짧은 대기 후 애니메이션 허용
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // now 갱신 — 미래의 deliverAt이 지나면 카드 자동 표시
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (replies.length >= MENTOR_ORDER.length) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % waitingPhrases.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [replies.length, waitingPhrases.length]);

  // 새 편지 도착 감지 (deliverAt 기준) → 사운드 재생
  useEffect(() => {
    if (prevRepliesRef.current.length > 0 && replies.length > prevRepliesRef.current.length) {
      const newVisible = replies.filter(
        r => !prevRepliesRef.current.find(pr => pr.mentorId === r.mentorId)
      );
      if (newVisible.length > 0) playArrivalSound();
    }
    prevRepliesRef.current = replies;
  }, [replies, playArrivalSound]);

  useEffect(() => {
    if (!user || !entryId) return;

    const q = query(
      collection(db, 'replies'),
      where('uid', '==', user.uid),
      where('entryId', '==', entryId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedReplies: MentorReply[] = await Promise.all(
        snapshot.docs.map(async (d) => {
          const data = d.data();
          return {
            ...data,
            quote: await decrypt(data.quote ?? ''),
            translation: await decrypt(data.translation ?? ''),
            advice: await decrypt(data.advice ?? ''),
            source: data.source ? await decrypt(data.source) : data.source,
          } as MentorReply;
        })
      );
      // 도착 순서 기록 (한 번 기록되면 바뀌지 않음)
      fetchedReplies.forEach(r => {
        if (!arrivalOrderRef.current.includes(r.mentorId)) {
          arrivalOrderRef.current = [...arrivalOrderRef.current, r.mentorId];
        }
      });
      setAllReplies(fetchedReplies);
    }, (error) => {
      console.error("Error listening to replies:", error);
    });

    return () => unsubscribe();
  }, [entryId, user]);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        className="self-start flex items-center gap-2 mb-6 opacity-40 hover:opacity-80 transition-opacity duration-300 text-sm font-serif italic"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        {t('envelopes.back')}
      </button>

      <h1 className="text-3xl font-serif mb-6">{t('envelopes.title')}</h1>
      <p className="opacity-60 italic text-sm mb-8">{t('envelopes.subtitle')}</p>

      {/* 대기 문구 + 안내 */}
      <div className="min-h-[7rem] flex flex-col items-center justify-center gap-3 mb-10">
        <AnimatePresence mode="wait">
          {replies.length < MENTOR_ORDER.length ? (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-2"
            >
              <motion.p
                key={phraseIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="font-serif italic text-sm text-[#8B7355] tracking-wide text-center px-4"
              >
                — {waitingPhrases[phraseIndex]} —
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1.2 }}
                className="flex flex-col items-center gap-2"
              >
                <p className="font-serif text-xs text-ink/35 text-center leading-relaxed px-6" style={{ whiteSpace: 'pre-line' }}>
                  {t('envelopes.waitHint')}
                </p>
                <button
                  onClick={() => navigate('/study')}
                  className="font-serif italic text-xs text-[#8B7355] hover:text-[#6b5a3e] transition-colors duration-300 border-b border-[#8B7355]/50 hover:border-[#6b5a3e] pb-px mt-1"
                >
                  {t('envelopes.visitLibrary')}
                </button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.p
              key="complete"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
              className="font-serif italic text-sm text-[#8B7355]/55 tracking-wide text-center"
            >
              {t('envelopes.allArrived')}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 항상 4칸 고정 그리드 — 카드 추가로 인한 리플로우 없음 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
        {MENTOR_ORDER.map((mentorId) => {
          const mentor = MENTOR_ICONS[mentorId];
          const mentorName = t(`mentors.${mentorId}.name`);
          const mentorTitle = t(`mentors.${mentorId}.title`);
          const reply = replies.find(r => r.mentorId === mentorId);
          const hasArrived = !!reply;
          // 도착 순서 기반 stagger: 연속 도착해도 순차적으로 부드럽게
          const arrivalIdx = arrivalOrderRef.current.indexOf(mentorId);
          const staggerDelay = ready && arrivalIdx >= 0 ? arrivalIdx * 0.18 : 0;

          // 카드 순서 기반 초기 등장 딜레이 (페이지 진입 시)
          const cardIdx = MENTOR_ORDER.indexOf(mentorId);
          const entranceDelay = ready ? cardIdx * 0.12 : 0;

          return (
            <motion.div
              key={mentorId}
              initial={{ opacity: 0, y: 14 }}
              animate={ready ? { opacity: hasArrived ? 1 : 0.45, y: 0 } : { opacity: 0, y: 14 }}
              transition={{
                duration: hasArrived ? 1.1 : 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: hasArrived ? staggerDelay : entranceDelay,
              }}
              onClick={() => reply && setSelectedReply(reply)}
              className={`relative flex flex-col items-center justify-center p-8 bg-[#FAFAFA] border border-[#E5E0D8] shadow-md h-72 overflow-hidden
                ${hasArrived ? 'cursor-pointer group hover:shadow-xl transition-shadow duration-700' : 'pointer-events-none'}`}
            >
              <div className="absolute top-2 left-2 w-6 h-6 border-t border-l border-[#D4AF37]/40 pointer-events-none" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t border-r border-[#D4AF37]/40 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b border-l border-[#D4AF37]/40 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b border-r border-[#D4AF37]/40 pointer-events-none" />

              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${mentor.color} p-1 shadow-lg mb-8 relative flex items-center justify-center
                ${hasArrived ? 'group-hover:scale-110 transition-transform duration-500' : ''}`}>
                <div className="absolute inset-1 rounded-full border border-[#D4AF37]/50" />
                <div className="absolute inset-2 rounded-full border border-dashed border-[#D4AF37]/40" />
                {mentor.icon}
              </div>

              <h3 className="font-serif text-lg font-bold mb-2 text-ink/90">{mentorName}</h3>
              {hasArrived ? (
                <p className="text-[10px] opacity-60 uppercase tracking-widest text-center">{mentorTitle}</p>
              ) : (
                <p className="font-serif italic text-[11px] text-[#8B7355]/60 animate-pulse mt-1">{t('envelopes.writing')}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedReply && (
          <LetterModal
            reply={selectedReply}
            entryId={entryId ?? ''}
            onClose={() => setSelectedReply(null)}
            onStartDamso={(mentorId) => {
              prefetchDamso(mentorId as MentorId, async () => {
                const snap = await getDoc(doc(db, 'entries', entryId ?? ''));
                const raw = snap.exists() ? String(snap.data().content ?? '') : '';
                return decrypt(raw);
              });
              setSelectedReply(null);
              navigate(`/damso/${entryId}/${mentorId}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Split a paragraph into dialogue and non-dialogue segments
// Matches "…" (straight double quotes) and "…" / "…" (curly quotes)
function splitDialogue(text: string): { text: string; isDialogue: boolean }[] {
  const regex = /("([^"]*?)"|"([^"]*?)")/g;
  const segments: { text: string; isDialogue: boolean }[] = [];
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(last, match.index).trim();
    if (before) segments.push({ text: before, isDialogue: false });
    segments.push({ text: match[0], isDialogue: true });
    last = match.index + match[0].length;
  }
  const after = text.slice(last).trim();
  if (after) segments.push({ text: after, isDialogue: false });
  return segments.length > 0 ? segments : [{ text, isDialogue: false }];
}

function LetterModal({
  reply,
  entryId,
  onClose,
  onStartDamso,
}: {
  reply: MentorReply;
  entryId: string;
  onClose: () => void;
  onStartDamso: (mentorId: string) => void;
}) {
  const { user } = useAuth();
  const { encrypt } = useVault();
  const { t } = useTranslation();
  const mentor = MENTOR_ICONS[reply.mentorId];
  const mentorName = t(`mentors.${reply.mentorId}.name`);
  const mentorTitle = t(`mentors.${reply.mentorId}.title`);
  const mentorParticle = t(`mentors.${reply.mentorId}.particle`);
  const [bookmarkDocId, setBookmarkDocId] = useState<string | null>(null);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // 책갈피 문서 ID — 예측 가능한 ID로 composite index 불필요
  const bookmarkId = user ? `${user.uid}_${entryId}_${reply.mentorId}` : '';

  // 이미 책갈피됐는지 확인 (getDoc — 인덱스 불필요)
  useEffect(() => {
    if (!user || !bookmarkId) return;
    getDoc(doc(db, 'bookmarks', bookmarkId)).then(snap => {
      setBookmarkDocId(snap.exists() ? snap.id : null);
    }).catch(() => {});
  }, [user, bookmarkId]);

  const toggleBookmark = useCallback(async () => {
    if (!user || bookmarkLoading || !bookmarkId) return;
    setBookmarkLoading(true);
    try {
      if (bookmarkDocId) {
        await deleteDoc(doc(db, 'bookmarks', bookmarkId));
        setBookmarkDocId(null);
      } else {
        await setDoc(doc(db, 'bookmarks', bookmarkId), {
          uid: user.uid,
          entryId,
          mentorId: reply.mentorId,
          quote: await encrypt(reply.quote),
          source: await encrypt(reply.source ?? ''),
          translation: await encrypt(reply.translation),
          advice: await encrypt(reply.advice),
          savedAt: serverTimestamp(),
        });
        setBookmarkDocId(bookmarkId);
      }
    } catch (e) {
      console.error('Bookmark error:', e);
    } finally {
      setBookmarkLoading(false);
    }
  }, [user, bookmarkDocId, bookmarkLoading, bookmarkId, entryId, reply]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 md:p-8 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-[#fdfbf7] p-5 sm:p-10 md:p-20 shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-y-auto overscroll-contain max-h-[95vh] letter-scroll border border-[#D4AF37]/20"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 100px rgba(139, 115, 85, 0.1), 0 20px 60px rgba(0,0,0,0.4)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-8 sm:right-8 opacity-40 hover:opacity-100 transition-all duration-300 hover:rotate-90"
        >
          <X size={28} strokeWidth={1} />
        </button>

        {/* 북마크 버튼 */}
        {user && (
          <button
            onClick={toggleBookmark}
            disabled={bookmarkLoading}
            title={bookmarkDocId ? t('envelopes.bookmarkRemove') : t('envelopes.bookmarkSave')}
            className="absolute top-4 right-12 sm:top-8 sm:right-16 transition-all duration-300 disabled:opacity-30"
          >
            <Bookmark
              size={22}
              strokeWidth={1.5}
              className={bookmarkDocId
                ? 'fill-[#D4AF37] text-[#D4AF37]'
                : 'text-ink/40 hover:text-[#D4AF37] transition-colors duration-300'}
            />
          </button>
        )}

        {/* Header: Mentor Info */}
        <div className="flex flex-col items-center mb-6 md:mb-16">
          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${mentor.color} p-1 shadow-md mb-4 relative flex items-center justify-center`}>
            <div className="absolute inset-1 rounded-full border border-[#D4AF37]/50"></div>
            {React.cloneElement(mentor.icon as React.ReactElement, { className: "w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" })}
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-wider sm:tracking-widest text-ink/90">{mentorName}</h2>
          <p className="text-[10px] sm:text-xs opacity-50 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-2">{mentorTitle}</p>
        </div>

        <div className="font-serif text-ink/90">
          {/* Lyrical Quote Section */}
          <div className="text-center mb-6 md:mb-16 relative px-0 md:px-12">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-7xl sm:text-8xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>

            <p className="text-base sm:text-2xl md:text-3xl leading-relaxed italic text-ink/90 mb-5 relative z-10 font-medium break-keep break-words" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {reply.quote}
            </p>

            <div className="flex items-center justify-center gap-3 mb-5 opacity-60">
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent"></div>
              {reply.source && <span className="text-xs sm:text-sm tracking-wider break-keep break-words shrink-0" style={{ textWrap: 'balance' } as React.CSSProperties}>{reply.source}</span>}
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent"></div>
            </div>

            <p className="text-sm sm:text-base md:text-lg leading-relaxed text-ink/70 mx-auto break-keep break-words" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {reply.translation}
            </p>
          </div>

          {/* Elegant Divider */}
          <div className="flex justify-center items-center gap-3 my-6 md:my-16 opacity-40">
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]"></div>
            <div className="w-1 h-1 rotate-45 bg-[#D4AF37]/60"></div>
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]"></div>
          </div>

          {/* Advice Section */}
          <div className="text-[15px] sm:text-lg md:text-xl leading-[1.85] sm:leading-[2.1] md:leading-[2.2] text-ink/90 md:text-justify md:break-keep px-0 md:px-8">
            {reply.advice.replace(/\\n/g, '\n').split('\n').map((paragraph, index) => {
              if (!paragraph.trim()) return null;
              const isFirstParagraph = index === 0;
              const segments = splitDialogue(paragraph);
              return (
                <p
                  key={index}
                  className={`mb-5 md:mb-7 ${isFirstParagraph ? 'sm:first-letter:text-5xl sm:first-letter:font-bold sm:first-letter:text-[#D4AF37] sm:first-letter:mr-2 sm:first-letter:float-left sm:first-letter:leading-none sm:first-letter:mt-2' : ''}`}
                >
                  {segments.map((seg, si) =>
                    seg.isDialogue
                      ? <span key={si} className="block mt-1 mb-1">{seg.text}</span>
                      : <span key={si}>{seg.text}</span>
                  )}
                </p>
              );
            })}
          </div>

          {/* Footer Signature */}
          <div className="mt-8 md:mt-24 text-right opacity-60 italic">
            <p className="text-sm sm:text-lg">{t('envelopes.footer')}</p>
            <p className="text-base sm:text-xl mt-1 sm:mt-2 font-bold">{t('envelopes.from', { name: mentorName })}</p>
          </div>

          {/* 담소 나누기 버튼 */}
          <div className="mt-10 md:mt-16 flex justify-center">
            <button
              onClick={() => onStartDamso(reply.mentorId)}
              className="group relative flex items-center gap-3 font-serif text-sm sm:text-base tracking-wide transition-all duration-500 px-6 py-3 border border-[#D4AF37]/40 hover:border-[#D4AF37]/80 hover:bg-[#D4AF37]/5"
            >
              <span className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[#D4AF37]/50 group-hover:border-[#D4AF37] transition-colors duration-500 pointer-events-none" />
              <span className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[#D4AF37]/50 group-hover:border-[#D4AF37] transition-colors duration-500 pointer-events-none" />
              <span className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#D4AF37]/50 group-hover:border-[#D4AF37] transition-colors duration-500 pointer-events-none" />
              <span className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#D4AF37]/50 group-hover:border-[#D4AF37] transition-colors duration-500 pointer-events-none" />
              <MessageCircle
                size={15}
                strokeWidth={1.5}
                className="text-[#D4AF37]/70 group-hover:text-[#D4AF37] transition-colors duration-500"
              />
              <span className="italic text-ink/60 group-hover:text-ink/90 transition-colors duration-500">
                {t('envelopes.startDamso', { name: mentorName, particle: mentorParticle })}
              </span>
            </button>
          </div>

          {/* 공유 카드 */}
          <div className="mt-10 md:mt-12 flex flex-col items-center gap-3">
            <div className="h-px w-full bg-ink/8" />
            <div className="mt-3">
              <ShareCardButton
                mentorName={mentorName}
                quote={reply.quote}
                source={reply.source ?? ''}
                translation={reply.translation}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
