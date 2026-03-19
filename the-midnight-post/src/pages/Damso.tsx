import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useVault } from '../components/VaultContext';
import { useTranslation } from 'react-i18next';
import {
  generateDamsoOpening,
  generateDamsoResponse,
  generateDamsoClosing,
  consumePrefetchedDamso,
  type DamsoConversationEntry,
  type MentorId,
} from '../services/damso';
import { usePlan } from '../hooks/usePlan';
import UpgradeModal from '../components/UpgradeModal';

// ── 위기 키워드 ───────────────────────────────────────────────────────────────
const CRISIS_PATTERNS = [
  '죽고 싶', '죽고싶', '자살', '자해',
  '사라지고 싶', '사라지고싶', '없어지고 싶', '없어지고싶',
  '스스로 목숨', '삶을 끝', '살기 싫',
];
function hasCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some(k => text.includes(k));
}

const MAX_USER_TURNS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  type: 'stage_direction' | 'mentor' | 'user';
  content: string;
  rawInput?: string;
}

// ─── Mentor space static data (accent colors only) ────────────────────────────

const MENTOR_SPACES = {
  hyewoon:   { bg: '#f8f6f1', accent: '#7c6a50' },
  benedicto: { bg: '#f8f5f2', accent: '#7a3030' },
  theodore:  { bg: '#f5f6f8', accent: '#3a4a5c' },
  yeonam:    { bg: '#f4f7f4', accent: '#2d5a3d' },
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
  userLabel,
  isAnimating,
  onAnimationComplete,
}: {
  message: Message;
  targetOpacity: number;
  mentorName: string;
  userLabel: string;
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
          <span className="font-semibold" style={{ opacity: 0.6 }}>{userLabel}:</span>
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
  const { t } = useTranslation();
  const [textDone, setTextDone] = useState(false);
  const mentorSpace = t(`mentors.${spaceKey}.space`);
  const loadingText = t(`damso.rooms.${spaceKey}.loading`);

  useEffect(() => {
    if (!textDone || !ready) return;
    const timer = setTimeout(onDone, 1000);
    return () => clearTimeout(timer);
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
          {mentorSpace}
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
        {loadingText}
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
  const { t } = useTranslation();

  const spaceKey = (mentorId as SpaceKey) ?? 'hyewoon';
  const space = MENTOR_SPACES[spaceKey] ?? MENTOR_SPACES.hyewoon;
  const mentorName = t(`mentors.${spaceKey}.name`);
  const mentorSpace = t(`mentors.${spaceKey}.space`);
  const mentorParticle = t(`mentors.${spaceKey}.particle`);
  const placeholder = t(`damso.rooms.${spaceKey}.placeholder`);
  const userLabel = t('damso.userLabel');

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
  const isNearBottomRef = useRef(true);

  const [openingData, setOpeningData] = useState<{ stageDirection: string; mentorGreeting: string } | null>(null);
  const [overlayDone, setOverlayDone] = useState(false);
  const { isAdmin, isStandard, upgrade, checkDamsoLimit } = usePlan();
  const [damsoLimitBlock, setDamsoLimitBlock] = useState<{ used: number } | null>(null);
  const [initKey, setInitKey] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
  }, []);

  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  useEffect(() => {
    if (!user || !entryId || !mentorId) return;
    // initKey가 변경되면 재시작 (업그레이드 후)

    const init = async () => {
      // 플랜 한도 확인 (admin 제외)
      if (!isAdmin) {
        const { allowed, used } = await checkDamsoLimit();
        if (!allowed) {
          setDamsoLimitBlock({ used });
          setShowLoading(false);
          return;
        }
      }

      const prefetched = consumePrefetchedDamso();

      const contentPromise = prefetched?.contentPromise ?? (async () => {
        const snap = await getDoc(doc(db, 'entries', entryId));
        const raw = snap.exists() ? String(snap.data().content ?? '') : '';
        return decrypt(raw);
      })();

      const openingPromise = prefetched?.openingPromise ??
        contentPromise.then(content => generateDamsoOpening(mentorId as MentorId, content));

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, entryId, mentorId, initKey]);

  useEffect(() => {
    if (!overlayDone || !openingData || !user) return;
    if (messages.length > 0) return;

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

  useEffect(() => {
    if (!isEnding) return;
    const timer = setTimeout(handleEndSession, 4500);
    return () => clearTimeout(timer);
  }, [isEnding, handleEndSession]);

  const handleSend = async () => {
    const raw = inputValue.trim();
    if (!raw || isSending || animatingId || isEnding) return;
    setInputValue('');
    setIsSending(true);

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
      {/* 담소 한도 초과 모달 */}
      <AnimatePresence>
        {damsoLimitBlock && (
          <UpgradeModal
            reason="damso"
            used={damsoLimitBlock.used}
            onUpgrade={async () => {
              await upgrade();
              setDamsoLimitBlock(null);
              setShowLoading(true);
              setInitKey(k => k + 1);
            }}
            onClose={() => navigate(-1)}
          />
        )}
      </AnimatePresence>

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
                    <p className="font-serif text-xs opacity-70">{t('damso.crisis.notice')}</p>
                    <a href="tel:1393" className="text-xs font-mono opacity-55 hover:opacity-90 transition-opacity">
                      {t('damso.crisis.hotline')}
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
                  {mentorSpace}
                </p>
                <h1
                  className="text-sm md:text-base font-bold tracking-wide"
                  style={{ color: 'rgba(44,42,41,0.8)' }}
                >
                  {t('damso.sessionTitle', { name: mentorName, particle: mentorParticle })}
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
                {t('damso.endConversation')}
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
                    mentorName={mentorName}
                    userLabel={userLabel}
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
                    ※ {t('damso.saveFailedWarning')}
                  </p>
                )}

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
                      {t('damso.sessionEnding')}
                    </p>
                    <p className="font-serif text-xs"
                      style={{ color: 'rgba(44,42,41,0.35)' }}>
                      {t('damso.sessionSaved')}
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
                    placeholder={placeholder}
                    rows={2}
                    disabled={isSending || !!animatingId}
                    className="flex-1 font-serif bg-transparent outline-none resize-none leading-relaxed transition-colors duration-300 py-1 placeholder:text-xs placeholder:tracking-wide"
                    style={{
                      fontSize: '16px',
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
                    {t('damso.send')} →
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
