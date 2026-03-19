import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import AdminPromptEditor from '../components/AdminPromptEditor';
import { forceRegenerateKnowledge } from '../services/knowledge';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const ADMIN_EMAIL = 'admin@tmp.com';

function RegenSection() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  const handleRegen = () => {
    if (status === 'running') return;
    setStatus('running');
    forceRegenerateKnowledge()
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
  };

  return (
    <div className="border border-ink/10 p-6 flex flex-col items-center gap-4">
      <p className="font-mono text-[10px] uppercase tracking-widest opacity-30">지혜카드</p>
      <p className="font-serif text-sm opacity-60 text-center">오늘 날짜 지혜카드를 삭제하고 AI로 전체 재생성합니다.</p>
      <button
        onClick={handleRegen}
        disabled={status === 'running'}
        className="px-6 py-2 border border-ink/30 font-serif text-sm hover:bg-ink hover:text-paper transition-all duration-300 disabled:opacity-30"
      >
        {status === 'running' ? '생성 중...' : status === 'done' ? '완료 ✓' : status === 'error' ? '오류 발생' : '지혜카드 전체 재생성'}
      </button>
    </div>
  );
}

type Reaction = 'touched' | 'comforted' | 'neutral';
type FeedbackType = 'letter' | 'wisdom';

interface FeedbackDoc {
  type: FeedbackType;
  mentorId: string;
  reaction: Reaction;
  createdAt?: { toDate?: () => Date } | null;
}

const MENTOR_LABELS: Record<string, string> = {
  hyewoon: '혜운',
  benedicto: '베네딕토',
  theodore: '테오도르',
  yeonam: '연암',
};

function AnalyticsSection() {
  const [feedbacks, setFeedbacks] = useState<FeedbackDoc[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'feedback')),
      getDocs(collection(db, 'bookmarks')),
    ]).then(([fbSnap, bmSnap]) => {
      setFeedbacks(fbSnap.docs.map(d => d.data() as FeedbackDoc));
      setBookmarkCount(bmSnap.size);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="border border-ink/10 p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-30 text-center">통계</p>
        <p className="font-serif text-xs opacity-30 text-center mt-3">불러오는 중...</p>
      </div>
    );
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const countReactions = (items: FeedbackDoc[]) => ({
    touched: items.filter(f => f.reaction === 'touched').length,
    comforted: items.filter(f => f.reaction === 'comforted').length,
    neutral: items.filter(f => f.reaction === 'neutral').length,
    total: items.length,
  });

  const letters = feedbacks.filter(f => f.type === 'letter');
  const wisdoms = feedbacks.filter(f => f.type === 'wisdom');

  const isRecent = (f: FeedbackDoc) => {
    const d = f.createdAt?.toDate?.();
    return d ? d >= sevenDaysAgo : false;
  };

  const letterAll = countReactions(letters);
  const letterRecent = countReactions(letters.filter(isRecent));
  const wisdomAll = countReactions(wisdoms);
  const wisdomRecent = countReactions(wisdoms.filter(isRecent));

  const pct = (n: number, total: number) => total === 0 ? '—' : `${Math.round((n / total) * 100)}%`;

  const renderRow = (label: string, counts: ReturnType<typeof countReactions>) => (
    <div className="flex items-baseline gap-2 text-[11px] font-serif">
      <span className="opacity-40 w-20 shrink-0">{label}</span>
      <span className="opacity-70">마음에 닿았어요 {counts.touched}<span className="opacity-50 ml-0.5">({pct(counts.touched, counts.total)})</span></span>
      <span className="opacity-40 mx-1">·</span>
      <span className="opacity-70">위로가 됐어요 {counts.comforted}<span className="opacity-50 ml-0.5">({pct(counts.comforted, counts.total)})</span></span>
      <span className="opacity-40 mx-1">·</span>
      <span className="opacity-70">그저그랬어요 {counts.neutral}<span className="opacity-50 ml-0.5">({pct(counts.neutral, counts.total)})</span></span>
      <span className="opacity-30 ml-auto">합계 {counts.total}</span>
    </div>
  );

  return (
    <div className="border border-ink/10 p-6 flex flex-col gap-6">
      <p className="font-mono text-[10px] uppercase tracking-widest opacity-30 text-center">통계</p>

      {/* 편지 반응 */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-25">편지 피드백</p>
        {renderRow('전체', letterAll)}
        {renderRow('최근 7일', letterRecent)}
      </div>

      {/* 지혜카드 반응 */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-25">지혜카드 피드백</p>
        {renderRow('전체', wisdomAll)}
        {renderRow('최근 7일', wisdomRecent)}
      </div>

      {/* 멘토별 */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-25">멘토별 반응 (전체)</p>
        {(['hyewoon', 'benedicto', 'theodore', 'yeonam'] as const).map(m => (
          renderRow(MENTOR_LABELS[m], countReactions(feedbacks.filter(f => f.mentorId === m)))
        ))}
      </div>

      {/* 북마크 */}
      <div className="flex items-baseline gap-3">
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-25">북마크</p>
        <span className="font-serif text-sm opacity-70">총 {bookmarkCount}개 저장됨</span>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="font-serif italic opacity-30 text-center py-20">접근 권한이 없습니다.</div>
    );
  }

  return (
    <div className="w-full max-w-2xl flex flex-col gap-8 py-10">
      <div className="text-center border-b border-ink/10 pb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-30 mb-1">Admin</p>
        <h1 className="font-serif text-2xl">관리</h1>
      </div>
      <RegenSection />
      <AnalyticsSection />
      <AdminPromptEditor />
    </div>
  );
}
