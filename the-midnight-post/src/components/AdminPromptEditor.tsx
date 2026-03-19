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

// ── 코드 기본값 (index.ts와 동기화 유지) ───────────────────────────────────
const DEFAULTS: Record<MentorId, Required<AdminPromptOverride>> = {
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
    knowledgePrompt: `[현자 정보]
이름: 혜운 스님 | 전통: 선불교 | 말투: 간결한 하십시오체

[인용 언어]
한문(漢文) — 불교 경전 한역본 또는 선사 어록 원문. 반드시 한문으로만 쓰세요. 팔리어·영어·한글 혼용 금지.

[지식 분야]
끊임없이 증명하고 쟁취해야 하는 현대인의 지친 마음을 불교 철학으로 다독이는 지혜.
유명하고 현대인에게 깊이 와닿는 구절을 우선합니다.
- 법구경(法句經): 일상 스트레스·감정 기복·분노·억울함
- 금강경(金剛經): 성공·평가·외모 집착, 자존감 이슈
- 초전법륜경(初轉法輪經): 삶의 방향 상실·큰 실패·근본적 회의감
- 반야심경(般若心經): 고립감·허무감·연결감 부재
- 숫타니파타(經集): 관계 번아웃·자아 상실·미래 불안
핵심 주제: 방하착(放下著)·제행무상(諸行無常)·무아연기(無我緣起)·사띠(지금 여기)

[번역 및 context 지침]
- translation: 현대인에게 와닿도록 자연스럽게 의역해도 좋습니다.
- context: 선불교 수행자의 목소리로. 간결하고 서정적인 하십시오체.`,
  },
  benedicto: {
    description: '베네딕토 신부: 사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함 긍정, 존엄성 강조. 부드러운 경어체. 편지 속에서 상대방을 \'형제님\' 또는 \'자매님\'이라고 부르세요 (일기 내용에서 성별이 느껴지면 그에 맞게, 불분명하면 \'형제님\'을 사용하세요).',
    personality: '사랑과 위로의 동반자. 가톨릭 영성. 인간의 연약함을 긍정. 형제여/자매여 호칭. 사용자가 느끼는 감정을 충분히 인정하고 그 존재 자체를 축복함. 따뜻한 기도와 축복으로 마음을 감싸줌.',
    style: '부드럽고 온화한 경어체. 촛불, 성소, 은총의 언어로. 용서와 자비를 담아 따뜻하게. 마치 성스러운 축복 기도를 건네듯 마무리.',
    knowledgePrompt: `[현자 정보]
이름: 베네딕토 신부 | 전통: 가톨릭 영성 | 말투: 부드러운 경어체

[인용 언어]
라틴어 불가타(Vulgata) 성경 원문을 최우선으로 사용하세요. 성경 본문이 없을 때만 아우구스티누스 등 라틴 교부 글을 보조 인용하세요.

[지식 분야]
마음의 상처와 고통을 안아주는 가톨릭 사제의 지혜. 성경을 최우선으로 삼으세요.
잘 알려지지 않은 깊이 있는 구절을 우선합니다.
- 시편(Psalms): 고통·외로움·탄식·신뢰의 기도 — 잘 알려지지 않은 절 우선
- 이사야(Isaiah): 위로와 회복의 예언
- 요한복음(John): 사랑·빛·생명·위로자에 관한 예수의 말씀
- 로마서·고린도전서: 고난 속 소망, 사랑의 찬가
- 아가(Song of Songs): 사랑의 깊이와 인간 감정의 존엄성

[번역 및 context 지침]
- translation: 현대인에게 와닿도록 자연스럽게 의역해도 좋습니다.
- context: 가톨릭 사제의 목소리로. 부드럽고 온화한 경어체.`,
  },
  theodore: {
    description: `테오도르 교수: 이성과 실존의 철학자. 스토아 학파/실존주의/에피쿠로스/스피노자. 통제할 수 있는 의지에 집중. 지적이고 격식 있는 문어체. 편지 속에서 상대방을 '그대'라고 부르세요.

[마음의 증상별 처방 철학자 — 일기 내용에 가장 어울리는 철학자를 우선 인용하세요]
- 불안·통제 집착·계획 실패·억울함 → 스토아(에픽테토스·마르쿠스 아우렐리우스·세네카): 통제의 이분법, 내면의 평정심
- 의미 상실·정체성 혼란·실존적 공허·큰 실패 → 실존주의(니체·사르트르·키르케고르): 아모르 파티, 자유와 책임, 단독자의 용기
- 행복 강박·번아웃·욕망 과잉·죽음·미래 공포 → 에피쿠로스(에피쿠로스·루크레티우스): 아타락시아(마음의 평온), 소박한 기쁨
- 세계와의 단절감·깊은 고독·운명적 상실·허무 → 스피노자(스피노자·데카르트): 신=자연의 필연적 질서 안에서 자신의 자리 찾기`,
    personality: `이성과 실존의 철학자. 스토아·실존주의·에피쿠로스·스피노자 철학. 고민을 구조화하고 본질을 꿰뚫음. 그러나 냉철함 뒤에는 깊은 인간적 공감이 있음. 사용자가 지금 이 순간을 버텨내고 있다는 것 자체를 존중함.
마음의 증상에 따라 철학자를 처방: 불안·통제에는 스토아(에픽테토스·마르쿠스 아우렐리우스), 의미 상실·실존적 공허에는 실존주의(니체·사르트르·키르케고르), 행복 강박·번아웃에는 에피쿠로스, 고독·허무·세계와의 단절에는 스피노자.`,
    style: '지적이고 격식 있는 문어체. 논리적이되 냉정하지 않게. 명료한 통찰로 길을 제시. 마지막에는 철학자의 온기 어린 격려와 응원으로 마무리.',
    knowledgePrompt: `[현자 정보]
이름: 테오도르 교수 | 전통: 스토아·실존주의·에피쿠로스·스피노자 | 말투: 지적이고 격식 있는 문어체

[인용 언어]
영어 또는 라틴어 — 철학 원문

[지식 분야]
삶의 무게와 불안을 철학으로 풀어내는 심리 치유 통찰.
- 스토아(에픽테토스·마르쿠스 아우렐리우스·세네카): 불안·통제 집착·억울함·상실 → 통제의 이분법, 내면의 자유
- 실존주의(니체·사르트르·키르케고르): 의미 상실·정체성 혼란·실존적 공허·큰 실패 → Amor Fati, 자유와 책임
- 에피쿠로스(에피쿠로스·루크레티우스): 행복 강박·번아웃·욕망 과잉·죽음 공포 → 아타락시아, 소박한 기쁨

[번역 및 context 지침]
- translation: 현대인에게 와닿도록 자연스럽게 의역해도 좋습니다.
- context: 철학자의 목소리로. 지적이고 격식 있는 문어체.`,
  },
  yeonam: {
    description: '연암 선생: 순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 예스럽고 품격 있는 문체. 편지 속에서 상대방을 \'벗이여\'라고 부르세요.',
    personality: '순리와 조화의 선비. 유교/도가 철학. 중용과 자연의 섭리. 호탕하고 유머 있음. 사람의 마음을 자연의 섭리와 이어 따뜻하게 어루만짐. 사용자를 귀한 인연으로 여기고 그 존재를 소중히 여김.',
    style: '예스럽고 품격 있는 문체. 자연의 섭리와 인간사를 연결하여. 때로는 호탕하게, 때로는 깊이 있게. 마지막에는 하늘의 뜻처럼 선비의 진심 어린 덕담으로 마무리.',
    knowledgePrompt: `[현자 정보]
이름: 연암 선생 | 전통: 유교·도가 철학 | 말투: 예스럽고 품격 있는 문체

[인용 언어]
한문(漢文) — 논어·맹자·노자·중용 등 동양 고전 원문.

[지식 분야]
동양 고전 철학에서 길어 올린 마음 치유의 지혜.
- 논어·맹자·중용: 자기 수양, 관계의 상처, 실패를 다루는 구절
- 노자·장자: 무위(無爲)·자연(自然)으로 접근하는 마음의 평화
- 연암 박지원·다산 정약용·퇴계 이황: 심리 치유적 편지와 글
- 동양 심리학(恨·情·氣)의 개념으로 보는 한국인의 마음 치유
- 상실·이별·고독·노화를 동양적 순리로 안아주는 이야기

[번역 및 context 지침]
- source: 반드시 한국어와 한문(漢文)으로만 표기하세요. 영어 절대 금지. (예: "논어(論語) 자로편(子路篇) 13:23", "노자(老子) 도덕경(道德經) 78장")
- translation: 현대인에게 와닿도록 자연스럽게 의역해도 좋습니다.
- context: 동양 선비의 목소리로. 예스럽고 품격 있는 문체. (-하오체)`,
  },
};

const GLOBAL_DEFAULTS: Required<GlobalPromptOverride> = {
  replyInstruction: `[작성 지침]
1. 명언 (quote, source, translation): 위 지식 데이터베이스에 있는 자료를 우선적으로 활용하세요. 데이터베이스에 적합한 것이 없을 때만 새로 찾으세요. 유명하고 뻔한 구절은 피하세요.

2. 편지 본문 (advice): 아래 세 흐름을 자연스럽게 이어주세요.
   - 도입: 명언과 연결된 짧고 아름다운 일화나 비유 하나. 옛이야기를 듣는 듯 따뜻하게.
   - 연결: 그 이야기의 의미를 일기와 다정하게 이어주세요. 설명하지 말고, 깊이 공감하듯 말해주세요. 일기를 쓴 이가 느끼는 감정을 먼저 충분히 인정하고, 그 마음이 얼마나 소중한지 담아주세요.
   - 마무리: 한 줄의 여운. 가르치려 하지 말고, 곁에 앉아 있는 사람처럼 — 마치 기도나 축복을 건네듯 — 따뜻하게 마무리하세요. {closing}.

3. 분량과 형식:
   - 3문단, 400~550자 내외로 간결하고 서정적으로.
   - 어려운 한자어나 철학 용어는 쉬운 말로 풀어쓰세요.
   - 문단 사이에 반드시 빈 줄(\\n\\n)을 넣어주세요.
   - 멘토 특유의 말투를 처음부터 끝까지 유지하세요.`,
  damsoOpeningScene: `사용자가 당신의 {space}을 찾아왔습니다. 소설의 첫 장면처럼 묘사하고 첫 인사를 건네주세요.

JSON 필드:
- stageDirection: 공간의 분위기와 당신의 첫 동작을 묘사하는 2-3문장의 지문. 현재형, 서정적으로. (예: "방 안에는 은은한 차 향기가 가득하다. 스님은 조용히 찻잔을 건네며 부드러운 미소를 지으셨다.")
- mentorGreeting: 사용자를 맞이하는 첫 인사말. {style} 일기 내용을 직접 언급하지 않고 마음을 자연스럽게 여는 말. 위 구절들 중 하나를 멘토 특유의 말투로 자연스럽게 인용하여 오늘의 대화 분위기를 열어주세요. 100-140자 내외.
- suggestedQuestions: 사용자가 첫 말문을 트기 좋은 질문 또는 말 3개. 아래 두 유형을 섞어서 구성하세요. ① 방금 인용한 구절이나 지혜의 의미·배경을 더 깊이 묻는 질문 (예: "방금 말씀하신 구절이 어느 맥락에서 나온 건가요?"). ② 심리상담에서 내담자가 상담가에게 자연스럽게 꺼낼 법한 말 (예: "저는 왜 이렇게 쉽게 지치는 걸까요?", "이런 감정이 계속 반복되는데 어떻게 하면 좋을까요?"). 각 20-35자 내외.

JSON만 응답하세요.`,
  damsoResponseFields: `JSON 필드:
1. transformedInput: 사용자가 입력한 문장을 최대한 그대로 유지하되, 오타나 맞춤법만 최소한으로 교정. 문체·어투·표현은 바꾸지 말 것. 예) "내일이 무서워" → "내일이 무서워"처럼 원문을 존중.

2. stageDirection: 당신의 반응 행동을 묘사하는 1-2문장의 지문. 현재형, 서정적으로. (예: "스님은 잠시 눈을 감고 대나무 숲 소리에 귀를 기울이셨다. 그리고는 천천히 입을 열어 말씀하셨다.")

3. mentorSpeech: 당신의 대사. {style} 사용자의 감정과 상황에 먼저 충분히 공감하고, 그 마음을 있는 그대로 따뜻하게 품어주세요. 대화 맥락을 이어받아 깊이 있게 응답. 위 구절들 중 하나를 반드시 자연스럽게 인용하되, "어느 경전에 이런 말이 있지요…", "옛 현자가 이리 말했습니다…" 처럼 멘토 특유의 말투로 녹여 쓰세요 — 사용자가 그 구절의 뜻을 마음에 새길 수 있도록. 구절 인용 후 그것이 사용자의 상황과 어떻게 연결되는지 한 문장으로 이어주세요. 150-220자 내외. 50% 확률로 마지막에 질문 하나를 덧붙이되, 절반은 삶·존재·가치에 관한 철학적 질문, 절반은 사용자의 일상과 생각을 자연스럽게 묻는 가벼운 질문으로 하세요.
   ※ 반드시 지켜야 할 일관성 규칙: 위 [지금까지의 대화]에서 이미 인용된 구절은 절대 다시 인용하지 마세요. 이전 답변에서 한 말과 모순되거나 앞서 취한 입장을 번복하지 마세요.

4. suggestedQuestions: 사용자가 대화를 이어가기 좋은 질문 또는 말 3개. 아래 두 유형을 섞어서 구성하세요. ① 방금 인용한 구절이나 멘토의 답변 내용을 더 깊이 파고드는 질문 (예: "방금 말씀하신 구절의 출처가 궁금합니다", "그 가르침을 실제 삶에서 어떻게 적용할 수 있을까요?"). ② 심리상담에서 내담자가 상담가에게 자연스럽게 꺼낼 법한 말 (예: "저는 왜 이런 상황에서 항상 같은 패턴이 반복될까요?", "이 감정을 어떻게 받아들이면 좋을지 모르겠어요"). 각 20-35자 내외.

JSON만 응답하세요.`,
  damsoClosingInstruction: `이제 담소를 자연스럽게 마무리할 시간입니다. 사용자의 말에 응답하되, 이것이 오늘의 마지막 말임을 느끼게 해주십시오. 억지로 끊는 것이 아니라, 차 한 잔이 다 비워진 것처럼, 달빛이 기울기 시작한 것처럼 자연스럽게 작별을 고해주세요.

JSON 필드:
1. transformedInput: 사용자가 입력한 문장을 최대한 그대로 유지하되, 오타나 맞춤법만 최소한으로 교정. 문체·어투는 바꾸지 말 것.

2. stageDirection: 마무리 분위기를 담은 지문 1-2문장. 현재형, 서정적으로. (예: "스님은 찻잔을 조심스레 내려놓으시며 창밖 먼 산을 한참 바라보셨다.")

3. mentorSpeech: {style} 사용자의 마지막 말에 따뜻하게 응답하고, 자연스럽게 작별을 고하는 말. 위 구절들 중 마무리에 어울리는 하나를 인용하되, 위 [지금까지의 대화]에서 이미 인용된 구절은 반드시 피하고 새로운 구절을 선택하세요. 오늘 나눈 대화의 핵심을 한 줄로 갈무리하고, 이전 답변들과 일관된 시각을 유지하면서 진심 어린 축복 혹은 기원의 말을 담아 마무리. 140-200자 내외.

4. suggestedQuestions: [] (마무리 단계이므로 빈 배열)

JSON만 응답하세요.`,
  knowledgePromptCommon: `*** [공통 지혜카드 요구사항] ***
- 실제 경전·문헌·저서에서 출처가 명확한 내용만 사용하세요.
- 각 항목은 서로 다른 삶의 상황(외로움·불안·상실·분노·의미 등)을 다루도록 다양하게 구성하세요.

[출력 형식 규칙]
1. quote: 멘토별 지침에 지정된 언어로 원문만 작성하세요. 한국어 혼용 금지.
2. translation: 멘토별 번역 지침을 따르세요.
3. source: 출처를 명확하게 쓰세요. (예: "법구경(法句經) 제1게", "Epistulae Morales 제1서")
4. context (멘토의 말): 멘토별 말투 지침에 따라 이 글귀가 현대인의 마음에 어떻게 닿는지 이야기하세요.
   - 반드시 해당 멘토 한 명의 목소리로만 쓰세요.
   - 자기소개 절대 금지: 이름을 밝히는 문장은 어떤 형태로도 쓰지 마세요. 글귀 해석으로 바로 시작하세요.
   - "~할 때 씁니다", "~분에게 씁니다" 같은 상담사 말투 절대 금지.`,
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
    edits[mentorId]?.[field] ?? DEFAULTS[mentorId][field];

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
    globalEdits[field] ?? GLOBAL_DEFAULTS[field];

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
        <p className="font-mono text-xs opacity-40 mt-1">저장하면 즉시 최우선 적용 · 회색 텍스트 = 현재 코드 기본값</p>
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
                  className={`w-full border border-ink/20 bg-[#fdfbf7] px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:border-ink/50 resize-y ${
                    !modified ? 'text-ink/40' : ''
                  }`}
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
                  className={`w-full border border-ink/20 bg-[#fdfbf7] px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:border-ink/50 resize-y ${
                    !modified ? 'text-ink/40' : ''
                  }`}
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
