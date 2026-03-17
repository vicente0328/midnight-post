import { GoogleGenAI, Type } from "@google/genai";
import { db } from '../firebase';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';

export interface KnowledgeEntry {
  quote: string;
  source: string;
  translation: string;
  context: string;   // 어떤 마음의 상황에 위로가 되는지
  tags: string[];    // ["상실", "불안", "외로움" ...]
}

// ── 각 현자의 지식 도메인 정의 ────────────────────────────────────────────────

const MENTOR_DOMAINS: Record<MentorId, string> = {
  hyewoon: `마음이 지치고 힘든 이를 위한 불교 심리 치유 지혜.
- 초기 불교 팔리어 경전(법구경·숫타니파타·앙굿타라 니카야)의 치유 구절
- 선불교 공안·일화 중 마음의 상처, 집착, 두려움, 슬픔을 다루는 이야기
- 마음챙김 기반 심리치료(MBSR/MBCT)와 불교 철학의 접점
- 자비명상(慈悲冥想), 무상(無常), 고통의 원인과 해소에 관한 구체적 가르침
- 상담 현장에서 실제 활용되는 불교 심리학 이야기`,

  benedicto: `마음의 상처와 고통을 안아주는 기독교 영적 위로의 지혜.
- 성경(시편·이사야·요한복음·로마서)에서 고통·상실·외로움을 위로하는 구절
- 성인들의 묵상록(아우구스티누스·십자가의 요한·테레사 성녀·헨리 나우웬)
- 죄책감·자기혐오·용서·수용에 관한 가톨릭 영성 치유 이야기
- 슬픔과 애도를 다루는 기독교 목회상담의 지혜
- 상실 후 회복, 어둠 속의 신뢰에 관한 영적 통찰`,

  theodore: `삶의 무게와 불안을 철학으로 풀어내는 심리 치유 통찰.
- 스토아 철학(에픽테토스·마르쿠스 아우렐리우스·세네카)의 불안·통제·상실 극복법
- 의미치료(빅터 프랭클)의 고통 속 의미 발견 사례와 통찰
- 실존주의(카뮈·야스퍼스·야스퍼스)의 부조리·불안·자유에 관한 위로
- 인지행동치료(CBT)의 철학적 뿌리인 스토아 심리학
- 자기비판·완벽주의·실패 공포를 다루는 철학적 처방`,

  yeonam: `동양 고전 철학에서 길어 올린 마음 치유의 지혜.
- 논어·맹자·중용에서 자기 수양, 관계의 상처, 실패를 다루는 구절
- 노자·장자의 무위(無爲)·자연(自然)으로 접근하는 마음의 평화
- 연암 박지원·다산 정약용·퇴계 이황의 심리 치유적 편지와 글
- 동양 심리학(恨·情·氣)의 개념으로 보는 한국인의 마음 치유
- 상실·이별·고독·노화를 동양적 순리로 안아주는 이야기`,
};

// ── 지식 생성 ─────────────────────────────────────────────────────────────────

export async function generateDailyKnowledge(mentorId: MentorId): Promise<KnowledgeEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `오늘(${today}) 다음 분야에서 심리 위로와 정서 치유에 실제로 도움이 되는,
잘 알려지지 않은 깊이 있는 지식 4개를 발굴해주세요.

[현자의 분야]
${MENTOR_DOMAINS[mentorId]}

[요구사항]
- 뻔하고 유명한 구절(예: "나는 생각한다, 고로 존재한다")은 절대 피하세요.
- 실제 경전·문헌·저서에서 출처가 명확한 내용만 사용하세요.
- 각 항목은 서로 다른 감정 상황(상실, 불안, 외로움, 자기비판 등)을 다루도록 다양하게 구성하세요.
- context는 실제 상담 현장에서 쓰일 법한, 구체적이고 따뜻한 설명으로 써주세요.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            quote:       { type: Type.STRING },
            source:      { type: Type.STRING },
            translation: { type: Type.STRING },
            context:     { type: Type.STRING },
            tags:        { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["quote", "source", "translation", "context", "tags"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text) as KnowledgeEntry[];
}

// ── Firestore 저장 / 조회 ─────────────────────────────────────────────────────

export async function saveKnowledgeEntries(
  mentorId: MentorId,
  entries: KnowledgeEntry[]
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await setDoc(doc(db, 'mentor_knowledge', `${mentorId}_${today}`), {
    mentorId,
    date: today,
    entries,
    generatedAt: serverTimestamp(),
  });
}

// 오늘 특정 멘토의 지식 — 없으면 최근 7일 이내 가장 최신 데이터 반환 (Study 페이지용)
export async function getTodayKnowledge(
  mentorId: MentorId
): Promise<KnowledgeEntry[]> {
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      const snap = await getDoc(doc(db, 'mentor_knowledge', `${mentorId}_${dateStr}`));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.entries) && data.entries.length > 0)
          return data.entries as KnowledgeEntry[];
      }
    } catch {}
  }
  return [];
}

// 최근 N일치 지식 합산 (복합 인덱스 불필요 — 문서 ID로 직접 접근)
export async function getRecentKnowledge(
  mentorId: MentorId,
  days = 5
): Promise<KnowledgeEntry[]> {
  const allEntries: KnowledgeEntry[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      const snap = await getDoc(doc(db, 'mentor_knowledge', `${mentorId}_${dateStr}`));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.entries)) allEntries.push(...data.entries);
      }
    } catch {
      // 해당 날짜 데이터 없으면 skip
    }
  }
  return allEntries;
}

// ── 일일 자동 생성 트리거 ────────────────────────────────────────────────────
// 앱 로드 시 오늘 처음 실행되는 경우에만 생성 (Firestore 잠금으로 중복 방지)

export async function triggerDailyKnowledgeGeneration(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const lockRef = doc(db, 'meta', `knowledge_${today}`);

  try {
    const lockSnap = await getDoc(lockRef);
    if (lockSnap.exists() && lockSnap.data()?.status === 'done') return; // 이미 오늘 완료됨

    // 잠금 설정 (다른 클라이언트의 중복 생성 방지)
    await setDoc(lockRef, { status: 'generating', startedAt: serverTimestamp() });

    const mentors: MentorId[] = ['hyewoon', 'benedicto', 'theodore', 'yeonam'];

    // 병렬 생성 (4명 동시)
    await Promise.allSettled(
      mentors.map(async (mentorId) => {
        try {
          const existing = await getDoc(
            doc(db, 'mentor_knowledge', `${mentorId}_${today}`)
          );
          if (existing.exists()) return; // 이미 있으면 skip

          const entries = await generateDailyKnowledge(mentorId);
          await saveKnowledgeEntries(mentorId, entries);
          console.log(`[Knowledge] ${mentorId} — ${entries.length}개 생성 완료`);
        } catch (err) {
          console.error(`[Knowledge] ${mentorId} 생성 실패:`, err);
        }
      })
    );

    await setDoc(lockRef, { status: 'done', completedAt: serverTimestamp() });
  } catch (err) {
    console.error('[Knowledge] 일일 생성 트리거 실패:', err);
  }
}
