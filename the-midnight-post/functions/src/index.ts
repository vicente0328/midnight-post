import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleGenAI, Type } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();

// ── Firestore 헬퍼 — 항상 올바른 DB ID 사용 ──────────────────────────────────
// FIRESTORE_DB_ID 환경변수로 커스텀 DB를 지정. 미설정 시 기본 DB 사용.
function getDb() {
  const dbId = process.env.FIRESTORE_DB_ID;
  return dbId ? getFirestore(dbId) : getFirestore();
}

// ── AI 클라이언트 초기화 (함수 호출 시점에 env 읽음) ──────────────────────────

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpsError('internal', 'Gemini API key not configured');
  return new GoogleGenAI({ apiKey });
}

function getClaude() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new HttpsError('internal', 'Anthropic API key not configured');
  return new Anthropic({ apiKey });
}

// ── 공통 타입 ─────────────────────────────────────────────────────────────────

type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';

interface KnowledgeEntry {
  quote: string;
  source: string;
  translation: string;
  context: string;
  tags: string[];
}

interface MentorReply {
  mentorId: MentorId;
  quote: string;
  source?: string;
  translation: string;
  advice: string;
}

interface DamsoOpening {
  stageDirection: string;
  mentorGreeting: string;
  suggestedQuestions: string[];
}

interface DamsoTurn {
  transformedInput: string;
  stageDirection: string;
  mentorSpeech: string;
  suggestedQuestions: string[];
}

interface DamsoConversationEntry {
  type: 'stage_direction' | 'mentor' | 'user';
  content: string;
  rawInput?: string;
}

// ── 유틸리티 ──────────────────────────────────────────────────────────────────

function getTimeContext(hour: number): { timeLabel: string; closing: string } {
  if (hour >= 5 && hour < 12) return { timeLabel: '아침', closing: '오늘 하루를 가볍고 따뜻하게 시작할 수 있도록' };
  if (hour >= 12 && hour < 18) return { timeLabel: '오후', closing: '남은 오후를 평온하게 보낼 수 있도록' };
  if (hour >= 18 && hour < 21) return { timeLabel: '저녁', closing: '하루를 따뜻하게 마무리할 수 있도록' };
  return { timeLabel: '밤', closing: '오늘 밤 조금 더 안심하고 잠들 수 있도록' };
}

function buildKnowledgeContext(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return '';
  const selected = entries.slice(0, 6);
  return `\n\n[지식 데이터베이스 — 편지 작성 시 아래 자료를 적극 활용하세요]\n` +
    selected.map((k, i) =>
      `${i + 1}. "${k.quote}"\n   출처: ${k.source}\n   번역: ${k.translation}\n   활용 맥락: ${k.context}`
    ).join('\n\n');
}

async function getRecentKnowledgeForDamso(mentorId: MentorId, count = 4): Promise<KnowledgeEntry[]> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const entries: KnowledgeEntry[] = [];

  for (const period of ['h08', 'h12', 'h17', 'h22', 'am', 'pm']) {
    if (entries.length >= count) break;
    try {
      const snap = await db.doc(`mentor_knowledge/${mentorId}_${today}_${period}`).get();
      if (snap.exists) {
        const data: KnowledgeEntry[] = snap.data()?.entries ?? [];
        entries.push(...data);
      }
    } catch { /* 해당 문서 없으면 skip */ }
  }

  // 오늘 자료가 부족하면 어제 것도 채움
  if (entries.length < count) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = yesterday.toISOString().slice(0, 10);
    for (const period of ['h08', 'h12', 'h17', 'h22', 'am', 'pm']) {
      if (entries.length >= count) break;
      try {
        const snap = await db.doc(`mentor_knowledge/${mentorId}_${yd}_${period}`).get();
        if (snap.exists) {
          const data: KnowledgeEntry[] = snap.data()?.entries ?? [];
          entries.push(...data);
        }
      } catch { /* skip */ }
    }
  }

  // gutenberg_quotes 보충 (베네딕토·테오도르만 — 한문 원문 멘토는 제외)
  if (GUTENBERG_BOOKS[mentorId] && entries.length < count) {
    try {
      const randomVal = Math.random();
      let gSnap = await db.collection('gutenberg_quotes')
        .where('mentorId', '==', mentorId)
        .where('randomOrder', '>=', randomVal)
        .orderBy('randomOrder')
        .limit(count - entries.length)
        .get();
      if (gSnap.empty) {
        gSnap = await db.collection('gutenberg_quotes')
          .where('mentorId', '==', mentorId)
          .orderBy('randomOrder')
          .limit(count - entries.length)
          .get();
      }
      gSnap.forEach(d => {
        const data = d.data();
        entries.push({ quote: data.quote, source: data.source, translation: data.translation, context: data.context, tags: data.tags ?? [] });
      });
    } catch { /* gutenberg_quotes 없거나 인덱스 미생성 시 skip */ }
  }

  // buddhist_quotes 보충 (혜운 스님 전용 한문 불교 경전 구절)
  if (mentorId === 'hyewoon' && entries.length < count) {
    try {
      const randomVal = Math.random();
      let bSnap = await db.collection('buddhist_quotes')
        .where('mentorId', '==', mentorId)
        .where('randomOrder', '>=', randomVal)
        .orderBy('randomOrder')
        .limit(count - entries.length)
        .get();
      if (bSnap.empty) {
        bSnap = await db.collection('buddhist_quotes')
          .where('mentorId', '==', mentorId)
          .orderBy('randomOrder')
          .limit(count - entries.length)
          .get();
      }
      bSnap.forEach(d => {
        const data = d.data();
        entries.push({ quote: data.quote, source: data.source, translation: data.translation, context: data.context, tags: data.tags ?? [] });
      });
    } catch { /* buddhist_quotes 없거나 인덱스 미생성 시 skip */ }
  }

  return entries.slice(0, count);
}

function buildDamsoKnowledgeContext(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return '';
  return `\n\n[참고할 수 있는 구절들]\n` +
    entries.map((k, i) =>
      `${i + 1}. ${k.quote}\n   출처: ${k.source} / 번역: ${k.translation}`
    ).join('\n');
}

function buildHistoryContext(history: DamsoConversationEntry[]): string {
  if (history.length === 0) return '';
  return '\n\n[지금까지의 대화]\n' + history.map(e => {
    if (e.type === 'stage_direction') return `*${e.content}*`;
    if (e.type === 'mentor') return `${e.content}`;
    return `나: "${e.content}"`;
  }).join('\n');
}

// ── 멘토 정보 ─────────────────────────────────────────────────────────────────

const MENTOR_DESCRIPTIONS: Record<MentorId, string> = {
  hyewoon: '혜운(慧雲) 스님: 비움과 머무름의 수행자. 초기 불교/선불교. 집착을 버리고 현재에 머무름. 간결한 하십시오체. 편지 속에서 상대방을 \'도반(道伴)이여\'라고 부르세요.',
  benedicto: '베네딕토 신부: 사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함 긍정, 존엄성 강조. 부드러운 경어체. 편지 속에서 상대방을 \'형제님\' 또는 \'자매님\'이라고 부르세요 (일기 내용에서 성별이 느껴지면 그에 맞게, 불분명하면 \'형제님\'을 사용하세요).',
  theodore: '테오도르 교수: 이성과 실존의 철학자. 스토아 학파/실존주의. 통제할 수 있는 의지에 집중. 지적이고 격식 있는 문어체. 편지 속에서 상대방을 \'그대\'라고 부르세요.',
  yeonam: '연암 선생: 순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 예스럽고 품격 있는 문체. 편지 속에서 상대방을 \'벗이여\'라고 부르세요.',
};

const MENTOR_PROFILES: Record<MentorId, { name: string; space: string; personality: string; style: string }> = {
  hyewoon: {
    name: '혜운 스님',
    space: '청명각',
    personality: '비움과 머무름의 수행자. 선불교 관점. 집착을 버리고 현재에 머무름. 대나무, 바람, 차(茶)의 비유를 즐겨 씀. 사용자의 고통을 먼저 충분히 품어주고, 그 마음이 있는 그대로 소중함을 전함. 판단하지 않고 함께 앉아 있어줌.',
    style: '간결하고 서정적인 하십시오체. 때로는 선문답처럼 역설적으로. 짧고 깊은 침묵 같은 문장으로. 마지막에는 마음을 고이 보듬는 수행자의 기원을 담아.',
  },
  benedicto: {
    name: '베네딕토 신부',
    space: '고해소',
    personality: '사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함을 긍정. 형제여/자매여 호칭. 사용자가 느끼는 감정을 충분히 인정하고 그 존재 자체를 축복함. 따뜻한 기도와 축복으로 마음을 감싸줌.',
    style: '부드럽고 온화한 경어체. 촛불, 성소, 은총의 언어로. 용서와 자비를 담아 따뜻하게. 마치 성스러운 축복 기도를 건네듯 마무리.',
  },
  theodore: {
    name: '테오도르 교수',
    space: '서재',
    personality: '이성과 실존의 철학자. 스토아 학파와 실존주의. 고민을 구조화하고 본질을 꿰뚫음. 그러나 냉철함 뒤에는 깊은 인간적 공감이 있음. 사용자가 지금 이 순간을 버텨내고 있다는 것 자체를 존중함.',
    style: '지적이고 격식 있는 문어체. 논리적이되 냉정하지 않게. 명료한 통찰로 길을 제시. 마지막에는 철학자의 온기 어린 격려와 응원으로 마무리.',
  },
  yeonam: {
    name: '연암 선생',
    space: '취락헌',
    personality: '순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 호탕하고 유머 있음. 사람의 마음을 자연의 섭리와 이어 따뜻하게 어루만짐. 사용자를 귀한 인연으로 여기고 그 존재를 소중히 여김.',
    style: '예스럽고 품격 있는 문체. 자연의 섭리와 인간사를 연결하여. 때로는 호탕하게, 때로는 깊이 있게. 마지막에는 하늘의 뜻처럼 선비의 진심 어린 덕담으로 마무리.',
  },
};

const MENTOR_DOMAINS: Record<MentorId, string> = {
  hyewoon: `끊임없이 증명하고 쟁취해야 하는 현대인의 지친 마음을 불교 철학으로 다독이는 지혜.
유명하고 현대인에게 깊이 와닿는 구절을 우선합니다.

[4가지 핵심 주제 — 이 관점에서 구절을 선택하세요]
1. 방하착(放下著) — 내려놓음: 더 가지고 더 이루어야 한다는 압박에서 벗어나 "지금 이대로도 완전하다"는 안도감
2. 제행무상(諸行無常) — 무상의 수용: 모든 것은 변한다. 허무주의가 아닌, 통제하려는 집착을 내려놓고 변화를 삶의 흐름으로 받아들이는 위로
3. 무아·연기(無我·緣起) — 나라는 짐 내려놓기: 고정된 '나'라는 실체는 없다. 비대해진 자아에서 벗어나 타인과의 연결감·자비심 회복
4. 사띠·지금 여기 — 마음챙김: 과거의 후회와 미래의 불안을 떠나 이 순간으로 마음을 가져오는 알아차림

[출처 범위 — 아래 어디서든 자유롭게 선택하세요]
- 법구경, 금강경, 화엄경, 숫타니파타 등 주요 불교 경전 한역본
- 혜능·마조·조주·임제 등 선종 조사 어록`,

  benedicto: `마음의 상처와 고통을 안아주는 가톨릭 사제의 지혜. 인용 출처는 반드시 성경을 최우선으로 삼으세요.
- 시편(Psalms): 고통·외로움·탄식·신뢰의 기도 — 특히 잘 알려지지 않은 절
- 이사야(Isaiah): 위로와 회복의 예언 ("두려워 말라", "내가 너와 함께하노라" 계열)
- 요한복음(John): 사랑·빛·생명·위로자에 관한 예수의 말씀
- 로마서·고린도전서(Romans, 1 Corinthians): 고난 속 소망, 사랑의 찬가
- 아가(Song of Songs): 사랑의 깊이와 인간 감정의 존엄성
- 성인·신학자 인용(아우구스티누스·십자가의 요한)은 성경 구절을 찾기 어려울 때만 보조적으로 사용`,

  theodore: `삶의 무게와 불안을 철학으로 풀어내는 심리 치유 통찰.
- 스토아 철학(에픽테토스·마르쿠스 아우렐리우스·세네카)의 불안·통제·상실 극복법
- 의미치료(빅터 프랭클)의 고통 속 의미 발견 사례와 통찰
- 실존주의(카뮈·야스퍼스)의 부조리·불안·자유에 관한 위로
- 인지행동치료(CBT)의 철학적 뿌리인 스토아 심리학
- 자기비판·완벽주의·실패 공포를 다루는 철학적 처방`,

  yeonam: `동양 고전 철학에서 길어 올린 마음 치유의 지혜.
- 논어·맹자·중용에서 자기 수양, 관계의 상처, 실패를 다루는 구절
- 노자·장자의 무위(無爲)·자연(自然)으로 접근하는 마음의 평화
- 연암 박지원·다산 정약용·퇴계 이황의 심리 치유적 편지와 글
- 동양 심리학(恨·情·氣)의 개념으로 보는 한국인의 마음 치유
- 상실·이별·고독·노화를 동양적 순리로 안아주는 이야기`,
};

// ── Project Gutenberg 도서 목록 ─────────────────────────────────────────────
// 혜운(불교 한문)·연암(유교/도가 한문)은 Gutenberg 영역본이 아닌 원문 한문을 써야 하므로 제외.
// 베네딕토(라틴/영어)·테오도르(영어/라틴)만 Gutenberg 활용.

interface GutenbergBook { id: number; title: string; }

const GUTENBERG_BOOKS: Partial<Record<MentorId, GutenbergBook[]>> = {
  benedicto: [
    { id: 3296, title: 'Confessions of Saint Augustine' },
    { id: 1653, title: 'The Imitation of Christ (Thomas à Kempis)' },
  ],
  theodore: [
    { id: 2680, title: 'Meditations — Marcus Aurelius' },
    { id: 4135, title: 'The Discourses of Epictetus' },
  ],
};

/** Gutenberg 텍스트 본문에서 무작위 ~3000자 청크 추출 */
async function fetchGutenbergChunk(bookId: number, chunkSize = 3000): Promise<string | null> {
  try {
    const url = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const text = await res.text();
    const startMark = text.indexOf('*** START OF');
    const endMark   = text.lastIndexOf('*** END OF');
    const body = (startMark !== -1 && endMark !== -1)
      ? text.slice(text.indexOf('\n', startMark) + 1, endMark)
      : text;
    if (body.length <= chunkSize) return body.trim();
    // 앞 10%는 목차·서문 영역이므로 건너뜀
    const minStart = Math.floor(body.length * 0.1);
    const maxStart = body.length - chunkSize - 1;
    const offset = Math.floor(Math.random() * (maxStart - minStart)) + minStart;
    const wordBoundary = body.indexOf(' ', offset) + 1;
    return body.slice(wordBoundary, wordBoundary + chunkSize);
  } catch {
    return null;
  }
}

// ── 1. 멘토 편지 생성 ─────────────────────────────────────────────────────────

/** 핵심 AI 생성 로직 — onCall과 generateAllRepliesForEntry가 공용으로 사용 */
async function generateMentorReplyCore(
  content: string,
  mentorId: MentorId,
  writtenHour: number | undefined,
  knowledgeEntries: KnowledgeEntry[],
  recentEntries: { content: string; emotion?: string; date?: string }[],
): Promise<MentorReply> {
  const { timeLabel, closing } = getTimeContext(writtenHour ?? new Date().getHours());
  const knowledgeContext = buildKnowledgeContext(knowledgeEntries);

  const recentContext = recentEntries.length > 0
    ? `\n\n[최근에 쓴 일기들 — 이 맥락을 자연스럽게 반영해 주세요. 직접 언급하지 말고, 편지의 깊이와 공감에 녹여주세요]\n` +
      recentEntries.map((e, i) =>
        `${i + 1}. ${e.date ? `(${e.date}) ` : ''}${e.content}${e.emotion && e.emotion !== 'unknown' ? ` [${e.emotion}]` : ''}`
      ).join('\n')
    : '';

  const prompt = `
${timeLabel}에 쓴 한 줄의 일기입니다: "${content}"${recentContext}

당신은 아래 설명된 현자입니다. 이 일기를 읽고, 당신의 철학과 삶의 결로 빚어낸 따뜻한 위로의 편지를 써주세요.

멘토 정보:
${MENTOR_DESCRIPTIONS[mentorId]}
${knowledgeContext}
[작성 지침]
1. 명언 (quote, source, translation): 위 지식 데이터베이스에 있는 자료를 우선적으로 활용하세요. 데이터베이스에 적합한 것이 없을 때만 새로 찾으세요. 유명하고 뻔한 구절은 피하세요.

2. 편지 본문 (advice): 아래 세 흐름을 자연스럽게 이어주세요.
   - 도입: 명언과 연결된 짧고 아름다운 일화나 비유 하나. 옛이야기를 듣는 듯 따뜻하게.
   - 연결: 그 이야기의 의미를 일기와 다정하게 이어주세요. 설명하지 말고, 깊이 공감하듯 말해주세요. 일기를 쓴 이가 느끼는 감정을 먼저 충분히 인정하고, 그 마음이 얼마나 소중한지 담아주세요.
   - 마무리: 한 줄의 여운. 가르치려 하지 말고, 곁에 앉아 있는 사람처럼 — 마치 기도나 축복을 건네듯 — 따뜻하게 마무리하세요. ${closing}.

3. 분량과 형식:
   - 3문단, 400~550자 내외로 간결하고 서정적으로.
   - 어려운 한자어나 철학 용어는 쉬운 말로 풀어쓰세요.
   - 문단 사이에 반드시 빈 줄(\\n\\n)을 넣어주세요.
   - 멘토 특유의 말투를 처음부터 끝까지 유지하세요.

답장은 다음 필드를 포함하는 JSON 객체여야 합니다:
- mentorId: "${mentorId}"
- quote: 철학적 원문 (한자, 라틴어, 영어 등 멘토에 맞는 언어)
- source: 원문의 출처
- translation: 원문의 한국어 번역
- advice: 위 지침에 따라 쓴 편지 본문
`;

  const ai = getGemini();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mentorId: { type: Type.STRING },
            quote: { type: Type.STRING },
            source: { type: Type.STRING },
            translation: { type: Type.STRING },
            advice: { type: Type.STRING },
          },
          required: ['mentorId', 'quote', 'source', 'translation', 'advice'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    return JSON.parse(text) as MentorReply;
  } catch (geminiError) {
    console.warn(`Gemini failed for ${mentorId}, falling back to Claude:`, geminiError);

    const claude = getClaude();
    const claudeResponse = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt + '\n\nJSON 형식으로만 응답하세요.' }],
    });

    const text = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : null;
    if (!text) throw new HttpsError('internal', 'AI 응답을 받지 못했습니다.');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new HttpsError('internal', 'AI 응답에서 JSON을 찾을 수 없습니다.');

    return JSON.parse(jsonMatch[0]) as MentorReply;
  }
}

export const generateMentorReply = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const { content, mentorId, writtenHour, knowledgeEntries = [], recentEntries = [] } = request.data as {
    content: string;
    mentorId: MentorId;
    writtenHour?: number;
    knowledgeEntries?: KnowledgeEntry[];
    recentEntries?: { content: string; emotion?: string; date?: string }[];
  };

  if (!content || !mentorId) throw new HttpsError('invalid-argument', 'content와 mentorId가 필요합니다.');

  return generateMentorReplyCore(content, mentorId, writtenHour, knowledgeEntries, recentEntries);
});

// ── 1-b. 모든 멘토 답장 백그라운드 생성 (앱 종료 후에도 서버에서 완료) ────────

export const generateAllRepliesForEntry = onCall({ timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const { entryId, content, writtenHour, recentEntries = [], rankedMentors } = request.data as {
    entryId: string;
    content: string;
    writtenHour?: number;
    recentEntries?: { content: string; emotion?: string; date?: string }[];
    rankedMentors?: MentorId[];
  };

  if (!entryId || !content) throw new HttpsError('invalid-argument', 'entryId와 content가 필요합니다.');

  const mentors: MentorId[] = rankedMentors ?? ['hyewoon', 'benedicto', 'theodore', 'yeonam'];
  const adminDb = getDb();

  // 모든 멘토의 지식 데이터 병렬 수집
  const knowledgeResults = await Promise.all(
    mentors.map(m => getRecentKnowledgeForDamso(m, 5).catch(() => [] as KnowledgeEntry[]))
  );

  // 4개 멘토 편지 병렬 생성
  const results = await Promise.allSettled(
    mentors.map((mentorId, idx) =>
      generateMentorReplyCore(content, mentorId, writtenHour, knowledgeResults[idx], recentEntries)
    )
  );

  // 생성된 답장을 Firestore에 저장
  let generated = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const reply = result.value;
      const replyData: Record<string, unknown> = {
        uid,
        entryId,
        mentorId: reply.mentorId,
        quote: reply.quote,
        translation: reply.translation,
        advice: reply.advice,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (reply.source) replyData.source = reply.source;
      try {
        await adminDb.collection('replies').add(replyData);
        generated++;
      } catch (e) {
        console.error(`Failed to save reply for ${reply.mentorId}:`, e);
      }
    } else {
      console.error('Reply generation failed:', result.reason);
    }
  }

  return { success: true, generated };
});

// ── 1-c. Firestore 트리거 — reply_jobs 문서 생성 시 답장 자동 생성 ────────────
// 클라이언트가 앱을 닫거나 폰을 잠가도 서버에서 완전히 독립적으로 실행됨.

/** Vault 암호화 여부 판별 (서버사이드) */
function isEncryptedContent(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return parsed.v === 1 && typeof parsed.iv === 'string' && typeof parsed.ct === 'string';
  } catch {
    return false;
  }
}

/** 최근 일기 컨텍스트 서버사이드 조회 — 암호화된 항목은 건너뜀 */
async function fetchRecentEntriesForContext(
  uid: string,
  excludeEntryId: string,
): Promise<{ content: string; emotion?: string; date?: string }[]> {
  const snap = await getDb().collection('entries')
    .where('uid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(6)
    .get();

  const entries: { content: string; emotion?: string; date?: string }[] = [];
  snap.forEach(doc => {
    if (doc.id === excludeEntryId || entries.length >= 5) return;
    const data = doc.data();
    const content: string = data.content ?? '';
    if (isEncryptedContent(content)) return; // Vault 암호화 항목 — 복호화 불가
    entries.push({
      content,
      emotion: data.emotion,
      date: data.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') ?? undefined,
    });
  });
  return entries;
}

// 트리거 database 옵션은 배포 시 평가되므로 .env 대신 직접 지정
// (런타임 getDb()는 여전히 process.env.FIRESTORE_DB_ID 사용)
const TRIGGER_DB_ID = 'ai-studio-d9e6a0c6-59eb-4796-a108-83ee3d57b90c';

export const generateRepliesOnJobCreated = onDocumentCreated(
  { document: 'reply_jobs/{entryId}', database: TRIGGER_DB_ID, timeoutSeconds: 540, memory: '1GiB' },
  async (event) => {
    const job = event.data?.data();
    if (!job) return;

    const { uid, entryId, content, writtenHour, rankedMentors } = job as {
      uid: string;
      entryId: string;
      content: string;
      writtenHour?: number;
      rankedMentors?: MentorId[];
    };

    if (!uid || !entryId || !content) {
      console.error('reply_jobs 문서에 필수 필드 누락:', { uid, entryId, content });
      return;
    }

    const mentors: MentorId[] = rankedMentors ?? ['hyewoon', 'benedicto', 'theodore', 'yeonam'];

    // 최근 일기 컨텍스트 서버사이드 조회
    const recentEntries = await fetchRecentEntriesForContext(uid, entryId).catch(() => []);

    // 모든 멘토의 지식 데이터 병렬 수집
    const knowledgeResults = await Promise.all(
      mentors.map(m => getRecentKnowledgeForDamso(m, 5).catch(() => [] as KnowledgeEntry[]))
    );

    // 4개 멘토 편지 병렬 생성
    const results = await Promise.allSettled(
      mentors.map((mentorId, idx) =>
        generateMentorReplyCore(content, mentorId, writtenHour, knowledgeResults[idx], recentEntries)
      )
    );

    // Firestore에 저장
    const adminDb = getDb();
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const reply = result.value;
        const replyData: Record<string, unknown> = {
          uid,
          entryId,
          mentorId: reply.mentorId,
          quote: reply.quote,
          translation: reply.translation,
          advice: reply.advice,
          createdAt: FieldValue.serverTimestamp(),
        };
        if (reply.source) replyData.source = reply.source;
        try {
          await adminDb.collection('replies').add(replyData);
        } catch (e) {
          console.error(`Failed to save reply for ${reply.mentorId}:`, e);
        }
      } else {
        console.error('Reply generation failed:', result.reason);
      }
    }

    // 작업 문서 정리
    await event.data?.ref.delete().catch(() => {});
  }
);

// ── 2. 담소 오프닝 ────────────────────────────────────────────────────────────

export const generateDamsoOpening = onCall({ timeoutSeconds: 180, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const { mentorId, entryContent } = request.data as { mentorId: MentorId; entryContent: string };
  if (!mentorId) throw new HttpsError('invalid-argument', 'mentorId가 필요합니다.');

  const mentor = MENTOR_PROFILES[mentorId];
  const knowledgeEntries = await getRecentKnowledgeForDamso(mentorId);
  const knowledgeContext = buildDamsoKnowledgeContext(knowledgeEntries);

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"${knowledgeContext}

사용자가 당신의 ${mentor.space}을 찾아왔습니다. 소설의 첫 장면처럼 묘사하고 첫 인사를 건네주세요.

JSON 필드:
- stageDirection: 공간의 분위기와 당신의 첫 동작을 묘사하는 2-3문장의 지문. 현재형, 서정적으로. (예: "방 안에는 은은한 차 향기가 가득하다. 스님은 조용히 찻잔을 건네며 부드러운 미소를 지으셨다.")
- mentorGreeting: 사용자를 맞이하는 첫 인사말. ${mentor.style} 일기 내용을 직접 언급하지 않고 마음을 자연스럽게 여는 말. 위 구절들 중 하나를 멘토 특유의 말투로 자연스럽게 인용하여 오늘의 대화 분위기를 열어주세요. 100-140자 내외.
- suggestedQuestions: 사용자가 첫 말문을 트기 좋은 질문 또는 말 3개. 아래 두 유형을 섞어서 구성하세요. ① 방금 인용한 구절이나 지혜의 의미·배경을 더 깊이 묻는 질문 (예: "방금 말씀하신 구절이 어느 맥락에서 나온 건가요?"). ② 심리상담에서 내담자가 상담가에게 자연스럽게 꺼낼 법한 말 (예: "저는 왜 이렇게 쉽게 지치는 걸까요?", "이런 감정이 계속 반복되는데 어떻게 하면 좋을까요?"). 각 20-35자 내외.

JSON만 응답하세요.`;

  const ai = getGemini();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stageDirection: { type: Type.STRING },
            mentorGreeting: { type: Type.STRING },
            suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['stageDirection', 'mentorGreeting', 'suggestedQuestions'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    return JSON.parse(text) as DamsoOpening;
  } catch {
    const claude = getClaude();
    const resp = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new HttpsError('internal', 'AI 응답에서 JSON을 찾을 수 없습니다.');
    return JSON.parse(match[0]) as DamsoOpening;
  }
});

// ── 3. 담소 응답 ──────────────────────────────────────────────────────────────

export const generateDamsoResponse = onCall({ timeoutSeconds: 180, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const { mentorId, entryContent, conversationHistory, userInput } = request.data as {
    mentorId: MentorId;
    entryContent: string;
    conversationHistory: DamsoConversationEntry[];
    userInput: string;
  };

  const mentor = MENTOR_PROFILES[mentorId];
  const historyContext = buildHistoryContext(conversationHistory);
  const knowledgeEntries = await getRecentKnowledgeForDamso(mentorId);
  const knowledgeContext = buildDamsoKnowledgeContext(knowledgeEntries);

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"${historyContext}${knowledgeContext}

사용자가 방금 말했습니다: "${userInput}"

JSON 필드:
1. transformedInput: 사용자가 입력한 문장을 최대한 그대로 유지하되, 오타나 맞춤법만 최소한으로 교정. 문체·어투·표현은 바꾸지 말 것. 예) "내일이 무서워" → "내일이 무서워"처럼 원문을 존중.

2. stageDirection: 당신의 반응 행동을 묘사하는 1-2문장의 지문. 현재형, 서정적으로. (예: "스님은 잠시 눈을 감고 대나무 숲 소리에 귀를 기울이셨다. 그리고는 천천히 입을 열어 말씀하셨다.")

3. mentorSpeech: 당신의 대사. ${mentor.style} 사용자의 감정과 상황에 먼저 충분히 공감하고, 그 마음을 있는 그대로 따뜻하게 품어주세요. 대화 맥락을 이어받아 깊이 있게 응답. 위 구절들 중 하나를 반드시 자연스럽게 인용하되, "어느 경전에 이런 말이 있지요…", "옛 현자가 이리 말했습니다…" 처럼 멘토 특유의 말투로 녹여 쓰세요 — 사용자가 그 구절의 뜻을 마음에 새길 수 있도록. 구절 인용 후 그것이 사용자의 상황과 어떻게 연결되는지 한 문장으로 이어주세요. 150-220자 내외. 50% 확률로 마지막에 질문 하나를 덧붙이되, 절반은 삶·존재·가치에 관한 철학적 질문, 절반은 사용자의 일상과 생각을 자연스럽게 묻는 가벼운 질문으로 하세요.
   ※ 반드시 지켜야 할 일관성 규칙: 위 [지금까지의 대화]에서 이미 인용된 구절은 절대 다시 인용하지 마세요. 이전 답변에서 한 말과 모순되거나 앞서 취한 입장을 번복하지 마세요.

4. suggestedQuestions: 사용자가 대화를 이어가기 좋은 질문 또는 말 3개. 아래 두 유형을 섞어서 구성하세요. ① 방금 인용한 구절이나 멘토의 답변 내용을 더 깊이 파고드는 질문 (예: "방금 말씀하신 구절의 출처가 궁금합니다", "그 가르침을 실제 삶에서 어떻게 적용할 수 있을까요?"). ② 심리상담에서 내담자가 상담가에게 자연스럽게 꺼낼 법한 말 (예: "저는 왜 이런 상황에서 항상 같은 패턴이 반복될까요?", "이 감정을 어떻게 받아들이면 좋을지 모르겠어요"). 각 20-35자 내외.

JSON만 응답하세요.`;

  const ai = getGemini();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transformedInput: { type: Type.STRING },
            stageDirection: { type: Type.STRING },
            mentorSpeech: { type: Type.STRING },
            suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['transformedInput', 'stageDirection', 'mentorSpeech', 'suggestedQuestions'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    return JSON.parse(text) as DamsoTurn;
  } catch {
    const claude = getClaude();
    const resp = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 768,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new HttpsError('internal', 'AI 응답에서 JSON을 찾을 수 없습니다.');
    return JSON.parse(match[0]) as DamsoTurn;
  }
});

// ── 4. 담소 클로징 ────────────────────────────────────────────────────────────

export const generateDamsoClosing = onCall({ timeoutSeconds: 180, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const { mentorId, entryContent, conversationHistory, userInput } = request.data as {
    mentorId: MentorId;
    entryContent: string;
    conversationHistory: DamsoConversationEntry[];
    userInput: string;
  };

  const mentor = MENTOR_PROFILES[mentorId];
  const historyContext = buildHistoryContext(conversationHistory);
  const knowledgeEntries = await getRecentKnowledgeForDamso(mentorId);
  const knowledgeContext = buildDamsoKnowledgeContext(knowledgeEntries);

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"${historyContext}${knowledgeContext}

사용자가 방금 말했습니다: "${userInput}"

이제 담소를 자연스럽게 마무리할 시간입니다. 사용자의 말에 응답하되, 이것이 오늘의 마지막 말임을 느끼게 해주십시오. 억지로 끊는 것이 아니라, 차 한 잔이 다 비워진 것처럼, 달빛이 기울기 시작한 것처럼 자연스럽게 작별을 고해주세요.

JSON 필드:
1. transformedInput: 사용자가 입력한 문장을 최대한 그대로 유지하되, 오타나 맞춤법만 최소한으로 교정. 문체·어투는 바꾸지 말 것.

2. stageDirection: 마무리 분위기를 담은 지문 1-2문장. 현재형, 서정적으로. (예: "스님은 찻잔을 조심스레 내려놓으시며 창밖 먼 산을 한참 바라보셨다.")

3. mentorSpeech: ${mentor.style} 사용자의 마지막 말에 따뜻하게 응답하고, 자연스럽게 작별을 고하는 말. 위 구절들 중 마무리에 어울리는 하나를 인용하되, 위 [지금까지의 대화]에서 이미 인용된 구절은 반드시 피하고 새로운 구절을 선택하세요. 오늘 나눈 대화의 핵심을 한 줄로 갈무리하고, 이전 답변들과 일관된 시각을 유지하면서 진심 어린 축복 혹은 기원의 말을 담아 마무리. 140-200자 내외.

4. suggestedQuestions: [] (마무리 단계이므로 빈 배열)

JSON만 응답하세요.`;

  const ai = getGemini();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transformedInput: { type: Type.STRING },
            stageDirection: { type: Type.STRING },
            mentorSpeech: { type: Type.STRING },
            suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['transformedInput', 'stageDirection', 'mentorSpeech', 'suggestedQuestions'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    return JSON.parse(text) as DamsoTurn;
  } catch {
    const claude = getClaude();
    const resp = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new HttpsError('internal', 'AI 응답에서 JSON을 찾을 수 없습니다.');
    return JSON.parse(match[0]) as DamsoTurn;
  }
});

// ── 5. 지혜 카드 생성 ─────────────────────────────────────────────────────────

const QUOTE_LANG: Record<MentorId, string> = {
  hyewoon:   '한문(漢文) — 불교 경전 한역본 또는 선사 어록 원문. 반드시 한문으로만 쓰세요. 팔리어·영어·한글은 절대 금지.',
  benedicto: '라틴어 불가타(Vulgata) 성경 원문을 최우선으로 사용하세요. 시편·이사야·요한복음·로마서·아가 등 성경 본문이 없을 때만 아우구스티누스 등 라틴 교부 글을 보조 인용하세요.',
  theodore:  '영어 또는 라틴어 — 스토아·실존주의 철학 원문이나 표준 영역',
  yeonam:    '한문(漢文) — 논어·맹자·노자·중용 등 동양 고전 원문',
};

/** 핵심 생성 로직 — onCall과 스케줄 함수가 공용으로 사용 */
async function generateKnowledgeEntries(
  mentorId: MentorId,
  avoidQuotes: string[] = [],
): Promise<KnowledgeEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  // Gutenberg 원문 텍스트 선택적 로드 (베네딕토·테오도르만)
  let gutenbergSection = '';
  const books = GUTENBERG_BOOKS[mentorId];
  if (books && books.length > 0) {
    const book = books[Math.floor(Math.random() * books.length)];
    const chunk = await fetchGutenbergChunk(book.id);
    if (chunk) {
      gutenbergSection = `\n[원문 텍스트 — "${book.title}" 발췌]\n` +
        `아래 텍스트에 실제로 등장하는 구절을 최우선으로 활용하세요. ` +
        `텍스트에서 적합한 구절을 찾지 못할 때만 해당 저자의 다른 작품에서 가져오세요.\n\n${chunk}\n`;
    }
  }

  const avoidSection = avoidQuotes.length > 0
    ? `\n[이미 사용된 구절 — 아래 구절들은 반드시 피하세요]\n` +
      avoidQuotes.slice(0, 28).map((q, i) => `${i + 1}. ${q}`).join('\n') + '\n'
    : '';

  const prompt = `오늘(${today}) 다음 분야에서 심리 위로와 정서 치유에 실제로 도움이 되는,
${mentorId === 'hyewoon' ? '현대인의 마음에 깊이 와닿는 지식 4개를 발굴해주세요. 유명한 구절도 괜찮습니다.' : '잘 알려지지 않은 깊이 있는 지식 4개를 발굴해주세요.'}
${gutenbergSection}
[현자의 분야]
${MENTOR_DOMAINS[mentorId]}
${avoidSection}
[필수 형식 — 반드시 아래 순서와 규칙을 지키세요]

1. quote (글귀): ${QUOTE_LANG[mentorId]}으로 작성하세요. 한국어를 섞지 말고 원문만 쓰세요.

2. source (출처): 원문의 출처를 명확하게 쓰세요. (예: "법구경(法句經) 제1게", "Epistulae Morales 제1서")

3. translation (번역): quote의 한국어 번역을 간결하게 쓰세요.${mentorId === 'hyewoon' ? ' 혜운 스님은 현대인에게 와닿도록 자연스럽게 의역해도 좋습니다.' : ' 해설이나 감상을 덧붙이지 말고 원문을 충실하게 번역하세요.'}

4. context (멘토의 말): 아래 현자의 목소리로 이 글귀를 해석하거나, 이 글귀를 마음에 품으면 어떻게 달라지는지 진솔하게 이야기하세요.

   [현자 페르소나]
   이름: ${MENTOR_PROFILES[mentorId].name}
   성격: ${MENTOR_PROFILES[mentorId].personality}
   말투: ${MENTOR_PROFILES[mentorId].style}

   - 반드시 위 현자 한 명의 목소리로만 쓰세요. 다른 현자의 말투가 섞이면 안 됩니다.
   - "저는 [이름]입니다", "나는 [이름]입니다" 같은 자기소개로 시작하지 마세요. 글귀 해석으로 바로 시작하세요.
   - "~할 때 씁니다", "~분에게 씁니다", "~하는 분들에게 추천합니다" 같은 상담사 말투는 절대 금지

[공통 요구사항]
- 실제 경전·문헌·저서에서 출처가 명확한 내용만 사용하세요.
- 각 항목은 서로 다른 삶의 상황(외로움·불안·상실·분노·의미 등)을 다루도록 다양하게 구성하세요.${mentorId === 'hyewoon' ? `
- 유명한 구절도 괜찮습니다. 현대인의 마음에 실제로 닿는 구절이면 충분합니다.` : `
- 뻔하고 유명한 구절(예: "나는 생각한다, 고로 존재한다")은 절대 피하세요.`}`;

  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
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
          required: ['quote', 'source', 'translation', 'context', 'tags'],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error('AI 응답을 받지 못했습니다.');
  return JSON.parse(text) as KnowledgeEntry[];
}

/** 최근 N일치 사용된 quote 목록 수집 (중복 방지용) */
async function collectRecentQuotes(mentorId: MentorId, days = 14): Promise<string[]> {
  const db = getDb();
  const quotes: string[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    for (const period of ['h08', 'h12', 'h17', 'h22', 'am', 'pm', '']) {
      const key = period ? `${mentorId}_${dateStr}_${period}` : `${mentorId}_${dateStr}`;
      try {
        const snap = await db.doc(`mentor_knowledge/${key}`).get();
        if (snap.exists) {
          const entries: KnowledgeEntry[] = snap.data()?.entries ?? [];
          entries.forEach(e => { if (e.quote) quotes.push(e.quote); });
        }
      } catch { /* 해당 문서 없으면 skip */ }
    }
  }
  return quotes;
}

// 5-a. 클라이언트 호출용 (어드민 수동 재생성)
export const generateKnowledge = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const { mentorId } = request.data as { mentorId: MentorId };
  if (!mentorId) throw new HttpsError('invalid-argument', 'mentorId가 필요합니다.');

  const avoidQuotes = await collectRecentQuotes(mentorId);
  const entries = await generateKnowledgeEntries(mentorId, avoidQuotes);
  return entries;
});

// 5-b. 스케줄 함수 — 매일 KST 08:00 · 12:00 · 17:00 · 22:00 자동 생성
export const scheduledKnowledgeGeneration = onSchedule(
  {
    schedule: '0 8,12,17,22 * * *',
    timeZone: 'Asia/Seoul',
    memory:          '512MiB',
    timeoutSeconds:  300,
  },
  async () => {
    const db = getDb();

    // KST 기준 날짜·시간대 결정
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today  = nowKst.toISOString().slice(0, 10);
    const hour   = nowKst.getUTCHours();
    const period = `h${String(hour).padStart(2, '0')}`; // h08 | h12 | h17 | h22

    console.log(`[Schedule] 시작 — ${today} ${period}`);

    // 중복 실행 방지 (Firestore 잠금)
    const lockRef = db.doc(`meta/knowledge_${today}_${period}`);
    const lockSnap = await lockRef.get();
    if (lockSnap.exists && lockSnap.data()?.status === 'done') {
      console.log(`[Schedule] 이미 완료 — ${today} ${period}, 종료`);
      return;
    }
    await lockRef.set({ status: 'generating', startedAt: FieldValue.serverTimestamp() });

    const mentors: MentorId[] = ['hyewoon', 'benedicto', 'theodore', 'yeonam'];

    await Promise.allSettled(mentors.map(async (mentorId) => {
      const docRef = db.doc(`mentor_knowledge/${mentorId}_${today}_${period}`);
      const existing = await docRef.get();
      if (existing.exists) {
        console.log(`[Schedule] ${mentorId} 이미 존재 — skip`);
        return;
      }

      try {
        // 최근 14일 quote 수집 → 중복 방지
        const avoidQuotes = await collectRecentQuotes(mentorId, 14);
        console.log(`[Schedule] ${mentorId} — 회피 구절 ${avoidQuotes.length}개`);

        const entries = await generateKnowledgeEntries(mentorId, avoidQuotes);

        await docRef.set({
          mentorId,
          date: today,
          period,
          entries,
          generatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[Schedule] ${mentorId} ${period} — ${entries.length}개 저장 완료`);
      } catch (err) {
        console.error(`[Schedule] ${mentorId} 생성 실패:`, err);
      }
    }));

    await lockRef.set({ status: 'done', completedAt: FieldValue.serverTimestamp() });
    console.log(`[Schedule] 완료 — ${today} ${period}`);
  },
);

// ── 6. Gutenberg 도서 배치 인덱싱 ────────────────────────────────────────────
// 관리자가 수동으로 실행. 책 한 권의 텍스트를 청크로 나눠 구절을 추출해
// gutenberg_quotes 컬렉션에 저장. 이후 멘토 편지/담소 생성 시 참고 자료로 활용됨.

export const indexGutenbergBooks = onCall(
  { timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

    const { mentorId, bookId } = request.data as { mentorId: MentorId; bookId: number };
    if (!mentorId || !bookId) throw new HttpsError('invalid-argument', 'mentorId와 bookId가 필요합니다.');

    const books = GUTENBERG_BOOKS[mentorId];
    if (!books) throw new HttpsError('invalid-argument', `${mentorId}에 대한 Gutenberg 도서가 없습니다.`);

    const book = books.find(b => b.id === bookId);
    if (!book) throw new HttpsError('invalid-argument', `도서 ID ${bookId}를 찾을 수 없습니다.`);

    // 전체 텍스트 로드
    const url = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new HttpsError('internal', 'Gutenberg 텍스트를 가져오지 못했습니다.');

    const text = await res.text();
    const startMark = text.indexOf('*** START OF');
    const endMark   = text.lastIndexOf('*** END OF');
    const body = (startMark !== -1 && endMark !== -1)
      ? text.slice(text.indexOf('\n', startMark) + 1, endMark)
      : text;

    // 앞 5% skip (서문/목차), 8000자 간격으로 청크 분리 (최대 20청크)
    const CHUNK_SIZE = 4500;
    const STEP = 8000;
    const chunks: string[] = [];
    for (let i = Math.floor(body.length * 0.05); i < body.length - CHUNK_SIZE; i += STEP) {
      chunks.push(body.slice(i, i + CHUNK_SIZE));
      if (chunks.length >= 20) break;
    }

    const adminDb = getDb();
    const ai = getGemini();
    let totalIndexed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const prompt = `다음은 "${book.title}"의 일부입니다.
이 텍스트에서 심리 위로와 정서 치유에 실제로 도움이 되는 구절 2개를 추출해주세요.

[원문 텍스트]
${chunk}

[필수 규칙]
- 반드시 위 텍스트에 실제로 나오는 문장만 사용하세요. 없으면 빈 배열을 반환하세요.
- quote: ${QUOTE_LANG[mentorId]}으로 작성 (원문 그대로)
- source: 출처 (책 제목 + 권/장 정보)
- translation: 한국어 직역 (해설 없이 원문 충실하게)
- context: ${MENTOR_PROFILES[mentorId].name}의 목소리로 이 구절의 의미 해석 (80-120자)
- tags: 관련 감정/상황 태그 2-3개

JSON 배열만 반환하세요.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
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
                required: ['quote', 'source', 'translation', 'context', 'tags'],
              },
            },
          },
        });

        const responseText = response.text;
        if (!responseText) continue;

        const entries = JSON.parse(responseText) as KnowledgeEntry[];
        for (const entry of entries) {
          if (!entry.quote || entry.quote.length < 10) continue;
          await adminDb.collection('gutenberg_quotes').add({
            mentorId,
            bookId,
            bookTitle: book.title,
            quote: entry.quote,
            source: entry.source,
            translation: entry.translation,
            context: entry.context,
            tags: entry.tags ?? [],
            randomOrder: Math.random(),
            createdAt: FieldValue.serverTimestamp(),
          });
          totalIndexed++;
        }
        console.log(`[Gutenberg] ${mentorId} 청크 ${i + 1}/${chunks.length} — ${totalIndexed}개 누적`);
      } catch (err) {
        console.error(`[Gutenberg] 청크 ${i} 처리 실패:`, err);
      }
    }

    return { success: true, indexed: totalIndexed, book: book.title };
  }
);

// ── 7. 불교 경전 사이트 스크래핑 + 인덱싱 (혜운 스님 전용) ──────────────────
// 동국대 ABC 한글대장경 등 URL에서 HTML을 가져와 한문 원문·한국어 번역 쌍을 추출.
// 결과는 buddhist_quotes 컬렉션에 저장.

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export const indexBuddhistCanon = onCall(
  { timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

    const { url, sourceName } = request.data as { url: string; sourceName?: string };
    if (!url) throw new HttpsError('invalid-argument', 'url이 필요합니다.');

    // 페이지 로드
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Buddhist-Canon-Indexer/1.0)' },
    });
    if (!res.ok) throw new HttpsError('internal', `페이지를 가져오지 못했습니다. (${res.status})`);

    const html = await res.text();
    const text = stripHtml(html);

    if (text.length < 200) throw new HttpsError('internal', '추출된 텍스트가 너무 짧습니다. URL을 확인해주세요.');

    // 텍스트가 길면 최대 6000자로 분할 처리
    const CHUNK_SIZE = 6000;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push(text.slice(i, i + CHUNK_SIZE));
      if (chunks.length >= 5) break; // 최대 5청크
    }

    const ai = getGemini();
    const adminDb = getDb();
    let totalIndexed = 0;

    for (const chunk of chunks) {
      try {
        const prompt = `다음은 불교 경전 사이트의 텍스트입니다.
이 텍스트에서 한문(漢文) 원문과 한국어 번역이 쌍을 이루는 경전·어록 구절을 최대 3개 추출해주세요.

[텍스트]
${chunk}

[추출 규칙]
- quote: 반드시 순수 한문(漢文) 원문만. 한글·영어·팔리어 혼용 금지.
- source: 경전명(한자 병기) + 품명 + 게송 번호 (텍스트에 있는 경우)
- translation: 텍스트의 한국어 번역을 그대로 사용. 없으면 직역.
- context: 혜운 스님(선불교 수행자, 하십시오체)의 목소리로 이 구절의 치유적 의미 (80-100자)
- tags: 관련 감정/상황 태그 2-3개

텍스트에 적합한 한문 구절이 없으면 빈 배열을 반환하세요.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
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
                required: ['quote', 'source', 'translation', 'context', 'tags'],
              },
            },
          },
        });

        const responseText = response.text;
        if (!responseText) continue;

        const entries = JSON.parse(responseText) as KnowledgeEntry[];
        for (const entry of entries) {
          if (!entry.quote || entry.quote.length < 5) continue;
          // 영문자가 절반 이상이면 한문이 아님 — skip
          const latinChars = (entry.quote.match(/[a-zA-Z]/g) ?? []).length;
          if (latinChars > entry.quote.length * 0.3) continue;

          await adminDb.collection('buddhist_quotes').add({
            mentorId: 'hyewoon',
            sourceUrl: url,
            sourceName: sourceName ?? url,
            quote: entry.quote,
            source: entry.source,
            translation: entry.translation,
            context: entry.context,
            tags: entry.tags ?? [],
            randomOrder: Math.random(),
            createdAt: FieldValue.serverTimestamp(),
          });
          totalIndexed++;
        }
      } catch (err) {
        console.error('[Buddhist] 청크 처리 실패:', err);
      }
    }

    return { success: true, indexed: totalIndexed };
  }
);
