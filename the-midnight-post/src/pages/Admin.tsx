import React from 'react';
import { useAuth } from '../components/AuthContext';
import AdminPromptEditor from '../components/AdminPromptEditor';

const ADMIN_EMAIL = 'admin@tmp.com';

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
        <h1 className="font-serif text-2xl">프롬프트 편집</h1>
      </div>
      <AdminPromptEditor />
    </div>
  );
}
