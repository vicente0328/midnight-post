import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Feather, Flower2, Cross, Brush, X, ChevronLeft, Bookmark, BookmarkCheck } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { getTodayKnowledge, forceRegenerateKnowledge, KnowledgeEntry } from '../services/knowledge';

// ── 멘토 연구실 정보 ─────────────────────────────────────────────────────────

const ROOMS = {
  hyewoon: {
    name: '혜운 스님',
    roomName: '청명각(淸明閣)',
    desc: '비움과 머무름의 수행자',
    icon: Flower2,
    color: 'from-stone-700 to-stone-900',
    accent: '#7c6a50',
    ambience: '고요한 선원의 향내가 번진다.\n빛이 창호지를 투과해 바닥에 내려앉는다.',
  },
  benedicto: {
    name: '베네딕토 신부',
    roomName: '고해소',
    desc: '사랑과 위로의 동반자',
    icon: Cross,
    color: 'from-red-900 to-red-950',
    accent: '#7a3030',
    ambience: '촛불이 흔들리며 작은 방을\n밝힌다. 나무 향이 조용히 감돈다.',
  },
  theodore: {
    name: '테오도르 교수',
    roomName: '서재',
    desc: '이성과 실존의 철학자',
    icon: Feather,
    color: 'from-slate-800 to-slate-950',
    accent: '#3a4a5c',
    ambience: '책들이 빼곡한 서가. 잉크 냄새와\n오래된 종이 사이로 사유가 깃든다.',
  },
  yeonam: {
    name: '연암 선생',
    roomName: '취락헌(聚樂軒)',
    desc: '순리와 조화의 선비',
    icon: Brush,
    color: 'from-emerald-900 to-emerald-950',
    accent: '#2d5a3d',
    ambience: '먹빛 향기와 대나무 그림자.\n창 너머 산이 숨을 고른다.',
  },
} as const;

type MentorKey = keyof typeof ROOMS;

// ── Study 메인 ──────────────────────────────────────────────────────────────

export default function Study() {
  const [activeRoom, setActiveRoom] = useState<MentorKey | null>(null);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeRoom ?? 'lobby'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
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

// ── 입구 화면 ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@tmp.com';

function Lobby({ onEnter }: { onEnter: (id: MentorKey) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [regenerating, setRegenerating] = useState(false);

  const handleAdminDoubleClick = async () => {
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
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-3">멘토의 연구실</h1>
        <p className="opacity-60 italic text-sm break-keep">
          매일 새롭게 쌓이는 지혜의 공간입니다. 문을 열어보세요.
        </p>
        {isAdmin && (
          <button
            onClick={handleAdminDoubleClick}
            disabled={regenerating}
            className="mt-3 text-[10px] uppercase tracking-[0.2em] opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
          >
            {regenerating ? '재생성 중...' : '↻ 지혜 재생성'}
          </button>
        )}
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
    </div>
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
    <div className="w-full flex flex-col items-center">
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
      <p className="font-serif italic text-sm text-center opacity-50 mb-10 max-w-md whitespace-pre-line break-keep" style={{ wordBreak: 'keep-all' }}>
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

        {!loading && entries.length === 0 && (
          <p className="font-serif italic opacity-40 text-center py-8">
            오늘의 지혜가 아직 준비되지 않았습니다. 잠시 후 다시 방문해주세요.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="h-44 border border-ink/8 bg-[#fdfbf7] animate-pulse opacity-50" />
              ))
            : entries.map((entry, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setSelectedEntry(entry)}
              className="group text-left relative flex flex-col p-7 border border-ink/12 bg-[#faf8f3] hover:bg-[#f7f4ed] shadow-sm hover:shadow-lg transition-all duration-700"
              style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }}
            >
              {/* 모서리 장식 */}
              <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t border-l border-[#D4AF37]/25 group-hover:border-[#D4AF37]/55 transition-colors duration-500 pointer-events-none" />
              <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t border-r border-[#D4AF37]/25 group-hover:border-[#D4AF37]/55 transition-colors duration-500 pointer-events-none" />
              <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b border-l border-[#D4AF37]/25 group-hover:border-[#D4AF37]/55 transition-colors duration-500 pointer-events-none" />
              <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b border-r border-[#D4AF37]/25 group-hover:border-[#D4AF37]/55 transition-colors duration-500 pointer-events-none" />

              {/* 상단 장식 라인 */}
              <div className="w-6 h-px bg-[#D4AF37]/30 group-hover:bg-[#D4AF37]/60 mb-5 transition-colors duration-500" />

              {/* 명언 */}
              <p className="font-serif text-sm italic leading-[1.85] mb-4 line-clamp-3 text-ink/75 group-hover:text-ink/90 transition-colors duration-500 break-keep flex-1" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                {entry.quote.split('\n')[0]}
              </p>

              {/* 출처 구분선 */}
              <div className="flex items-center gap-2 mb-2 opacity-30">
                <div className="flex-1 h-px bg-ink/40" />
                <div className="w-0.5 h-0.5 rounded-full bg-[#D4AF37]" />
              </div>

              {/* 출처 */}
              <p className="text-[9.5px] tracking-wider opacity-45 break-keep leading-relaxed font-serif" style={{ wordBreak: 'keep-all' }}>
                {entry.source}
              </p>
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
            mentorId={mentorId}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 지혜 상세 모달 ────────────────────────────────────────────────────────────

function WisdomModal({
  entry,
  room,
  mentorId,
  onClose,
}: {
  entry: KnowledgeEntry;
  room: typeof ROOMS[MentorKey];
  mentorId: MentorKey;
  onClose: () => void;
}) {
  const Icon = room.icon;
  const { user } = useAuth();
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 이미 저장된 북마크인지 확인
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
          <button
            onClick={onClose}
            className="opacity-30 hover:opacity-80 transition-all duration-300 hover:rotate-90"
          >
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
            <p className="font-serif text-sm font-bold opacity-80">{room.name}</p>
            <p className="text-[9px] uppercase tracking-widest opacity-40">{room.roomName}</p>
          </div>
        </div>

        {/* 원문 */}
        <div className="mb-6 relative">
          <span className="absolute -top-4 -left-2 text-6xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>
          <p className="font-serif text-xl sm:text-2xl italic leading-relaxed text-ink/90 relative z-10 break-keep whitespace-pre-line" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
            {entry.quote}
          </p>
        </div>

        {/* 번역 */}
        <p className="font-serif text-base sm:text-lg text-ink/70 leading-relaxed mb-5 italic break-keep" style={{ wordBreak: 'keep-all' }}>
          {entry.translation}
        </p>

        {/* 출처 */}
        <div className="flex items-start gap-3 opacity-50 mb-8">
          <div className="h-px w-8 bg-ink/40 flex-shrink-0 mt-2" />
          <span className="text-xs tracking-wide leading-relaxed break-keep" style={{ wordBreak: 'keep-all' }}>{entry.source}</span>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-8 opacity-20">
          <div className="flex-1 h-px bg-ink" />
          <div className="w-1 h-1 rotate-45 bg-[#D4AF37]" />
          <div className="flex-1 h-px bg-ink" />
        </div>

        {/* 멘토의 말 */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] opacity-35 mb-3">멘토의 말</p>
          <p className="font-serif text-sm sm:text-base leading-[1.95] text-ink/80 break-keep italic" style={{ wordBreak: 'keep-all' }}>
            {entry.context}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
