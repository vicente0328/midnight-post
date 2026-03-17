import React, { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flower2, Cross, Feather, Brush, Trash2, Bookmark } from 'lucide-react';

// ── 멘토 정보 ─────────────────────────────────────────────────────────────────

const MENTOR_INFO = {
  hyewoon:   { name: '혜운 스님',    spaceName: '청명각(淸明閣)', accent: '#7c6a50', icon: Flower2, color: 'from-stone-700 to-stone-900' },
  benedicto: { name: '베네딕토 신부', spaceName: '고해소',         accent: '#7a3030', icon: Cross,   color: 'from-red-900 to-red-950'   },
  theodore:  { name: '테오도르 교수', spaceName: '서재',           accent: '#3a4a5c', icon: Feather, color: 'from-slate-800 to-slate-950' },
  yeonam:    { name: '연암 선생',    spaceName: '취락헌(聚樂軒)', accent: '#2d5a3d', icon: Brush,   color: 'from-emerald-900 to-emerald-950' },
} as const;

type MentorKey = keyof typeof MENTOR_INFO;

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface EntryDoc {
  id: string;
  content: string;
  emotion?: string;
  createdAt: any;
}

interface SessionDoc {
  id: string;
  mentorId: string;
  entryId: string;
  startedAt: any;
  endedAt: any;
}

interface MessageDoc {
  id: string;
  type: 'stage_direction' | 'mentor' | 'user';
  content: string;
  order: number;
}

// ── 북마크 타입 ────────────────────────────────────────────────────────────────

interface BookmarkDoc {
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

// ── 탭 타입 ───────────────────────────────────────────────────────────────────

type Tab = 'letters' | 'damso' | 'bookmarks';

// ── Archive ───────────────────────────────────────────────────────────────────

// 카드 스켈레톤 — 로딩 중 레이아웃 높이 유지용
function SkeletonCard({ height = 'h-48' }: { height?: string }) {
  return <div className={`${height} border border-ink/8 bg-[#fdfbf7] animate-pulse rounded-none opacity-50`} />;
}

export default function Archive() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('letters');
  const isFirstRender = useRef(true);
  useEffect(() => { isFirstRender.current = false; }, []);

  // 편지 탭
  const [entries, setEntries] = useState<EntryDoc[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // 담소 탭
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsFetched, setSessionsFetched] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);

  // 담소 리더
  const [selectedSession, setSelectedSession] = useState<SessionDoc | null>(null);

  // 북마크 탭
  const [bookmarks, setBookmarks] = useState<BookmarkDoc[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [bookmarksFetched, setBookmarksFetched] = useState(false);

  // 삭제 확인
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (!user) return;
    const repliesSnap = await getDocs(query(
      collection(db, 'replies'),
      where('uid', '==', user.uid),
      where('entryId', '==', entryId)
    ));
    const batch = writeBatch(db);
    repliesSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'entries', entryId));
    await batch.commit();
    setEntries(prev => prev.filter(e => e.id !== entryId));
    setConfirmDeleteId(null);
  }, [user]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    const messagesSnap = await getDocs(
      query(collection(db, 'damso_messages'), where('uid', '==', user.uid))
    );
    const batch = writeBatch(db);
    messagesSnap.forEach(d => {
      if (d.data().sessionId === sessionId) batch.delete(d.ref);
    });
    batch.delete(doc(db, 'damso_sessions', sessionId));
    await batch.commit();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setConfirmDeleteId(null);
  }, [user]);

  const fetchBookmarks = useCallback(() => {
    if (!user) return;
    setLoadingBookmarks(true);
    getDocs(query(collection(db, 'bookmarks'), where('uid', '==', user.uid)))
      .then(snap => {
        const list: BookmarkDoc[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as BookmarkDoc));
        list.sort((a, b) => (b.savedAt?.toDate?.() ?? 0) - (a.savedAt?.toDate?.() ?? 0));
        setBookmarks(list);
        setBookmarksFetched(true);
      })
      .catch(console.error)
      .finally(() => setLoadingBookmarks(false));
  }, [user]);

  const deleteBookmark = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'bookmarks', id));
    setBookmarks(prev => prev.filter(b => b.id !== id));
    setConfirmDeleteId(null);
  }, []);

  // 편지 목록 — 마운트 시 로드
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'entries'), where('uid', '==', user.uid)))
      .then(snap => {
        const list: EntryDoc[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as EntryDoc));
        list.sort((a, b) => (b.createdAt?.toDate() ?? 0) - (a.createdAt?.toDate() ?? 0));
        setEntries(list);
      })
      .catch(console.error)
      .finally(() => setLoadingEntries(false));
  }, [user]);

  // 담소 목록 — 탭 전환 시 매번 로드
  const fetchSessions = useCallback(() => {
    if (!user) return;
    setLoadingSessions(true);
    setSessionsFetched(false);
    setSessionsError(false);
    console.log('[Archive] 담소 세션 조회 시작 / uid:', user.uid);
    getDocs(query(collection(db, 'damso_sessions'), where('uid', '==', user.uid)))
      .then(snap => {
        console.log('[Archive] 조회 결과:', snap.size, '개');
        const list: SessionDoc[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as SessionDoc));
        list.sort((a, b) => (b.startedAt?.toDate() ?? 0) - (a.startedAt?.toDate() ?? 0));
        setSessions(list);
        setSessionsFetched(true);
      })
      .catch(err => {
        console.error('[Archive] 담소 기록 불러오기 실패:', err);
        setSessionsError(true);
      })
      .finally(() => setLoadingSessions(false));
  }, [user]);

  const handleTabChange = (t: Tab) => {
    setConfirmDeleteId(null);
    setTab(t);
    if (t === 'damso' && !sessionsFetched) fetchSessions();
    if (t === 'bookmarks' && !bookmarksFetched) fetchBookmarks();
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <h1 className="text-3xl font-serif mb-4">The Archive</h1>
      <p className="opacity-60 italic text-sm mb-10">당신의 밤이 기록된 서재입니다.</p>

      {/* ── 탭 ── */}
      <div className="flex gap-8 mb-12 w-full border-b border-ink/10">
        {([
          { key: 'letters',   label: '편지 기록' },
          { key: 'damso',     label: '담소 기록' },
          { key: 'bookmarks', label: '북마크'    },
        ] as { key: Tab; label: string }[]).map(({ key: t, label }) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className={`pb-3 font-serif text-sm tracking-widest uppercase transition-all duration-300 relative ${
              tab === t ? 'opacity-90' : 'opacity-35 hover:opacity-55'
            }`}
          >
            {label}
            {tab === t && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-px bg-ink/50"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <motion.div
        key={tab}
        initial={isFirstRender.current ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full flex flex-col items-center"
      >
      {tab === 'letters' && (
        <div className="w-full flex flex-col items-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {loadingEntries
              ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
              : entries.length === 0
                ? <p className="font-serif italic opacity-40 col-span-full text-center py-4">아직 남겨진 기록이 없습니다.</p>
                : entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="group relative"
              >
                <Link to={`/envelopes/${entry.id}`} className="block h-full">
                  <div className="relative flex flex-col justify-between p-6 border border-ink/20 bg-[#fdfbf7] shadow-sm hover:shadow-md transition-shadow duration-500 h-48">
                    <div className="absolute top-2 left-2 right-2 bottom-2 border border-ink/5 pointer-events-none" />
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-mono opacity-50">
                        {entry.createdAt ? format(entry.createdAt.toDate(), 'yyyy.MM.dd') : '—'}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest opacity-40">
                        {entry.emotion !== 'unknown' ? entry.emotion : ''}
                      </span>
                    </div>
                    <p className="font-serif text-lg leading-relaxed line-clamp-3 opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                      {entry.content}
                    </p>
                  </div>
                </Link>
                {confirmDeleteId === entry.id ? (
                  <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#fdfbf7] border border-ink/20 px-2 py-1 shadow-sm">
                    <span className="text-[10px] opacity-60">삭제할까요?</span>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-[10px] text-red-700 hover:text-red-900 transition-colors"
                    >확인</button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] opacity-40 hover:opacity-70 transition-opacity"
                    >취소</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.preventDefault(); setConfirmDeleteId(entry.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity duration-200"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === 'damso' && (
        <div className="w-full flex flex-col items-center">
          {!loadingSessions && sessionsError && (
            <div className="flex flex-col items-center gap-4">
              <p className="font-serif italic opacity-40">기록을 불러오지 못했습니다.</p>
              <button
                onClick={fetchSessions}
                className="font-serif text-xs italic opacity-50 hover:opacity-80 transition-opacity"
              >
                다시 시도 →
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {loadingSessions && [...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
            {!loadingSessions && sessionsFetched && sessions.length === 0 && !sessionsError && (
              <p className="font-serif italic opacity-40 col-span-full text-center py-4">아직 나눈 담소가 없습니다.</p>
            )}
            {sessions.map((session, index) => {
              const mentor = MENTOR_INFO[session.mentorId as MentorKey];
              if (!mentor) return null;
              const Icon = mentor.icon;
              const date = session.startedAt?.toDate
                ? format(session.startedAt.toDate(), 'yyyy.MM.dd')
                : '—';
              const isEnded = !!session.endedAt;

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative"
                >
                  <button
                    onClick={() => setSelectedSession(session)}
                    className="w-full text-left relative flex flex-col justify-between p-6 border border-ink/15 bg-[#fdfbf7] shadow-sm hover:shadow-md transition-shadow duration-500 h-48"
                  >
                    <div className="absolute top-2 left-2 right-2 bottom-2 border border-ink/5 pointer-events-none" />

                    {/* 날짜 + 완료 여부 */}
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono opacity-50">{date}</span>
                      {isEnded && (
                        <span className="text-[9px] uppercase tracking-[0.2em] opacity-30">
                          마무리됨
                        </span>
                      )}
                    </div>

                    {/* 멘토 아이콘 + 이름 */}
                    <div className="flex items-center gap-4 my-auto">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${mentor.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={18} strokeWidth={1.5} className="text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="font-serif font-bold text-base text-ink/85 group-hover:text-ink transition-colors duration-300">
                          {mentor.name}
                        </p>
                        <p className="text-[10px] italic opacity-40 mt-0.5">{mentor.spaceName}</p>
                      </div>
                    </div>

                    {/* 하단 힌트 */}
                    <p className="text-[10px] opacity-25 group-hover:opacity-50 transition-opacity duration-300 tracking-wide">
                      열어보기 →
                    </p>
                  </button>
                  {confirmDeleteId === session.id ? (
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#fdfbf7] border border-ink/20 px-2 py-1 shadow-sm">
                      <span className="text-[10px] opacity-60">삭제할까요?</span>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="text-[10px] text-red-700 hover:text-red-900 transition-colors"
                      >확인</button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] opacity-40 hover:opacity-70 transition-opacity"
                      >취소</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity duration-200"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
      {tab === 'bookmarks' && (
        <div className="w-full flex flex-col items-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {loadingBookmarks && [...Array(3)].map((_, i) => <SkeletonCard key={i} height="h-52" />)}
            {!loadingBookmarks && bookmarksFetched && bookmarks.length === 0 && (
              <div className="flex flex-col items-center gap-3 opacity-40 py-4 col-span-full">
                <Bookmark size={28} strokeWidth={1} />
                <p className="font-serif italic text-sm">아직 간직한 편지가 없습니다.</p>
              </div>
            )}
            {bookmarks.map((bm, index) => {
              const mentor = MENTOR_INFO[bm.mentorId as MentorKey];
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
                  <div className="relative flex flex-col justify-between p-6 border border-ink/20 bg-[#fdfbf7] shadow-sm h-52">
                    <div className="absolute top-2 left-2 right-2 bottom-2 border border-ink/5 pointer-events-none" />

                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${mentor.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={13} strokeWidth={1.5} className="text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="font-serif text-sm font-bold text-ink/80">{mentor.name}</p>
                        <p className="text-[9px] uppercase tracking-widest opacity-40">{date}</p>
                      </div>
                    </div>

                    <p className="font-serif text-sm italic opacity-75 line-clamp-2 leading-relaxed mb-2">
                      "{bm.quote}"
                    </p>
                    <p className="text-xs opacity-50 line-clamp-2 leading-relaxed">{bm.translation}</p>
                  </div>

                  {confirmDeleteId === bm.id ? (
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#fdfbf7] border border-ink/20 px-2 py-1 shadow-sm z-10">
                      <span className="text-[10px] opacity-60">제거할까요?</span>
                      <button onClick={() => deleteBookmark(bm.id)} className="text-[10px] text-red-700 hover:text-red-900 transition-colors">확인</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] opacity-40 hover:opacity-70 transition-opacity">취소</button>
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
        </div>
      )}
      </motion.div>

      {/* ── 담소 리더 모달 ── */}
      <AnimatePresence>
        {selectedSession && (
          <DamsoReader
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 담소 리더 ─────────────────────────────────────────────────────────────────

function DamsoReader({
  session,
  onClose,
}: {
  session: SessionDoc;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [entryContent, setEntryContent] = useState('');
  const [loading, setLoading] = useState(true);

  const mentor = MENTOR_INFO[session.mentorId as MentorKey];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // uid 기준으로 조회 후 sessionId로 클라이언트 필터링
      // (Firestore list 규칙이 uid 제약을 요구함)
      const snap = await getDocs(
        query(
          collection(db, 'damso_messages'),
          where('uid', '==', user.uid),
        )
      );
      const list: MessageDoc[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.sessionId === session.id) {
          list.push({ id: d.id, ...data } as MessageDoc);
        }
      });
      list.sort((a, b) => a.order - b.order);
      setMessages(list);

      // 원본 일기 가져오기
      try {
        const entrySnap = await getDoc(doc(db, 'entries', session.entryId));
        if (entrySnap.exists()) setEntryContent(String(entrySnap.data().content ?? ''));
      } catch {}

      setLoading(false);
    };
    load().catch(console.error);
  }, [session, user]);

  if (!mentor) return null;

  const Icon = mentor.icon;
  const date = session.startedAt?.toDate
    ? format(session.startedAt.toDate(), 'yyyy년 MM월 dd일')
    : '';

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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-[#fdfbf7] shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-y-auto overscroll-contain max-h-[92vh]"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 80px rgba(139,115,85,0.08), 0 20px 60px rgba(0,0,0,0.4)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 opacity-30 hover:opacity-70 transition-opacity duration-300 z-10"
        >
          <X size={24} strokeWidth={1} />
        </button>

        <div className="px-8 py-10 sm:px-14 sm:py-14">
          {/* 헤더 */}
          <div className="flex flex-col items-center mb-10">
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${mentor.color} flex items-center justify-center shadow-md mb-5 relative`}>
              <div className="absolute inset-1 rounded-full border border-[#D4AF37]/40" />
              <Icon size={20} strokeWidth={1.5} className="text-[#D4AF37]" />
            </div>
            <h2 className="font-serif text-xl font-bold tracking-widest text-ink/85 mb-1">
              {mentor.name}와의 담소
            </h2>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-40">{mentor.spaceName}</p>
            <p className="text-xs opacity-35 mt-2 font-mono">{date}</p>
          </div>

          {/* 원본 일기 */}
          {entryContent && (
            <>
              <div className="mb-8 px-4 py-4 border-l-2 border-[#D4AF37]/30">
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-35 mb-2">그날의 일기</p>
                <p className="font-serif text-sm italic opacity-65 leading-relaxed">{entryContent}</p>
              </div>
              <div className="flex justify-center items-center gap-2 mb-8 opacity-20">
                <div className="w-12 h-px bg-ink" />
                <div className="w-1 h-1 rotate-45 bg-ink" />
                <div className="w-12 h-px bg-ink" />
              </div>
            </>
          )}

          {/* 대화 내용 */}
          {loading ? (
            <p className="font-serif italic opacity-40 text-center py-8 animate-pulse">
              기록을 불러오는 중…
            </p>
          ) : messages.length === 0 ? (
            <p className="font-serif italic opacity-40 text-center py-8">
              저장된 대화가 없습니다.
            </p>
          ) : (
            <div className="space-y-6">
              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.type === 'stage_direction' && (
                    <p className="font-serif text-sm italic text-center leading-relaxed"
                      style={{ color: 'rgba(44,42,41,0.5)' }}>
                      {msg.content}
                    </p>
                  )}
                  {msg.type === 'mentor' && (
                    <p className="font-serif text-base leading-[1.9]"
                      style={{ color: 'rgba(44,42,41,0.88)' }}>
                      <span className="font-bold">{mentor.name}:</span>
                      {' '}"{msg.content}"
                    </p>
                  )}
                  {msg.type === 'user' && (
                    <p className="font-serif text-base leading-[1.9]"
                      style={{ color: 'rgba(44,42,41,0.72)' }}>
                      <span className="font-semibold" style={{ opacity: 0.6 }}>나:</span>
                      {' '}{msg.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 푸터 */}
          {!loading && messages.length > 0 && (
            <div className="mt-12 flex justify-center opacity-20">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rotate-45 bg-[#D4AF37]" />
                <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
                <div className="w-1 h-1 rotate-45 bg-[#D4AF37]" />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
