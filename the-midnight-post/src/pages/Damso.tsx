import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import {
  generateDamsoOpening,
  generateDamsoResponse,
  generateDamsoClosing,
  type DamsoConversationEntry,
  type MentorId,
} from '../services/damso';

const SESSION_DURATION_MS = 5 * 60 * 1000; // 5분

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

// ─── Typewriter component ─────────────────────────────────────────────────────

function TypewriterText({
  text,
  speed = 32,
  onComplete,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState('');
  const [finished, setFinished] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    setDisplayed('');
    setFinished(false);
    calledRef.current = false;
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
        if (!calledRef.current) {
          calledRef.current = true;
          setFinished(true);
          onComplete?.();
        }
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!finished && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          className="inline-block ml-0.5"
        >
          ·
        </motion.span>
      )}
    </span>
  );
}

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
          "{message.content}"
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
}: {
  spaceKey: SpaceKey;
  onDone: () => void;
}) {
  const space = MENTOR_SPACES[spaceKey];
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    if (!typingDone) return;
    const t = setTimeout(onDone, 1000);
    return () => clearTimeout(t);
  }, [typingDone, onDone]);

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
        transition={{ delay: 0.9, duration: 0.6 }}
        className="font-serif text-sm md:text-base leading-[2.2] max-w-md italic"
        style={{ color: 'rgba(244,241,234,0.75)' }}
      >
        <TypewriterText
          text={space.loadingText}
          speed={38}
          onComplete={() => setTypingDone(true)}
        />
      </motion.p>

      {/* Fade-in ornament when done */}
      <motion.div
        animate={{ opacity: typingDone ? 0.5 : 0 }}
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
  const navigate = useNavigate();

  const spaceKey = (mentorId as SpaceKey) ?? 'hyewoon';
  const space = MENTOR_SPACES[spaceKey] ?? MENTOR_SPACES.hyewoon;

  const [showLoading, setShowLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<DamsoConversationEntry[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const entryContentRef = useRef('');
  const messageOrderRef = useRef(0);
  const sessionStartRef = useRef<number | null>(null);
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
      const entrySnap = await getDoc(doc(db, 'entries', entryId));
      const content = entrySnap.exists() ? String(entrySnap.data().content ?? '') : '';
      entryContentRef.current = content;

      const sessionRef = await addDoc(collection(db, 'damso_sessions'), {
        uid: user.uid,
        entryId,
        mentorId,
        startedAt: serverTimestamp(),
      });
      sessionIdRef.current = sessionRef.id;

      const opening = await generateDamsoOpening(mentorId as MentorId, content);
      setOpeningData(opening);
    };

    init().catch(console.error);
  }, [user, entryId, mentorId]);

  // Show opening when BOTH overlay is done AND AI data is ready
  useEffect(() => {
    if (!overlayDone || !openingData || !user) return;
    if (messages.length > 0) return; // already shown

    const { stageDirection, mentorGreeting } = openingData;
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
      addDoc(collection(db, 'damso_messages'), {
        sessionId: sid, uid, type: 'stage_direction',
        content: stageDirection, order: 0, createdAt: serverTimestamp(),
      });
      addDoc(collection(db, 'damso_messages'), {
        sessionId: sid, uid, type: 'mentor',
        content: mentorGreeting, order: 1, createdAt: serverTimestamp(),
      });
      messageOrderRef.current = 2;
    }
  }, [overlayDone, openingData, user]);

  const handleOverlayDone = useCallback((): void => {
    setShowLoading(false);
    setOverlayDone(true);
    sessionStartRef.current = Date.now();
  }, []);

  // isEnding 전환 시 세션 종료 후 자동 이동
  useEffect(() => {
    if (!isEnding) return;
    const t = setTimeout(handleEndSession, 4500);
    return () => clearTimeout(t);
  }, [isEnding]);

  // Send message
  const handleSend = async () => {
    const raw = inputValue.trim();
    if (!raw || isSending || animatingId || isEnding) return;
    setInputValue('');
    setIsSending(true);

    // 5분 경과 여부 확인 — 마지막 메시지 처리
    const elapsed = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
    const isLastMessage = elapsed >= SESSION_DURATION_MS;
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
            content: turn.transformedInput, rawInput: raw,
            order, createdAt: serverTimestamp(),
          }),
          addDoc(collection(db, 'damso_messages'), {
            sessionId: sid, uid, type: 'stage_direction',
            content: turn.stageDirection, order: order + 1, createdAt: serverTimestamp(),
          }),
          addDoc(collection(db, 'damso_messages'), {
            sessionId: sid, uid, type: 'mentor',
            content: turn.mentorSpeech, order: order + 2, createdAt: serverTimestamp(),
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

  const handleEndSession = useCallback(async () => {
    if (sessionIdRef.current) {
      await updateDoc(doc(db, 'damso_sessions', sessionIdRef.current), {
        endedAt: serverTimestamp(),
      }).catch(() => {});
    }
    navigate(`/envelopes/${entryId}`);
  }, [entryId, navigate]);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: space.bg, fontFamily: '"Nanum Myeongjo", serif' }}
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {showLoading && (
          <LoadingOverlay key="loading" spaceKey={spaceKey} onDone={handleOverlayDone} />
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

              {/* Center ornament */}
              <div className="hidden md:flex items-center gap-2 opacity-20">
                <div className="w-10 h-px bg-current" style={{ color: space.accent }} />
                <div
                  className="w-1 h-1 rotate-45"
                  style={{ background: space.accent }}
                />
                <div className="w-10 h-px" style={{ background: space.accent }} />
              </div>

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
                      if (shouldCloseRef.current) setIsEnding(true);
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
                className="px-6 pb-6 pt-1"
                style={{
                  backgroundColor: space.bg,
                  borderTop: '1px solid rgba(44,42,41,0.05)',
                }}
              >
                <div className="max-w-xl mx-auto flex items-end gap-3">
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
                    className="flex-1 font-serif bg-transparent outline-none resize-none leading-relaxed transition-colors duration-300 py-2 placeholder:text-xs placeholder:tracking-wide"
                    style={{
                      fontSize: '16px', // iOS 자동 확대 방지
                      color: 'rgba(44,42,41,0.85)',
                      borderBottom: `1px solid rgba(44,42,41,0.2)`,
                    }}
                    onFocus={e => {
                      e.target.style.borderBottomColor = `${space.accent}99`;
                    }}
                    onBlur={e => {
                      e.target.style.borderBottomColor = 'rgba(44,42,41,0.2)';
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isSending || !!animatingId}
                    className="font-serif italic transition-colors duration-300 whitespace-nowrap"
                    style={{
                      fontSize: '14px',
                      padding: '14px 4px 14px 16px', // 터치 영역 확보
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
