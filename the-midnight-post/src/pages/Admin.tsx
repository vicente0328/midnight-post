import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import AdminPromptEditor from '../components/AdminPromptEditor';
import { forceRegenerateKnowledge } from '../services/knowledge';

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
      <AdminPromptEditor />
    </div>
  );
}
