/**
 * AdminPromptEditor — admin 계정 전용 멘토 프롬프트 편집기
 * Firestore `admin_prompts/{mentorId}` 에 저장된 값이 코드 기본값보다 최우선 적용됩니다.
 * 비워두면 백엔드 index.ts의 기본값이 사용됩니다.
 */
import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';
type TabId = MentorId | 'global';

interface AdminPromptOverride {
  description?: string;
  personality?: string;
  style?: string;
  knowledgePrompt?: string;
}

interface GlobalPromptOverride {
  replyInstruction?: string;
  damsoOpeningScene?: string;
  damsoResponseFields?: string;
  damsoClosingInstruction?: string;
  knowledgePromptCommon?: string;
}

const MENTOR_NAMES: Record<MentorId, string> = {
  hyewoon: '혜운 스님',
  benedicto: '베네딕토 신부',
  theodore: '테오도르 교수',
  yeonam: '연암 선생',
};

const SECTIONS: { key: keyof AdminPromptOverride; label: string; hint: string; rows: number }[] = [
  { key: 'description',    label: '편지 프롬프트 — 멘토 설명',      hint: '편지 생성 시 "멘토 정보" 섹션에 삽입됩니다',                                          rows: 10 },
  { key: 'personality',    label: '담소 — 성격 (personality)',       hint: '담소 Opening/Response/Closing 생성 시 사용됩니다',                                    rows: 6  },
  { key: 'style',          label: '담소 — 말투 (style)',              hint: '담소 대사 생성 시 말투 지침으로 사용됩니다',                                          rows: 3  },
  { key: 'knowledgePrompt',label: '지혜카드 — 멘토별 지침',           hint: '현자 정보·인용 언어·지식 분야·번역 및 context 말투를 포함하는 통합 프롬프트',          rows: 20 },
];

const GLOBAL_SECTIONS: { key: keyof GlobalPromptOverride; label: string; hint: string; rows: number }[] = [
  { key: 'replyInstruction',       label: '편지 — 작성 지침',              hint: '{closing} 플레이스홀더: 시간대별 맺음말 자동 치환',           rows: 14 },
  { key: 'damsoOpeningScene',      label: '담소 오프닝 — 장면 지침',        hint: '{space}: 멘토 공간명, {style}: 멘토 말투 자동 치환',         rows: 10 },
  { key: 'damsoResponseFields',    label: '담소 응답 — JSON 필드 지침',     hint: '{style}: 멘토 말투 자동 치환',                               rows: 10 },
  { key: 'damsoClosingInstruction',label: '담소 클로징 — 마무리 지침',      hint: '{style}: 멘토 말투 자동 치환',                               rows: 12 },
  { key: 'knowledgePromptCommon',  label: '지혜카드 — 공통 지침',           hint: '출력 형식 규칙·context 금지사항·공통 요구사항 통합 프롬프트', rows: 14 },
];

export default function AdminPromptEditor() {
  const [activeTab, setActiveTab] = useState<TabId>('hyewoon');
  const [overrides, setOverrides] = useState<Partial<Record<MentorId, AdminPromptOverride>>>({});
  const [edits, setEdits] = useState<Partial<Record<MentorId, AdminPromptOverride>>>({});
  const [globalOverride, setGlobalOverride] = useState<GlobalPromptOverride>({});
  const [globalEdits, setGlobalEdits] = useState<GlobalPromptOverride>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Partial<Record<string, number>>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const mentors: MentorId[] = ['hyewoon', 'benedicto', 'theodore', 'yeonam'];
      const [mentorResults, globalSnap] = await Promise.all([
        Promise.all(mentors.map(async (id) => {
          const snap = await getDoc(doc(db, 'admin_prompts', id));
          return snap.exists() ? { id, data: snap.data() as AdminPromptOverride } : null;
        })),
        getDoc(doc(db, 'admin_prompts', 'global')),
      ]);
      const result: Partial<Record<MentorId, AdminPromptOverride>> = {};
      mentorResults.forEach(r => { if (r) result[r.id] = r.data; });
      const global = globalSnap.exists() ? globalSnap.data() as GlobalPromptOverride : {};
      setOverrides(result);
      setEdits(result);
      setGlobalOverride(global);
      setGlobalEdits(global);
      setLoading(false);
    };
    load();
  }, []);

  // ── Mentor tab helpers ─────────────────────────────────────────────────────

  const getMentorValue = (mentorId: MentorId, field: keyof AdminPromptOverride): string =>
    edits[mentorId]?.[field] ?? '';

  const handleMentorChange = (mentorId: MentorId, field: keyof AdminPromptOverride, value: string) => {
    setEdits(prev => ({ ...prev, [mentorId]: { ...prev[mentorId], [field]: value } }));
  };

  const handleMentorSave = async (mentorId: MentorId, field: keyof AdminPromptOverride) => {
    const key = `${mentorId}_${field}`;
    setSaving(key);
    try {
      const value = edits[mentorId]?.[field];
      await setDoc(doc(db, 'admin_prompts', mentorId), { [field]: value, updatedAt: serverTimestamp() }, { merge: true });
      setOverrides(prev => ({ ...prev, [mentorId]: { ...prev[mentorId], [field]: value } }));
      setSavedAt(prev => ({ ...prev, [key]: Date.now() }));
    } finally { setSaving(null); }
  };

  const handleMentorReset = async (mentorId: MentorId, field: keyof AdminPromptOverride) => {
    const key = `${mentorId}_${field}`;
    setSaving(key);
    try {
      const { deleteField } = await import('firebase/firestore');
      await setDoc(doc(db, 'admin_prompts', mentorId), { [field]: deleteField() }, { merge: true });
      setOverrides(prev => { const c = { ...prev[mentorId] }; delete c[field]; return { ...prev, [mentorId]: c }; });
      setEdits(prev => { const c = { ...prev[mentorId] }; delete c[field]; return { ...prev, [mentorId]: c }; });
      setSavedAt(prev => ({ ...prev, [key]: Date.now() }));
    } finally { setSaving(null); }
  };

  const isMentorModified = (mentorId: MentorId, field: keyof AdminPromptOverride) =>
    overrides[mentorId]?.[field] !== undefined;

  const isMentorDirty = (mentorId: MentorId, field: keyof AdminPromptOverride) =>
    edits[mentorId]?.[field] !== overrides[mentorId]?.[field] &&
    !(edits[mentorId]?.[field] === undefined && overrides[mentorId]?.[field] === undefined);

  // ── Global tab helpers ─────────────────────────────────────────────────────

  const getGlobalValue = (field: keyof GlobalPromptOverride): string =>
    globalEdits[field] ?? '';

  const handleGlobalChange = (field: keyof GlobalPromptOverride, value: string) => {
    setGlobalEdits(prev => ({ ...prev, [field]: value }));
  };

  const handleGlobalSave = async (field: keyof GlobalPromptOverride) => {
    const key = `global_${field}`;
    setSaving(key);
    try {
      const value = globalEdits[field];
      await setDoc(doc(db, 'admin_prompts', 'global'), { [field]: value, updatedAt: serverTimestamp() }, { merge: true });
      setGlobalOverride(prev => ({ ...prev, [field]: value }));
      setSavedAt(prev => ({ ...prev, [key]: Date.now() }));
    } finally { setSaving(null); }
  };

  const handleGlobalReset = async (field: keyof GlobalPromptOverride) => {
    const key = `global_${field}`;
    setSaving(key);
    try {
      const { deleteField } = await import('firebase/firestore');
      await setDoc(doc(db, 'admin_prompts', 'global'), { [field]: deleteField() }, { merge: true });
      setGlobalOverride(prev => { const c = { ...prev }; delete c[field]; return c; });
      setGlobalEdits(prev => { const c = { ...prev }; delete c[field]; return c; });
      setSavedAt(prev => ({ ...prev, [key]: Date.now() }));
    } finally { setSaving(null); }
  };

  const isGlobalModified = (field: keyof GlobalPromptOverride) => globalOverride[field] !== undefined;

  const isGlobalDirty = (field: keyof GlobalPromptOverride) =>
    globalEdits[field] !== globalOverride[field] &&
    !(globalEdits[field] === undefined && globalOverride[field] === undefined);

  if (loading) return (
    <p className="font-mono text-xs opacity-40 animate-pulse text-center py-4">프롬프트 로드 중...</p>
  );

  const isGlobalTab = activeTab === 'global';

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-serif text-lg">프롬프트 편집</h2>
        <p className="font-mono text-xs opacity-40 mt-1">저장하면 즉시 최우선 적용 · 비워두면 코드 기본값 사용</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-ink/15 overflow-x-auto">
        {(Object.keys(MENTOR_NAMES) as MentorId[]).map(id => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-shrink-0 px-3 py-2 font-serif text-xs transition-all ${
              activeTab === id ? 'border-b-2 border-ink font-bold' : 'opacity-40 hover:opacity-70'
            }`}
          >
            {MENTOR_NAMES[id]}
          </button>
        ))}
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-shrink-0 px-3 py-2 font-mono text-xs transition-all ${
            activeTab === 'global' ? 'border-b-2 border-ink font-bold' : 'opacity-40 hover:opacity-70'
          }`}
        >
          공통
        </button>
      </div>

      {/* 섹션별 편집기 */}
      <div className="flex flex-col gap-8">
        {isGlobalTab ? (
          GLOBAL_SECTIONS.map(({ key, label, hint, rows }) => {
            const saveKey = `global_${key}`;
            const isSaving = saving === saveKey;
            const modified = isGlobalModified(key);
            const dirty = isGlobalDirty(key);
            const justSaved = savedAt[saveKey] && Date.now() - (savedAt[saveKey] ?? 0) < 3000;

            return (
              <div key={key} className="flex flex-col gap-2">
                <div>
                  <p className="font-serif text-sm">
                    {label}
                    {modified && <span className="ml-2 font-mono text-xs text-amber-700 opacity-80">● 적용 중</span>}
                  </p>
                  <p className="font-mono text-xs opacity-35 mt-0.5">{hint}</p>
                </div>
                <textarea
                  value={getGlobalValue(key)}
                  onChange={e => handleGlobalChange(key, e.target.value)}
                  rows={rows}
                  placeholder="비어있으면 코드 기본값이 사용됩니다. 여기에 입력하면 즉시 최우선 적용됩니다."
                  className="w-full border border-ink/20 bg-[#fdfbf7] px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:border-ink/50 resize-y"
                />
                <div className="flex items-center gap-2 justify-end">
                  {modified && (
                    <button
                      onClick={() => handleGlobalReset(key)}
                      disabled={isSaving}
                      className="px-3 py-1 border border-ink/20 font-mono text-xs opacity-50 hover:opacity-80 disabled:opacity-20 transition-all"
                    >
                      삭제 (코드 기본값 복귀)
                    </button>
                  )}
                  <button
                    onClick={() => handleGlobalSave(key)}
                    disabled={isSaving || !dirty}
                    className="px-4 py-1 border border-ink/30 font-mono text-xs hover:bg-ink hover:text-paper disabled:opacity-20 transition-all"
                  >
                    {isSaving ? '저장 중...' : justSaved ? '저장됨 ✓' : '저장'}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          SECTIONS.map(({ key, label, hint, rows }) => {
            const mentorId = activeTab as MentorId;
            const saveKey = `${mentorId}_${key}`;
            const isSaving = saving === saveKey;
            const modified = isMentorModified(mentorId, key);
            const dirty = isMentorDirty(mentorId, key);
            const justSaved = savedAt[saveKey] && Date.now() - (savedAt[saveKey] ?? 0) < 3000;

            return (
              <div key={key} className="flex flex-col gap-2">
                <div>
                  <p className="font-serif text-sm">
                    {label}
                    {modified && <span className="ml-2 font-mono text-xs text-amber-700 opacity-80">● 적용 중</span>}
                  </p>
                  <p className="font-mono text-xs opacity-35 mt-0.5">{hint}</p>
                </div>
                <textarea
                  value={getMentorValue(mentorId, key)}
                  onChange={e => handleMentorChange(mentorId, key, e.target.value)}
                  rows={rows}
                  placeholder="비어있으면 코드 기본값이 사용됩니다. 여기에 입력하면 즉시 최우선 적용됩니다."
                  className="w-full border border-ink/20 bg-[#fdfbf7] px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:border-ink/50 resize-y"
                />
                <div className="flex items-center gap-2 justify-end">
                  {modified && (
                    <button
                      onClick={() => handleMentorReset(mentorId, key)}
                      disabled={isSaving}
                      className="px-3 py-1 border border-ink/20 font-mono text-xs opacity-50 hover:opacity-80 disabled:opacity-20 transition-all"
                    >
                      삭제 (코드 기본값 복귀)
                    </button>
                  )}
                  <button
                    onClick={() => handleMentorSave(mentorId, key)}
                    disabled={isSaving || !dirty}
                    className="px-4 py-1 border border-ink/30 font-mono text-xs hover:bg-ink hover:text-paper disabled:opacity-20 transition-all"
                  >
                    {isSaving ? '저장 중...' : justSaved ? '저장됨 ✓' : '저장'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
