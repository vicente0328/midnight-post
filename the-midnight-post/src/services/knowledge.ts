import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';

// 자정 ~ 11:59 = 'am', 12:00 ~ 23:59 = 'pm'
function getPeriod(): 'am' | 'pm' {
  return new Date().getHours() < 12 ? 'am' : 'pm';
}

type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';

export interface KnowledgeEntry {
  quote: string;
  source: string;
  translation: string;
  context: string;   // 어떤 마음의 상황에 위로가 되는지
  tags: string[];    // ["상실", "불안", "외로움" ...]
}

// ── 데이터가 없을 때 보여줄 내장 fallback ────────────────────────────────────

const FALLBACK: Record<MentorId, KnowledgeEntry[]> = {
  hyewoon: [
    {
      quote: '心為法本，心尊心使。中心念惡，即言即行，罪苦自追，車轢於轍。',
      source: '법구경(法句經, Dhammapada) 쌍품(雙品) 제1게',
      translation: '마음이 모든 것의 근본이다. 마음이 주인이요, 마음이 이끈다. 악한 마음으로 말하거나 행하면, 수레바퀴가 발자국을 따르듯 고통이 뒤따른다.',
      context: '지금 어떤 생각이 마음의 주인 노릇을 하고 있는지, 조용히 들여다보십시오. 생각을 없애려 싸울 필요는 없습니다. 다만 그 생각이 "생각일 뿐"임을 알아차리는 순간, 이미 다른 자리에 서 있게 됩니다.',
      tags: [],
    },
    {
      quote: '莫追憶過去，莫期待未來；過去已過去，未來未到來。現在所生法，慧者應觀察。',
      source: '중부니카야(中部, Majjhima Nikāya) 제131경 — 일야현자경(一夜賢者經)',
      translation: '과거를 쫓지 말라, 미래를 기다리지 말라. 과거는 이미 지나갔고, 미래는 아직 오지 않았다. 지금 이 순간 일어나는 것을, 지혜로운 자는 통찰한다.',
      context: '마음이 과거의 잔해를 헤매거나 아직 오지 않은 내일을 두려워하고 있다면, 잠시 멈추어 지금 이 순간으로 돌아오십시오. 지금 들리는 소리, 지금 느껴지는 숨결 — 그것만으로 충분합니다.',
      tags: [],
    },
    {
      quote: '願一切衆生安樂無苦。如母護獨子，以無量心，利益一切衆生。',
      source: '자비경(慈悲經, Metta Sutta) — 숫타니파타(Suttanipāta) 제1품 8경',
      translation: '모든 존재들이 행복하고 고통 없기를. 어머니가 외아들을 보호하듯, 무량한 마음으로 모든 중생을 이롭게 하라.',
      context: '자비명상은 가장 먼저 자기 자신에게서 시작합니다. "내가 행복하기를, 내가 평안하기를." 이 말이 어색하게 느껴진다면, 그만큼 자신을 돌보는 일에 인색하게 살아온 것입니다. 오늘 이 순간만큼은, 자신에게도 자비를 허락해 보십시오.',
      tags: [],
    },
    {
      quote: '此苦聖諦：生苦，老苦，病苦，死苦，怨憎會苦，愛別離苦，求不得苦。',
      source: '초전법륜경(初轉法輪經, Dhammacakkappavattana Sutta)',
      translation: '이것이 괴로움의 성스러운 진리이다. 태어남도 괴로움이요, 늙음도 괴로움이요, 병도 괴로움이다. 싫어하는 것과 만남도, 사랑하는 것과 헤어짐도, 원하는 것을 얻지 못함도 모두 괴로움이다.',
      context: '붓다께서는 첫 가르침에서 고통을 부정하거나 외면하지 않으셨습니다. "고통이 있다"는 진실을 정면으로 선언하셨습니다. 아프다면 그 아픔을 있는 그대로 바라보십시오. 직면하는 것이 수행의 첫 걸음입니다.',
      tags: [],
    },
  ],
  benedicto: [
    {
      quote: 'Dominus regit me, et nihil mihi deerit. In loco pascuae ibi me collocavit; super aquam refectionis educavit me.',
      source: '시편(Psalms) 23:1-2 — 라틴어 불가타(Vulgata)',
      translation: '주님은 나의 목자, 나는 아무것도 부족하지 않으리라. 그분은 나를 풀밭에 쉬게 하시고, 잔잔한 물가로 이끄신다.',
      context: '목자는 양을 다그치지 않습니다. 그저 앞에서 걸으며, 쉬어야 할 곳에서 먼저 멈춥니다. 지금 당신이 지쳐있다면, 그것은 쉬어야 할 때라는 신호입니다. 모든 것을 혼자 감당하지 않아도 됩니다.',
      tags: [],
    },
    {
      quote: 'Noli timere, quia ego redemi te, et vocavi te nomine tuo: meus es tu.',
      source: '이사야서(Isaias) 43:1 — 라틴어 불가타(Vulgata)',
      translation: '두려워하지 말라. 내가 너를 구원하였다. 내가 너를 이름으로 불렀다. 너는 나의 것이다.',
      context: '당신은 이름으로 불리는 존재입니다. 군중 속의 하나가 아니라, 알려지고 사랑받는 고유한 존재입니다. 세상이 당신을 지워버리는 것 같을 때, 이 말을 기억하십시오. 너는 나의 것이다.',
      tags: [],
    },
    {
      quote: 'Caritas patiens est, benigna est; caritas non aemulatur, non agit perperam, non inflatur. Caritas numquam excidit.',
      source: '고린도전서(1 Corinthians) 13:4,8 — 라틴어 불가타(Vulgata)',
      translation: '사랑은 오래 참고 친절합니다. 사랑은 시기하지 않고 교만하지 않습니다. 사랑은 결코 없어지지 않습니다.',
      context: '바울이 말하는 사랑의 첫 번째 속성은 "오래 참음"입니다. 사랑은 폭발하는 감정이 아니라, 긴 인내와 친절함 속에서 자랍니다. 지금 누군가의 곁에 아무 말 없이 머물러 줄 수 있다면, 그것이 이미 사랑입니다.',
      tags: [],
    },
    {
      quote: 'Fecisti nos ad Te, et inquietum est cor nostrum, donec requiescat in Te.',
      source: '아우구스티누스(Aurelius Augustinus) 『고백록(Confessiones)』 제1권 제1장',
      translation: '당신은 우리를 당신을 향해 지으셨기에, 우리 마음은 당신 안에서 쉴 때까지 쉬지 못합니다.',
      context: '무엇을 가져도 채워지지 않는 허전함이 있다면, 그것을 결핍으로 보지 마십시오. 아우구스티누스는 그 불만족이 인간의 가장 깊은 갈망, 무한을 향한 방향감각이라 했습니다. 그 공허함은 더 깊은 곳을 향한 초대입니다.',
      tags: [],
    },
  ],
  theodore: [
    {
      quote: 'The unexamined life is not worth living.',
      source: '플라톤(Platon) 『소크라테스의 변론(Apologia)』 38a',
      translation: '검증되지 않은 삶은 살 가치가 없다.',
      context: '소크라테스는 사형 선고를 받는 그 자리에서도 철학을 포기하지 않았다. 그에게 생존보다 중요한 것은, 자신이 어떻게 살고 있는지를 끊임없이 묻는 일이었다. 당신의 삶은 지금 어떤 질문 위에 서 있는가?',
      tags: [],
    },
    {
      quote: 'Of things, some are in our power, and others are not. In our power are opinion, movement towards a thing, desire, aversion.',
      source: '에픽테토스(Epictetus) 『엔케이리디온(Enchiridion)』 제1장',
      translation: '어떤 것들은 우리의 힘 안에 있고, 어떤 것들은 그렇지 않다. 우리 힘 안에 있는 것은 판단, 충동, 욕망, 혐오다.',
      context: '노예였던 에픽테토스는 몸의 자유를 빼앗겨도 마음의 자유만큼은 지켰다. 지금 당신을 괴롭히는 것이 당신의 힘 안에 있는 것인지, 밖에 있는 것인지 먼저 물어라. 통제할 수 없는 것에 에너지를 쏟는 것, 그것이 고통의 원천이다.',
      tags: [],
    },
    {
      quote: 'Ita fac, mi Lucili: vindica te tibi. Collige itaque et serva tempus, quod adhuc aut auferebatur aut subripiebatur aut excidebat.',
      source: '세네카(Seneca) 『루킬리우스에게 보내는 편지(Epistulae Morales)』 제1서',
      translation: '그대여, 그대를 그대에게 되찾아 주십시오. 지금까지 빼앗기고 낭비되고 흘러가버린 시간을 모아 간직하십시오.',
      context: '세네카가 가장 두려워한 낭비는 돈이나 물건이 아니었다. 시간이었다. 우리는 돈의 낭비에는 민감하면서, 가장 되돌릴 수 없는 것인 시간만큼은 무심히 흘려보낸다. 오늘, 당신의 시간은 당신에게 속해 있는가?',
      tags: [],
    },
    {
      quote: 'The impediment to action advances action. What stands in the way becomes the way.',
      source: '마르쿠스 아우렐리우스(Marcus Aurelius) 『명상록(Meditations)』 5:20',
      translation: '행동을 가로막는 것이 행동을 전진시킨다. 길을 막는 것이 곧 길이 된다.',
      context: '황제였던 마르쿠스는 이 말을 자신에게 되뇌며 전쟁터와 역병과 제국의 무게를 견뎌냈다. 막아서는 것들이 있다면, 그것이 오히려 전진의 재료임을 잊지 말라. 장애물이 곧 길이다.',
      tags: [],
    },
  ],
  yeonam: [
    {
      quote: '學而時習之，不亦說乎。有朋自遠方來，不亦樂乎。人不知而不慍，不亦君子乎。',
      source: '논어(論語) 학이편(學而篇) 1:1 — 공자(孔子)',
      translation: '배우고 때때로 그것을 익히니 또한 기쁘지 아니한가. 벗이 먼 곳에서 찾아오니 또한 즐겁지 아니한가. 남이 알아주지 않아도 노여워하지 않으니 또한 군자가 아니겠는가.',
      context: '공자는 논어를 이 말로 시작했습니다. 배움의 기쁨은 남이 알아주는 데 있지 않습니다. 아무도 인정해 주지 않아도 흔들리지 않는 것, 그것이 군자의 마음이라 했습니다. 당신의 공부는 지금 누구를 위한 것입니까?',
      tags: [],
    },
    {
      quote: '惻隱之心，仁之端也。羞惡之心，義之端也。辭讓之心，禮之端也。是非之心，智之端也。',
      source: '맹자(孟子) 공손추편(公孫丑篇) 상 2:6',
      translation: '측은히 여기는 마음은 인(仁)의 단서요, 부끄러워하는 마음은 의(義)의 단서요, 사양하는 마음은 예(禮)의 단서요, 옳고 그름을 아는 마음은 지(智)의 단서다.',
      context: '맹자는 도덕적 능력이 외부에서 주입되는 것이 아니라, 이미 우리 안에 씨앗으로 있다고 했습니다. 다른 이의 아픔을 보고 마음이 움직였다면, 그것이 바로 당신 안의 인(仁)입니다. 본성은 잃어버리는 것이 아니라, 다만 가려지는 것입니다.',
      tags: [],
    },
    {
      quote: '知人者智，自知者明。勝人者有力，自勝者強。',
      source: '노자(老子) 『도덕경(道德經)』 33장',
      translation: '남을 아는 자는 지혜롭고, 자기를 아는 자는 밝다. 남을 이기는 자는 힘이 있고, 자기를 이기는 자는 강하다.',
      context: '노자는 묻습니다. 남과의 싸움에서 이기는 것과, 자기 자신을 이기는 것 중 어느 것이 더 어렵습니까. 진정한 강함은 바깥을 향하지 않습니다. 자기 안을 향합니다.',
      tags: [],
    },
    {
      quote: '天命之謂性，率性之謂道，修道之謂敎。道也者，不可須臾離也，可離，非道也。',
      source: '중용(中庸) 제1장 — 자사(子思)',
      translation: '하늘이 명한 것을 성(性)이라 하고, 성을 따르는 것을 도(道)라 하며, 도를 닦는 것을 교(敎)라 한다. 도는 잠시도 떠날 수 없는 것이니, 떠날 수 있다면 도가 아니다.',
      context: '중용은 하늘이 부여한 본성을 따르는 것이 도(道)라 했습니다. 지금의 삶이 본래 자신의 모습과 얼마나 가까운지, 한 번쯤 물어보시기 바랍니다. 수양은 멀리 있지 않습니다. 자신에게로 돌아가는 것입니다.',
      tags: [],
    },
  ],
};

// ── 지식 생성 (Firebase Function 호출) ───────────────────────────────────────

export async function generateDailyKnowledge(mentorId: MentorId): Promise<KnowledgeEntry[]> {
  const fn = httpsCallable<{ mentorId: MentorId }, KnowledgeEntry[]>(
    functions, 'generateKnowledge'
  );
  const result = await fn({ mentorId });
  return result.data;
}

// ── Firestore 저장 / 조회 ─────────────────────────────────────────────────────

export async function saveKnowledgeEntries(
  mentorId: MentorId,
  entries: KnowledgeEntry[],
  period?: 'am' | 'pm'
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const p = period ?? getPeriod();
  await setDoc(doc(db, 'mentor_knowledge', `${mentorId}_${today}_${p}`), {
    mentorId,
    date: today,
    period: p,
    entries,
    generatedAt: serverTimestamp(),
  });
}

// 오늘 특정 멘토의 지식 — 현재 시간대 → 반대 시간대 → 구형 키 → 최근 7일 → 내장 fallback
export async function getTodayKnowledge(
  mentorId: MentorId
): Promise<KnowledgeEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const period = getPeriod();
  const other = period === 'am' ? 'pm' : 'am';

  // 현재 시간대 먼저
  for (const key of [
    `${mentorId}_${today}_${period}`,
    `${mentorId}_${today}_${other}`,
    `${mentorId}_${today}`, // 구형 키 호환
  ]) {
    try {
      const snap = await getDoc(doc(db, 'mentor_knowledge', key));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.entries) && data.entries.length > 0)
          return data.entries as KnowledgeEntry[];
      }
    } catch {}
  }

  // 최근 7일 fallback
  for (let i = 1; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    for (const suffix of [`_am`, `_pm`, ``]) {
      try {
        const snap = await getDoc(doc(db, 'mentor_knowledge', `${mentorId}_${dateStr}${suffix}`));
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.entries) && data.entries.length > 0)
            return data.entries as KnowledgeEntry[];
        }
      } catch {}
    }
  }

  // 내장 fallback
  const fallback = FALLBACK[mentorId];
  try { await saveKnowledgeEntries(mentorId, fallback); } catch {}
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

// ── 강제 재생성 ───────────────────────────────────────────────────────────────

export async function forceRegenerateKnowledge(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const mentors: MentorId[] = ['hyewoon', 'benedicto', 'theodore', 'yeonam'];

  // 오늘 잠금 및 지식 문서 모두 삭제
  for (const period of ['am', 'pm']) {
    try { await deleteDoc(doc(db, 'meta', `knowledge_${today}_${period}`)); } catch {}
    for (const mentorId of mentors) {
      try { await deleteDoc(doc(db, 'mentor_knowledge', `${mentorId}_${today}_${period}`)); } catch {}
    }
  }
  // 구형 키도 삭제
  try { await deleteDoc(doc(db, 'meta', `knowledge_${today}`)); } catch {}
  for (const mentorId of mentors) {
    try { await deleteDoc(doc(db, 'mentor_knowledge', `${mentorId}_${today}`)); } catch {}
  }

  await triggerDailyKnowledgeGeneration();
}

// ── 자정/정오 자동 생성 트리거 ───────────────────────────────────────────────
// 앱 로드 시 현재 시간대(am/pm)에 처음 실행되는 경우에만 생성 (Firestore 잠금으로 중복 방지)

export async function triggerDailyKnowledgeGeneration(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const period = getPeriod();
  const lockRef = doc(db, 'meta', `knowledge_${today}_${period}`);

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
            doc(db, 'mentor_knowledge', `${mentorId}_${today}_${period}`)
          );
          if (existing.exists()) return; // 이미 있으면 skip

          const entries = await generateDailyKnowledge(mentorId);
          await saveKnowledgeEntries(mentorId, entries, period);
          console.log(`[Knowledge] ${mentorId} ${period} — ${entries.length}개 생성 완료`);
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
