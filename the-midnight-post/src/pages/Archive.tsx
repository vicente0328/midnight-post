import React, { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useVault } from '../components/VaultContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flower2, Cross, Feather, Brush, Trash2, Bookmark } from 'lucide-react';
import { ShareCardButton } from '../utils/shareCard';
import { useTranslation } from 'react-i18next';
import { usePlan, FREE_HISTORY_LIMIT } from '../hooks/usePlan';
import UpgradeModal from '../components/UpgradeModal';

// ── 멘토 아이콘/색상 ──────────────────────────────────────────────────────────

const MENTOR_META = {
  hyewoon:   { accent: '#7c6a50', icon: Flower2, color: 'from-stone-700 to-stone-900' },
  benedicto: { accent: '#7a3030', icon: Cross,   color: 'from-red-900 to-red-950'   },
  theodore:  { accent: '#3a4a5c', icon: Feather, color: 'from-slate-800 to-slate-950' },
  yeonam:    { accent: '#2d5a3d', icon: Brush,   color: 'from-emerald-900 to-emerald-950' },
} as const;

type MentorKey = keyof typeof MENTOR_META;

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


export default function Archive() {
  const { user } = useAuth();
  const { decrypt } = useVault();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const highlightEntryId = searchParams.get('entryId');
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<Tab>('letters');
  const { isAdmin, isStandard, upgrade } = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  // 책갈피 상세 모달
  const [selectedBookmark, setSelectedBookmark] = useState<BookmarkDoc | null>(null);

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
      .then(async snap => {
        const list: BookmarkDoc[] = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              quote: await decrypt(data.quote ?? ''),
              source: data.source ? await decrypt(data.source) : data.source,
              translation: await decrypt(data.translation ?? ''),
              advice: await decrypt(data.advice ?? ''),
            } as BookmarkDoc;
          })
        );
        list.sort((a, b) => (b.savedAt?.toDate?.() ?? 0) - (a.savedAt?.toDate?.() ?? 0));
        setBookmarks(list);
        setBookmarksFetched(true);
      })
      .catch(console.error)
      .finally(() => setLoadingBookmarks(false));
  }, [user, decrypt]);

  const deleteBookmark = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'bookmarks', id));
    setBookmarks(prev => prev.filter(b => b.id !== id));
    setConfirmDeleteId(null);
  }, []);

  // 편지 목록 — 마운트 시 로드
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'entries'), where('uid', '==', user.uid)))
      .then(async snap => {
        const list: EntryDoc[] = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data();
            return { id: d.id, ...data, content: await decrypt(data.content ?? '') } as EntryDoc;
          })
        );
        list.sort((a, b) => (b.createdAt?.toDate() ?? 0) - (a.createdAt?.toDate() ?? 0));
        setEntries(list);
      })
      .catch(console.error)
      .finally(() => setLoadingEntries(false));
  }, [user]);

  // highlightEntryId 있으면 해당 카드로 스크롤
  useEffect(() => {
    if (!loadingEntries && highlightEntryId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }
  }, [loadingEntries, highlightEntryId]);

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

  const handleTabChange = (nextTab: Tab) => {
    setConfirmDeleteId(null);
    setTab(nextTab);
    if (nextTab === 'damso' && !sessionsFetched) fetchSessions();
    if (nextTab === 'bookmarks' && !bookmarksFetched) fetchBookmarks();
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <h1 className="text-3xl font-serif mb-4">{t('archive.title')}</h1>
      <p className="opacity-60 italic text-sm mb-10">{t('archive.subtitle')}</p>

      {/* ── 탭 ── */}
      <div className="flex gap-8 mb-12 w-full border-b border-ink/10">
        {(['letters', 'damso', 'bookmarks'] as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`pb-3 font-serif text-sm tracking-widest uppercase transition-opacity duration-200 relative ${
              tab === key ? 'opacity-90' : 'opacity-35 hover:opacity-60'
            }`}
          >
            {t(`archive.tabs.${key}`)}
            <div
              className={`absolute bottom-0 left-0 right-0 h-px bg-ink/50 transition-opacity duration-200 ${
                tab === key ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="w-full flex flex-col items-center min-h-[60vh]">
      <AnimatePresence mode="wait">
      {tab === 'letters' && (
        <motion.div
          key="letters"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="w-full flex flex-col items-center"
        >

          {loadingEntries && (
            <p className="font-serif italic opacity-30 text-sm text-center py-12 animate-pulse">{t('archive.letters.loading')}</p>
          )}
          {!loadingEntries && entries.length === 0 && (
            <p className="font-serif italic opacity-40 text-center py-12">{t('archive.letters.empty')}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {!loadingEntries && (isAdmin || isStandard ? entries : entries.slice(0, FREE_HISTORY_LIMIT)).map((entry, index) => {
              const isHighlighted = entry.id === highlightEntryId;
              return (
              <motion.div
                key={entry.id}
                ref={isHighlighted ? (el) => { highlightRef.current = el; } : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="group relative"
              >
                <button
                  onClick={() => navigate(`/mailbox?entryId=${entry.id}`)}
                  className={`w-full text-left relative flex flex-col p-6 shadow-sm hover:shadow-md transition-all duration-500 select-none ${
                    isHighlighted
                      ? 'border border-[#D4AF37]/55 bg-[#fef9e8]'
                      : 'border border-ink/20 bg-[#fdfbf7]'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className="absolute top-2 left-2 right-2 bottom-2 border border-ink/5 pointer-events-none" />
                  <div className="mb-4">
                    <span className="text-xs font-mono opacity-50">
                      {entry.createdAt ? format(entry.createdAt.toDate(), 'yyyy.MM.dd') : '—'}
                    </span>
                  </div>
                  <p className="font-serif text-lg leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                    {entry.content}
                  </p>
                  <p className="mt-4 text-[10px] opacity-25 group-hover:opacity-50 transition-opacity duration-300 tracking-wide self-end">
                    {t('archive.letters.viewReplies')}
                  </p>
                </button>
                {confirmDeleteId === entry.id ? (
                  <div
                    className="absolute top-2 right-2 flex items-center gap-2 bg-[#fdfbf7] border border-ink/20 px-2 py-1 shadow-sm z-10"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-[10px] opacity-60">{t('archive.letters.confirmDelete')}</span>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-[10px] text-red-700 hover:text-red-900 transition-colors"
                    >{t('archive.letters.delete')}</button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] opacity-40 hover:opacity-70 transition-opacity"
                    >{t('archive.letters.cancel')}</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(entry.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity duration-200"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                )}
              </motion.div>
            );
            })}
          </div>
          {!loadingEntries && !isAdmin && !isStandard && entries.length > FREE_HISTORY_LIMIT && (
            <div className="mt-6 flex flex-col items-center gap-2 w-full">
              <p className="font-serif text-[12px] italic opacity-35 text-center">
                최신 {FREE_HISTORY_LIMIT}개까지 표시됩니다.
              </p>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="font-serif text-[12px] italic opacity-45 hover:opacity-75 transition-opacity border-b border-ink/20 pb-px"
              >
                Standard로 업그레이드
              </button>
            </div>
          )}
        </motion.div>
      )}

      {tab === 'damso' && (
        <motion.div
          key="damso"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="w-full flex flex-col items-center"
        >
          {loadingSessions && (
            <p className="font-serif italic opacity-30 text-sm text-center py-12 animate-pulse">{t('archive.damso.loading')}</p>
          )}
          {!loadingSessions && sessionsError && (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="font-serif italic opacity-40">{t('archive.damso.error')}</p>
              <button
                onClick={fetchSessions}
                className="font-serif text-xs italic opacity-50 hover:opacity-80 transition-opacity"
              >
                {t('archive.damso.retry')}
              </button>
            </div>
          )}
          {!loadingSessions && sessionsFetched && sessions.length === 0 && !sessionsError && (
            <p className="font-serif italic opacity-40 text-center py-12">{t('archive.damso.empty')}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {!loadingSessions && (isAdmin || isStandard ? sessions : sessions.slice(0, FREE_HISTORY_LIMIT)).map((session, index) => {
              const meta = MENTOR_META[session.mentorId as MentorKey];
              if (!meta) return null;
              const Icon = meta.icon;
              const mentorName = t(`mentors.${session.mentorId}.name`);
              const mentorSpace = t(`mentors.${session.mentorId}.space`);
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
                          {t('archive.damso.ended')}
                        </span>
                      )}
                    </div>

                    {/* 멘토 아이콘 + 이름 */}
                    <div className="flex items-center gap-4 my-auto">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${meta.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={18} strokeWidth={1.5} className="text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="font-serif font-bold text-base text-ink/85 group-hover:text-ink transition-colors duration-300">
                          {mentorName}
                        </p>
                        <p className="text-[10px] italic opacity-40 mt-0.5">{mentorSpace}</p>
                      </div>
                    </div>

                    {/* 하단 힌트 */}
                    <p className="text-[10px] opacity-25 group-hover:opacity-50 transition-opacity duration-300 tracking-wide">
                      {t('archive.damso.open')}
                    </p>
                  </button>
                  {confirmDeleteId === session.id ? (
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#fdfbf7] border border-ink/20 px-2 py-1 shadow-sm">
                      <span className="text-[10px] opacity-60">{t('archive.letters.confirmDelete')}</span>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="text-[10px] text-red-700 hover:text-red-900 transition-colors"
                      >{t('archive.letters.delete')}</button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] opacity-40 hover:opacity-70 transition-opacity"
                      >{t('archive.letters.cancel')}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="absolute top-2 right-2 opacity-20 hover:opacity-70 transition-opacity duration-200"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
          {!loadingSessions && !isAdmin && !isStandard && sessions.length > FREE_HISTORY_LIMIT && (
            <div className="mt-6 flex flex-col items-center gap-2 w-full">
              <p className="font-serif text-[12px] italic opacity-35 text-center">
                최신 {FREE_HISTORY_LIMIT}개까지 표시됩니다.
              </p>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="font-serif text-[12px] italic opacity-45 hover:opacity-75 transition-opacity border-b border-ink/20 pb-px"
              >
                Standard로 업그레이드
              </button>
            </div>
          )}
        </motion.div>
      )}

      {tab === 'bookmarks' && (
        <motion.div
          key="bookmarks"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="w-full flex flex-col items-center"
        >
          {loadingBookmarks && (
            <p className="font-serif italic opacity-30 text-sm text-center py-12 animate-pulse">{t('archive.bookmarks.loading')}</p>
          )}
          {!loadingBookmarks && bookmarksFetched && bookmarks.length === 0 && (
            <div className="flex flex-col items-center gap-3 opacity-40 py-12">
              <Bookmark size={28} strokeWidth={1} />
              <p className="font-serif italic text-sm">{t('archive.bookmarks.empty')}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {!loadingBookmarks && bookmarks.map((bm, index) => {
              const meta = MENTOR_META[bm.mentorId as MentorKey];
              if (!meta) return null;
              const Icon = meta.icon;
              const mentorName = t(`mentors.${bm.mentorId}.name`);
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
                    onClick={() => setSelectedBookmark(bm)}
                    className="w-full text-left relative flex flex-col justify-between p-6 border border-ink/20 bg-[#fdfbf7] shadow-sm hover:shadow-md transition-shadow duration-500 h-52"
                  >
                    <div className="absolute top-2 left-2 right-2 bottom-2 border border-ink/5 pointer-events-none" />

                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${meta.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={13} strokeWidth={1.5} className="text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="font-serif text-sm font-bold text-ink/80">{mentorName}</p>
                        <p className="text-[9px] uppercase tracking-widest opacity-40">{date}</p>
                      </div>
                    </div>

                    <p className="font-serif text-sm italic opacity-75 line-clamp-2 leading-relaxed mb-2">
                      "{bm.quote}"
                    </p>
                    <p className="text-xs opacity-50 line-clamp-2 leading-relaxed">{bm.translation}</p>
                  </button>

                  {confirmDeleteId === bm.id ? (
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#fdfbf7] border border-ink/20 px-2 py-1 shadow-sm z-10">
                      <span className="text-[10px] opacity-60">{t('archive.bookmarks.confirmDelete')}</span>
                      <button onClick={() => deleteBookmark(bm.id)} className="text-[10px] text-red-700 hover:text-red-900 transition-colors">{t('archive.letters.delete')}</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] opacity-40 hover:opacity-70 transition-opacity">{t('archive.letters.cancel')}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(bm.id)}
                      className="absolute top-2 right-2 opacity-20 hover:opacity-70 transition-opacity duration-200"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      </div>

      {/* ── 업그레이드 모달 ── */}
      <AnimatePresence>
        {showUpgradeModal && (
          <UpgradeModal
            reason="history"
            used={0}
            onUpgrade={upgrade}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}
      </AnimatePresence>

      {/* ── 담소 리더 모달 ── */}
      <AnimatePresence>
        {selectedSession && (
          <DamsoReader
            session={selectedSession}
            onClose={() => setSelectedSession(null)}
          />
        )}
      </AnimatePresence>

      {/* ── 책갈피 상세 모달 ── */}
      <AnimatePresence>
        {selectedBookmark && (
          <BookmarkModal
            bookmark={selectedBookmark}
            onClose={() => setSelectedBookmark(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 책갈피 상세 모달 ──────────────────────────────────────────────────────────

function BookmarkModal({
  bookmark,
  onClose,
}: {
  bookmark: BookmarkDoc;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const meta = MENTOR_META[bookmark.mentorId as MentorKey];
  if (!meta) return null;
  const Icon = meta.icon;
  const mentorName = t(`mentors.${bookmark.mentorId}.name`);

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
        className="relative w-full max-w-3xl bg-[#fdfbf7] p-5 sm:p-10 md:p-16 shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-y-auto overscroll-contain max-h-[95vh] border border-[#D4AF37]/20"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 100px rgba(139,115,85,0.1), 0 20px 60px rgba(0,0,0,0.4)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 opacity-40 hover:opacity-100 transition-all duration-300 hover:rotate-90"
        >
          <X size={26} strokeWidth={1} />
        </button>

        {/* 멘토 헤더 */}
        <div className="flex flex-col items-center mb-8 md:mb-12">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br ${meta.color} p-1 shadow-md mb-4 relative flex items-center justify-center`}>
            <div className="absolute inset-1 rounded-full border border-[#D4AF37]/50" />
            <Icon size={18} strokeWidth={1.5} className="text-[#D4AF37]" />
          </div>
          <h2 className="font-serif text-xl font-bold tracking-widest text-ink/90">{mentorName}</h2>
        </div>

        <div className="font-serif text-ink/90">
          {/* 명언 */}
          <div className="text-center mb-8 md:mb-12 relative px-0 md:px-8">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-7xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>
            <p className="text-base sm:text-xl md:text-2xl leading-relaxed italic text-ink/90 mb-4 relative z-10 font-medium">
              {bookmark.quote}
            </p>
            {bookmark.source && (
              <div className="flex items-center justify-center gap-3 mb-4 opacity-60">
                <div className="h-px w-10 bg-ink/40" />
                <span className="text-xs tracking-wider">{bookmark.source}</span>
                <div className="h-px w-10 bg-ink/40" />
              </div>
            )}
            <p className="text-sm sm:text-base leading-relaxed text-ink/70 break-keep break-words" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word', textWrap: 'balance' } as React.CSSProperties}>
              {bookmark.translation}
            </p>
          </div>

          {/* 구분선 */}
          <div className="flex justify-center items-center gap-3 my-6 md:my-10 opacity-40">
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
            <div className="w-1 h-1 rotate-45 bg-[#D4AF37]/60" />
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
          </div>

          {/* 조언 */}
          <div className="text-[15px] sm:text-lg leading-[1.85] sm:leading-[2.1] text-ink/90 px-0 md:px-4">
            {bookmark.advice.replace(/\\n/g, '\n').split('\n').map((paragraph, index) => {
              if (!paragraph.trim()) return null;
              return (
                <p key={index} className="mb-4 md:mb-6">
                  {paragraph}
                </p>
              );
            })}
          </div>

          {/* 서명 */}
          <div className="mt-8 md:mt-16 text-right opacity-60 italic">
            <p className="text-base sm:text-lg font-bold">{t('envelopes.from', { name: mentorName })}</p>
          </div>

          {/* 공유 카드 */}
          <div className="mt-10 md:mt-14 flex flex-col items-center gap-3">
            <div className="h-px w-full bg-ink/8" />
            <div className="mt-4">
              <ShareCardButton
                mentorName={mentorName}
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

// ── 담소 리더 ─────────────────────────────────────────────────────────────────

function DamsoReader({
  session,
  onClose,
}: {
  session: SessionDoc;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { decrypt } = useVault();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [entryContent, setEntryContent] = useState('');
  const [loading, setLoading] = useState(true);

  const meta = MENTOR_META[session.mentorId as MentorKey];
  const mentorName = t(`mentors.${session.mentorId}.name`);
  const mentorSpace = t(`mentors.${session.mentorId}.space`);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // uid 기준으로 조회 후 sessionId로 클라이언트 필터링
      const snap = await getDocs(
        query(
          collection(db, 'damso_messages'),
          where('uid', '==', user.uid),
        )
      );
      const list: MessageDoc[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.sessionId === session.id) {
          list.push({
            id: d.id,
            ...data,
            content: await decrypt(data.content ?? ''),
          } as MessageDoc);
        }
      }
      list.sort((a, b) => a.order - b.order);
      setMessages(list);

      // 원본 일기 가져오기
      try {
        const entrySnap = await getDoc(doc(db, 'entries', session.entryId));
        if (entrySnap.exists()) {
          const raw = String(entrySnap.data().content ?? '');
          setEntryContent(await decrypt(raw));
        }
      } catch {}

      setLoading(false);
    };
    load().catch(console.error);
  }, [session, user, decrypt]);

  if (!meta) return null;

  const Icon = meta.icon;
  const date = session.startedAt?.toDate
    ? format(session.startedAt.toDate(), 'yyyy.MM.dd')
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
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${meta.color} flex items-center justify-center shadow-md mb-5 relative`}>
              <div className="absolute inset-1 rounded-full border border-[#D4AF37]/40" />
              <Icon size={20} strokeWidth={1.5} className="text-[#D4AF37]" />
            </div>
            <h2 className="font-serif text-xl font-bold tracking-widest text-ink/85 mb-1">
              {t('archive.damso.sessionWith', { name: mentorName, particle: t(`mentors.${session.mentorId}.particle`) })}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-40">{mentorSpace}</p>
            <p className="text-xs opacity-35 mt-2 font-mono">{date}</p>
          </div>

          {/* 원본 일기 */}
          {entryContent && (
            <>
              <div className="mb-8 px-4 py-4 border-l-2 border-[#D4AF37]/30">
                <p className="text-[10px] uppercase tracking-[0.25em] opacity-35 mb-2">{t('archive.damso.originalEntry')}</p>
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
              {t('archive.damso.loading')}
            </p>
          ) : messages.length === 0 ? (
            <p className="font-serif italic opacity-40 text-center py-8">
              {t('archive.damso.noMessages')}
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
                      <span className="font-bold">{mentorName}:</span>
                      {' '}"{msg.content}"
                    </p>
                  )}
                  {msg.type === 'user' && (
                    <p className="font-serif text-base leading-[1.9]"
                      style={{ color: 'rgba(44,42,41,0.72)' }}>
                      <span className="font-semibold" style={{ opacity: 0.6 }}>{t('archive.damso.userLabel')}:</span>
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
