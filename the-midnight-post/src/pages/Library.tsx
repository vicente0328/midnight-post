import React, { useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useVault } from '../components/VaultContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { X, Feather, Flower2, Cross, Brush, Bookmark, Trash2 } from 'lucide-react';
import { ShareCardButton } from '../utils/shareCard';

// ── 멘토 정보 ─────────────────────────────────────────────────────────────────

const MENTORS = {
  hyewoon:   { name: '혜운 스님',    title: '비움과 머무름의 수행자', icon: Flower2, color: 'from-stone-700 to-stone-900' },
  benedicto: { name: '베네딕토 신부', title: '사랑과 위로의 동반자',   icon: Cross,   color: 'from-red-900 to-red-950'    },
  theodore:  { name: '테오도르 교수', title: '이성과 실존의 철학자',   icon: Feather, color: 'from-slate-800 to-slate-950'  },
  yeonam:    { name: '연암 선생',    title: '순리와 조화의 선비',     icon: Brush,   color: 'from-emerald-900 to-emerald-950' },
} as const;

type MentorKey = keyof typeof MENTORS;

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface Bookmark {
  id: string;
  uid: string;
  entryId: string;
  mentorId: string;
  quote: string;
  source: string;
  translation: string;
  advice: string;
  savedAt: any;
}

// ── splitDialogue (Envelopes와 동일) ──────────────────────────────────────────

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

// ── Library ───────────────────────────────────────────────────────────────────

export default function Library() {
  const { user } = useAuth();
  const { decrypt } = useVault();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Bookmark | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getDocs(query(collection(db, 'bookmarks'), where('uid', '==', user.uid)))
      .then(async snap => {
        const list: Bookmark[] = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              quote: await decrypt(data.quote ?? ''),
              source: data.source ? await decrypt(data.source) : data.source,
              translation: await decrypt(data.translation ?? ''),
              advice: await decrypt(data.advice ?? ''),
            } as Bookmark;
          })
        );
        list.sort((a, b) => (b.savedAt?.toDate?.() ?? 0) - (a.savedAt?.toDate?.() ?? 0));
        setBookmarks(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, decrypt]);

  const removeBookmark = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'bookmarks', id));
    setBookmarks(prev => prev.filter(b => b.id !== id));
    if (selected?.id === id) setSelected(null);
    setConfirmDeleteId(null);
  }, [selected]);

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-3">나의 서재</h1>
        <p className="opacity-60 italic text-sm break-keep">마음에 간직한 지혜들을 모아두는 곳입니다.</p>
      </div>

      {loading && (
        <p className="font-serif italic opacity-40 animate-pulse">서재를 열고 있습니다…</p>
      )}

      {!loading && bookmarks.length === 0 && (
        <div className="flex flex-col items-center gap-4 opacity-50">
          <Bookmark size={32} strokeWidth={1} />
          <p className="font-serif italic text-sm">아직 간직한 편지가 없습니다.</p>
          <p className="text-xs opacity-70">편지를 읽다가 북마크 아이콘을 눌러 저장해보세요.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
        {bookmarks.map((bm, index) => {
          const mentor = MENTORS[bm.mentorId as MentorKey];
          if (!mentor) return null;
          const Icon = mentor.icon;
          const date = bm.savedAt?.toDate ? format(bm.savedAt.toDate(), 'yyyy.MM.dd') : '—';

          return (
            <motion.div
              key={bm.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="group relative"
            >
              <button
                onClick={() => setSelected(bm)}
                className="w-full text-left relative flex flex-col justify-between p-6 border border-ink/20 bg-[#fdfbf7] shadow-sm hover:shadow-md transition-shadow duration-500 h-52"
              >
                <div className="absolute top-2 left-2 right-2 bottom-2 border border-ink/5 pointer-events-none" />

                {/* 멘토 정보 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${mentor.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon size={13} strokeWidth={1.5} className="text-[#D4AF37]" />
                  </div>
                  <div>
                    <p className="font-serif text-sm font-bold text-ink/80">{mentor.name}</p>
                    <p className="text-[9px] uppercase tracking-widest opacity-40">{date}</p>
                  </div>
                </div>

                {/* 명언 프리뷰 */}
                <p className="font-serif text-sm italic opacity-75 line-clamp-2 leading-relaxed mb-2">
                  "{bm.quote}"
                </p>

                {/* 번역 */}
                <p className="text-xs opacity-50 line-clamp-2 leading-relaxed">
                  {bm.translation}
                </p>
              </button>

              {/* 삭제 버튼 */}
              {confirmDeleteId === bm.id ? (
                <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#fdfbf7] border border-ink/20 px-2 py-1 shadow-sm z-10">
                  <span className="text-[10px] opacity-60">제거할까요?</span>
                  <button
                    onClick={() => removeBookmark(bm.id)}
                    className="text-[10px] text-red-700 hover:text-red-900 transition-colors"
                  >확인</button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-[10px] opacity-40 hover:opacity-70 transition-opacity"
                  >취소</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(bm.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity duration-200"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 편지 전체보기 모달 */}
      <AnimatePresence>
        {selected && (
          <BookmarkModal
            bookmark={selected}
            onClose={() => setSelected(null)}
            onRemove={() => removeBookmark(selected.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 북마크 편지 모달 ──────────────────────────────────────────────────────────

function BookmarkModal({
  bookmark,
  onClose,
  onRemove,
}: {
  bookmark: Bookmark;
  onClose: () => void;
  onRemove: () => void;
}) {
  const mentor = MENTORS[bookmark.mentorId as MentorKey];
  if (!mentor) return null;
  const Icon = mentor.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 md:p-8 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-[#fdfbf7] p-5 sm:p-10 md:p-20 shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-y-auto overscroll-contain max-h-[95vh] letter-scroll border border-[#D4AF37]/20"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 100px rgba(139,115,85,0.1), 0 20px 60px rgba(0,0,0,0.4)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-8 sm:right-8 opacity-40 hover:opacity-100 transition-all duration-300 hover:rotate-90"
        >
          <X size={28} strokeWidth={1} />
        </button>

        {/* 서재에서 제거 */}
        <button
          onClick={onRemove}
          title="서재에서 제거"
          className="absolute top-4 right-12 sm:top-8 sm:right-16 transition-all duration-300"
        >
          <Bookmark size={22} strokeWidth={1.5} className="fill-[#D4AF37] text-[#D4AF37] hover:fill-transparent transition-all duration-300" />
        </button>

        {/* 헤더 */}
        <div className="flex flex-col items-center mb-6 md:mb-16">
          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${mentor.color} p-1 shadow-md mb-4 relative flex items-center justify-center`}>
            <div className="absolute inset-1 rounded-full border border-[#D4AF37]/50" />
            <Icon size={20} strokeWidth={1.5} className="text-[#D4AF37] w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-wider sm:tracking-widest text-ink/90">{mentor.name}</h2>
          <p className="text-[10px] sm:text-xs opacity-50 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-2">{mentor.title}</p>
        </div>

        <div className="font-serif text-ink/90">
          {/* 명언 */}
          <div className="text-center mb-6 md:mb-16 relative px-0 md:px-12">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-7xl sm:text-8xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>
            <p className="text-base sm:text-2xl md:text-3xl leading-relaxed italic text-ink/90 mb-5 relative z-10 font-medium break-keep break-words" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {bookmark.quote}
            </p>
            <div className="flex items-center justify-center gap-3 mb-5 opacity-60">
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent" />
              {bookmark.source && <span className="text-xs sm:text-sm tracking-wider break-keep break-words shrink-0" style={{ textWrap: 'balance' } as React.CSSProperties}>{bookmark.source}</span>}
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent" />
            </div>
            <p className="text-sm sm:text-base md:text-lg leading-relaxed text-ink/70 mx-auto break-keep break-words" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {bookmark.translation}
            </p>
          </div>

          {/* 구분선 */}
          <div className="flex justify-center items-center gap-3 my-6 md:my-16 opacity-40">
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
            <div className="w-1 h-1 rotate-45 bg-[#D4AF37]/60" />
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
          </div>

          {/* 편지 본문 */}
          <div className="text-[15px] sm:text-lg md:text-xl leading-[1.85] sm:leading-[2.1] md:leading-[2.2] text-ink/90 md:text-justify md:break-keep px-0 md:px-8">
            {bookmark.advice.replace(/\\n/g, '\n').split('\n').map((paragraph, index) => {
              if (!paragraph.trim()) return null;
              const isFirst = index === 0;
              const segments = splitDialogue(paragraph);
              return (
                <p
                  key={index}
                  className={`mb-5 md:mb-7 ${isFirst ? 'sm:first-letter:text-5xl sm:first-letter:font-bold sm:first-letter:text-[#D4AF37] sm:first-letter:mr-2 sm:first-letter:float-left sm:first-letter:leading-none sm:first-letter:mt-2' : ''}`}
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

          {/* 서명 */}
          <div className="mt-8 md:mt-24 text-right opacity-60 italic">
            <p className="text-sm sm:text-lg">당신의 평안을 기원하며,</p>
            <p className="text-base sm:text-xl mt-1 sm:mt-2 font-bold">{mentor.name} 드림</p>
          </div>

          {/* 공유 카드 */}
          <div className="mt-10 md:mt-14 flex flex-col items-center gap-3">
            <div className="h-px w-full bg-ink/8" />
            <div className="mt-3">
              <ShareCardButton
                mentorName={mentor.name}
                quote={bookmark.quote}
                source={bookmark.source}
                translation={bookmark.translation}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
