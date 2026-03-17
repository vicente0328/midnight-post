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

// ── 데이터가 없을 때 보여줄 내장 fallback ────────────────────────────────────

const FALLBACK: Record<MentorId, KnowledgeEntry[]> = {
  hyewoon: [
    { quote: '마음이 모든 것에 선행한다. 청정한 마음으로 말하거나 행하면, 그림자가 따르듯 행복이 뒤따른다.', source: '법구경(法句經) 제1품 쌍품', translation: '우리의 고통과 기쁨은 모두 마음에서 비롯된다. 지금 이 순간의 마음 상태가 다음 순간의 현실을 만든다.', context: '자신을 끊임없이 자책하거나 부정적인 생각의 소용돌이에 빠진 분에게, 그 흐름을 바꿀 수 있는 것도 바로 자신의 마음임을 일깨워줄 때 씁니다.', tags: ['자기비판', '불안', '마음챙김'] },
    { quote: '생각은 사실이 아니다. 생각은 다만 생각일 뿐이다.', source: '존 카밧진 『마음챙김 명상과 자기치유』', translation: '우리는 종종 "나는 실패자야"라는 생각을 사실인 것처럼 믿는다. 하지만 생각은 마음이 만들어낸 이야기일 뿐, 현실 그 자체가 아니다.', context: '부정적인 자기 생각에 사로잡혀 그것이 진실이라고 믿는 분에게, 생각과 자신 사이에 거리를 두는 법을 안내할 때 씁니다.', tags: ['자기비판', '불안', '인지'] },
    { quote: '집착이 고통의 뿌리다. 내려놓는 것은 버리는 것이 아니라, 있는 그대로 바라보는 것이다.', source: '앙굿타라 니카야(Aṅguttara Nikāya) 제3권', translation: '사랑하는 사람, 이루고 싶은 꿈에 대한 집착이 우리를 힘들게 한다. 내려놓음은 포기가 아니라 더 넓은 시야로 보는 연습이다.', context: '이별, 실패, 상실 뒤에도 놓아주지 못해 괴로운 분에게 씁니다.', tags: ['집착', '이별', '내려놓기'] },
    { quote: '자비(慈悲)는 남에게 베푸는 것이기 전에, 먼저 자신에게 향하는 것이다.', source: '불교 자비명상(慈悲冥想) 전통', translation: '많은 이들이 타인에게는 자비롭지만 자신에게는 가혹하다. 스스로를 돌보는 것은 진정한 자비의 시작이다.', context: '항상 남을 먼저 챙기느라 정작 자신은 지쳐 있는 분에게 씁니다.', tags: ['자기수용', '번아웃', '자기돌봄'] },
  ],
  benedicto: [
    { quote: '여호와는 마음이 상한 자를 가까이 하시고 중심에 통회하는 자를 구원하시는도다.', source: '시편 34:18', translation: '하느님은 완벽한 사람 곁에 있는 것이 아니라, 상처받고 무너진 사람 바로 곁에 계신다.', context: '스스로 너무 망가졌다고 느끼거나, "이런 나를 신이 사랑할 수 있을까" 의심할 때 씁니다.', tags: ['상실', '외로움', '위로'] },
    { quote: '당신은 당신이 하는 것이 아니다. 당신은 사랑받는 사람이다.', source: '헨리 나우웬 『집으로 돌아가는 길』', translation: '우리의 가치는 성취나 능력에 있지 않다. 있는 그대로 사랑받는 존재라는 것, 그것이 우리 정체성의 가장 깊은 뿌리다.', context: '실패 후 자존감이 무너지거나, 성과 위주의 삶에 지쳐 있는 분에게 씁니다.', tags: ['자기비판', '자존감', '수용'] },
    { quote: '어두운 밤을 지날 때, 그 어둠이 사실은 더 깊은 빛으로 인도하는 통로다.', source: '십자가의 요한 『영혼의 어두운 밤』', translation: '신앙의 위기, 삶의 암흑기는 파괴가 아니라 변화의 시작이다. 빛이 사라진 것처럼 보이는 그 순간이 더 깊은 곳으로 들어가는 문이다.', context: '믿음이 흔들리거나, 오랫동안 기도해도 응답이 없다고 느껴 막막한 분에게 씁니다.', tags: ['신앙의 위기', '고통', '변화'] },
    { quote: '우리 마음은 당신 안에서 안식을 얻기까지 쉬지 못합니다.', source: '아우구스티누스 『고백록』 1권 1장', translation: '우리 마음에는 무언가로도 채워지지 않는 빈자리가 있다. 그 불만족과 갈망은 결함이 아니라, 더 깊은 곳을 향한 초대다.', context: '아무리 가져도 채워지지 않는 공허함을 호소하는 분에게 씁니다.', tags: ['공허함', '의미', '갈망'] },
  ],
  theodore: [
    { quote: '어떤 것들은 우리 힘 안에 있고, 어떤 것들은 그렇지 않다. 우리 힘 안에 있는 것은 의견, 충동, 욕망, 혐오다.', source: '에픽테토스 『엔케이리디온』 제1장', translation: '모든 고통의 뿌리는 통제할 수 없는 것을 통제하려는 시도에서 온다. 자신이 바꿀 수 있는 것에만 에너지를 쏟는 것이 지혜의 시작이다.', context: '다른 사람의 반응, 결과, 과거 사건에 대한 집착으로 괴로운 분에게 씁니다.', tags: ['불안', '통제', '내려놓기'] },
    { quote: '모든 것을 빼앗겨도 빼앗길 수 없는 마지막 자유가 있다 — 어떤 상황에서 어떤 태도를 취할 것인가를 선택하는 자유.', source: '빅터 프랭클 『죽음의 수용소에서』', translation: '상황이 아무리 나빠도 그것을 어떻게 받아들일지는 내가 선택할 수 있다.', context: '도저히 바꿀 수 없는 상황 앞에서 무력감을 느끼는 분에게 씁니다.', tags: ['상실', '무력감', '의미'] },
    { quote: '당신이 잃었다고 슬퍼하는 것들을, 한 번도 가진 적이 없었다면 어떠했겠는가. 자연은 빌려준 것을 돌려달라 할 뿐이다.', source: '세네카 『루킬리우스에게 보내는 편지』 제99서', translation: '한때 가졌던 것에 대한 감사가 상실의 고통과 함께할 수 있다면, 슬픔의 성질이 달라진다.', context: '사랑하는 사람을 잃어 깊은 슬픔에 잠긴 분에게 씁니다.', tags: ['상실', '애도', '감사'] },
    { quote: '지금 이 순간을 마치 마지막으로 하는 일인 것처럼 살라.', source: '마르쿠스 아우렐리우스 『명상록』 2:5', translation: '과거의 후회와 미래의 불안 사이에서 삶이 허비된다. 지금 이 순간에 완전히 존재하는 것이 황제가 스스로에게 내린 처방이었다.', context: '미루고 있거나, 현재를 살지 못하는 분에게 씁니다.', tags: ['미루기', '현재', '집중'] },
  ],
  yeonam: [
    { quote: '吾日三省吾身 — 나는 매일 세 가지로 자신을 살핀다: 충성스러웠는가, 신의가 있었는가, 배운 것을 익혔는가.', source: '논어(論語) 학이편 1:4, 증자(曾子)', translation: '하루를 마치며 결과가 아닌 태도를 점검하는 성찰. 잘못을 탓하기 위해서가 아니라, 더 나은 하루를 위한 조용한 물음이다.', context: '하루하루 잘 살고 있는지 불안해하는 분에게 씁니다.', tags: ['자기점검', '성찰', '불안'] },
    { quote: '울음이 터져 나오려 할 때 웃음을 지어보라. 웃다가 다시 울기도 하고, 울다가 웃음이 나오기도 한다. 이것이 인생이다.', source: '박지원(朴趾源) 『열하일기』 호곡장론(好哭場論)', translation: '삶이 웃음과 울음의 경계에 있음을 알았다. 슬픔을 참는 것도, 억지로 웃는 것도 아닌, 그 경계를 자연스럽게 흐르는 것이 삶이다.', context: '감정을 억누르거나 스스로를 몰아붙이는 분에게 씁니다.', tags: ['감정표현', '자기수용', '슬픔'] },
    { quote: '天下莫柔弱於水，而攻堅強者莫之能勝 — 천하에 물보다 부드러운 것은 없지만, 굳고 강한 것을 이기는 데 물보다 나은 것은 없다.', source: '노자(老子) 도덕경 78장', translation: '강함이 항상 이기는 것이 아니다. 물은 어떤 그릇에도 담기고, 바위도 뚫어낸다. 유연함은 나약함이 아니라 가장 강한 힘이다.', context: '완벽하고 강해야 한다는 압박에 시달리는 분에게 씁니다.', tags: ['완벽주의', '유연성', '자기수용'] },
    { quote: '어부가 큰 새를 사랑한다면 고기를 주어야지, 자신이 좋아하는 음악을 연주해서는 안 된다.', source: '장자(莊子) 지락편(至樂篇)', translation: '진정한 돌봄은 상대방의 본성에 맞게 하는 것이다. 내가 옳다고 생각하는 것을 강요하는 사랑은 사랑이 아닐 수 있다.', context: '관계에서 "내 사랑이 왜 통하지 않나" 답답해하는 분에게 씁니다.', tags: ['관계', '소통', '기대'] },
  ],
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

// 오늘 특정 멘토의 지식 — 없으면 최근 7일 fallback → 내장 fallback 자동 저장
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
  // 7일 내 데이터 없음 → 내장 fallback을 오늘 날짜로 Firestore에 저장 후 반환
  const fallback = FALLBACK[mentorId];
  try {
    await saveKnowledgeEntries(mentorId, fallback);
  } catch {}
  return fallback;
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
    if (lockSnap.exists()) {
      const data = lockSnap.data();
      if (data?.status === 'done') return; // 이미 오늘 완료됨
      // 'generating' 상태가 1시간 이상 지속되면 stuck으로 간주하고 재시도
      if (data?.status === 'generating' && data?.startedAt) {
        const startedMs = data.startedAt.toDate?.().getTime() ?? 0;
        if (Date.now() - startedMs < 60 * 60 * 1000) return; // 아직 1시간 미경과 → 대기
        // 1시간 초과 → stuck으로 간주, 아래에서 재시도
      }
    }

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
