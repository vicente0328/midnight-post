import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });

export type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';

export interface DamsoConversationEntry {
  type: 'stage_direction' | 'mentor' | 'user';
  content: string;
  rawInput?: string;
}

export interface DamsoOpening {
  stageDirection: string;
  mentorGreeting: string;
}

export interface DamsoTurn {
  transformedInput: string;
  stageDirection: string;
  mentorSpeech: string;
}

const MENTOR_PROFILES: Record<MentorId, { name: string; space: string; personality: string; style: string }> = {
  hyewoon: {
    name: '혜운 스님',
    space: '청명각',
    personality: '비움과 머무름의 수행자. 선불교 관점. 집착을 버리고 현재에 머무름. 대나무, 바람, 차(茶)의 비유를 즐겨 씀.',
    style: '간결하고 서정적인 하십시오체. 때로는 선문답처럼 역설적으로. 짧고 깊은 침묵 같은 문장으로.',
  },
  benedicto: {
    name: '베네딕토 신부',
    space: '고해소',
    personality: '사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함을 긍정. 형제여/자매여 호칭.',
    style: '부드럽고 온화한 경어체. 촛불, 성소, 은총의 언어로. 용서와 자비를 담아 따뜻하게.',
  },
  theodore: {
    name: '테오도르 교수',
    space: '서재',
    personality: '이성과 실존의 철학자. 스토아 학파와 실존주의. 고민을 구조화하고 본질을 꿰뚫음.',
    style: '지적이고 격식 있는 문어체. 논리적이되 냉정하지 않게. 명료한 통찰로 길을 제시.',
  },
  yeonam: {
    name: '연암 선생',
    space: '취락헌',
    personality: '순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 호탕하고 유머 있음.',
    style: '예스럽고 품격 있는 문체. 자연의 섭리와 인간사를 연결하여. 때로는 호탕하게, 때로는 깊이 있게.',
  },
};

function buildHistoryContext(history: DamsoConversationEntry[]): string {
  if (history.length === 0) return '';
  return '\n\n[지금까지의 대화]\n' + history.map(e => {
    if (e.type === 'stage_direction') return `*${e.content}*`;
    if (e.type === 'mentor') return `${e.content}`;
    return `나: "${e.content}"`;
  }).join('\n');
}

export async function generateDamsoOpening(
  mentorId: MentorId,
  entryContent: string
): Promise<DamsoOpening> {
  const mentor = MENTOR_PROFILES[mentorId];

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"

사용자가 당신의 ${mentor.space}을 찾아왔습니다. 소설의 첫 장면처럼 묘사하고 첫 인사를 건네주세요.

JSON 필드:
- stageDirection: 공간의 분위기와 당신의 첫 동작을 묘사하는 2-3문장의 지문. 현재형, 서정적으로. (예: "방 안에는 은은한 차 향기가 가득하다. 스님은 조용히 찻잔을 건네며 부드러운 미소를 지으셨다.")
- mentorGreeting: 사용자를 맞이하는 첫 인사말. ${mentor.style} 일기 내용을 직접 언급하지 않고 마음을 자연스럽게 여는 말. 80-120자 내외.

JSON만 응답하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stageDirection: { type: Type.STRING },
            mentorGreeting: { type: Type.STRING },
          },
          required: ["stageDirection", "mentorGreeting"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as DamsoOpening;
  } catch {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content[0].type === "text" ? resp.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    return JSON.parse(match[0]) as DamsoOpening;
  }
}

export async function generateDamsoClosing(
  mentorId: MentorId,
  entryContent: string,
  conversationHistory: DamsoConversationEntry[],
  userInput: string,
): Promise<DamsoTurn> {
  const mentor = MENTOR_PROFILES[mentorId];
  const historyContext = buildHistoryContext(conversationHistory);

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"${historyContext}

사용자가 방금 말했습니다: "${userInput}"

이제 담소를 자연스럽게 마무리할 시간입니다. 사용자의 말에 응답하되, 이것이 오늘의 마지막 말임을 느끼게 해주십시오. 억지로 끊는 것이 아니라, 차 한 잔이 다 비워진 것처럼, 달빛이 기울기 시작한 것처럼 자연스럽게 작별을 고해주세요.

JSON 필드:
1. transformedInput: 사용자의 구어체를 소설체로 변환. 내용 보존, 문체만 다듬기.

2. stageDirection: 마무리 분위기를 담은 지문 1-2문장. 현재형, 서정적으로. (예: "스님은 찻잔을 조심스레 내려놓으시며 창밖 먼 산을 한참 바라보셨다.")

3. mentorSpeech: ${mentor.style} 사용자의 마지막 말에 따뜻하게 응답하고, 자연스럽게 작별을 고하는 말. 오늘의 이야기에 대한 여운을 남기며 마무리. 120-180자 내외.

JSON만 응답하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transformedInput: { type: Type.STRING },
            stageDirection: { type: Type.STRING },
            mentorSpeech: { type: Type.STRING },
          },
          required: ["transformedInput", "stageDirection", "mentorSpeech"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as DamsoTurn;
  } catch {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content[0].type === "text" ? resp.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    return JSON.parse(match[0]) as DamsoTurn;
  }
}

export async function generateDamsoResponse(
  mentorId: MentorId,
  entryContent: string,
  conversationHistory: DamsoConversationEntry[],
  userInput: string
): Promise<DamsoTurn> {
  const mentor = MENTOR_PROFILES[mentorId];
  const historyContext = buildHistoryContext(conversationHistory);

  const prompt = `당신은 ${mentor.name}입니다. 성격: ${mentor.personality}

사용자가 어젯밤 이런 일기를 썼습니다: "${entryContent || '말로 표현하기 어려운 감정'}"${historyContext}

사용자가 방금 말했습니다: "${userInput}"

JSON 필드:
1. transformedInput: 사용자의 구어체 말을 소설의 1인칭 서술체로 변환. 예) "내일이 무서워" → "내일이 오는 것이 조금 두렵습니다." 자연스럽고 품위 있게. 내용을 보존하되 문체만 다듬기.

2. stageDirection: 당신의 반응 행동을 묘사하는 1-2문장의 지문. 현재형, 서정적으로. (예: "스님은 잠시 눈을 감고 대나무 숲 소리에 귀를 기울이셨다. 그리고는 천천히 입을 열어 말씀하셨다.")

3. mentorSpeech: 당신의 대사. ${mentor.style} 대화 맥락을 이어받아 깊이 있게 응답. 120-200자 내외. 30% 확률로 마지막에 사용자가 스스로 사유하게 하는 질문 하나를 덧붙임.

JSON만 응답하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transformedInput: { type: Type.STRING },
            stageDirection: { type: Type.STRING },
            mentorSpeech: { type: Type.STRING },
          },
          required: ["transformedInput", "stageDirection", "mentorSpeech"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text) as DamsoTurn;
  } catch {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 768,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content[0].type === "text" ? resp.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    return JSON.parse(match[0]) as DamsoTurn;
  }
}
