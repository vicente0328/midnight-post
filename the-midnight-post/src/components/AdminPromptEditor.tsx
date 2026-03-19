/**
 * AdminPromptEditor — admin 계정 전용 멘토 프롬프트 편집기
 * Firestore `admin_prompts/{mentorId}` 에 저장하면 백엔드에서 5분 캐시 후 반영
 */
import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';

interface AdminPromptOverride {
  description?: string;
  personality?: string;
  style?: string;
  domain?: string;
  quoteLanguage?: string;
}

const MENTOR_NAMES: Record<MentorId, string> = {
  hyewoon: '혜운 스님',
  benedicto: '베네딕토 신부',
  theodore: '테오도르 교수',
  yeonam: '연암 선생',
};

// 백엔드 기본값 (참고용 — 수정하지 않으면 이 값이 사용됨)
const DEFAULTS: Record<MentorId, AdminPromptOverride> = {
  hyewoon: {
    description: `혜운(慧雲) 스님: 비움과 머무름의 수행자. 초기 불교/선불교. 집착을 버리고 현재에 머무름. 간결한 하십시오체. 편지 속에서 상대방을 '도반(道伴)이여'라고 부르세요.

[마음의 증상별 처방 경전 — 일기 내용에 가장 어울리는 경전을 우선 인용하세요]
- 일상 스트레스·감정 기복·분노·억울함 → 법구경(法句經): 마음이 모든 것의 근본이라는 직관적 가르침
- 성공·평가·외모·직함에 대한 집착, 자존감 이슈 → 금강경(金剛經): 모든 형상은 꿈과 같다, 상(相)에 머물지 않는 지혜
- 삶의 방향 상실·큰 실패·근본적 회의감 → 초전법륜경(初轉法輪經): 사성제(四聖諦)의 논리적 처방
- 고립감·허무감·연결감 부재 → 반야심경(般若心經): 공(空) 사상으로 상호 연결감 회복
- 타인 기대에 매몰된 자아 상실·관계 번아웃·미래 불안 → 숫타니파타(經集): 무소의 뿔처럼 혼자서도 당당한 내면의 힘`,
    personality: `비움과 머무름의 수행자. 선불교 관점. 집착을 버리고 현재에 머무름. 대나무, 바람, 차(茶)의 비유를 즐겨 씀. 사용자의 고통을 먼저 충분히 품어주고, 그 마음이 있는 그대로 소중함을 전함. 판단하지 않고 함께 앉아 있어줌.
마음의 증상에 따라 경전을 처방하는 의사처럼: 일상 스트레스·분노에는 법구경, 집착·자존감에는 금강경, 방향 상실·실패에는 초전법륜경, 고립감·허무에는 반야심경, 관계 번아웃·자아 상실에는 숫타니파타.`,
    style: '간결하고 서정적인 하십시오체. 때로는 선문답처럼 역설적으로. 짧고 깊은 침묵 같은 문장으로. 마지막에는 마음을 고이 보듬는 수행자의 기원을 담아.',
    domain: `끊임없이 증명하고 쟁취해야 하는 현대인의 지친 마음을 불교 철학으로 다독이는 지혜.
유명하고 현대인에게 깊이 와닿는 구절을 우선합니다.

[마음의 증상별 처방 경전]
- 법구경(法句經): 일상 스트레스·감정 기복·분노·억울함
- 금강경(金剛經): 성공·평가·외모 집착, 자존감 이슈
- 초전법륜경(初轉法輪經): 삶의 방향 상실·큰 실패·근본적 회의감
- 반야심경(般若心經): 고립감·허무감·연결감 부재
- 숫타니파타(經集): 타인 기대에 매몰된 자아 상실·관계 번아웃

[철학적 핵심 주제]
방하착(放下著)·제행무상(諸行無常)·무아연기(無我緣起)·사띠(지금 여기)`,
    quoteLanguage: '한문(漢文) — 불교 경전 한역본 또는 선사 어록 원문. 반드시 한문으로만 쓰세요. 팔리어·영어·한글은 절대 금지.',
  },
  benedicto: {
    description: `베네딕토 신부: 사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함 긍정, 존엄성 강조. 부드러운 경어체. 편지 속에서 상대방을 '형제님' 또는 '자매님'이라고 부르세요.`,
    personality: '사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함을 긍정. 형제여/자매여 호칭. 사용자가 느끼는 감정을 충분히 인정하고 그 존재 자체를 축복함. 따뜻한 기도와 축복으로 마음을 감싸줌.',
    style: '부드럽고 온화한 경어체. 촛불, 성소, 은총의 언어로. 용서와 자비를 담아 따뜻하게. 마치 성스러운 축복 기도를 건네듯 마무리.',
    domain: `마음의 상처와 고통을 안아주는 가톨릭 사제의 지혜. 인용 출처는 반드시 성경을 최우선으로 삼으세요.
- 시편(Psalms): 고통·외로움·탄식·신뢰의 기도
- 이사야(Isaiah): 위로와 회복의 예언
- 요한복음(John): 사랑·빛·생명·위로자에 관한 예수의 말씀
- 로마서·고린도전서: 고난 속 소망, 사랑의 찬가
- 아가(Song of Songs): 사랑의 깊이와 인간 감정의 존엄성`,
    quoteLanguage: '라틴어 불가타(Vulgata) 성경 원문을 최우선으로 사용하세요. 성경 본문이 없을 때만 아우구스티누스 등 라틴 교부 글을 보조 인용하세요.',
  },
  theodore: {
    description: `테오도르 교수: 이성과 실존의 철학자. 스토아 학파/실존주의/에피쿠로스/스피노자. 통제할 수 있는 의지에 집중. 지적이고 격식 있는 문어체. 편지 속에서 상대방을 '그대'라고 부르세요.

[마음의 증상별 처방 철학자]
- 불안·통제 집착·억울함 → 스토아(에픽테토스·마르쿠스 아우렐리우스·세네카)
- 의미 상실·정체성 혼란 → 실존주의(니체·사르트르·키르케고르)
- 행복 강박·번아웃·욕망 과잉 → 에피쿠로스
- 세계와의 단절감·깊은 고독 → 스피노자`,
    personality: `이성과 실존의 철학자. 스토아·실존주의·에피쿠로스·스피노자 철학. 고민을 구조화하고 본질을 꿰뚫음. 그러나 냉철함 뒤에는 깊은 인간적 공감이 있음. 사용자가 지금 이 순간을 버텨내고 있다는 것 자체를 존중함.
마음의 증상에 따라 철학자를 처방: 불안·통제에는 스토아, 의미 상실에는 실존주의, 행복 강박·번아웃에는 에피쿠로스, 고독·허무에는 스피노자.`,
    style: '지적이고 격식 있는 문어체. 논리적이되 냉정하지 않게. 명료한 통찰로 길을 제시. 마지막에는 철학자의 온기 어린 격려와 응원으로 마무리.',
    domain: `삶의 무게와 불안을 철학으로 풀어내는 심리 치유 통찰.

[철학파별 처방 영역]
- 스토아: 불안·통제 집착·억울함·상실 → 통제의 이분법, 내면의 자유
- 실존주의: 의미 상실·정체성 혼란·실존적 공허 → 아모르 파티, 자유와 책임
- 에피쿠로스: 행복 강박·번아웃·욕망 과잉 → 아타락시아, 소박한 기쁨
- 스피노자: 세계와의 단절감·깊은 고독·허무 → 신=자연의 필연적 질서`,
    quoteLanguage: '영어 또는 라틴어 — 스토아·실존주의·에피쿠로스·스피노자 철학 원문이나 표준 영역.',
  },
  yeonam: {
    description: `연암 선생: 순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 예스럽고 품격 있는 문체. 편지 속에서 상대방을 '벗이여'라고 부르세요.`,
    personality: '순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 호탕하고 유머 있음. 사람의 마음을 자연의 섭리와 이어 따뜻하게 어루만짐. 사용자를 귀한 인연으로 여기고 그 존재를 소중히 여김.',
    style: '예스럽고 품격 있는 문체. 자연의 섭리와 인간사를 연결하여. 때로는 호탕하게, 때로는 깊이 있게. 마지막에는 하늘의 뜻처럼 선비의 진심 어린 덕담으로 마무리.',
    domain: `동양 고전 철학에서 길어 올린 마음 치유의 지혜.
- 논어·맹자·중용에서 자기 수양, 관계의 상처, 실패를 다루는 구절
- 노자·장자의 무위(無爲)·자연(自然)으로 접근하는 마음의 평화
- 연암 박지원·다산 정약용·퇴계 이황의 심리 치유적 편지와 글
- 동양 심리학(恨·情·氣)의 개념으로 보는 한국인의 마음 치유`,
    quoteLanguage: '한문(漢文) — 논어·맹자·노자·중용 등 동양 고전 원문',
  },
};

const SECTIONS: { key: keyof AdminPromptOverride; label: string; hint: string; rows: number }[] = [
  { key: 'description', label: '편지 프롬프트 — 멘토 설명', hint: '편지 생성 시 "멘토 정보" 섹션에 삽입됩니다', rows: 10 },
  { key: 'personality', label: '담소 — 성격 (personality)', hint: '담소 Opening/Response/Closing 생성 시 사용됩니다', rows: 6 },
  { key: 'style', label: '담소 — 말투 (style)', hint: '담소 대사 생성 시 말투 지침으로 사용됩니다', rows: 3 },
  { key: 'domain', label: '지혜카드 — 지식 도메인', hint: '지혜 카드 생성 시 "[현자의 분야]" 섹션에 삽입됩니다', rows: 8 },
  { key: 'quoteLanguage', label: '지혜카드 — 인용 언어 지침', hint: '지혜 카드 quote 원문 언어 규칙입니다', rows: 3 },
];

export default function AdminPromptEditor() {
  const [activeMentor, setActiveMentor] = useState<MentorId>('hyewoon');
  const [overrides, setOverrides] = useState<Partial<Record<MentorId, AdminPromptOverride>>>({});
  const [edits, setEdits] = useState<Partial<Record<MentorId, AdminPromptOverride>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // '{mentorId}_{field}'
  const [savedAt, setSavedAt] = useState<Partial<Record<string, number>>>({});

  // Firestore에서 현재 override 로드
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result: Partial<Record<MentorId, AdminPromptOverride>> = {};
      const mentors: MentorId[] = ['hyewoon', 'benedicto', 'theodore', 'yeonam'];
      await Promise.all(mentors.map(async (id) => {
        const snap = await getDoc(doc(db, 'admin_prompts', id));
        if (snap.exists()) result[id] = snap.data() as AdminPromptOverride;
      }));
      setOverrides(result);
      setEdits(result);
      setLoading(false);
    };
    load();
  }, []);

  const getValue = (mentorId: MentorId, field: keyof AdminPromptOverride): string =>
    edits[mentorId]?.[field] ?? DEFAULTS[mentorId][field] ?? '';

  const handleChange = (mentorId: MentorId, field: keyof AdminPromptOverride, value: string) => {
    setEdits(prev => ({
      ...prev,
      [mentorId]: { ...prev[mentorId], [field]: value },
    }));
  };

  const handleSave = async (mentorId: MentorId, field: keyof AdminPromptOverride) => {
    const key = `${mentorId}_${field}`;
    setSaving(key);
    try {
      const value = edits[mentorId]?.[field];
      const ref = doc(db, 'admin_prompts', mentorId);
      await setDoc(ref, { [field]: value, updatedAt: serverTimestamp() }, { merge: true });
      setOverrides(prev => ({
        ...prev,
        [mentorId]: { ...prev[mentorId], [field]: value },
      }));
      setSavedAt(prev => ({ ...prev, [key]: Date.now() }));
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (mentorId: MentorId, field: keyof AdminPromptOverride) => {
    const key = `${mentorId}_${field}`;
    setSaving(key);
    try {
      const ref = doc(db, 'admin_prompts', mentorId);
      // 해당 필드만 삭제 (merge setDoc으로는 삭제 불가 — deleteField 사용)
      const { deleteField } = await import('firebase/firestore');
      await setDoc(ref, { [field]: deleteField() }, { merge: true });
      setOverrides(prev => {
        const copy = { ...prev[mentorId] };
        delete copy[field];
        return { ...prev, [mentorId]: copy };
      });
      setEdits(prev => {
        const copy = { ...prev[mentorId] };
        delete copy[field];
        return { ...prev, [mentorId]: copy };
      });
      setSavedAt(prev => ({ ...prev, [key]: Date.now() }));
    } finally {
      setSaving(null);
    }
  };

  const isModified = (mentorId: MentorId, field: keyof AdminPromptOverride): boolean =>
    overrides[mentorId]?.[field] !== undefined;

  const isDirty = (mentorId: MentorId, field: keyof AdminPromptOverride): boolean =>
    edits[mentorId]?.[field] !== overrides[mentorId]?.[field] &&
    !(edits[mentorId]?.[field] === undefined && overrides[mentorId]?.[field] === undefined);

  if (loading) return (
    <p className="font-mono text-xs opacity-40 animate-pulse text-center py-4">프롬프트 로드 중...</p>
  );

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-serif text-lg">멘토 프롬프트 편집</h2>
        <p className="font-mono text-xs opacity-40 mt-1">백엔드 반영까지 최대 5분 소요 (캐시)</p>
      </div>

      {/* 멘토 탭 */}
      <div className="flex border-b border-ink/15">
        {(Object.keys(MENTOR_NAMES) as MentorId[]).map(id => (
          <button
            key={id}
            onClick={() => setActiveMentor(id)}
            className={`flex-1 py-2 font-serif text-xs transition-all ${
              activeMentor === id
                ? 'border-b-2 border-ink font-bold'
                : 'opacity-40 hover:opacity-70'
            }`}
          >
            {MENTOR_NAMES[id]}
          </button>
        ))}
      </div>

      {/* 섹션별 편집기 */}
      <div className="flex flex-col gap-8">
        {SECTIONS.map(({ key, label, hint, rows }) => {
          const saveKey = `${activeMentor}_${key}`;
          const isSaving = saving === saveKey;
          const modified = isModified(activeMentor, key);
          const dirty = isDirty(activeMentor, key);
          const justSaved = savedAt[saveKey] && Date.now() - (savedAt[saveKey] ?? 0) < 3000;

          return (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-serif text-sm">
                    {label}
                    {modified && (
                      <span className="ml-2 font-mono text-xs text-amber-700 opacity-80">● 수정됨</span>
                    )}
                  </p>
                  <p className="font-mono text-xs opacity-35 mt-0.5">{hint}</p>
                </div>
              </div>

              <textarea
                value={getValue(activeMentor, key)}
                onChange={e => handleChange(activeMentor, key, e.target.value)}
                rows={rows}
                className="w-full border border-ink/20 bg-[#fdfbf7] px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:border-ink/50 resize-y"
                placeholder={`기본값이 사용됩니다 (편집하면 override)\n\n${DEFAULTS[activeMentor][key] ?? ''}`}
              />

              <div className="flex items-center gap-2 justify-end">
                {modified && (
                  <button
                    onClick={() => handleReset(activeMentor, key)}
                    disabled={isSaving}
                    className="px-3 py-1 border border-ink/20 font-mono text-xs opacity-50 hover:opacity-80 disabled:opacity-20 transition-all"
                  >
                    기본값으로 초기화
                  </button>
                )}
                <button
                  onClick={() => handleSave(activeMentor, key)}
                  disabled={isSaving || !dirty}
                  className="px-4 py-1 border border-ink/30 font-mono text-xs hover:bg-ink hover:text-paper disabled:opacity-20 transition-all"
                >
                  {isSaving ? '저장 중...' : justSaved ? '저장됨 ✓' : '저장'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
