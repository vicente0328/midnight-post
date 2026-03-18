import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useVault } from '../components/VaultContext';
import {
  generateDamsoOpening,
  generateDamsoResponse,
  generateDamsoClosing,
  consumePrefetchedDamso,
  type DamsoConversationEntry,
  type MentorId,
} from '../services/damso';

// ── 위기 키워드 ───────────────────────────────────────────────────────────────
const CRISIS_PATTERNS = [
  '죽고 싶', '죽고싶', '자살', '자해',
  '사라지고 싶', '사라지고싶', '없어지고 싶', '없어지고싶',
  '스스로 목숨', '삶을 끝', '살기 싫',
];
function hasCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some(k => text.includes(k));
}

const MAX_USER_TURNS = 5; // 질문 5개 제한

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  type: 'stage_direction' | 'mentor' | 'user';
  content: string;
  rawInput?: string;
}

// ─── Mentor spaces ────────────────────────────────────────────────────────────

const MENTOR_SPACES = {
  hyewoon: {
    name: '혜운 스님',
    spaceName: '청명각(淸明閣)',
    loadingText:
      '혜운 스님이 정진하시는 청명각으로 발걸음을 옮깁니다. 은은한 향나무 냄새가 코끝을 스치고, 대나무 숲을 흔드는 바람 소리가 마음의 먼지를 씻어냅니다. 스님이 내어주시는 따뜻한 찻잔의 온기를 느끼며 잠시 숨을 고르십시오.',
    placeholder: '찻잔을 내려놓으며 말씀드립니다',
    bg: '#f8f6f1',
    accent: '#7c6a50',
  },
  benedicto: {
    name: '베네딕토 신부',
    spaceName: '고해소',
    loadingText:
      '신부님이 당신을 기다리시는 고해소로 향합니다. 흔들리는 작은 촛불이 당신의 그림자를 다정하게 감싸 안으며, 이곳은 당신의 모든 진심이 안전하게 지켜질 성소임을 말해줍니다. 무거운 짐을 내려놓고 고요한 평화를 마주해 보세요.',
    placeholder: '촛불 앞에서 솔직하게 말씀드립니다',
    bg: '#f8f5f2',
    accent: '#7a3030',
  },
  theodore: {
    name: '테오도르 교수',
    spaceName: '서재',
    loadingText:
      '지적인 잉크 향과 오래된 가죽 책 냄새가 가득한 테오도르의 개인 서재로 초대받았습니다. 명료한 이성의 불빛 아래서 당신의 고민을 객관화해 볼 시간입니다. 날카로운 통찰이 당신의 삶을 다시 설계할 이정표가 되어줄 것입니다.',
    placeholder: '생각을 정리하며 말씀드립니다',
    bg: '#f5f6f8',
    accent: '#3a4a5c',
  },
  yeonam: {
    name: '연암 선생',
    spaceName: '취락헌(聚樂軒)',
    loadingText:
      '벗을 반기는 호탕한 웃음소리가 들려오는 취락헌의 문이 열립니다. 세상의 격식은 잠시 마당에 던져두고, 달빛 아래 술잔을 부딪치듯 진솔한 이야기를 나누러 오십시오. 자연의 순리에 몸을 맡긴 채 나누는 대화는 당신을 자유롭게 할 것입니다.',
    placeholder: '마루에 걸터앉아 이야기합니다',
    bg: '#f4f7f4',
    accent: '#2d5a3d',
  },
} as const;

type SpaceKey = keyof typeof MENTOR_SPACES;


// ─── Opacity fade helper ──────────────────────────────────────────────────────

function calcOpacity(index: number, total: number): number {
  const fromEnd = total - 1 - index;
  if (fromEnd <= 2) return 1;
  if (fromEnd <= 5) return 0.42;
  return 0.22;
}

// ─── Message block ────────────────────────────────────────────────────────────

function MessageBlock({
  message,
  targetOpacity,
  mentorName,
  isAnimating,
  onAnimationComplete,
}: {
  message: Message;
  targetOpacity: number;
  mentorName: string;
  isAnimating: boolean;
  onAnimationComplete?: () => void;
}) {
  const calledRef = useRef(false);

  const handleAnimationComplete = () => {
    if (isAnimating && !calledRef.current) {
      calledRef.current = true;
      onAnimationComplete?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: targetOpacity, y: 0 }}
      transition={{ duration: isAnimating ? 1.6 : 0.8, ease: 'easeOut' }}
      onAnimationComplete={handleAnimationComplete}
      className="mb-7 md:mb-9"
    >
      {message.type === 'stage_direction' && (
        <p className="font-serif text-sm md:text-[0.95rem] italic text-center leading-loose"
          style={{ color: 'rgba(44,42,41,0.55)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
          {message.content}
        </p>
      )}

      {message.type === 'mentor' && (
        <p className="font-serif text-base md:text-lg leading-[2] md:leading-[2.1]"
          style={{ color: 'rgba(44,42,41,0.9)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
          <span className="font-bold">{mentorName}:</span>
          {' '}
          &ldquo;{message.content}&rdquo;
        </p>
      )}

      {message.type === 'user' && (
        <p className="font-serif text-base md:text-lg leading-[2] md:leading-[2.1]"
          style={{ color: 'rgba(44,42,41,0.75)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
          <span className="font-semibold" style={{ opacity: 0.6 }}>나:</span>
          {' '}
          {message.content}
        </p>
      )}
    </motion.div>
  );
}

// ─── Loading overlay ──────────────────────────────────────────────────────────

function LoadingOverlay({
  spaceKey,
  onDone,
  ready,
}: {
  spaceKey: SpaceKey;
  onDone: () => void;
  ready: boolean;
}) {
  const space = MENTOR_SPACES[spaceKey];
  const [textDone, setTextDone] = useState(false);

  useEffect(() => {
    if (!textDone || !ready) return;
    const t = setTimeout(onDone, 1000);
    return () => clearTimeout(t);
  }, [textDone, ready, onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
      style={{ backgroundColor: 'rgba(22,20,18,0.97)' }}
    >
      {/* Space name */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.9 }}
        className="mb-10"
      >
        <p className="text-[10px] uppercase tracking-[0.5em] mb-4"
          style={{ color: 'rgba(212,175,55,0.55)' }}>
          {space.spaceName}
        </p>
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-px" style={{ background: 'rgba(212,175,55,0.3)' }} />
          <div className="w-1 h-1 rotate-45" style={{ background: 'rgba(212,175,55,0.5)' }} />
          <div className="w-12 h-px" style={{ background: 'rgba(212,175,55,0.3)' }} />
        </div>
      </motion.div>

      {/* Narrative text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 2.4, ease: 'easeIn' }}
        onAnimationComplete={() => setTextDone(true)}
        className="font-serif text-sm md:text-base leading-[2.2] max-w-md italic"
        style={{ color: 'rgba(244,241,234,0.75)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}
      >
        {space.loadingText}
      </motion.p>

      {/* Fade-in ornament when done */}
      <motion.div
        animate={{ opacity: textDone ? 0.5 : 0 }}
        transition={{ duration: 1 }}
        className="mt-10 flex items-center gap-2.5"
      >
        <div className="w-1.5 h-1.5 rotate-45" style={{ background: '#D4AF37' }} />
        <div className="w-1 h-1 rotate-45" style={{ background: 'rgba(212,175,55,0.6)' }} />
        <div className="w-1.5 h-1.5 rotate-45" style={{ background: '#D4AF37' }} />
      </motion.div>
    </motion.div>
  );
}

// ─── Torn paper SVG edge ──────────────────────────────────────────────────────

function TornPaperEdge({ fill }: { fill: string }) {
  return (
    <svg
      viewBox="0 0 1440 32"
      className="w-full pointer-events-none"
      preserveAspectRatio="none"
      style={{ height: '32px', display: 'block' }}
    >
      <path
        d="M0,32 L0,20 C24,32 48,12 72,22 C96,32 120,10 144,20
           C168,30 192,8 216,18 C240,28 264,12 288,22
           C312,32 336,10 360,20 C384,30 408,8 432,18
           C456,28 480,14 504,24 C528,34 552,10 576,20
           C600,30 624,8 648,18 C672,28 696,12 720,22
           C744,32 768,10 792,20 C816,30 840,8 864,18
           C888,28 912,14 936,24 C960,34 984,10 1008,20
           C1032,30 1056,8 1080,18 C1104,28 1128,12 1152,22
           C1176,32 1200,10 1224,20 C1248,30 1272,8 1296,18
           C1320,28 1344,12 1368,22 C1392,32 1416,10 1440,20
           L1440,32 Z"
        fill={fill}
      />
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Damso() {
  const { entryId, mentorId } = useParams<{ entryId: string; mentorId: string }>();
  const { user } = useAuth();
  const { encrypt, decrypt } = useVault();
  const navigate = useNavigate();

  const spaceKey = (mentorId as SpaceKey) ?? 'hyewoon';
  const space = MENTOR_SPACES[spaceKey] ?? MENTOR_SPACES.hyewoon;

  const [showLoading, setShowLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [sessionSaveFailed, setSessionSaveFailed] = useState(false);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [showCrisisBanner, setShowCrisisBanner] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<DamsoConversationEntry[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const entryContentRef = useRef('');
  const messageOrderRef = useRef(0);
  const shouldCloseRef = useRef(false);
  // 사용자가 위로 스크롤 중이면 자동 스크롤 하지 않음
  const isNearBottomRef = useRef(true);

  // openingReady: set once AI generates the opening
  const [openingData, setOpeningData] = useState<{ stageDirection: string; mentorGreeting: string } | null>(null);
  // overlayDone: set once loading overlay fades out
  const [overlayDone, setOverlayDone] = useState(false);

  // 스크롤 위치 감지 — 사용자가 위로 올리면 자동 스크롤 멈춤
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
  }, []);

  // 새 메시지 도착 시 자동 스크롤
  // behavior: 'smooth' 제거 — 반복 호출 시 iOS Safari/Chrome에서 scroll이 멈추는 버그 방지
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    // rAF으로 DOM 반영 후 스크롤
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  // Fetch entry + create session + generate opening in background
  useEffect(() => {
    if (!user || !entryId || !mentorId) return;

    const init = async () => {
      // 버튼 클릭 시 미리 시작된 promise가 있으면 재사용 (없으면 직접 fetch)
      const prefetched = consumePrefetchedDamso();

      const contentPromise = prefetched?.contentPromise ?? (async () => {
        const snap = await getDoc(doc(db, 'entries', entryId));
        const raw = snap.exists() ? String(snap.data().content ?? '') : '';
        return decrypt(raw);
      })();

      const openingPromise = prefetched?.openingPromise ??
        contentPromise.then(content => generateDamsoOpening(mentorId as MentorId, content));

      // 세션 생성, 컨텐츠 로드, 오프닝 생성을 모두 병렬로 실행
      const [sessionResult, contentResult, openingResult] = await Promise.allSettled([
        addDoc(collection(db, 'damso_sessions'), {
          uid: user.uid,
          entryId,
          mentorId,
          startedAt: serverTimestamp(),
        }),
        contentPromise,
        openingPromise,
      ]);

      if (contentResult.status === 'fulfilled') {
        entryContentRef.current = contentResult.value;
      }

      if (sessionResult.status === 'fulfilled') {
        sessionIdRef.current = sessionResult.value.id;
        console.log('[담소] 세션 생성 성공:', sessionResult.value.id, '/ uid:', user.uid);
      } else {
        const err = sessionResult.reason;
        console.error('[담소] 세션 생성 실패:', err?.code, err?.message, err);
        setSessionSaveFailed(String(err?.code ?? err?.message ?? err));
      }

      if (openingResult.status === 'fulfilled') {
        setOpeningData(openingResult.value);
      } else {
        console.error('[담소] 오프닝 생성 실패:', openingResult.reason);
      }
    };

    init().catch(console.error);
  }, [user, entryId, mentorId]);

  // Show opening when BOTH overlay is done AND AI data is ready
  useEffect(() => {
    if (!overlayDone || !openingData || !user) return;
    if (messages.length > 0) return; // already shown

    const { stageDirection, mentorGreeting, suggestedQuestions: sq } = openingData;
    setSuggestedQuestions(sq ?? []);
    const sdId = `sd-open-${Date.now()}`;
    const mId = `m-open-${Date.now() + 1}`;

    setMessages([
      { id: sdId, type: 'stage_direction', content: stageDirection },
      { id: mId, type: 'mentor', content: mentorGreeting },
    ]);
    setAnimatingId(mId);

    conversationRef.current = [
      { type: 'stage_direction', content: stageDirection },
      { type: 'mentor', content: mentorGreeting },
    ];

    if (sessionIdRef.current) {
      const sid = sessionIdRef.current;
      const uid = user.uid;
      (async () => {
        addDoc(collection(db, 'damso_messages'), {
          sessionId: sid, uid, type: 'stage_direction',
          content: await encrypt(stageDirection), order: 0, createdAt: serverTimestamp(),
        });
        addDoc(collection(db, 'damso_messages'), {
          sessionId: sid, uid, type: 'mentor',
          content: await encrypt(mentorGreeting), order: 1, createdAt: serverTimestamp(),
        });
      })();
      messageOrderRef.current = 2;
    }
  }, [overlayDone, openingData, user, encrypt]);

  const handleOverlayDone = useCallback((): void => {
    setShowLoading(false);
    setOverlayDone(true);
  }, []);

  const handleEndSession = useCallback(async () => {
    if (sessionIdRef.current) {
      await updateDoc(doc(db, 'damso_sessions', sessionIdRef.current), {
        endedAt: serverTimestamp(),
      }).catch(err => console.error('담소 세션 종료 업데이트 실패:', err));
    }
    navigate('/study', { state: { activeRoom: mentorId } });
  }, [mentorId, navigate]);

  // isEnding 전환 시 세션 종료 후 자동 이동
  useEffect(() => {
    if (!isEnding) return;
    const t = setTimeout(handleEndSession, 4500);
    return () => clearTimeout(t);
  }, [isEnding, handleEndSession]);

  // Send message
  const handleSend = async () => {
    const raw = inputValue.trim();
    if (!raw || isSending || animatingId || isEnding) return;
    setInputValue('');
    setIsSending(true);

    // 위기 키워드 감지 — 담소는 그대로 계속
    if (hasCrisis(raw)) setShowCrisisBanner(true);

    const nextTurn = userTurnCount + 1;
    setUserTurnCount(nextTurn);
    const isLastMessage = nextTurn >= MAX_USER_TURNS;
    if (isLastMessage) shouldCloseRef.current = true;

    try {
      const turn = isLastMessage
        ? await generateDamsoClosing(
            mentorId as MentorId,
            entryContentRef.current,
            conversationRef.current,
            raw,
          )
        : await generateDamsoResponse(
            mentorId as MentorId,
            entryContentRef.current,
            conversationRef.current,
            raw,
          );

      const ts = Date.now();
      const uMsg: Message = { id: `u-${ts}`, type: 'user', content: turn.transformedInput, rawInput: raw };
      const sdMsg: Message = { id: `sd-${ts + 1}`, type: 'stage_direction', content: turn.stageDirection };
      const mMsg: Message = { id: `m-${ts + 2}`, type: 'mentor', content: turn.mentorSpeech };

      setSuggestedQuestions(turn.suggestedQuestions ?? []);
      setMessages(prev => [...prev, uMsg, sdMsg, mMsg]);
      setAnimatingId(mMsg.id);

      conversationRef.current = [
        ...conversationRef.current,
        { type: 'user', content: turn.transformedInput, rawInput: raw },
        { type: 'stage_direction', content: turn.stageDirection },
        { type: 'mentor', content: turn.mentorSpeech },
      ];

      // Save to Firestore
      if (sessionIdRef.current && user) {
        const sid = sessionIdRef.current;
        const uid = user.uid;
        const order = messageOrderRef.current;
        await Promise.all([
          addDoc(collection(db, 'damso_messages'), {
            sessionId: sid, uid, type: 'user',
            content: await encrypt(turn.transformedInput), rawInput: await encrypt(raw),
            order, createdAt: serverTimestamp(),
          }),
          addDoc(collection(db, 'damso_messages'), {
            sessionId: sid, uid, type: 'stage_direction',
            content: await encrypt(turn.stageDirection), order: order + 1, createdAt: serverTimestamp(),
          }),
          addDoc(collection(db, 'damso_messages'), {
            sessionId: sid, uid, type: 'mentor',
            content: await encrypt(turn.mentorSpeech), order: order + 2, createdAt: serverTimestamp(),
          }),
        ]);
        messageOrderRef.current += 3;
      }
    } catch (err) {
      console.error('담소 응답 생성 실패:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: space.bg, fontFamily: '"Nanum Myeongjo", serif' }}
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {showLoading && (
          <LoadingOverlay key="loading" spaceKey={spaceKey} onDone={handleOverlayDone} ready={openingData !== null} />
        )}
      </AnimatePresence>

      {/* Main content */}
      <AnimatePresence>
        {!showLoading && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            className="flex flex-col h-full"
          >
            {/* ── 위기 배너 ── */}
            <AnimatePresence>
              {showCrisisBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="flex-none flex items-center justify-between px-5 py-3 gap-4"
                  style={{ background: 'rgba(26,18,8,0.04)', borderBottom: '1px solid rgba(26,18,8,0.07)' }}
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="font-serif text-xs opacity-70">힘드실 때는 언제든지 전화하세요.</p>
                    <a href="tel:1393" className="text-xs font-mono opacity-55 hover:opacity-90 transition-opacity">
                      자살예방상담전화 1393 · 24시간 무료
                    </a>
                  </div>
                  <button
                    onClick={() => setShowCrisisBanner(false)}
                    className="text-[10px] opacity-30 hover:opacity-60 transition-opacity flex-shrink-0 font-mono"
                  >
                    ✕
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Header ── */}
            <div
              className="flex-none px-6 py-4 md:py-5 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(44,42,41,0.08)' }}
            >
              {/* Left: space info */}
              <div>
                <p
                  className="text-[9px] uppercase tracking-[0.4em] mb-0.5"
                  style={{ color: `${space.accent}99` }}
                >
                  {space.spaceName}
                </p>
                <h1
                  className="text-sm md:text-base font-bold tracking-wide"
                  style={{ color: 'rgba(44,42,41,0.8)' }}
                >
                  {space.name}와의 담소
                </h1>
              </div>

              {/* Center: turn counter */}
              {overlayDone && (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: MAX_USER_TURNS }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rotate-45 transition-all duration-500"
                      style={{
                        background: i < userTurnCount ? space.accent : 'transparent',
                        border: `1px solid ${space.accent}`,
                        opacity: i < userTurnCount ? 0.8 : 0.3,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Right: exit */}
              <button
                onClick={handleEndSession}
                className="font-serif text-xs italic transition-colors duration-300"
                style={{ color: 'rgba(44,42,41,0.35)' }}
                onMouseEnter={e => (e.currentTarget.style.color = space.accent)}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(44,42,41,0.35)')}
              >
                담소 마치기
              </button>
            </div>

            {/* ── Conversation ── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto damso-scroll"
              onScroll={handleScroll}
              style={{
                padding: '2.5rem 1.5rem 1rem',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="max-w-xl mx-auto">
                {messages.map((msg, i) => (
                  <MessageBlock
                    key={msg.id}
                    message={msg}
                    targetOpacity={calcOpacity(i, messages.length)}
                    mentorName={space.name}
                    isAnimating={animatingId === msg.id}
                    onAnimationComplete={() => {
                      setAnimatingId(null);
                      if (shouldCloseRef.current) setTimeout(() => setIsEnding(true), 2000);
                    }}
                  />
                ))}

                {/* Sending indicator */}
                {isSending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-center gap-2 py-4"
                  >
                    {[0, 0.35, 0.7].map((delay, i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: `${space.accent}55` }}
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay }}
                      />
                    ))}
                  </motion.div>
                )}

                {/* 세션 저장 실패 경고 */}
                {sessionSaveFailed && (
                  <p className="font-serif text-xs italic text-center mb-4"
                    style={{ color: 'rgba(44,42,41,0.35)' }}>
                    ※ 연결 문제로 이 대화는 기록보관소에 저장되지 않습니다.
                  </p>
                )}

                {/* Spacer so last message isn't behind input */}
                <div className="h-4" />
              </div>
            </div>

            {/* ── 담소 마무리 오버레이 ── */}
            <AnimatePresence>
              {isEnding && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 1.8 }}
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
                  style={{ backgroundColor: `${space.bg}d0`, backdropFilter: 'blur(4px)' }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.4, duration: 1.2 }}
                    className="text-center px-8"
                  >
                    <div className="flex items-center justify-center gap-2 mb-6 opacity-30">
                      <div className="w-8 h-px" style={{ background: space.accent }} />
                      <div className="w-1 h-1 rotate-45" style={{ background: space.accent }} />
                      <div className="w-8 h-px" style={{ background: space.accent }} />
                    </div>
                    <p className="font-serif text-sm italic mb-2"
                      style={{ color: 'rgba(44,42,41,0.55)' }}>
                      오늘의 담소가 마무리되었습니다.
                    </p>
                    <p className="font-serif text-xs"
                      style={{ color: 'rgba(44,42,41,0.35)' }}>
                      나눈 이야기는 기록보관소에 고이 담겨 있습니다.
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Input area with torn paper edge ── */}
            <div className={`flex-none relative transition-opacity duration-1000 ${isEnding ? 'opacity-0 pointer-events-none' : ''}`}>
              <TornPaperEdge fill={space.bg} />

              <div
                className="px-5 pb-5 pt-2"
                style={{ backgroundColor: space.bg }}
              >
                {/* 추천 질문 칩 */}
                <AnimatePresence>
                  {suggestedQuestions.length > 0 && !animatingId && !isSending && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.5 }}
                      className="max-w-xl mx-auto mb-3 flex flex-wrap gap-2"
                    >
                      {suggestedQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSuggestedQuestions([]);
                            setInputValue(q);
                          }}
                          className="font-serif text-xs italic transition-all duration-300 px-3 py-1.5"
                          style={{
                            color: `${space.accent}cc`,
                            border: `1px solid ${space.accent}33`,
                            background: `${space.accent}08`,
                            wordBreak: 'keep-all',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = `${space.accent}88`;
                            e.currentTarget.style.background = `${space.accent}14`;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = `${space.accent}33`;
                            e.currentTarget.style.background = `${space.accent}08`;
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 입력 박스 */}
                <div
                  className="max-w-xl mx-auto flex items-end gap-3 px-4 py-3 transition-shadow duration-300"
                  style={{
                    border: `1px solid rgba(44,42,41,0.14)`,
                    boxShadow: '0 2px 12px rgba(44,42,41,0.06)',
                    background: 'rgba(255,255,255,0.55)',
                  }}
                >
                  <textarea
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={space.placeholder}
                    rows={2}
                    disabled={isSending || !!animatingId}
                    className="flex-1 font-serif bg-transparent outline-none resize-none leading-relaxed transition-colors duration-300 py-1 placeholder:text-xs placeholder:tracking-wide"
                    style={{
                      fontSize: '16px', // iOS 자동 확대 방지
                      color: 'rgba(44,42,41,0.85)',
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isSending || !!animatingId}
                    className="font-serif italic transition-colors duration-300 whitespace-nowrap pb-1"
                    style={{
                      fontSize: '14px',
                      padding: '14px 4px 14px 12px',
                      color: inputValue.trim() && !isSending && !animatingId ? space.accent : 'rgba(44,42,41,0.25)',
                    }}
                  >
                    전하다 →
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
