import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Feather, Flower2, Cross, Brush, X, ChevronLeft, Bookmark, BookmarkCheck, PenLine, MessageCircle } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, orderBy, limit, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { getTodayKnowledge, forceRegenerateKnowledge, KnowledgeEntry } from '../services/knowledge';
import { generateSingleMentorReply } from '../services/ai';
import { ShareCardButton } from '../utils/shareCard';
import { useTranslation } from 'react-i18next';

// ── 멘토 아이콘/색상 ─────────────────────────────────────────────────────────

const ROOMS = {
  hyewoon: {
    icon: Flower2,
    color: 'from-stone-700 to-stone-900',
    accent: '#7c6a50',
    accentRgb: '124,106,80',
  },
  benedicto: {
    icon: Cross,
    color: 'from-red-900 to-red-950',
    accent: '#7a3030',
    accentRgb: '122,48,48',
  },
  theodore: {
    icon: Feather,
    color: 'from-slate-800 to-slate-950',
    accent: '#3a4a5c',
    accentRgb: '58,74,92',
  },
  yeonam: {
    icon: Brush,
    color: 'from-emerald-900 to-emerald-950',
    accent: '#2d5a3d',
    accentRgb: '45,90,61',
  },
} as const;

// 공간별 고유 분위기 텍스처 오버레이
const ATMOSPHERES: Record<string, string> = {
  hyewoon: 'repeating-linear-gradient(0deg, rgba(212,175,55,0.06) 0px, transparent 1px, transparent 20px, rgba(212,175,55,0.06) 21px)',
  benedicto: 'radial-gradient(ellipse at 50% 80%, rgba(212,175,55,0.18), transparent 60%)',
  theodore: [
    'repeating-linear-gradient(90deg, rgba(212,175,55,0.04) 0px, transparent 1px, transparent 36px, rgba(212,175,55,0.04) 37px)',
    'repeating-linear-gradient(0deg, rgba(212,175,55,0.04) 0px, transparent 1px, transparent 36px, rgba(212,175,55,0.04) 37px)',
  ].join(', '),
  yeonam: 'radial-gradient(ellipse at 12% 95%, rgba(45,90,61,0.55), transparent 58%), radial-gradient(ellipse at 88% 8%, rgba(212,175,55,0.07), transparent 45%)',
};

type MentorKey = keyof typeof ROOMS;

// ── Study 메인 ───────────────────────────────────────────────────────────────

export default function Study() {
  const location = useLocation();
  const initialRoom = (location.state as { activeRoom?: MentorKey } | null)?.activeRoom ?? null;
  const [activeRoom, setActiveRoom] = useState<MentorKey | null>(initialRoom);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeRoom ?? 'lobby'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full flex flex-col items-center"
        >
          {activeRoom ? (
            <RoomView mentorId={activeRoom} onBack={() => setActiveRoom(null)} />
          ) : (
            <Lobby onEnter={setActiveRoom} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── 로비 ─────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@tmp.com';

function Lobby({ onEnter }: { onEnter: (id: MentorKey) => void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [regenerating, setRegenerating] = useState(false);

  const handleAdminRegenerate = async () => {
    if (!isAdmin || regenerating) return;
    setRegenerating(true);
    try {
      await forceRegenerateKnowledge();
      window.location.reload();
    } catch (e) {
      console.error(e);
      setRegenerating(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-4">{t('study.title')}</h1>
        <p className="opacity-60 italic text-sm break-keep max-w-xs mx-auto leading-relaxed" style={{ textWrap: 'balance' } as React.CSSProperties}>
          {t('study.subtitle')}
        </p>
        {isAdmin && (
          <button
            onClick={handleAdminRegenerate}
            disabled={regenerating}
            className="mt-4 text-[10px] uppercase tracking-[0.2em] opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
          >
            {regenerating ? t('study.regenerating') : t('study.regenerate')}
          </button>
        )}
      </div>

      {/* 문 그리드 — 항상 2열 (복도에 늘어선 문들) */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full">
        {(Object.keys(ROOMS) as MentorKey[]).map((id, index) => (
          <DoorCard key={id} id={id} index={index} onEnter={onEnter} />
        ))}
      </div>
    </div>
  );
}

// ── 문 카드 ──────────────────────────────────────────────────────────────────

function DoorCard({
  id,
  index,
  onEnter,
}: {
  id: MentorKey;
  index: number;
  onEnter: (id: MentorKey) => void;
}) {
  const { t } = useTranslation();
  const room = ROOMS[id];
  const Icon = room.icon;
  const mentorName = t(`mentors.${id}.name`);
  const mentorSpace = t(`mentors.${id}.space`);
  const ambience = t(`study.rooms.${id}.ambience`);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.10, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onEnter(id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative overflow-hidden flex flex-col cursor-pointer w-full h-full"
      style={{
        border: `1px solid rgba(${room.accentRgb},${hovered ? '0.55' : '0.20'})`,
        boxShadow: hovered
          ? `0 16px 48px rgba(${room.accentRgb},0.14), 0 4px 16px rgba(0,0,0,0.07)`
          : '0 2px 6px rgba(0,0,0,0.04)',
        transition: 'border-color 0.5s ease, box-shadow 0.6s ease',
      }}
    >
      {/* ── 상단: 공간 분위기 창 ── */}
      <div
        className={`relative bg-gradient-to-br ${room.color} flex items-center justify-center overflow-hidden`}
        style={{ height: '130px' }}
      >
        {/* 공간별 고유 분위기 텍스처 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: ATMOSPHERES[id] }}
        />

        {/* 호버 시 따뜻한 빛이 아래에서 올라오는 효과 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 110%, rgba(212,175,55,0.13), transparent 60%)',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.7s ease',
          }}
        />

        {/* 코너 장식 */}
        <div
          className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t border-l pointer-events-none transition-colors duration-500"
          style={{ borderColor: hovered ? 'rgba(212,175,55,0.50)' : 'rgba(212,175,55,0.22)' }}
        />
        <div
          className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t border-r pointer-events-none transition-colors duration-500"
          style={{ borderColor: hovered ? 'rgba(212,175,55,0.50)' : 'rgba(212,175,55,0.22)' }}
        />

        {/* 아이콘 */}
        <div className="relative flex items-center justify-center w-14 h-14">
          <div
            className="absolute inset-0 rounded-full border transition-colors duration-500"
            style={{ borderColor: hovered ? 'rgba(212,175,55,0.55)' : 'rgba(212,175,55,0.28)' }}
          />
          <div
            className="absolute inset-2.5 rounded-full border border-dashed transition-colors duration-500"
            style={{ borderColor: hovered ? 'rgba(212,175,55,0.32)' : 'rgba(212,175,55,0.14)' }}
          />
          <Icon
            size={21}
            strokeWidth={1.3}
            style={{
              color: hovered ? 'rgba(212,175,55,0.95)' : 'rgba(212,175,55,0.68)',
              transition: 'color 0.5s ease',
            }}
          />
        </div>

        {/* 하단 페이드 — 명패로 자연스럽게 이어짐 */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(6,4,2,0.28))' }}
        />
      </div>

      {/* ── 얇은 액센트 구분선 ── */}
      <div
        className="h-px w-full"
        style={{
          background: `linear-gradient(to right, transparent, rgba(${room.accentRgb},0.50), transparent)`,
          opacity: hovered ? 1 : 0.45,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* ── 하단: 명패 ── */}
      <div
        className="flex-1 flex flex-col items-center justify-start px-3 pt-4 pb-5"
        style={{
          backgroundColor: '#fdfbf7',
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
        }}
      >
        {/* 이름 */}
        <p
          className="font-serif text-sm sm:text-[15px] font-bold mb-0.5 text-center transition-colors duration-300"
          style={{ color: hovered ? 'rgba(26,18,8,0.90)' : 'rgba(26,18,8,0.72)' }}
        >
          {mentorName}
        </p>

        {/* 공간 이름 */}
        <p className="font-serif text-[10px] italic mb-3 text-center" style={{ color: 'rgba(26,18,8,0.32)' }}>
          {mentorSpace}
        </p>

        {/* 호버 시 늘어나는 금색 선 */}
        <div
          className="h-px transition-all duration-700"
          style={{
            width: hovered ? '36px' : '18px',
            background: hovered ? 'rgba(212,175,55,0.55)' : 'rgba(212,175,55,0.28)',
          }}
        />

        {/* 분위기 텍스트 */}
        <p
          className="mt-3 font-serif italic text-[9px] sm:text-[9.5px] leading-[1.75] text-center whitespace-pre-line break-keep px-1"
          style={{
            color: hovered ? 'rgba(26,18,8,0.40)' : 'rgba(26,18,8,0.20)',
            transition: 'color 0.6s ease',
          }}
        >
          {ambience}
        </p>
      </div>
    </motion.button>
  );
}

// ── 연구실 내부 ──────────────────────────────────────────────────────────────

function RoomView({ mentorId, onBack }: { mentorId: MentorKey; onBack: () => void }) {
  const room = ROOMS[mentorId];
  const Icon = room.icon;
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mentorName = t(`mentors.${mentorId}.name`);
  const mentorSpace = t(`mentors.${mentorId}.space`);
  const mentorTitle = t(`mentors.${mentorId}.title`);
  const ambience = t(`study.rooms.${mentorId}.ambience`);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [damsoLoading, setDamsoLoading] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);

  const currentQuoteRef = useRef<string>('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let isFirst = true;

    const fetchAndSchedule = () => {
      getTodayKnowledge(mentorId)
        .then(newEntries => {
          setEntries(newEntries);
          const newQuote = newEntries[0]?.quote ?? '';
          if (!isFirst && newQuote && newQuote !== currentQuoteRef.current) {
            window.dispatchEvent(new CustomEvent('knowledgeUpdated', { detail: { mentorId } }));
          }
          if (newQuote) currentQuoteRef.current = newQuote;
          isFirst = false;
        })
        .catch(console.error)
        .finally(() => setLoading(false));

      // 다음 업데이트 시각(08, 12, 17, 22시 KST)까지 남은 ms 계산
      const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const h = nowKST.getUTCHours();
      const updateHours = [8, 12, 17, 22];
      const nextHour = updateHours.find(u => u > h) ?? (updateHours[0] + 24);
      const minsLeft = (nextHour - h) * 60 - nowKST.getUTCMinutes();
      const msUntilNext = minsLeft * 60 * 1000 - nowKST.getUTCSeconds() * 1000 + 30 * 1000;

      timer = setTimeout(fetchAndSchedule, msUntilNext);
    };

    fetchAndSchedule();
    return () => clearTimeout(timer);
  }, [mentorId]);

  const handleDamso = async () => {
    if (!user) return;
    setDamsoLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'replies'),
          where('uid', '==', user.uid),
          where('mentorId', '==', mentorId),
          orderBy('createdAt', 'desc'),
          limit(1),
        )
      );
      if (!snap.empty) {
        const entryId = snap.docs[0].data().entryId;
        navigate(`/damso/${entryId}/${mentorId}`);
      } else {
        navigate('/');
      }
    } catch {
      navigate('/');
    } finally {
      setDamsoLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 mb-6 opacity-35 hover:opacity-75 transition-opacity duration-300 text-sm font-serif italic"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        {t('study.backToLobby')}
      </button>

      {/* ── 공간 진입 배너 ── */}
      <div
        className={`relative w-full bg-gradient-to-br ${room.color} overflow-hidden mb-10`}
        style={{ minHeight: '190px' }}
      >
        {/* 공간별 분위기 텍스처 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: ATMOSPHERES[mentorId] }}
        />

        {/* 상단 금색 hairline */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.55), transparent)' }}
        />
        {/* 하단 금색 hairline */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.28), transparent)' }}
        />

        {/* 코너 장식 */}
        <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-[#D4AF37]/20 pointer-events-none" />
        <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-[#D4AF37]/20 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-[#D4AF37]/20 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-[#D4AF37]/20 pointer-events-none" />

        {/* 배너 컨텐츠 */}
        <div className="relative z-10 flex flex-col items-center justify-center py-10 px-6 text-center">
          {/* 아이콘 */}
          <div className="relative w-14 h-14 flex items-center justify-center mb-5">
            <div className="absolute inset-0 rounded-full border border-[#D4AF37]/32" />
            <div className="absolute inset-2.5 rounded-full border border-dashed border-[#D4AF37]/18" />
            <Icon size={22} strokeWidth={1.3} className="text-[#D4AF37]/82" />
          </div>

          {/* 직함 */}
          <p className="text-[9px] uppercase tracking-[0.35em] mb-2" style={{ color: 'rgba(212,175,55,0.45)' }}>
            {mentorTitle}
          </p>

          {/* 공간 제목 */}
          <h2 className="font-serif text-xl sm:text-2xl font-bold mb-4 tracking-wide" style={{ color: 'rgba(245,237,213,0.88)' }}>
            {t('study.roomTitle', { name: mentorName, room: mentorSpace })}
          </h2>

          {/* 얇은 구분선 */}
          <div className="flex items-center gap-3 mb-5 w-20 opacity-30">
            <div className="flex-1 h-px bg-[#D4AF37]" />
            <div className="w-1 h-1 rotate-45 bg-[#D4AF37]" />
            <div className="flex-1 h-px bg-[#D4AF37]" />
          </div>

          {/* 분위기 묘사 */}
          <p
            className="font-serif italic text-[11px] sm:text-sm text-center whitespace-pre-line leading-[1.85] max-w-xs"
            style={{ color: 'rgba(245,237,213,0.46)' }}
          >
            {ambience}
          </p>
        </div>
      </div>

      {/* ── 액션 버튼 ── */}
      <div className="flex items-center justify-center gap-6 mb-8 w-full">
        <button
          onClick={() => setShowLetterModal(true)}
          className="flex items-center gap-1.5 font-serif italic text-xs opacity-38 hover:opacity-70 transition-opacity duration-300"
          style={{ touchAction: 'manipulation' }}
        >
          <PenLine size={11} strokeWidth={1.4} />
          {t('study.sendLetter')}
        </button>
        <div className="w-px h-3 bg-ink/15" />
        <button
          onClick={handleDamso}
          disabled={damsoLoading}
          className="flex items-center gap-1.5 font-serif italic text-xs opacity-38 hover:opacity-70 transition-opacity duration-300 disabled:opacity-20"
          style={{ touchAction: 'manipulation' }}
        >
          <MessageCircle size={11} strokeWidth={1.4} />
          {damsoLoading ? t('study.connecting') : t('study.startDamso')}
        </button>
      </div>

      {/* ── 편지 쓰기 모달 ── */}
      <AnimatePresence>
        {showLetterModal && (
          <LetterWritingModal
            mentorId={mentorId}
            onClose={() => setShowLetterModal(false)}
            onSent={() => setShowLetterModal(false)}
          />
        )}
      </AnimatePresence>

      {/* 오늘의 지혜 레이블 */}
      <p className="text-[9px] uppercase tracking-[0.35em] opacity-28 text-center font-serif mb-7">
        {t('study.todayWisdom')} — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
      </p>

      {!loading && entries.length === 0 && (
        <p className="font-serif italic opacity-40 text-center py-8">
          {t('study.emptyHint')}
        </p>
      )}

      {/* 지혜 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
        {loading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="h-44 border border-ink/8 bg-[#fdfbf7] animate-pulse opacity-50" />
            ))
          : entries.map((entry, index) => (
              <KnowledgeCard
                key={index}
                entry={entry}
                index={index}
                mentorId={mentorId}
                onSelect={() => setSelectedEntry(entry)}
              />
            ))}
      </div>

      {/* 지혜 상세 모달 */}
      <AnimatePresence>
        {selectedEntry && (
          <WisdomModal
            entry={selectedEntry}
            mentorId={mentorId}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 지혜 카드 ─────────────────────────────────────────────────────────────────

function KnowledgeCard({
  entry,
  index,
  mentorId,
  onSelect,
}: {
  entry: KnowledgeEntry;
  index: number;
  mentorId: MentorKey;
  onSelect: () => void;
}) {
  const room = ROOMS[mentorId];
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group text-left relative flex flex-col p-6 sm:p-7 transition-shadow duration-700"
      style={{
        border: `1px solid rgba(${room.accentRgb},${hovered ? '0.32' : '0.14'})`,
        backgroundColor: '#faf8f3',
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
        boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.08)' : '0 2px 6px rgba(0,0,0,0.03)',
        transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
      }}
    >
      {/* 코너 장식 */}
      <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#D4AF37]/20 group-hover:border-[#D4AF37]/45 transition-colors duration-500 pointer-events-none" />
      <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#D4AF37]/20 group-hover:border-[#D4AF37]/45 transition-colors duration-500 pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#D4AF37]/20 group-hover:border-[#D4AF37]/45 transition-colors duration-500 pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#D4AF37]/20 group-hover:border-[#D4AF37]/45 transition-colors duration-500 pointer-events-none" />

      {/* 상단 액센트 선 */}
      <div
        className="mb-5 h-px transition-all duration-500"
        style={{
          width: hovered ? '32px' : '20px',
          background: `linear-gradient(to right, rgba(${room.accentRgb},0.55), rgba(212,175,55,0.40))`,
        }}
      />

      {/* 명언 원문 */}
      <p
        className="font-serif text-sm italic leading-[1.85] mb-3 line-clamp-2 transition-colors duration-500"
        style={{
          color: hovered ? 'rgba(26,18,8,0.88)' : 'rgba(26,18,8,0.68)',
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
          textWrap: 'balance',
        } as React.CSSProperties}
      >
        {entry.quote.split('\n')[0]}
      </p>

      {/* 번역 */}
      <p
        className="text-[11px] leading-[1.75] mb-4 flex-1 line-clamp-2 transition-colors duration-500 break-keep"
        style={{
          color: hovered ? 'rgba(26,18,8,0.60)' : 'rgba(26,18,8,0.42)',
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
          textWrap: 'balance',
        } as React.CSSProperties}
      >
        {entry.translation}
      </p>

      {/* 출처 구분선 */}
      <div className="flex items-center gap-2 mb-2 opacity-22">
        <div className="flex-1 h-px bg-ink/40" />
        <div className="w-0.5 h-0.5 rounded-full bg-[#D4AF37]" />
      </div>

      {/* 출처 */}
      <p
        className="text-[9px] tracking-wider opacity-38 font-serif break-keep leading-relaxed"
        style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', textWrap: 'balance' } as React.CSSProperties}
      >
        {entry.source}
      </p>
    </motion.button>
  );
}

// ── 지혜 상세 모달 ────────────────────────────────────────────────────────────

function WisdomModal({
  entry,
  mentorId,
  onClose,
}: {
  entry: KnowledgeEntry;
  mentorId: MentorKey;
  onClose: () => void;
}) {
  const room = ROOMS[mentorId];
  const Icon = room.icon;
  const { user } = useAuth();
  const { t } = useTranslation();
  const mentorName = t(`mentors.${mentorId}.name`);
  const mentorSpace = t(`mentors.${mentorId}.space`);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const entryId = `wisdom_${mentorId}_${entry.source.replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 30)}`;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'bookmarks'), where('uid', '==', user.uid), where('entryId', '==', entryId)))
      .then(snap => { if (!snap.empty) setBookmarkId(snap.docs[0].id); })
      .catch(() => {});
  }, [user, entryId]);

  const toggleBookmark = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      if (bookmarkId) {
        await deleteDoc(doc(db, 'bookmarks', bookmarkId));
        setBookmarkId(null);
      } else {
        const ref = await addDoc(collection(db, 'bookmarks'), {
          uid: user.uid,
          entryId,
          mentorId,
          quote: entry.quote,
          source: entry.source,
          translation: entry.translation,
          advice: entry.context,
          savedAt: serverTimestamp(),
        });
        setBookmarkId(ref.id);
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 md:p-8 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#fdfbf7] p-8 sm:p-14 shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-y-auto overscroll-contain max-h-[90vh] border border-[#D4AF37]/20"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 80px rgba(139,115,85,0.08), 0 20px 60px rgba(0,0,0,0.4)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 상단 버튼 */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3">
          {user && (
            <button
              onClick={toggleBookmark}
              disabled={saving}
              className={`transition-all duration-300 ${bookmarkId ? 'opacity-80 text-[#D4AF37]' : 'opacity-30 hover:opacity-70'}`}
            >
              {bookmarkId
                ? <BookmarkCheck size={22} strokeWidth={1.5} />
                : <Bookmark size={22} strokeWidth={1.5} />
              }
            </button>
          )}
          <button onClick={onClose} className="opacity-30 hover:opacity-80 transition-all duration-300 hover:rotate-90">
            <X size={24} strokeWidth={1} />
          </button>
        </div>

        {/* 멘토 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${room.color} flex items-center justify-center flex-shrink-0 shadow-sm relative`}>
            <div className="absolute inset-0.5 rounded-full border border-[#D4AF37]/40" />
            <Icon size={14} strokeWidth={1.5} className="text-[#D4AF37]" />
          </div>
          <div>
            <p className="font-serif text-sm font-bold opacity-80">{mentorName}</p>
            <p className="text-[9px] uppercase tracking-widest opacity-40">{mentorSpace}</p>
          </div>
        </div>

        {/* 원문 */}
        <div className="mb-6 relative">
          <span className="absolute -top-4 -left-2 text-6xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>
          <p
            className="font-serif text-xl sm:text-2xl italic leading-relaxed text-ink/90 relative z-10 break-keep whitespace-pre-line"
            style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', textWrap: 'balance' } as React.CSSProperties}
          >
            {entry.quote}
          </p>
        </div>

        {/* 번역 */}
        <p className="font-serif text-base sm:text-lg text-ink/70 leading-relaxed mb-5 italic break-keep break-words" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', textWrap: 'balance' } as React.CSSProperties}>
          {entry.translation}
        </p>

        {/* 출처 */}
        <div className="flex items-start gap-3 opacity-50 mb-8">
          <div className="h-px w-8 bg-ink/40 flex-shrink-0 mt-2" />
          <span className="text-xs tracking-wide leading-relaxed break-keep" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', textWrap: 'balance' } as React.CSSProperties}>{entry.source}</span>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-8 opacity-20">
          <div className="flex-1 h-px bg-ink" />
          <div className="w-1 h-1 rotate-45 bg-[#D4AF37]" />
          <div className="flex-1 h-px bg-ink" />
        </div>

        {/* 멘토의 말 */}
        <div className="mb-8">
          <p className="text-[9px] uppercase tracking-[0.3em] opacity-35 mb-3">{t('study.card.context')}</p>
          <p className="font-serif text-sm sm:text-base leading-[1.95] text-ink/80 break-keep italic" style={{ wordBreak: 'keep-all' }}>
            {entry.context}
          </p>
        </div>

        {/* 공유 카드 */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-px w-full bg-ink/8" />
          <div className="mt-3">
            <ShareCardButton
              mentorName={mentorName}
              quote={entry.quote}
              source={entry.source}
              translation={entry.translation}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 편지 쓰기 모달 ────────────────────────────────────────────────────────────

function LetterWritingModal({
  mentorId,
  onClose,
  onSent,
}: {
  mentorId: MentorKey;
  onClose: () => void;
  onSent: () => void;
}) {
  const { user, setShowAuthModal } = useAuth();
  const { t } = useTranslation();
  const room = ROOMS[mentorId];
  const Icon = room.icon;
  const mentorName = t(`mentors.${mentorId}.name`);
  const mentorTitle = t(`mentors.${mentorId}.title`);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const MAX = 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    if (!user) { setShowAuthModal(true); return; }

    setIsSending(true);
    try {
      // 1. 일기 저장
      const entryRef = await addDoc(collection(db, 'entries'), {
        uid: user.uid,
        content: trimmed,
        emotion: 'unknown',
        createdAt: serverTimestamp(),
        status: 'replied',
      });

      // 2. 최근 일기 조회
      let recentEntries: { content: string; emotion?: string; date?: string }[] = [];
      try {
        const snap = await getDocs(query(
          collection(db, 'entries'),
          where('uid', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(6),
        ));
        snap.forEach(d => {
          if (d.id !== entryRef.id) {
            const data = d.data();
            recentEntries.push({ content: data.content, emotion: data.emotion,
              date: data.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') });
          }
        });
        recentEntries = recentEntries.slice(0, 5);
      } catch {}

      // 3. pendingDeliverTimes — 즉시 도착
      const deliverTimes: Record<string, number> = { [mentorId]: Date.now() };
      localStorage.setItem('pendingEntryId', entryRef.id);
      localStorage.setItem('pendingDeliverTimes', JSON.stringify(deliverTimes));
      window.dispatchEvent(new Event('pendingEntryUpdated'));

      // 4. 해당 멘토에게만 답장 생성
      const reply = await generateSingleMentorReply(trimmed, mentorId, new Date().getHours(), recentEntries);
      const replyData: any = {
        uid: user.uid,
        entryId: entryRef.id,
        mentorId: reply.mentorId,
        quote: reply.quote,
        translation: reply.translation,
        advice: reply.advice,
        createdAt: serverTimestamp(),
      };
      if (reply.source) replyData.source = reply.source;
      await addDoc(collection(db, 'replies'), replyData);

      setIsSent(true);
      // 2초 후 모달 닫기
      setTimeout(() => onSent(), 2200);
    } catch (err) {
      console.error('편지 전송 실패:', err);
      setIsSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 16, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#fdfbf7] p-8 sm:p-12 border border-[#D4AF37]/20 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
        }}
      >
        {/* 코너 장식 */}
        <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-[#D4AF37]/25 pointer-events-none" />
        <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-[#D4AF37]/25 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-[#D4AF37]/25 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-[#D4AF37]/25 pointer-events-none" />

        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 opacity-30 hover:opacity-70 transition-opacity duration-200 hover:rotate-90 transition-transform"
        >
          <X size={22} strokeWidth={1} />
        </button>

        {/* 수신인 */}
        <div className="flex flex-col items-center mb-8">
          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${room.color} flex items-center justify-center mb-3 relative`}>
            <div className="absolute inset-1 rounded-full border border-[#D4AF37]/40" />
            <Icon size={17} strokeWidth={1.3} className="text-[#D4AF37]" />
          </div>
          <p className="font-serif text-[10px] uppercase tracking-[0.3em] opacity-35 mb-1">To</p>
          <p className="font-serif text-lg font-bold text-ink/85">{mentorName}</p>
          <p className="text-[10px] opacity-35 italic mt-0.5">{mentorTitle}</p>
        </div>

        {isSent ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 py-8 text-center"
          >
            <p className="font-serif italic text-sm opacity-70">{t('study.sent')}</p>
            <p className="text-[11px] opacity-35 font-serif leading-relaxed break-keep" style={{ wordBreak: 'keep-all' }}>
              {t('study.sentHint')}
            </p>
          </motion.div>
        ) : isSending ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="font-serif italic text-sm opacity-50"
            >
              {t('study.sending')}
            </motion.div>
            <p className="text-[10px] opacity-25 font-serif text-center">
              {t('study.waitingFor', { name: mentorName })}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="relative">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value.slice(0, MAX))}
                placeholder={t('study.letterPlaceholder', { name: mentorName })}
                rows={5}
                className="w-full bg-transparent resize-none outline-none font-serif text-base leading-[1.9] text-ink/85 placeholder:text-ink/25 placeholder:italic border-b border-ink/15 pb-2 focus:border-ink/30 transition-colors duration-300"
                autoFocus
              />
              <span className={`absolute bottom-3 right-0 text-[10px] font-mono transition-opacity ${content.length > MAX * 0.8 ? 'opacity-50' : 'opacity-20'}`}>
                {content.length}/{MAX}
              </span>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={!content.trim()}
                className="font-serif italic text-sm opacity-55 hover:opacity-90 transition-opacity duration-300 disabled:opacity-20 border-b border-ink/20 pb-px"
              >
                {t('study.sendAction')}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
