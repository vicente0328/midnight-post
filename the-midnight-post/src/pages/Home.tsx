import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../components/AuthContext';
import { useSound } from '../components/SoundContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, addDoc, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { generateSingleMentorReply, rankMentors } from '../services/ai';

// ── 위기 키워드 (클라이언트 사이드) ──────────────────────────────────────────

const CRISIS_PATTERNS = [
  '죽고 싶', '죽고싶', '자살', '자해',
  '사라지고 싶', '사라지고싶', '없어지고 싶', '없어지고싶',
  '스스로 목숨', '삶을 끝', '살기 싫',
];

function hasCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some(k => text.includes(k));
}

// ── 시간대별 문구 ──────────────────────────────────────────────────────────────

const TIME_CONTENT: Record<string, { subtitle: string; greetings: string[] }> = {
  dawn: {
    subtitle: "새벽에 찾아온 당신의\n마음을 한 줄로 남겨주세요.",
    greetings: [
      "이른 새벽,\n무엇이 당신을 깨웠나요?",
      "새벽의 고요 속에서\n어떤 생각이 머무나요?",
      "남들이 잠든 시간,\n혼자 깨어있는 당신에게.",
      "새벽빛이 스미기 전,\n마음속 이야기를 나눠요.",
      "당신의 모든 순간을 존중합니다.",
    ],
  },
  morning: {
    subtitle: "오늘 하루, 어떤\n마음으로 시작하시나요?",
    greetings: [
      "좋은 아침입니다.\n오늘은 어떤 하루를 보내실 건가요?",
      "새로운 하루가 시작되었습니다.\n오늘의 마음은 어떤가요?",
      "아침의 첫 마음을\n한 줄로 남겨주세요.",
      "오늘 하루를\n어떻게 맞이하고 싶으신가요?",
      "천천히,\n당신의 속도대로 이야기해주세요.",
    ],
  },
  afternoon: {
    subtitle: "오후의 한 자락,\n당신의 이야기를 들려주세요.",
    greetings: [
      "오후의 햇살 속에서\n어떤 생각이 스치나요?",
      "하루의 중간,\n잠시 마음을 들여다보세요.",
      "오늘 하루는\n지금까지 어떠신가요?",
      "잠깐 멈추어,\n당신의 마음을 살펴보세요.",
      "마음속에 담아둔 말을\n조용히 꺼내보세요.",
    ],
  },
  evening: {
    subtitle: "하루의 끝자락,\n마음을 한 줄로 남겨주세요.",
    greetings: [
      "하루를 마무리하며\n어떤 감정이 남아있나요?",
      "저녁 노을처럼,\n오늘 하루를 되돌아보세요.",
      "수고한 하루를 함께 돌아봐요.",
      "저녁이 왔습니다.\n오늘 당신의 마음은 어땠나요?",
      "이곳에서는 어떤 감정이든 괜찮습니다.",
    ],
  },
  night: {
    subtitle: "지친 밤, 당신의\n마음을 한 줄로 남겨주세요.",
    greetings: [
      "오늘 하루는 어땠나요?",
      "당신의 밤이 평안하기를 바랍니다.",
      "밤이 깊어가는 시간,\n어떤 생각에 잠겨 있나요?",
      "누구에게도 하지 못한 말이 있다면\n이곳에 남겨주세요.",
      "오늘 하루도 견뎌내느라 애썼습니다.",
      "당신의 발걸음이 머무는 이 밤.",
      "오늘 하루의 무게를\n이곳에 덜어두세요.",
    ],
  },
};

function getTimePeriod(hour: number): string {
  if (hour >= 0 && hour < 5) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export default function Home() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  // crisisEntryId: entry ID when crisis detected (non-null = crisis UI visible)
  const [crisisEntryId, setCrisisEntryId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('');
  const [timePeriod, setTimePeriod] = useState('night');
  const { user, setShowAuthModal } = useAuth();
  const { setTyping } = useSound();
  const navigate = useNavigate();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const period = getTimePeriod(new Date().getHours());
    setTimePeriod(period);
    const greetings = TIME_CONTENT[period].greetings;
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

    const isCrisis = hasCrisis(trimmed);
    setIsSubmitting(true);
    if (!isCrisis) setShowAnimation(true);

    try {
      // 1. Save entry
      const entryRef = await addDoc(collection(db, 'entries'), {
        uid: user.uid,
        content: trimmed,
        emotion: 'unknown',
        createdAt: serverTimestamp(),
        status: 'replied',
      });

      // 2. 최근 일기 조회 (멘토 기억 — 맥락 연속성)
      let recentEntries: { content: string; emotion?: string; date?: string }[] = [];
      try {
        const recentSnap = await getDocs(
          query(
            collection(db, 'entries'),
            where('uid', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(6),
          )
        );
        recentSnap.forEach(d => {
          if (d.id !== entryRef.id) { // 현재 entry 제외
            const data = d.data();
            recentEntries.push({
              content: data.content,
              emotion: data.emotion,
              date: data.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') ?? undefined,
            });
          }
        });
        recentEntries = recentEntries.slice(0, 5); // 최대 5개
      } catch {
        // 실패해도 편지 생성은 계속 진행
      }

      // 3. Fire off letter generation (always, regardless of crisis)
      const rankedMentors = rankMentors(trimmed);
      const writtenHour = new Date().getHours();
      const submittedAt = Date.now();

      // 브라우저 알림 권한 요청 (비차단)
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      rankedMentors.forEach((mentorId, index) => {
        // 멘토별 랜덤 발송 시간: 10초 ~ 10분
        const minMs = 10 * 1000;
        const maxMs = 10 * 60 * 1000;
        const deliverAt = Timestamp.fromMillis(submittedAt + minMs + Math.random() * (maxMs - minMs));

        setTimeout(async () => {
          try {
            const reply = await generateSingleMentorReply(trimmed, mentorId, writtenHour, recentEntries);
            const replyData: any = {
              uid: user.uid,
              entryId: entryRef.id,
              mentorId: reply.mentorId,
              quote: reply.quote,
              translation: reply.translation,
              advice: reply.advice,
              createdAt: serverTimestamp(),
              deliverAt,
            };
            if (reply.source) replyData.source = reply.source;
            await addDoc(collection(db, 'replies'), replyData);
          } catch (error) {
            console.error(`Failed to generate reply for ${mentorId}:`, error);
          }
        }, index * 150);
      });

      // 보류 중인 편지 entryId 저장 (Layout의 알림 감지용)
      localStorage.setItem('pendingEntryId', entryRef.id);

      // 4. Route based on crisis
      if (isCrisis) {
        setCrisisEntryId(entryRef.id);
      } else {
        setTimeout(() => navigate('/study'), 1500);
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
          지금 많이 힘드시군요.
        </p>
        <p className="font-serif text-sm leading-[1.9] opacity-55">
          혼자 감당하기 너무 무거울 때는<br />
          전문적인 도움을 받으시는 것이 좋습니다.
        </p>

        <div className="border border-ink/15 bg-[#fdfbf7] w-full px-8 py-7 flex flex-col items-center gap-2">
          <p className="text-[9px] uppercase tracking-[0.35em] opacity-35 mb-1">24시간 위기상담전화</p>
          <a
            href="tel:1393"
            className="font-serif text-4xl font-bold tracking-widest opacity-75 hover:opacity-100 transition-opacity"
          >
            1393
          </a>
          <p className="text-[10px] opacity-35">자살예방상담전화 · 무료 · 24시간</p>
        </div>

        <a
          href="tel:1577-0199"
          className="text-xs opacity-35 hover:opacity-60 transition-opacity"
        >
          정신건강 위기상담 1577-0199
        </a>

        <div className="flex flex-col items-center gap-3 mt-2">
          <p className="text-xs opacity-35 font-serif italic">
            현자들의 편지도 함께 보내드렸습니다.
          </p>
          <Link
            to={`/envelopes/${crisisEntryId}`}
            className="font-serif text-sm italic opacity-55 hover:opacity-90 transition-opacity border-b border-ink/20 pb-px"
          >
            편지 확인하기 →
          </Link>
        </div>

        <button
          onClick={() => { setCrisisEntryId(null); setContent(''); setIsSubmitting(false); }}
          className="mt-2 font-serif text-xs italic opacity-30 hover:opacity-55 transition-opacity"
        >
          돌아가기
        </button>
      </motion.div>
    );
  }

  // ── 발송 애니메이션 ──────────────────────────────────────────────────────────
  if (showAnimation) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center space-y-8"
      >
        <div className="w-24 h-16 bg-ink/10 relative flex items-center justify-center shadow-md">
          <div className="absolute inset-0 border border-ink/20 m-1" />
          <div className="w-6 h-6 rounded-full bg-red-800/80 flex items-center justify-center shadow-sm">
            <span className="text-[8px] text-white/80 font-serif">M</span>
          </div>
        </div>
        <div className="flex flex-col items-center space-y-4 min-h-[120px] text-center">
          <p className="text-lg font-serif italic opacity-70 tracking-widest">편지를 부쳤습니다.</p>
          <p className="text-sm font-serif opacity-40 leading-relaxed">
            현자들이 고심하여 답장을 쓰고 있습니다.<br />
            오늘의 지혜 카드를 읽으면서 쉬어가세요.
          </p>
        </div>
      </motion.div>
    );
  }

  // ── 메인 폼 ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-4">The Desk</h1>
        <p className="opacity-60 italic text-sm whitespace-pre-line break-keep" style={{ wordBreak: 'keep-all' }}>
          {TIME_CONTENT[timePeriod].subtitle}
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
          {isSubmitting ? 'Writing...' : 'Send to Mentors'}
        </button>
      </form>
    </div>
  );
}
