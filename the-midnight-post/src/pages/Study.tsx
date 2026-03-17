import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Feather, Flower2, Cross, Brush, X, ChevronLeft } from 'lucide-react';
import { getTodayKnowledge, KnowledgeEntry } from '../services/knowledge';

// ── 멘토 연구실 정보 ─────────────────────────────────────────────────────────

const ROOMS = {
  hyewoon: {
    name: '혜운 스님',
    roomName: '청명각(淸明閣)',
    desc: '비움과 머무름의 수행자',
    icon: Flower2,
    color: 'from-stone-700 to-stone-900',
    accent: '#7c6a50',
    ambience: '고요한 선원의 향내가 번진다. 빛이 창호지를 투과해 바닥에 내려앉는다.',
  },
  benedicto: {
    name: '베네딕토 신부',
    roomName: '고해소',
    desc: '사랑과 위로의 동반자',
    icon: Cross,
    color: 'from-red-900 to-red-950',
    accent: '#7a3030',
    ambience: '촛불이 흔들리며 작은 방을 밝힌다. 나무 향이 조용히 감돈다.',
  },
  theodore: {
    name: '테오도르 교수',
    roomName: '서재',
    desc: '이성과 실존의 철학자',
    icon: Feather,
    color: 'from-slate-800 to-slate-950',
    accent: '#3a4a5c',
    ambience: '책들이 빼곡한 서가. 잉크 냄새와 오래된 종이 사이로 사유가 깃든다.',
  },
  yeonam: {
    name: '연암 선생',
    roomName: '취락헌(聚樂軒)',
    desc: '순리와 조화의 선비',
    icon: Brush,
    color: 'from-emerald-900 to-emerald-950',
    accent: '#2d5a3d',
    ambience: '먹빛 향기와 대나무 그림자. 창 너머 산이 숨을 고른다.',
  },
} as const;

type MentorKey = keyof typeof ROOMS;

// ── Study 메인 ──────────────────────────────────────────────────────────────

export default function Study() {
  const [activeRoom, setActiveRoom] = useState<MentorKey | null>(null);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <AnimatePresence mode="wait">
        {activeRoom ? (
          <RoomView
            key={activeRoom}
            mentorId={activeRoom}
            onBack={() => setActiveRoom(null)}
          />
        ) : (
          <Lobby key="lobby" onEnter={setActiveRoom} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 입구 화면 ────────────────────────────────────────────────────────────────

function Lobby({ onEnter }: { onEnter: (id: MentorKey) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full flex flex-col items-center"
    >
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-3">멘토의 연구실</h1>
        <p className="opacity-60 italic text-sm break-keep">
          매일 새롭게 쌓이는 지혜의 공간입니다. 문을 열어보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full">
        {(Object.keys(ROOMS) as MentorKey[]).map((id, index) => {
          const room = ROOMS[id];
          const Icon = room.icon;
          return (
            <motion.button
              key={id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onEnter(id)}
              className="group relative flex flex-col items-center justify-center p-10 border border-ink/15 bg-[#fdfbf7] shadow-sm hover:shadow-lg transition-all duration-700 h-56 overflow-hidden"
            >
              {/* 모서리 장식 */}
              <div className="absolute top-2 left-2 w-5 h-5 border-t border-l border-[#D4AF37]/30 group-hover:border-[#D4AF37]/70 transition-colors duration-500 pointer-events-none" />
              <div className="absolute top-2 right-2 w-5 h-5 border-t border-r border-[#D4AF37]/30 group-hover:border-[#D4AF37]/70 transition-colors duration-500 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-5 h-5 border-b border-l border-[#D4AF37]/30 group-hover:border-[#D4AF37]/70 transition-colors duration-500 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-5 h-5 border-b border-r border-[#D4AF37]/30 group-hover:border-[#D4AF37]/70 transition-colors duration-500 pointer-events-none" />

              {/* 멘토 아이콘 */}
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${room.color} flex items-center justify-center shadow-md mb-5 relative group-hover:scale-110 transition-transform duration-500`}>
                <div className="absolute inset-1 rounded-full border border-[#D4AF37]/40" />
                <Icon size={22} strokeWidth={1.5} className="text-[#D4AF37]" />
              </div>

              {/* 이름 */}
              <p className="font-serif text-base font-bold text-ink/85 group-hover:text-ink transition-colors duration-300">
                {room.name}
              </p>
              <p className="text-[11px] font-serif italic opacity-50 mt-1">{room.roomName}</p>

              {/* 호버 시 하단 힌트 */}
              <p className="absolute bottom-4 text-[10px] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-35 transition-opacity duration-500">
                문을 열다 →
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── 연구실 내부 ──────────────────────────────────────────────────────────────

function RoomView({ mentorId, onBack }: { mentorId: MentorKey; onBack: () => void }) {
  const room = ROOMS[mentorId];
  const Icon = room.icon;
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);

  useEffect(() => {
    getTodayKnowledge(mentorId)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mentorId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full flex flex-col items-center"
    >
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 mb-8 opacity-40 hover:opacity-80 transition-opacity duration-300 text-sm font-serif italic"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
        연구실 목록으로
      </button>

      {/* 연구실 헤더 */}
      <div className="flex flex-col items-center mb-4">
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${room.color} flex items-center justify-center shadow-md mb-4 relative`}>
          <div className="absolute inset-1 rounded-full border border-[#D4AF37]/40" />
          <Icon size={22} strokeWidth={1.5} className="text-[#D4AF37]" />
        </div>
        <h2 className="text-2xl font-serif font-bold mb-1">{room.name}의 {room.roomName}</h2>
        <p className="text-xs uppercase tracking-[0.25em] opacity-40 mb-3">{room.desc}</p>
      </div>

      {/* 분위기 묘사 */}
      <p className="font-serif italic text-sm text-center opacity-50 mb-10 max-w-md break-keep">
        — {room.ambience} —
      </p>

      {/* 구분선 */}
      <div className="flex items-center gap-3 mb-10 opacity-25 w-full">
        <div className="flex-1 h-px bg-ink" />
        <div className="w-1 h-1 rotate-45 bg-ink" />
        <div className="flex-1 h-px bg-ink" />
      </div>

      {/* 오늘의 지혜 */}
      <div className="w-full mb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-35 mb-6 text-center">
          오늘의 지혜 — {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
        </p>

        {loading && (
          <p className="font-serif italic opacity-40 text-center animate-pulse py-8">
            지혜를 불러오는 중…
          </p>
        )}

        {!loading && entries.length === 0 && (
          <p className="font-serif italic opacity-40 text-center py-8">
            오늘의 지혜가 아직 준비되지 않았습니다. 잠시 후 다시 방문해주세요.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {entries.map((entry, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setSelectedEntry(entry)}
              className="group text-left relative flex flex-col p-6 border border-ink/15 bg-[#fdfbf7] shadow-sm hover:shadow-md transition-all duration-500"
            >
              <div className="absolute top-1.5 left-1.5 right-1.5 bottom-1.5 border border-ink/5 pointer-events-none" />

              {/* 명언 */}
              <p className="font-serif text-sm italic opacity-80 leading-relaxed mb-3 line-clamp-3 group-hover:opacity-100 transition-opacity duration-300">
                "{entry.quote}"
              </p>

              {/* 출처 */}
              <p className="text-[10px] uppercase tracking-widest opacity-40 mb-3">
                — {entry.source}
              </p>

              {/* 태그 */}
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {entry.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="text-[9px] px-2 py-0.5 border border-ink/15 opacity-50 tracking-wide"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* 지혜 상세 모달 */}
      <AnimatePresence>
        {selectedEntry && (
          <WisdomModal
            entry={selectedEntry}
            room={room}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── 지혜 상세 모달 ────────────────────────────────────────────────────────────

function WisdomModal({
  entry,
  room,
  onClose,
}: {
  entry: KnowledgeEntry;
  room: typeof ROOMS[MentorKey];
  onClose: () => void;
}) {
  const Icon = room.icon;

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
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 opacity-30 hover:opacity-80 transition-all duration-300 hover:rotate-90"
        >
          <X size={24} strokeWidth={1} />
        </button>

        {/* 멘토 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${room.color} flex items-center justify-center flex-shrink-0 shadow-sm relative`}>
            <div className="absolute inset-0.5 rounded-full border border-[#D4AF37]/40" />
            <Icon size={14} strokeWidth={1.5} className="text-[#D4AF37]" />
          </div>
          <div>
            <p className="font-serif text-sm font-bold opacity-80">{room.name}</p>
            <p className="text-[9px] uppercase tracking-widest opacity-40">{room.roomName}</p>
          </div>
        </div>

        {/* 명언 */}
        <div className="mb-8 relative">
          <span className="absolute -top-4 -left-2 text-6xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>
          <p className="font-serif text-xl sm:text-2xl italic leading-relaxed text-ink/90 relative z-10 mb-4">
            {entry.quote}
          </p>
          <div className="flex items-center gap-3 opacity-50">
            <div className="h-px w-8 bg-ink/40" />
            <span className="text-xs tracking-wider">{entry.source}</span>
          </div>
        </div>

        {/* 번역 */}
        <p className="font-serif text-base sm:text-lg text-ink/70 leading-relaxed mb-8 italic">
          {entry.translation}
        </p>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-8 opacity-20">
          <div className="flex-1 h-px bg-ink" />
          <div className="w-1 h-1 rotate-45 bg-[#D4AF37]" />
          <div className="flex-1 h-px bg-ink" />
        </div>

        {/* 활용 맥락 */}
        <div className="mb-8">
          <p className="text-[9px] uppercase tracking-[0.3em] opacity-35 mb-3">이런 마음에 와닿습니다</p>
          <p className="font-serif text-sm sm:text-base leading-relaxed text-ink/80">
            {entry.context}
          </p>
        </div>

        {/* 태그 */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {entry.tags.map(tag => (
              <span
                key={tag}
                className="text-[10px] px-3 py-1 border border-ink/20 opacity-55 tracking-wide font-serif"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
