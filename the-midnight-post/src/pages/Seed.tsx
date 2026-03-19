/**
 * /seed — Admin 관리 페이지
 */
import React, { useState } from 'react';
import { forceRegenerateKnowledge } from '../services/knowledge';
import { useAuth } from '../components/AuthContext';
import AdminPromptEditor from '../components/AdminPromptEditor';

export default function Seed() {
  const { user } = useAuth();
  const [regenStatus, setRegenStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  const handleForceRegen = () => {
    if (regenStatus === 'running') return;
    setRegenStatus('running');
    forceRegenerateKnowledge()
      .then(() => setRegenStatus('done'))
      .catch(() => setRegenStatus('error'));
  };

  if (!user) return (
    <div className="font-serif italic opacity-50 text-center py-16">로그인 후 이용하세요.</div>
  );

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 py-12">
      <h1 className="font-serif text-2xl">관리자</h1>

      <div className="w-full border-t border-ink/10 pt-6 flex flex-col items-center gap-3">
        <p className="font-serif text-sm opacity-50">AI로 지혜 카드 전체 재생성</p>
        <button
          onClick={handleForceRegen}
          disabled={regenStatus === 'running'}
          className="px-6 py-2 border border-ink/30 font-serif text-sm hover:bg-ink hover:text-paper transition-all duration-300 disabled:opacity-30"
        >
          {regenStatus === 'running' ? '생성 중...' : regenStatus === 'done' ? '완료 ✓' : regenStatus === 'error' ? '오류 발생' : '지혜 카드 재생성'}
        </button>
        {regenStatus === 'done' && <p className="text-xs opacity-50 font-serif">/study에서 확인하세요.</p>}
      </div>

      {/* 프롬프트 편집기 */}
      <div className="w-full border-t border-ink/10 pt-8">
        <AdminPromptEditor />
      </div>
    </div>
  );
}
