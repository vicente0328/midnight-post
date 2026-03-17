import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useSound } from '../components/SoundContext';
import { MentorReply } from '../services/ai';
import { X, Feather, Flower2, Cross, Brush, MessageCircle, Bookmark } from 'lucide-react';


const WAITING_PHRASES = [
  "당신의 마음에 귀 기울이고 있습니다.",
  "오래된 책장을 넘기며 지혜를 찾고 있습니다.",
  "촛불 아래 붓을 들고 있습니다.",
  "깊은 사유 끝에 말씀을 가다듬고 있습니다.",
  "먹을 갈며 마음을 정돈하고 있습니다.",
  "당신의 하루를 조용히 헤아리고 있습니다.",
];

const MENTORS = {
  hyewoon: { 
    name: '혜운 스님', 
    title: '비움과 머무름의 수행자', 
    icon: <Flower2 className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-stone-700 to-stone-900'
  },
  benedicto: { 
    name: '베네딕토 신부', 
    title: '사랑과 위로의 동반자', 
    icon: <Cross className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-red-900 to-red-950'
  },
  theodore: { 
    name: '테오도르 교수', 
    title: '이성과 실존의 철학자', 
    icon: <Feather className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-slate-800 to-slate-950'
  },
  yeonam: { 
    name: '연암 선생', 
    title: '순리와 조화의 선비', 
    icon: <Brush className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-emerald-900 to-emerald-950'
  }
};

// 항상 고정 순서로 4칸 유지 — 레이아웃 흔들림 방지
const MENTOR_ORDER = ['hyewoon', 'benedicto', 'theodore', 'yeonam'] as const;

export default function Envelopes() {
  const { entryId } = useParams();
  const { user } = useAuth();
  const { playArrivalSound } = useSound();
  const navigate = useNavigate();
  const [replies, setReplies] = useState<MentorReply[]>([]);
  const [selectedReply, setSelectedReply] = useState<MentorReply | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  // 페이지 전환 완료 후 애니메이션 시작 — 전환 중 글리치 방지
  const [ready, setReady] = useState(false);

  // 도착 순서 추적 (stagger delay 계산용)
  const arrivalOrderRef = React.useRef<string[]>([]);
  const prevRepliesRef = React.useRef<MentorReply[]>([]);

  // 페이지 마운트 후 짧은 대기 후 애니메이션 허용
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (replies.length >= MENTOR_ORDER.length) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % WAITING_PHRASES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [replies.length]);

  // 새 편지 도착 감지 → 사운드만 재생 (glow 제거하여 클래스 전환 글리치 방지)
  useEffect(() => {
    if (prevRepliesRef.current.length > 0 && replies.length > prevRepliesRef.current.length) {
      const newReplies = replies.filter(
        r => !prevRepliesRef.current.find(pr => pr.mentorId === r.mentorId)
      );
      if (newReplies.length > 0) playArrivalSound();
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReplies: MentorReply[] = [];
      snapshot.forEach((doc) => {
        fetchedReplies.push(doc.data() as MentorReply);
      });
      // 도착 순서 기록 (한 번 기록되면 바뀌지 않음)
      fetchedReplies.forEach(r => {
        if (!arrivalOrderRef.current.includes(r.mentorId)) {
          arrivalOrderRef.current = [...arrivalOrderRef.current, r.mentorId];
        }
      });
      setReplies(fetchedReplies);
    }, (error) => {
      console.error("Error listening to replies:", error);
    });

    return () => unsubscribe();
  }, [entryId, user]);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <h1 className="text-3xl font-serif mb-6">The Four Envelopes</h1>
      <p className="opacity-60 italic text-sm mb-8">네 명의 현자가 당신에게 보내는 위로의 편지입니다.</p>

      {/* 대기 문구 — min-h로 공간 고정, 사라질 때 레이아웃 안 흔들림 */}
      <div className="min-h-[2.5rem] flex items-center justify-center mb-10">
        <AnimatePresence mode="wait">
          {replies.length < MENTOR_ORDER.length && (
            <motion.p
              key={phraseIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="font-serif italic text-sm text-[#8B7355] tracking-wide text-center px-4"
            >
              — {WAITING_PHRASES[phraseIndex]} —
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 항상 4칸 고정 그리드 — 카드 추가로 인한 리플로우 없음 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
        {MENTOR_ORDER.map((mentorId) => {
          const mentor = MENTORS[mentorId];
          const reply = replies.find(r => r.mentorId === mentorId);
          const hasArrived = !!reply;
          // 도착 순서 기반 stagger: 연속 도착해도 순차적으로 부드럽게
          const arrivalIdx = arrivalOrderRef.current.indexOf(mentorId);
          const staggerDelay = ready && arrivalIdx >= 0 ? arrivalIdx * 0.18 : 0;

          return (
            <motion.div
              key={mentorId}
              initial={{ opacity: 0, y: 14 }}
              animate={ready && hasArrived ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
              transition={{
                duration: 1.1,
                ease: [0.22, 1, 0.36, 1],
                delay: staggerDelay,
              }}
              onClick={() => reply && setSelectedReply(reply)}
              // 도착 전엔 포인터 이벤트 차단, 공간은 유지
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

              <h3 className="font-serif text-lg font-bold mb-2 text-ink/90">{mentor.name}</h3>
              <p className="text-[10px] opacity-60 uppercase tracking-widest text-center">{mentor.title}</p>
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
  const mentor = MENTORS[reply.mentorId];
  const [bookmarkDocId, setBookmarkDocId] = useState<string | null>(null);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // 이미 북마크됐는지 확인
  useEffect(() => {
    if (!user) return;
    getDocs(query(
      collection(db, 'bookmarks'),
      where('uid', '==', user.uid),
      where('entryId', '==', entryId),
      where('mentorId', '==', reply.mentorId)
    )).then(snap => {
      if (!snap.empty) setBookmarkDocId(snap.docs[0].id);
    }).catch(() => {});
  }, [user, entryId, reply.mentorId]);

  const toggleBookmark = useCallback(async () => {
    if (!user || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarkDocId) {
        const snap = await getDocs(query(
          collection(db, 'bookmarks'),
          where('uid', '==', user.uid),
          where('entryId', '==', entryId),
          where('mentorId', '==', reply.mentorId)
        ));
        for (const d of snap.docs) await deleteDoc(d.ref);
        setBookmarkDocId(null);
      } else {
        const docRef = await addDoc(collection(db, 'bookmarks'), {
          uid: user.uid,
          entryId,
          mentorId: reply.mentorId,
          quote: reply.quote,
          source: reply.source ?? '',
          translation: reply.translation,
          advice: reply.advice,
          savedAt: serverTimestamp(),
        });
        setBookmarkDocId(docRef.id);
      }
    } catch (e) {
      console.error('Bookmark error:', e);
    } finally {
      setBookmarkLoading(false);
    }
  }, [user, bookmarkDocId, bookmarkLoading, entryId, reply]);

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
            title={bookmarkDocId ? '서재에서 제거' : '나의 서재에 저장'}
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
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-wider sm:tracking-widest text-ink/90">{mentor.name}</h2>
          <p className="text-[10px] sm:text-xs opacity-50 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-2">{mentor.title}</p>
        </div>

        <div className="font-serif text-ink/90">
          {/* Lyrical Quote Section */}
          <div className="text-center mb-6 md:mb-16 relative px-0 md:px-12">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-7xl sm:text-8xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>

            <p className="text-base sm:text-2xl md:text-3xl leading-relaxed italic text-ink/90 mb-5 relative z-10 font-medium">
              {reply.quote}
            </p>

            <div className="flex items-center justify-center gap-3 mb-5 opacity-60">
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent"></div>
              {reply.source && <span className="text-xs sm:text-sm tracking-wider whitespace-nowrap shrink-0">{reply.source}</span>}
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent"></div>
            </div>

            <p className="text-sm sm:text-base md:text-lg leading-relaxed text-ink/70 mx-auto">
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
            {reply.advice.split('\n').map((paragraph, index) => {
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
            <p className="text-sm sm:text-lg">당신의 평안을 기원하며,</p>
            <p className="text-base sm:text-xl mt-1 sm:mt-2 font-bold">{mentor.name} 드림</p>
          </div>

          {/* 담소 나누기 버튼 */}
          <div className="mt-10 md:mt-16 flex justify-center">
            <button
              onClick={() => onStartDamso(reply.mentorId)}
              className="group relative flex items-center gap-3 font-serif text-sm sm:text-base tracking-wide transition-all duration-500 px-6 py-3 border border-[#D4AF37]/40 hover:border-[#D4AF37]/80 hover:bg-[#D4AF37]/5"
            >
              {/* 모서리 장식 */}
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
                {mentor.name}와 담소 나누기
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
