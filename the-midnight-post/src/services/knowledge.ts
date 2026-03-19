import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp,
  collection, query, where, orderBy, limit, getDocs,
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
      quote: '諸行無常，是生滅法；生滅滅已，寂滅爲樂。',
      source: '대반열반경(大般涅槃經, Mahāparinibbāna Sutta) — 열반 직전 최후 설법',
      translation: '모든 현상은 무상하고, 그것은 생멸하는 법이다. 생멸이 다하고 나면, 고요한 열반이 곧 즐거움이다.',
      context: '붓다께서는 마지막 숨을 거두기 전 이 게송을 남기셨습니다. 붙잡으려 할수록 더 빠르게 빠져나가는 것들이 있습니다. 사람도, 감정도, 한때의 행복도 그러합니다. 변한다는 것을 받아들이는 순간, 비로소 집착이 느슨해지고 — 그 자리에 고요함이 깃듭니다.',
      tags: [],
    },
    {
      quote: '心不孤起，托境方生。道不虛行，遇緣即應。',
      source: '화엄경(華嚴經) 야마천궁게찬품(夜摩天宮偈讚品)',
      translation: '마음은 홀로 일어나지 않고 경계를 의지하여 생겨난다. 도는 헛되이 행해지지 않으며 인연을 만나면 바로 응한다.',
      context: '지금 마음이 흔들린다면, 그 흔들림을 일으킨 인연이 있을 것입니다. 탓할 것도, 자책할 것도 없습니다. 조건이 갖추어질 때 생겨나고 조건이 다하면 사라지는 것이 마음의 성품입니다. 지금의 고통도 그러하니, 이 인연이 다할 때까지 다만 함께 머무십시오.',
      tags: [],
    },
    {
      quote: '若人靜坐一須臾，勝造恒沙七寶塔。',
      source: '원각경(圓覺經) 보안보살장(普眼菩薩章)',
      translation: '만약 어떤 사람이 잠시 고요히 앉는다면, 항하의 모래 수만큼 칠보탑을 짓는 것보다 낫다.',
      context: '참선에서 중요한 것은 얼마나 오래 앉았느냐가 아닙니다. 단 한 번의 온전한 고요함이, 그 어떤 외적 공덕보다 깊습니다. 일체의 판단을 내려놓고, 오늘 단 5분만이라도 아무것도 하지 않고 그냥 앉아보십시오. 그것으로 충분합니다.',
      tags: [],
    },
    {
      quote: '愛欲生憂惱，愛欲生恐懼。離愛欲，無憂惱，何處有恐懼？',
      source: '법구경(法句經, Dhammapada) 애욕품(愛欲品) 제214게',
      translation: '애욕이 있으면 슬픔이 생기고, 애욕이 있으면 두려움이 생긴다. 애욕에서 벗어나면 슬픔도 없는데, 어디에 두려움이 있겠는가.',
      context: '이 가르침은 사랑하지 말라는 뜻이 아닙니다. 집착 — 잡으면 잡을수록 더 떠날까봐 두려워지는 그 마음에 대해 이야기하는 것입니다. 사람을 사랑하되 그 사람이 반드시 내 곁에 있어야 한다는 생각에서 조금씩 자유로워질 수 있다면, 사랑은 더 가볍고 더 오래 갑니다.',
      tags: [],
    },
  ],
  benedicto: [
    {
      quote: 'Pone me ut signaculum super cor tuum, quia fortis est ut mors dilectio, dura sicut infernus aemulatio.',
      source: '아가(Canticum Canticorum) 8:6 — 라틴어 불가타(Vulgata)',
      translation: '나를 그대의 심장 위에 인장처럼 새겨다오. 사랑은 죽음처럼 강하고, 그 열망은 저승처럼 집요하다.',
      context: '성경에서 가장 인간적인 책이 아가(雅歌)입니다. 하느님의 말씀이 뜨거운 인간의 사랑을 그대로 담았습니다. 누군가를 진심으로 사랑했거나, 사랑하고 있거나, 사랑을 잃었다면 — 그 마음은 하느님께서 주신 가장 거룩한 것입니다. 사랑의 아픔을 부끄러워하지 마십시오.',
      tags: [],
    },
    {
      quote: 'Vide humilitatem meam et laborem meum, et dimitte universa delicta mea.',
      source: '시편(Psalms) 25:18 — 라틴어 불가타(Vulgata)',
      translation: '저의 비천함과 수고를 굽어보시고, 저의 모든 죄를 용서하여 주소서.',
      context: '다윗은 왕이었지만 이런 기도를 드렸습니다. 아무것도 숨기지 않고, 가장 낮고 지친 자신의 모습을 그대로 들어올렸습니다. 기도란 완벽한 말이 아니어도 됩니다. 지금 당신의 무너진 모습 그대로, 그냥 가져가십시오. 그것이 가장 솔직한 기도입니다.',
      tags: [],
    },
    {
      quote: 'Deus refugium nostrum et virtus, adiutor in tribulationibus quae invenerunt nos nimis.',
      source: '시편(Psalms) 46:1 — 라틴어 불가타(Vulgata)',
      translation: '하느님은 우리의 피난처요 힘이시니, 우리를 덮친 환난 속에서 도움이 되어 주십니다.',
      context: '이 시편은 전쟁과 재앙을 목격한 사람이 쓴 것입니다. 그러나 그는 두려움 한복판에서도 "하느님은 피난처"라고 노래했습니다. 믿음이란 현실의 고통을 부정하는 것이 아닙니다. 고통 한가운데서도 기댈 수 있는 어딘가가 있다는 것을 아는 것, 그것이 믿음입니다.',
      tags: [],
    },
    {
      quote: 'Fecisti nos ad Te, et inquietum est cor nostrum, donec requiescat in Te.',
      source: '아우구스티누스(Aurelius Augustinus) 『고백록(Confessiones)』 제1권 제1장',
      translation: '당신은 우리를 당신을 향해 지으셨기에, 우리 마음은 당신 안에서 쉴 때까지 쉬지 못합니다.',
      context: '아우구스티누스는 방탕한 세월을 보낸 뒤 이 말을 썼습니다. 무엇을 가져도 채워지지 않는 허전함이 있다면, 그것을 결핍으로 보지 마십시오. 그 불만족은 인간의 가장 깊은 갈망, 더 큰 무언가를 향한 방향감각입니다. 그 공허함은 더 깊은 곳으로 향하는 초대입니다.',
      tags: [],
    },
  ],
  theodore: [
    {
      quote: 'Was mich nicht umbringt, macht mich stärker.',
      source: '프리드리히 니체(Friedrich Nietzsche) 『우상의 황혼(Götzen-Dämmerung)』 — "격언과 화살" 8',
      translation: '나를 죽이지 못하는 것은 나를 강하게 만든다.',
      context: '니체는 이것을 추상적 위로로 쓴 것이 아니다. 그는 평생 극심한 편두통과 병마를 안고 살면서 이것을 썼다. 고통이 당신을 부수지 못했다면, 그것은 이미 당신의 일부가 되었다. 무엇이 남아 있는지 살펴보라. 그 안에 이미 강함이 있다.',
      tags: [],
    },
    {
      quote: 'Omnia aliena sunt, tempus tantum nostrum est.',
      source: '세네카(Lucius Annaeus Seneca) 『루킬리우스에게 보내는 편지(Epistulae Morales ad Lucilium)』 제1서',
      translation: '모든 것은 타인의 것이다. 오직 시간만이 우리 것이다.',
      context: '세네카는 제국의 권력자였음에도 이것을 깨달았다. 재물도 명예도 지위도 빼앗길 수 있지만, 지금 이 순간을 어떻게 쓰느냐만큼은 온전히 당신의 것이다. 가장 가난한 사람도, 오늘 하루만큼은 같은 양의 시간을 갖는다.',
      tags: [],
    },
    {
      quote: 'Plus enim nos terrent imaginaria quam vera.',
      source: '세네카(Lucius Annaeus Seneca) 『루킬리우스에게 보내는 편지(Epistulae Morales ad Lucilium)』 제13서',
      translation: '우리를 두렵게 하는 것은 현실보다 상상이 더 크다.',
      context: '두려움의 대부분은 실제로 일어난 일이 아니라, 일어날지도 모른다는 생각에서 온다. 지금 당신을 괴롭히는 것이 실재하는 것인지, 아니면 마음이 만들어낸 시나리오인지 구분해보라. 생각과 현실을 같은 것으로 취급하는 순간부터 고통은 배가된다.',
      tags: [],
    },
    {
      quote: 'Man is condemned to be free; because once thrown into the world, he is responsible for everything he does.',
      source: '장폴 사르트르(Jean-Paul Sartre) 『실존주의는 휴머니즘이다(L\'Existentialisme est un humanisme)』',
      translation: '인간은 자유롭도록 선고받았다. 세상에 내던져진 이상, 자신이 하는 모든 것에 책임을 진다.',
      context: '사르트르의 이 말은 무거운 선고처럼 들리지만, 사실은 인간에 대한 최고의 존엄 선언이다. 당신은 선택할 수 있다. 그 선택이 두렵다면, 그것은 선택의 무게를 아는 사람이라는 뜻이다. 자유는 짐이기도 하지만, 동시에 유일한 가능성이다.',
      tags: [],
    },
  ],
  yeonam: [
    {
      quote: '君子和而不同，小人同而不和。',
      source: '논어(論語) 자로편(子路篇) 13:23 — 공자(孔子)',
      translation: '군자는 화합하되 같아지지 않고, 소인은 같아지되 화합하지 못한다.',
      context: '다름을 인정하는 것이 진정한 화합이요, 겉으로 동조하는 것은 화합이 아닙니다. 남과 생각이 달라 불편하거나, 쉬이 동조하지 못하는 자신이 불편하다면, 그것은 당신 안에 지조가 있다는 뜻이기도 합니다. 군자의 길이란 쉽지 않으나, 그것이 바른 길입니다.',
      tags: [],
    },
    {
      quote: '曲則全，枉則直，窪則盈，弊則新。',
      source: '노자(老子) 『도덕경(道德經)』 22장',
      translation: '굽으면 온전해지고, 구부러지면 곧아지며, 낮아지면 차오르고, 낡으면 새로워진다.',
      context: '낮은 곳이 채워지는 법이요, 낡음이 새로움의 시작입니다. 지금의 자리가 낮고 고달프다면, 그것이 오히려 채워질 자리가 마련되는 때임을 기억하십시오. 억지로 펴려 하면 더 구부러지나니, 때로는 구부러진 채로 걸어가는 것이 지혜입니다.',
      tags: [],
    },
    {
      quote: '知人者智，自知者明。勝人者有力，自勝者強。',
      source: '노자(老子) 『도덕경(道德經)』 33장',
      translation: '남을 아는 자는 지혜롭고, 자기를 아는 자는 밝다. 남을 이기는 자는 힘이 있고, 자기를 이기는 자는 강하다.',
      context: '남과의 싸움에서 이기는 것과 자기 자신을 이기는 것, 어느 쪽이 더 어렵습니까. 진정한 강함은 바깥을 향하지 않습니다. 자기 안을 향합니다. 오늘 하루 남보다 앞서는 것보다, 어제의 자신보다 조금 더 솔직해지는 것이 더 깊은 공부입니다.',
      tags: [],
    },
    {
      quote: '天命之謂性，率性之謂道，修道之謂敎。道也者，不可須臾離也，可離，非道也。',
      source: '중용(中庸) 제1장 — 자사(子思)',
      translation: '하늘이 명한 것을 성(性)이라 하고, 성을 따르는 것을 도(道)라 하며, 도를 닦는 것을 교(敎)라 한다. 도는 잠시도 떠날 수 없으니, 떠날 수 있다면 도가 아니다.',
      context: '자사는 도(道)란 거창한 것이 아니라, 자신의 본성을 따르는 것이라 했습니다. 지금의 삶이 본래 자신과 얼마나 가까운지, 한 번쯤 물어보시기 바랍니다. 수양은 멀리 있지 않습니다. 자신에게로 돌아가는 것, 그것이 곧 배움입니다.',
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

const ALL_SUFFIXES = ['_h22', '_h17', '_h12', '_h08', '_am', '_pm', ''] as const;

// 오늘 특정 멘토의 지식 — 오늘 모든 슬롯 → 최근 3일 → 내장 fallback
export async function getTodayKnowledge(
  mentorId: MentorId
): Promise<KnowledgeEntry[]> {
  // 오늘 + 최근 3일
  for (let i = 0; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    for (const suffix of ALL_SUFFIXES) {
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

// 임의 구절 조회 헬퍼 (randomOrder 필드 활용)
async function getRandomQuotes(collectionName: string, mentorId: MentorId, count: number): Promise<KnowledgeEntry[]> {
  try {
    const randomVal = Math.random();
    let snap = await getDocs(query(
      collection(db, collectionName),
      where('mentorId', '==', mentorId),
      where('randomOrder', '>=', randomVal),
      orderBy('randomOrder'),
      limit(count),
    ));
    if (snap.empty) {
      snap = await getDocs(query(
        collection(db, collectionName),
        where('mentorId', '==', mentorId),
        orderBy('randomOrder'),
        limit(count),
      ));
    }
    const entries: KnowledgeEntry[] = [];
    snap.forEach(d => {
      const data = d.data();
      entries.push({ quote: data.quote, source: data.source, translation: data.translation, context: data.context, tags: data.tags ?? [] });
    });
    return entries;
  } catch {
    return [];
  }
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
    for (const suffix of ['_h08', '_h12', '_h17', '_h22', '_am', '_pm', '']) {
      try {
        const snap = await getDoc(doc(db, 'mentor_knowledge', `${mentorId}_${dateStr}${suffix}`));
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.entries)) allEntries.push(...data.entries);
        }
      } catch {
        // 해당 날짜 데이터 없으면 skip
      }
    }
  }


  // 불교 경전 구절 보충 (혜운)
  if (mentorId === 'hyewoon') {
    const buddhistEntries = await getRandomQuotes('buddhist_quotes', mentorId, 2);
    allEntries.push(...buddhistEntries);
  }

  return allEntries;
}

// ── 강제 재생성 ───────────────────────────────────────────────────────────────

export async function forceRegenerateKnowledge(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const mentors: MentorId[] = ['hyewoon', 'benedicto', 'theodore', 'yeonam'];

  // 오늘 잠금 및 지식 문서 모두 삭제 (모든 슬롯 포함)
  for (const suffix of ALL_SUFFIXES) {
    const period = suffix.slice(1); // '_h08' → 'h08'
    if (suffix !== '') {
      try { await deleteDoc(doc(db, 'meta', `knowledge_${today}_${period}`)); } catch {}
    }
    for (const mentorId of mentors) {
      try { await deleteDoc(doc(db, 'mentor_knowledge', `${mentorId}_${today}${suffix}`)); } catch {}
    }
  }
  // 구형 키 (suffix === '')
  try { await deleteDoc(doc(db, 'meta', `knowledge_${today}`)); } catch {}

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
