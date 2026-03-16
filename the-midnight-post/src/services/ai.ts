import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });

export interface MentorReply {
  mentorId: 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';
  quote: string;
  source?: string;
  translation: string;
  advice: string;
}

export async function generateSingleMentorReply(content: string, mentorId: 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam'): Promise<MentorReply> {
  const mentorDescriptions = {
    hyewoon: "혜운(慧雲) 스님: 비움과 머무름의 수행자. 초기 불교/선불교. 집착을 버리고 현재에 머무름. 간결한 하십시오체.",
    benedicto: "베네딕토 신부: 사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함 긍정, 존엄성 강조. 부드러운 경어체 ('형제여/자매여').",
    theodore: "테오도르 교수: 이성과 실존의 철학자. 스토아 학파/실존주의. 통제할 수 있는 의지에 집중. 지적이고 격식 있는 문어체.",
    yeonam: "연암 선생: 순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 예스럽고 품격 있는 문체."
  };

  const prompt = `
사용자가 밤에 쓴 한 줄의 일기입니다: "${content}"

당신은 아래에 설명된 멘토(현자)입니다. 사용자의 일기를 읽고, 당신의 철학과 관점에서 깊은 위로와 지혜가 담긴 편지를 작성해주세요.

멘토 정보:
${mentorDescriptions[mentorId]}

[작성 지침]
1. 명언 선정 (quote, source, translation): 사용자의 상황에 가장 깊은 울림을 줄 수 있는 철학적/문학적 원문을 신중하게 선정하세요. 뻔하고 흔한 명언보다는, 깊이 있고 희소성 있는 구절을 추천합니다.
2. 일화와 내러티브 (advice의 시작): 조언을 바로 시작하지 말고, 선정한 명언이 탄생하게 된 흥미로운 역사적 배경, 멘토 본인의 생애 속 겪었던 일화, 혹은 깊이 있는 비유(내러티브)를 먼저 재미있게 들려주세요. 사용자가 마치 한 편의 짧고 아름다운 에세이나 옛이야기를 듣는 것처럼 몰입할 수 있어야 합니다.
3. 위로와 통찰 (advice의 연결): 앞서 소개한 일화와 명언의 의미를 사용자의 일기 내용과 다정하게 연결해주세요. 사용자가 '좋은 이야기를 통해 위로받았다'는 감동과 '훌륭한 지혜를 배웠다'는 지적 충만감을 동시에 느낄 수 있도록 깊이 있게 풀어내세요.
4. 분량 및 형식: advice 부분은 최소 4~5문단 이상, 800자~1000자 내외로 매우 풍성하고 정성스럽게 작성해주세요. 가독성을 위해 문단 구분을 명확히 하고, 문단 사이에 반드시 빈 줄(\\n\\n)을 넣어주세요. 멘토 특유의 말투를 끝까지 유지하세요.

답장은 다음 필드를 포함하는 JSON 객체여야 합니다:
- mentorId: "${mentorId}"
- quote: 철학적 원문 (한자, 라틴어, 영어 등 멘토에 맞는 언어)
- source: 원문의 출처 (예: "금강경", "아우구스티누스 고백록", "마르쿠스 아우렐리우스 명상록", "열하일기" 등)
- translation: 원문의 한국어 번역
- advice: 일화와 내러티브가 포함된, 멘토의 성격이 반영된 길고 깊이 있는 현대적 조언
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mentorId: { type: Type.STRING },
            quote: { type: Type.STRING },
            source: { type: Type.STRING },
            translation: { type: Type.STRING },
            advice: { type: Type.STRING }
          },
          required: ["mentorId", "quote", "source", "translation", "advice"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as MentorReply;
  } catch (geminiError) {
    console.warn(`Gemini failed for ${mentorId}, falling back to Claude:`, geminiError);

    try {
      const claudeResponse = await anthropic.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt + "\n\nJSON 형식으로만 응답하세요." }],
      });

      const text = claudeResponse.content[0].type === "text" ? claudeResponse.content[0].text : null;
      if (!text) throw new Error("No response from Claude");

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in Claude response");

      return JSON.parse(jsonMatch[0]) as MentorReply;
    } catch (claudeError) {
      console.error(`Claude fallback also failed for ${mentorId}:`, claudeError);
      throw claudeError;
    }
  }
}

export async function generateMentorReplies(content: string): Promise<MentorReply[]> {
  const prompt = `
사용자가 밤에 쓴 한 줄의 일기입니다: "${content}"

이 일기를 읽고, 다음 4명의 멘토(현자)가 각각의 철학과 관점에서 위로와 조언의 편지를 작성해야 합니다.
반드시 각 멘토의 성격과 말투를 반영하고, [원문 - 출처 - 한국어 번역 - 현대적 조언] 형식을 지켜주세요.
조언(advice) 부분은 사용자의 마음에 깊은 울림을 줄 수 있도록 충분히 길고 상세하게 작성해주세요. (최소 3문단 이상, 500자 내외).

1. 혜운(慧雲) 스님 (hyewoon): 비움과 머무름의 수행자. 초기 불교/선불교. 집착을 버리고 현재에 머무름. 간결한 하십시오체.
2. 베네딕토 신부 (benedicto): 사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함 긍정, 존엄성 강조. 부드러운 경어체 ("형제여/자매여").
3. 테오도르 교수 (theodore): 이성과 실존의 철학자. 스토아 학파/실존주의. 통제할 수 있는 의지에 집중. 지적이고 격식 있는 문어체.
4. 연암 선생 (yeonam): 순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 예스럽고 품격 있는 문체.

각 멘토의 답장은 다음 필드를 포함해야 합니다:
- mentorId: 멘토의 영문 ID (hyewoon, benedicto, theodore, yeonam)
- quote: 철학적 원문 (한자, 라틴어, 영어 등 각 멘토에 맞는 언어)
- source: 원문의 출처 (예: "금강경", "아우구스티누스 고백록", "마르쿠스 아우렐리우스 명상록", "열하일기" 등)
- translation: 원문의 한국어 번역
- advice: 멘토의 성격이 반영된 현대적 조언 (최소 3문단 이상, 깊이 있는 위로와 통찰 제공)
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              mentorId: {
                type: Type.STRING,
                enum: ["hyewoon", "benedicto", "theodore", "yeonam"]
              },
              quote: { type: Type.STRING },
              source: { type: Type.STRING },
              translation: { type: Type.STRING },
              advice: { type: Type.STRING }
            },
            required: ["mentorId", "quote", "source", "translation", "advice"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as MentorReply[];
  } catch (error) {
    console.error("Error generating mentor replies:", error);
    throw error;
  }
}
