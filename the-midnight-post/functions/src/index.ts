import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleGenAI, Type } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();

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
}

interface DamsoTurn {
  transformedInput: string;
  stageDirection: string;
  mentorSpeech: string;
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

// ── 1. 멘토 편지 생성 ─────────────────────────────────────────────────────────

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

  const { timeLabel, closing } = getTimeContext(writtenHour ?? new Date().getHours());
  const knowledgeContext = buildKnowledgeContext(knowledgeEntries);

  // 최근 일기 맥락 — 멘토가 "나를 아는 현자"처럼 느껴지게
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
});

// ── 2. 담소 오프닝 ────────────────────────────────────────────────────────────

export const generateDamsoOpening = onCall({ timeoutSeconds: 180, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const { mentorId, entryContent } = request.data as { mentorId: MentorId; entryContent: string };
  if (!mentorId) throw new HttpsError('invalid-argument', 'mentorId가 필요합니다.');

  const mentor = MENTOR_PROFILES[mentorId];
  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"

사용자가 당신의 ${mentor.space}을 찾아왔습니다. 소설의 첫 장면처럼 묘사하고 첫 인사를 건네주세요.

JSON 필드:
- stageDirection: 공간의 분위기와 당신의 첫 동작을 묘사하는 2-3문장의 지문. 현재형, 서정적으로. (예: "방 안에는 은은한 차 향기가 가득하다. 스님은 조용히 찻잔을 건네며 부드러운 미소를 지으셨다.")
- mentorGreeting: 사용자를 맞이하는 첫 인사말. ${mentor.style} 일기 내용을 직접 언급하지 않고 마음을 자연스럽게 여는 말. 80-120자 내외.

JSON만 응답하세요.`;

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
            stageDirection: { type: Type.STRING },
            mentorGreeting: { type: Type.STRING },
          },
          required: ['stageDirection', 'mentorGreeting'],
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

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"${historyContext}

사용자가 방금 말했습니다: "${userInput}"

JSON 필드:
1. transformedInput: 사용자가 입력한 문장을 최대한 그대로 유지하되, 오타나 맞춤법만 최소한으로 교정. 문체·어투·표현은 바꾸지 말 것. 예) "내일이 무서워" → "내일이 무서워"처럼 원문을 존중.

2. stageDirection: 당신의 반응 행동을 묘사하는 1-2문장의 지문. 현재형, 서정적으로. (예: "스님은 잠시 눈을 감고 대나무 숲 소리에 귀를 기울이셨다. 그리고는 천천히 입을 열어 말씀하셨다.")

3. mentorSpeech: 당신의 대사. ${mentor.style} 사용자의 감정과 상황에 먼저 충분히 공감하고, 그 마음을 있는 그대로 따뜻하게 품어주세요. 대화 맥락을 이어받아 깊이 있게 응답. 120-200자 내외. 30% 확률로 마지막에 사용자가 스스로 사유하게 하는 질문 하나를 덧붙임.

JSON만 응답하세요.`;

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
            transformedInput: { type: Type.STRING },
            stageDirection: { type: Type.STRING },
            mentorSpeech: { type: Type.STRING },
          },
          required: ['transformedInput', 'stageDirection', 'mentorSpeech'],
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

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"${historyContext}

사용자가 방금 말했습니다: "${userInput}"

이제 담소를 자연스럽게 마무리할 시간입니다. 사용자의 말에 응답하되, 이것이 오늘의 마지막 말임을 느끼게 해주십시오. 억지로 끊는 것이 아니라, 차 한 잔이 다 비워진 것처럼, 달빛이 기울기 시작한 것처럼 자연스럽게 작별을 고해주세요.

JSON 필드:
1. transformedInput: 사용자가 입력한 문장을 최대한 그대로 유지하되, 오타나 맞춤법만 최소한으로 교정. 문체·어투는 바꾸지 말 것.

2. stageDirection: 마무리 분위기를 담은 지문 1-2문장. 현재형, 서정적으로. (예: "스님은 찻잔을 조심스레 내려놓으시며 창밖 먼 산을 한참 바라보셨다.")

3. mentorSpeech: ${mentor.style} 사용자의 마지막 말에 따뜻하게 응답하고, 자연스럽게 작별을 고하는 말. 오늘 이 자리에 와준 것에 대한 감사와, 사용자가 앞으로 나아갈 수 있도록 진심 어린 축복 혹은 기원의 말을 담아 마무리. 120-180자 내외.

JSON만 응답하세요.`;

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
            transformedInput: { type: Type.STRING },
            stageDirection: { type: Type.STRING },
            mentorSpeech: { type: Type.STRING },
          },
          required: ['transformedInput', 'stageDirection', 'mentorSpeech'],
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
  hyewoon:   '한문(漢文) — 불교 경전의 한역본(법구경·숫타니파타·중부니카야 등) 원문',
  benedicto: '라틴어(Vulgata) 또는 영어 — 성경 원문이나 영문 신학 고전',
  theodore:  '영어 또는 라틴어 — 스토아·실존주의 철학 원문이나 표준 영역',
  yeonam:    '한문(漢文) — 논어·맹자·노자·중용 등 동양 고전 원문',
};

/** 핵심 생성 로직 — onCall과 스케줄 함수가 공용으로 사용 */
async function generateKnowledgeEntries(
  mentorId: MentorId,
  avoidQuotes: string[] = [],
): Promise<KnowledgeEntry[]> {
  const today = new Date().toISOString().slice(0, 10);

  const avoidSection = avoidQuotes.length > 0
    ? `\n[이미 사용된 구절 — 아래 구절들은 반드시 피하세요]\n` +
      avoidQuotes.slice(0, 28).map((q, i) => `${i + 1}. ${q}`).join('\n') + '\n'
    : '';

  const prompt = `오늘(${today}) 다음 분야에서 심리 위로와 정서 치유에 실제로 도움이 되는,
잘 알려지지 않은 깊이 있는 지식 4개를 발굴해주세요.

[현자의 분야]
${MENTOR_DOMAINS[mentorId]}
${avoidSection}
[필수 형식 — 반드시 아래 순서와 규칙을 지키세요]

1. quote (글귀): ${QUOTE_LANG[mentorId]}으로 작성하세요. 한국어를 섞지 말고 원문만 쓰세요.

2. source (출처): 원문의 출처를 명확하게 쓰세요. (예: "법구경(法句經) 제1게", "Epistulae Morales 제1서")

3. translation (번역): quote의 한국어 직역을 간결하게 쓰세요. 해설이나 감상을 덧붙이지 말고, 원문을 충실하게 번역하세요.

4. context (멘토의 말): 이 글귀에 대한 멘토의 해석 또는 독자에게 건네고 싶은 말을 멘토의 목소리로 직접 쓰세요.
   - "~할 때 씁니다", "~분에게 씁니다", "~하는 분들에게 추천합니다" 같은 상담사 말투는 절대 금지
   - 멘토 특유의 말투로 자연스럽게: 혜운(하십시오체), 베네딕토(경어체), 테오도르(문어체), 연암(예스러운 문체)
   - 글귀의 의미를 해석하거나, 이 글귀를 마음에 품으면 어떻게 달라지는지 진솔하게 이야기하세요

[공통 요구사항]
- 뻔하고 유명한 구절(예: "나는 생각한다, 고로 존재한다")은 절대 피하세요.
- 실제 경전·문헌·저서에서 출처가 명확한 내용만 사용하세요.
- 각 항목은 서로 다른 삶의 상황(외로움·불안·상실·분노·의미 등)을 다루도록 다양하게 구성하세요.`;

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
  const db = getFirestore();
  const quotes: string[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    for (const period of ['am', 'pm', '']) {
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

// 5-b. 스케줄 함수 — 매일 KST 00:00 (자정) · 12:00 (정오) 자동 생성
export const scheduledKnowledgeGeneration = onSchedule(
  {
    schedule: '0 0,12 * * *',
    timeZone: 'Asia/Seoul',
    memory:          '512MiB',
    timeoutSeconds:  300,
  },
  async () => {
    const db = getFirestore();

    // KST 기준 날짜·시간대 결정
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today  = nowKst.toISOString().slice(0, 10);
    const period = nowKst.getUTCHours() < 12 ? 'am' : 'pm';

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
