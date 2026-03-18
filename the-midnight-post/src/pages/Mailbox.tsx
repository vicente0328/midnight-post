import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flower2, Cross, Feather, Brush, Mail, ArrowRight, Bookmark, BookmarkCheck } from 'lucide-react';

// ── 멘토 정보 ────────────────────────────────────────────────────────────────

const MENTOR_INFO = {
  hyewoon:   { name: '혜운 스님',    spaceName: '청명각(淸明閣)', icon: Flower2, color: 'from-stone-700 to-stone-900', accentRgb: '124,106,80' },
  benedicto: { name: '베네딕토 신부', spaceName: '고해소',         icon: Cross,   color: 'from-red-900 to-red-950',        accentRgb: '122,48,48'  },
  theodore:  { name: '테오도르 교수', spaceName: '서재',           icon: Feather, color: 'from-slate-800 to-slate-950',     accentRgb: '58,74,92'   },
  yeonam:    { name: '연암 선생',    spaceName: '취락헌(聚樂軒)', icon: Brush,   color: 'from-emerald-900 to-emerald-950', accentRgb: '45,90,61'   },
} as const;

type MentorKey = keyof typeof MENTOR_INFO;

interface ReplyDoc {
  id: string;
  uid: string;
  entryId: string;
  mentorId: string;
  quote: string;
  source?: string;
  translation: string;
  advice: string;
  createdAt: any;
}

// ── Mailbox ──────────────────────────────────────────────────────────────────

export default function Mailbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightEntryId = searchParams.get('entryId');

  const [replies, setReplies] = useState<ReplyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReply, setSelectedReply] = useState<ReplyDoc | null>(null);

  // 하이라이트 대상 ref (첫 번째 매칭 아이템)
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'replies'), where('uid', '==', user.uid)))
      .then(snap => {
        const list: ReplyDoc[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as ReplyDoc));
        // 최신순 정렬 (도착 순서: createdAt 내림차순)
        list.sort((a, b) => (b.createdAt?.toDate?.() ?? 0) - (a.createdAt?.toDate?.() ?? 0));
        setReplies(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // 하이라이트 대상으로 스크롤
  useEffect(() => {
    if (!loading && highlightEntryId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }
  }, [loading, highlightEntryId]);

  if (!user) {
    return (
      <div className="w-full flex flex-col items-center py-20">
        <p className="font-serif italic opacity-40">로그인 후 편지함을 확인할 수 있습니다.</p>
      </div>
    );
  }

  // 하이라이트 대상 entryId의 첫 번째 reply index 찾기
  let highlightFirstSeen = false;

  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      {/* ── 헤더 ── */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-4">Mailbox</h1>
        <p className="opacity-60 italic text-sm break-keep" style={{ wordBreak: 'keep-all' }}>
          현자들의 편지가 모이는 곳입니다.
        </p>
      </div>

      {/* ── 장식선 ── */}
      <div className="flex items-center gap-3 w-full mb-10 opacity-20">
        <div className="flex-1 h-px bg-ink" />
        <Mail size={13} strokeWidth={1.2} className="text-[#D4AF37]" />
        <div className="flex-1 h-px bg-ink" />
      </div>

      {/* ── 로딩 ── */}
      {loading && (
        <p className="font-serif italic opacity-30 text-sm animate-pulse py-12">
          편지함을 열고 있습니다…
        </p>
      )}

      {/* ── 비어있음 ── */}
      {!loading && replies.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-5 opacity-35 py-16 text-center"
        >
          <Mail size={34} strokeWidth={0.9} />
          <p className="font-serif italic text-base">아직 도착한 편지가 없습니다.</p>
          <p className="text-xs tracking-wide">The Desk에서 첫 번째 마음을 남겨보세요.</p>
        </motion.div>
      )}

      {/* ── 편지 목록 ── */}
      <div className="w-full flex flex-col gap-2.5">
        {!loading && replies.map((reply, index) => {
          const mentor = MENTOR_INFO[reply.mentorId as MentorKey];
          if (!mentor) return null;
          const Icon = mentor.icon;
          const isHighlighted = reply.entryId === highlightEntryId;

          // 해당 entryId의 첫 번째 항목에만 ref 부착
          let attachRef = false;
          if (isHighlighted && !highlightFirstSeen) {
            attachRef = true;
            highlightFirstSeen = true;
          }

          const date = reply.createdAt?.toDate
            ? format(reply.createdAt.toDate(), 'yyyy.MM.dd')
            : '—';

          // 인용구 미리보기 (이메일 제목처럼)
          const quoteLine = reply.quote.split('\n')[0];
          const preview = quoteLine.length > 55 ? quoteLine.slice(0, 55) + '…' : quoteLine;

          // 번역 서브텍스트
          const translationPreview = reply.translation
            ? (reply.translation.length > 48 ? reply.translation.slice(0, 48) + '…' : reply.translation)
            : null;

          return (
            <motion.div
              key={reply.id}
              ref={attachRef ? (el) => { highlightRef.current = el; } : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                onClick={() => setSelectedReply(reply)}
                className={`group w-full text-left relative flex items-start gap-4 px-5 py-5 transition-all duration-500 ${
                  isHighlighted
                    ? 'border border-[#D4AF37]/55 bg-[#fef9e8] shadow-md'
                    : 'border border-ink/10 bg-[#fdfbf7] hover:border-ink/22 hover:shadow-sm'
                }`}
                style={{
                  backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* 내부 테두리 장식 */}
                <div className="absolute top-1.5 left-1.5 right-1.5 bottom-1.5 border border-ink/4 pointer-events-none" />

                {/* 멘토 엠블럼 */}
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${mentor.color} flex items-center justify-center flex-shrink-0 shadow-sm relative mt-0.5`}
                >
                  <div className="absolute inset-0.5 rounded-full border border-[#D4AF37]/35" />
                  <Icon size={14} strokeWidth={1.5} className="text-[#D4AF37]" />
                </div>

                {/* 편지 내용 */}
                <div className="flex-1 min-w-0">
                  {/* 발신인 + 날짜 */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="font-serif text-sm font-bold text-ink/85 group-hover:text-ink transition-colors duration-300 leading-tight">
                      {mentor.name}
                    </p>
                    <span className="text-[10px] font-mono opacity-35 flex-shrink-0 mt-0.5">{date}</span>
                  </div>
                  {/* 인용구 미리보기 (이메일 제목처럼) */}
                  <p className="font-serif text-sm italic opacity-65 leading-relaxed line-clamp-1">
                    &ldquo;{preview}&rdquo;
                  </p>
                  {/* 번역 서브텍스트 */}
                  {translationPreview && (
                    <p className="text-[11px] opacity-35 mt-0.5 line-clamp-1 leading-relaxed">
                      {translationPreview}
                    </p>
                  )}
                </div>

                {/* 열기 화살표 */}
                <div className="flex-shrink-0 opacity-18 group-hover:opacity-45 transition-opacity duration-300 self-center ml-1">
                  <ArrowRight size={13} strokeWidth={1.5} />
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* ── 편지 상세 모달 ── */}
      <AnimatePresence>
        {selectedReply && (
          <LetterModal
            reply={selectedReply}
            onClose={() => setSelectedReply(null)}
            onGoToArchive={() => {
              const entryId = selectedReply.entryId;
              setSelectedReply(null);
              navigate(`/archive?entryId=${entryId}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 편지 읽기 모달 ────────────────────────────────────────────────────────────

function LetterModal({
  reply,
  onClose,
  onGoToArchive,
}: {
  reply: ReplyDoc;
  onClose: () => void;
  onGoToArchive: () => void;
}) {
  const { user } = useAuth();
  const mentor = MENTOR_INFO[reply.mentorId as MentorKey];
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // 북마크 여부 확인
  useEffect(() => {
    if (!user || !mentor) return;
    getDocs(query(
      collection(db, 'bookmarks'),
      where('uid', '==', user.uid),
      where('entryId', '==', reply.entryId),
    )).then(snap => {
      snap.forEach(d => {
        if (d.data().mentorId === reply.mentorId) setBookmarkId(d.id);
      });
    }).catch(() => {});
  }, [user, reply, mentor]);

  const toggleBookmark = useCallback(async () => {
    if (!user || !mentor || saving) return;
    setSaving(true);
    try {
      if (bookmarkId) {
        await deleteDoc(doc(db, 'bookmarks', bookmarkId));
        setBookmarkId(null);
      } else {
        const ref = await addDoc(collection(db, 'bookmarks'), {
          uid: user.uid,
          entryId: reply.entryId,
          mentorId: reply.mentorId,
          quote: reply.quote,
          source: reply.source ?? '',
          translation: reply.translation,
          advice: reply.advice,
          savedAt: serverTimestamp(),
        });
        setBookmarkId(ref.id);
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  }, [user, mentor, saving, bookmarkId, reply]);

  if (!mentor) return null;

  const Icon = mentor.icon;
  const date = reply.createdAt?.toDate
    ? format(reply.createdAt.toDate(), 'yyyy년 MM월 dd일')
    : '';

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
        initial={{ scale: 0.96, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 20, opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#fdfbf7] shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-y-auto overscroll-contain max-h-[93vh] border border-[#D4AF37]/20"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 100px rgba(139,115,85,0.10), 0 20px 60px rgba(0,0,0,0.45)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="px-7 py-9 sm:px-14 sm:py-14">
          {/* 상단 버튼 */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3">
            {user && (
              <button
                onClick={toggleBookmark}
                disabled={saving}
                className={`transition-all duration-300 ${bookmarkId ? 'opacity-80 text-[#D4AF37]' : 'opacity-28 hover:opacity-65'}`}
              >
                {bookmarkId
                  ? <BookmarkCheck size={21} strokeWidth={1.5} />
                  : <Bookmark size={21} strokeWidth={1.5} />
                }
              </button>
            )}
            <button
              onClick={onClose}
              className="opacity-28 hover:opacity-70 transition-all duration-300 hover:rotate-90"
            >
              <X size={24} strokeWidth={1} />
            </button>
          </div>

          {/* 발송 날짜 */}
          <p className="text-[9px] uppercase tracking-[0.35em] opacity-28 text-center mb-7 font-mono">
            {date}
          </p>

          {/* 멘토 헤더 */}
          <div className="flex flex-col items-center mb-10">
            <div
              className={`w-14 h-14 rounded-full bg-gradient-to-br ${mentor.color} flex items-center justify-center shadow-md mb-4 relative`}
            >
              <div className="absolute inset-1 rounded-full border border-[#D4AF37]/40" />
              <Icon size={20} strokeWidth={1.5} className="text-[#D4AF37]" />
            </div>
            <h2 className="font-serif text-xl font-bold tracking-widest text-ink/90 mb-0.5">
              {mentor.name}
            </h2>
            <p className="text-[9px] uppercase tracking-[0.3em] opacity-35">{mentor.spaceName}</p>
          </div>

          {/* 인용구 */}
          <div className="text-center mb-10 relative px-0 md:px-8">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-7xl text-[#D4AF37]/13 font-serif leading-none select-none pointer-events-none">
              &ldquo;
            </span>
            <p className="text-base sm:text-xl md:text-2xl leading-relaxed italic text-ink/90 mb-4 relative z-10 font-medium font-serif break-keep"
              style={{ wordBreak: 'keep-all' }}>
              {reply.quote}
            </p>
            {reply.source && (
              <div className="flex items-center justify-center gap-3 mb-4 opacity-55">
                <div className="h-px w-10 bg-ink/40" />
                <span className="text-xs tracking-wider">{reply.source}</span>
                <div className="h-px w-10 bg-ink/40" />
              </div>
            )}
            <p className="text-sm sm:text-base leading-relaxed text-ink/65 font-serif break-keep italic"
              style={{ wordBreak: 'keep-all' }}>
              {reply.translation}
            </p>
          </div>

          {/* 구분선 */}
          <div className="flex justify-center items-center gap-3 my-8 opacity-28">
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
            <div className="w-1 h-1 rotate-45 bg-[#D4AF37]/60" />
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
          </div>

          {/* 조언 본문 */}
          <div className="text-[15px] sm:text-lg leading-[1.9] sm:leading-[2.1] text-ink/88 px-0 md:px-4 font-serif break-keep"
            style={{ wordBreak: 'keep-all' }}>
            {reply.advice.replace(/\\n/g, '\n').split('\n').map((paragraph, i) => {
              if (!paragraph.trim()) return null;
              return <p key={i} className="mb-5 md:mb-6">{paragraph}</p>;
            })}
          </div>

          {/* 서명 */}
          <div className="mt-10 text-right opacity-55 italic font-serif">
            <p className="text-base sm:text-lg font-bold">{mentor.name} 드림</p>
          </div>

          {/* 나의 편지 보러가기 */}
          <div className="mt-10 pt-6 border-t border-ink/10 flex justify-center">
            <button
              onClick={onGoToArchive}
              className="font-serif text-xs italic opacity-38 hover:opacity-65 transition-opacity duration-300 flex items-center gap-1.5 tracking-wide"
            >
              나의 편지 보러가기
              <ArrowRight size={11} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
