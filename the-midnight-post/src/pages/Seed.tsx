/**
 * /seed — 멘토 지식 데이터 초기 적재 페이지
 * 로그인된 상태로 방문하면 오늘 날짜의 예시 지혜를 Firestore에 저장합니다.
 * 데이터가 이미 있으면 덮어쓰지 않습니다.
 */
import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { saveKnowledgeEntries, forceRegenerateKnowledge, KnowledgeEntry } from '../services/knowledge';
import { useAuth } from '../components/AuthContext';
import AdminPromptEditor from '../components/AdminPromptEditor';

type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';

// ── 예시 지혜 데이터 ─────────────────────────────────────────────────────────

const SEED_DATA: Record<MentorId, KnowledgeEntry[]> = {
  hyewoon: [
    {
      quote: '마음이 모든 것에 선행한다. 청정한 마음으로 말하거나 행하면, 그림자가 따르듯 행복이 뒤따른다.',
      source: '법구경(法句經) 제1품 쌍품',
      translation: '우리의 고통과 기쁨은 모두 마음에서 비롯된다. 지금 이 순간의 마음 상태가 다음 순간의 현실을 만든다.',
      context: '자신을 끊임없이 자책하거나 부정적인 생각의 소용돌이에 빠진 분에게, 그 흐름을 바꿀 수 있는 것도 바로 자신의 마음임을 일깨워줄 때 씁니다.',
      tags: ['자기비판', '불안', '마음챙김'],
    },
    {
      quote: '생각은 사실이 아니다. 생각은 다만 생각일 뿐이다.',
      source: '존 카밧진 『마음챙김 명상과 자기치유』',
      translation: '우리는 종종 "나는 실패자야"라는 생각을 사실인 것처럼 믿는다. 하지만 생각은 마음이 만들어낸 이야기일 뿐, 현실 그 자체가 아니다.',
      context: '부정적인 자기 생각에 사로잡혀 그것이 진실이라고 믿는 분에게, 생각과 자신 사이에 거리를 두는 법을 안내할 때 씁니다.',
      tags: ['자기비판', '불안', '인지'],
    },
    {
      quote: '집착이 고통의 뿌리다. 그러나 내려놓는 것은 버리는 것이 아니라, 있는 그대로 바라보는 것이다.',
      source: '앙굿타라 니카야(Aṅguttara Nikāya) 제3권',
      translation: '사랑하는 사람, 이루고 싶은 꿈, 과거의 자신에 대한 집착이 우리를 힘들게 한다. 내려놓음은 포기가 아니라 더 넓은 시야로 보는 연습이다.',
      context: '이별, 실패, 상실 뒤에도 놓아주지 못해 괴로운 분에게, 집착과 수용 사이의 균형을 찾도록 도울 때 씁니다.',
      tags: ['집착', '이별', '내려놓기'],
    },
    {
      quote: '자비(慈悲)는 남에게 베푸는 것이기 전에, 먼저 자신에게 향하는 것이다.',
      source: '자타카(Jātaka) 및 불교 자비명상(慈悲冥想) 전통',
      translation: '많은 이들이 타인에게는 자비롭지만 자신에게는 가혹하다. 스스로를 돌보는 것은 이기심이 아니라 진정한 자비의 시작이다.',
      context: '항상 남을 먼저 챙기느라 정작 자신은 지쳐 있는 분에게, 자기 자신에 대한 따뜻한 시선을 돌려드릴 때 씁니다.',
      tags: ['자기수용', '번아웃', '자기돌봄'],
    },
  ],

  benedicto: [
    {
      quote: '여호와는 마음이 상한 자를 가까이 하시고 중심에 통회하는 자를 구원하시는도다.',
      source: '시편 34:18',
      translation: '하느님은 완벽한 사람 곁에 있는 것이 아니라, 상처받고 무너진 사람 바로 곁에 계신다.',
      context: '스스로 너무 망가졌다고 느끼거나, "이런 나를 신이 사랑할 수 있을까" 의심할 때 씁니다.',
      tags: ['상실', '외로움', '위로'],
    },
    {
      quote: '당신은 당신이 하는 것이 아니다. 당신은 사랑받는 사람이다.',
      source: '헨리 나우웬 『집으로 돌아가는 길(The Return of the Prodigal Son)』',
      translation: '우리의 가치는 성취나 능력, 소유에 있지 않다. 있는 그대로 사랑받는 존재라는 것, 그것이 우리 정체성의 가장 깊은 뿌리다.',
      context: '실패 후 자존감이 무너지거나, 성과 위주의 삶에 지쳐 "나는 쓸모없는 존재가 아닌가" 느끼는 분에게 씁니다.',
      tags: ['자기비판', '자존감', '수용'],
    },
    {
      quote: '어두운 밤을 지날 때, 그 어둠이 사실은 더 깊은 빛으로 인도하는 통로다.',
      source: '십자가의 요한 『영혼의 어두운 밤(Noche Oscura del Alma)』',
      translation: '신앙의 위기, 삶의 암흑기는 파괴가 아니라 변화의 시작이다. 빛이 사라진 것처럼 보이는 그 순간이 더 깊은 곳으로 들어가는 문이다.',
      context: '믿음이 흔들리거나, 오랫동안 기도해도 응답이 없다고 느껴 막막한 분에게 씁니다.',
      tags: ['신앙의 위기', '고통', '변화'],
    },
    {
      quote: '우리 마음은 당신 안에서 안식을 얻기까지 쉬지 못합니다.',
      source: '아우구스티누스 『고백록(Confessiones)』 1권 1장',
      translation: '우리 마음에는 무언가로도 채워지지 않는 빈자리가 있다. 그 불만족과 갈망은 결함이 아니라, 더 깊은 곳을 향한 초대다.',
      context: '아무리 가져도 채워지지 않는 공허함, 성공해도 기쁘지 않은 느낌을 호소하는 분에게 씁니다.',
      tags: ['공허함', '의미', '갈망'],
    },
  ],

  theodore: [
    {
      quote: '어떤 것들은 우리 힘 안에 있고, 어떤 것들은 그렇지 않다. 우리 힘 안에 있는 것은 의견, 충동, 욕망, 혐오다.',
      source: '에픽테토스 『엔케이리디온(Enchiridion)』 제1장',
      translation: '모든 고통의 뿌리는 통제할 수 없는 것을 통제하려는 시도에서 온다. 자신이 바꿀 수 있는 것에만 에너지를 쏟는 것이 지혜의 시작이다.',
      context: '다른 사람의 반응, 결과, 과거 사건에 대한 집착으로 괴로운 분에게, 내가 통제할 수 있는 것과 없는 것을 구분하도록 안내할 때 씁니다.',
      tags: ['불안', '통제', '내려놓기'],
    },
    {
      quote: '모든 것을 빼앗겨도 빼앗길 수 없는 마지막 자유가 있다 — 어떤 상황에서 어떤 태도를 취할 것인가를 선택하는 자유.',
      source: '빅터 프랭클 『죽음의 수용소에서(Man\'s Search for Meaning)』',
      translation: '아우슈비츠에서도 인간의 존엄은 빼앗길 수 없었다. 상황이 아무리 나빠도 그것을 어떻게 받아들일지는 내가 선택할 수 있다.',
      context: '도저히 바꿀 수 없는 상황 — 질병, 상실, 불공평한 현실 — 앞에서 무력감을 느끼는 분에게 씁니다.',
      tags: ['상실', '무력감', '의미'],
    },
    {
      quote: '당신이 잃었다고 슬퍼하는 것들을, 한 번도 가진 적이 없었다면 어떠했겠는가. 자연은 빌려준 것을 돌려달라 할 뿐이다.',
      source: '세네카 『루킬리우스에게 보내는 편지(Epistulae Morales)』 제99서',
      translation: '슬픔은 자연스러운 것이다. 하지만 한때 가졌던 것에 대한 감사가 상실의 고통과 함께할 수 있다면, 슬픔의 성질이 달라진다.',
      context: '사랑하는 사람을 잃거나 소중한 것을 잃어 깊은 슬픔에 잠긴 분에게 씁니다.',
      tags: ['상실', '애도', '감사'],
    },
    {
      quote: '지금 이 순간을 마치 마지막으로 하는 일인 것처럼 살라.',
      source: '마르쿠스 아우렐리우스 『명상록(Meditations)』 2:5',
      translation: '과거의 후회와 미래의 불안 사이에서 삶이 허비된다. 지금 이 순간, 지금 이 행동에 완전히 존재하는 것이 황제가 스스로에게 내린 처방이었다.',
      context: '미루고 있거나, 과거와 미래 사이에서 현재를 살지 못하는 분에게 씁니다.',
      tags: ['미루기', '현재', '집중'],
    },
  ],

  yeonam: [
    {
      quote: '吾日三省吾身 — 나는 매일 세 가지로 자신을 살핀다: 충성스러웠는가, 신의가 있었는가, 배운 것을 익혔는가.',
      source: '논어(論語) 학이편(學而篇) 1:4, 증자(曾子)',
      translation: '하루를 마치며 결과가 아닌 태도를 점검하는 성찰. 잘못을 탓하기 위해서가 아니라, 더 나은 하루를 위한 조용한 물음이다.',
      context: '하루하루 잘 살고 있는지 불안해하거나, 자신이 나쁜 사람인가 걱정하는 분에게 씁니다.',
      tags: ['자기점검', '성찰', '불안'],
    },
    {
      quote: '울음이 터져 나오려 할 때 웃음을 지어보라. 웃다가 다시 울기도 하고, 울다가 웃음이 나오기도 한다. 이것이 인생이다.',
      source: '박지원(朴趾源) 『열하일기(熱河日記)』 호곡장론(好哭場論)',
      translation: '조선 최고의 문장가는 삶이 웃음과 울음의 경계에 있음을 알았다. 슬픔을 참는 것도, 억지로 웃는 것도 아닌, 그 경계를 자연스럽게 흐르는 것이 삶이다.',
      context: '감정을 억누르거나 "이런 것쯤은 아무것도 아니다"며 스스로를 몰아붙이는 분에게 씁니다.',
      tags: ['감정표현', '자기수용', '슬픔'],
    },
    {
      quote: '天下莫柔弱於水，而攻堅強者莫之能勝 — 천하에 물보다 부드러운 것은 없지만, 굳고 강한 것을 이기는 데 물보다 나은 것은 없다.',
      source: '노자(老子) 도덕경(道德經) 78장',
      translation: '강함이 항상 이기는 것이 아니다. 물은 어떤 그릇에도 담기고, 바위도 뚫어낸다. 유연함은 나약함이 아니라 가장 강한 힘이다.',
      context: '완벽하고 강해야 한다는 압박에 시달리거나, 부드러움을 나약함으로 여기는 분에게 씁니다.',
      tags: ['완벽주의', '유연성', '자기수용'],
    },
    {
      quote: '어부가 큰 새를 사랑한다면 고기를 주어야지, 자신이 좋아하는 음악을 연주해서는 안 된다.',
      source: '장자(莊子) 지락편(至樂篇)',
      translation: '진정한 돌봄은 상대방의 본성에 맞게 하는 것이다. 내가 옳다고 생각하는 것을 강요하는 사랑은 사랑이 아닐 수 있다.',
      context: '자녀나 파트너와의 관계에서 "내 사랑이 왜 통하지 않나" 답답해하는 분에게 씁니다.',
      tags: ['관계', '소통', '기대'],
    },
  ],
};

// ── Gutenberg 도서 목록 (Seed 페이지용) ─────────────────────────────────────

const GUTENBERG_CATALOG: { mentorId: string; bookId: number; title: string }[] = [
  { mentorId: 'benedicto', bookId: 3296, title: 'Confessions of Saint Augustine' },
  { mentorId: 'benedicto', bookId: 1653, title: 'The Imitation of Christ' },
  { mentorId: 'theodore',  bookId: 2680, title: 'Meditations — Marcus Aurelius' },
  { mentorId: 'theodore',  bookId: 4135, title: 'The Discourses of Epictetus' },
];

// ── 혜운 스님 불교 경전 수작업 큐레이션 데이터 ──────────────────────────────
// 출처: 법구경(法句經)·금강경·화엄경·선종 조사 어록 등 권위 있는 한역 원문
// ※ ABC 한글대장경(kabc.dongguk.edu)에서 원문 대조 권장

interface BuddhistQuoteEntry extends KnowledgeEntry { mentorId: 'hyewoon'; }

const BUDDHIST_CURATED: BuddhistQuoteEntry[] = [
  {
    mentorId: 'hyewoon',
    quote: '諸惡莫作，眾善奉行，自淨其意，是諸佛教。',
    source: '법구경(法句經) 술불품(述佛品) — 칠불통계게(七佛通誡偈)',
    translation: '모든 악은 짓지 말고, 모든 선은 받들어 행하며, 스스로 그 마음을 청정히 하라. 이것이 모든 부처님의 가르침이다.',
    context: '거창할 것 없습니다. 오늘 하루, 하나의 악을 멀리하고 하나의 선을 행하며 마음을 조금 더 맑게 하십시오. 그것으로 충분합니다.',
    tags: ['자기수양', '일상', '청정'],
  },
  {
    mentorId: 'hyewoon',
    quote: '菩提本無樹，明鏡亦非臺；本來無一物，何處惹塵埃？',
    source: '육조혜능(六祖慧能) 게송 — 육조단경(六祖壇經)',
    translation: '보리는 본래 나무가 없고, 밝은 거울도 받침대가 없다. 본래부터 아무것도 없으니, 어느 곳에 먼지가 끼겠는가.',
    context: '집착할 무언가를 찾지 마십시오. 본래부터 아무것도 없었으니, 더럽혀질 것도 없습니다. 텅 빔 속에서 오히려 자유로워집니다.',
    tags: ['집착', '내려놓기', '공(空)'],
  },
  {
    mentorId: 'hyewoon',
    quote: '此有故彼有，此生故彼生；此無故彼無，此滅故彼滅。',
    source: '잡아함경(雜阿含經) 연기법(緣起法) 게송',
    translation: '이것이 있으므로 저것이 있고, 이것이 생겨나므로 저것이 생겨난다. 이것이 없으므로 저것이 없고, 이것이 사라지므로 저것이 사라진다.',
    context: '지금의 고통도 조건에 의해 생겨난 것입니다. 조건이 다하면 사라집니다. 이 아픔이 영원하지 않음을 기억하십시오.',
    tags: ['무상', '고통', '연기'],
  },
  {
    mentorId: 'hyewoon',
    quote: '過去心不可得，現在心不可得，未來心不可得。',
    source: '금강반야바라밀경(金剛般若波羅蜜經) — 삼심불가득(三心不可得)',
    translation: '과거의 마음도 얻을 수 없고, 현재의 마음도 얻을 수 없으며, 미래의 마음도 얻을 수 없다.',
    context: '잡으려는 손을 잠시 내려놓으십시오. 과거도 미래도 붙잡을 수 없습니다. 그렇다면 지금 이 자리, 이 숨결만이 있습니다.',
    tags: ['집착', '현재', '내려놓기'],
  },
  {
    mentorId: 'hyewoon',
    quote: '凡所有相，皆是虛妄；若見諸相非相，則見如來。',
    source: '금강반야바라밀경(金剛般若波羅蜜經) 여리실견분(如理實見分)',
    translation: '모든 현상과 형상은 다 허망한 것이다. 모든 형상을 형상 아님으로 보면 곧 여래를 보게 된다.',
    context: '눈에 보이는 것, 손에 잡히는 것만이 전부가 아닙니다. 형상에 집착하지 않을 때 비로소 더 깊은 것이 보이기 시작합니다.',
    tags: ['집착', '공(空)', '지혜'],
  },
  {
    mentorId: 'hyewoon',
    quote: '千千爲敵，一夫勝之，未若自勝，爲戰中上。',
    source: '법구경(法句經) 천품(千品)',
    translation: '천 번의 싸움에서 천 명을 이긴다 해도, 자기 자신을 이기는 것만 못하니, 그것이 전쟁 중에서 으뜸이다.',
    context: '지금 당신이 맞서고 있는 것이 무엇인지 가만히 들여다보십시오. 진정한 용기는 자신 안에서 일어나는 싸움을 직면하는 것입니다.',
    tags: ['자기극복', '용기', '내면'],
  },
  {
    mentorId: 'hyewoon',
    quote: '觀身不淨，觀受是苦，觀心無常，觀法無我。',
    source: '대념처경(大念處經, Mahāsatipaṭṭhāna) — 사념처(四念處)',
    translation: '몸을 부정한 것으로 관찰하고, 느낌을 괴로움으로 관찰하고, 마음을 무상한 것으로 관찰하고, 법을 무아로 관찰하라.',
    context: '있는 그대로 바라보는 것이 수행의 시작입니다. 판단 없이 그저 지켜보십시오. 그것으로 이미 마음이 쉬기 시작합니다.',
    tags: ['마음챙김', '관찰', '사념처'],
  },
  {
    mentorId: 'hyewoon',
    quote: '若人欲了知，三世一切佛，應觀法界性，一切唯心造。',
    source: '대방광불화엄경(大方廣佛華嚴經) 야마천궁게찬품(夜摩天宮偈讚品)',
    translation: '만약 어떤 사람이 삼세의 모든 부처님을 알고자 한다면, 마땅히 법계의 성품을 관찰하라. 모든 것은 오직 마음이 만든 것이다.',
    context: '지금의 세계는 지금의 마음이 만들어낸 것입니다. 마음이 달라지면 세계도 달라집니다. 그 변화는 이 자리에서 시작됩니다.',
    tags: ['마음', '유심', '변화'],
  },
  {
    mentorId: 'hyewoon',
    quote: '是日已過，命亦隨減；如少水魚，斯有何樂？',
    source: '보현보살경계게(普賢菩薩警衆偈)',
    translation: '이 날이 이미 지나갔으니, 목숨도 따라 줄어든다. 물이 줄어드는 못의 물고기처럼, 여기에 무슨 즐거움이 있겠는가.',
    context: '무상함이 두렵지 않습니다. 오히려 이 순간이 얼마나 귀한지를 일깨워줍니다. 지금 이 숨결이 선물임을 기억하십시오.',
    tags: ['무상', '현재', '소중함'],
  },
  {
    mentorId: 'hyewoon',
    quote: '不患人之不己知，患其不能也。',
    source: '논어(論語) 헌문편(憲問篇) 14:32 — 공자(孔子)',
    translation: '남이 자신을 알아주지 않음을 걱정하지 말고, 자신의 능력이 부족함을 걱정하라.',
    context: '남의 시선보다 자신의 내면을 먼저 돌아보십시오. 인정받으려는 마음을 잠시 내려놓으면, 비로소 본래의 자리가 보입니다.',
    tags: ['인정욕구', '자기수양', '내면'],
  },
];

// ── Seed 페이지 ──────────────────────────────────────────────────────────────

export default function Seed() {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [regenStatus, setRegenStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [gutenbergStates, setGutenbergStates] = useState<Record<string, 'idle' | 'running' | 'done' | 'error'>>({});
  const [gutenbergLog, setGutenbergLog] = useState<string[]>([]);
  const [buddhistUploadStatus, setBuddhistUploadStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [buddhistLog, setBuddhistLog] = useState<string[]>([]);
  const [abcUrl, setAbcUrl] = useState('');
  const [abcSourceName, setAbcSourceName] = useState('');
  const [abcStatus, setAbcStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);
  const addGutenbergLog = (msg: string) => setGutenbergLog(prev => [...prev, msg]);
  const addBuddhistLog = (msg: string) => setBuddhistLog(prev => [...prev, msg]);

  const handleUploadBuddhistCurated = async () => {
    if (buddhistUploadStatus === 'running') return;
    setBuddhistUploadStatus('running');
    addBuddhistLog('수작업 불교 경전 데이터 업로드 시작...');
    let uploaded = 0;
    for (const entry of BUDDHIST_CURATED) {
      try {
        await addDoc(collection(db, 'buddhist_quotes'), {
          ...entry,
          randomOrder: Math.random(),
          createdAt: serverTimestamp(),
        });
        uploaded++;
      } catch (e) {
        addBuddhistLog(`✗ 오류: ${String(e)}`);
      }
    }
    addBuddhistLog(`✓ ${uploaded}/${BUDDHIST_CURATED.length}개 업로드 완료`);
    setBuddhistUploadStatus('done');
  };

  const handleIndexBuddhistCanon = async () => {
    if (!abcUrl.trim() || abcStatus === 'running') return;
    setAbcStatus('running');
    addBuddhistLog(`[ABC] "${abcSourceName || abcUrl}" 인덱싱 시작...`);
    try {
      const fn = httpsCallable<{ url: string; sourceName?: string }, { indexed: number }>(functions, 'indexBuddhistCanon');
      const result = await fn({ url: abcUrl.trim(), sourceName: abcSourceName.trim() || abcUrl.trim() });
      addBuddhistLog(`✓ [ABC] ${result.data.indexed}개 구절 저장 완료`);
      setAbcStatus('done');
    } catch (e) {
      addBuddhistLog(`✗ [ABC] 실패: ${String(e)}`);
      setAbcStatus('error');
    }
  };

  const handleIndexGutenberg = async (mentorId: string, bookId: number, title: string) => {
    const key = `${mentorId}_${bookId}`;
    if (gutenbergStates[key] === 'running') return;
    setGutenbergStates(prev => ({ ...prev, [key]: 'running' }));
    addGutenbergLog(`[${mentorId}] "${title}" 인덱싱 시작...`);
    try {
      const fn = httpsCallable<{ mentorId: string; bookId: number }, { indexed: number; book: string }>(functions, 'indexGutenbergBooks');
      const result = await fn({ mentorId, bookId });
      addGutenbergLog(`✓ [${mentorId}] "${title}" — ${result.data.indexed}개 구절 저장`);
      setGutenbergStates(prev => ({ ...prev, [key]: 'done' }));
    } catch (e) {
      addGutenbergLog(`✗ [${mentorId}] "${title}" 실패: ${String(e)}`);
      setGutenbergStates(prev => ({ ...prev, [key]: 'error' }));
    }
  };

  useEffect(() => {
    if (!user || status !== 'idle') return;
    setStatus('running');

    const today = new Date().toISOString().slice(0, 10);
    const mentors = Object.keys(SEED_DATA) as MentorId[];

    (async () => {
      for (const mentorId of mentors) {
        const docId = `${mentorId}_${today}`;
        const existing = await getDoc(doc(db, 'mentor_knowledge', docId));
        if (existing.exists() && Array.isArray(existing.data().entries) && existing.data().entries.length > 0) {
          addLog(`✓ ${mentorId} — 이미 데이터 있음, 건너뜀`);
          continue;
        }
        try {
          await saveKnowledgeEntries(mentorId, SEED_DATA[mentorId]);
          addLog(`✓ ${mentorId} — ${SEED_DATA[mentorId].length}개 저장 완료`);
        } catch (e) {
          addLog(`✗ ${mentorId} — 저장 실패: ${String(e)}`);
        }
      }
      setStatus('done');
    })().catch(() => setStatus('error'));
  }, [user, status]);

  const handleForceRegen = () => {
    if (regenStatus === 'running') return;
    setRegenStatus('running');
    forceRegenerateKnowledge()
      .then(() => setRegenStatus('done'))
      .catch(() => setRegenStatus('error'));
  };

  if (!user) return (
    <div className="font-serif italic opacity-50 text-center py-16">로그인 후 이용하세요.</div>
  );

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-6 py-12">
      <h1 className="font-serif text-2xl">지혜 데이터 초기 적재</h1>
      <div className="w-full border border-ink/10 bg-[#fdfbf7] p-6 font-mono text-xs space-y-2 min-h-[160px]">
        {status === 'idle' && <p className="opacity-40 animate-pulse">준비 중...</p>}
        {log.map((l, i) => <p key={i} className="opacity-75">{l}</p>)}
        {status === 'done' && <p className="text-green-700 font-bold mt-4">완료. /study에서 확인하세요.</p>}
        {status === 'error' && <p className="text-red-700">오류가 발생했습니다.</p>}
      </div>

      <div className="w-full border-t border-ink/10 pt-6 flex flex-col items-center gap-3">
        <p className="font-serif text-sm opacity-50">AI로 지혜 카드 전체 재생성</p>
        <button
          onClick={handleForceRegen}
          disabled={regenStatus === 'running'}
          className="px-6 py-2 border border-ink/30 font-serif text-sm hover:bg-ink hover:text-paper transition-all duration-300 disabled:opacity-30"
        >
          {regenStatus === 'running' ? '생성 중...' : regenStatus === 'done' ? '완료 ✓' : regenStatus === 'error' ? '오류 발생' : '지혜 카드 재생성'}
        </button>
        {regenStatus === 'done' && <p className="text-xs opacity-50 font-serif">/study에서 확인하세요.</p>}
      </div>

      <div className="w-full border-t border-ink/10 pt-6 flex flex-col items-center gap-4">
        <p className="font-serif text-sm opacity-50">혜운 스님 — 불교 경전 지식 적재</p>
        <p className="text-xs opacity-35 text-center font-serif italic leading-relaxed">
          수작업 큐레이션 데이터(법구경·금강경·화엄경 등)를 업로드하거나,<br />
          ABC 한글대장경 URL에서 직접 인덱싱합니다.
        </p>

        {/* 수작업 큐레이션 업로드 */}
        <div className="w-full flex items-center justify-between gap-3">
          <p className="font-serif text-xs opacity-60 flex-1 text-left">큐레이션 데이터 ({BUDDHIST_CURATED.length}개 구절)</p>
          <button
            onClick={handleUploadBuddhistCurated}
            disabled={buddhistUploadStatus === 'running' || buddhistUploadStatus === 'done'}
            className="px-4 py-1 border border-ink/25 font-mono text-xs hover:bg-ink hover:text-paper transition-all duration-300 disabled:opacity-30 whitespace-nowrap"
          >
            {buddhistUploadStatus === 'running' ? '업로드 중...' : buddhistUploadStatus === 'done' ? '완료 ✓' : buddhistUploadStatus === 'error' ? '오류' : '업로드'}
          </button>
        </div>

        {/* ABC 한글대장경 URL 스크래핑 */}
        <div className="w-full flex flex-col gap-2">
          <input
            type="url"
            value={abcUrl}
            onChange={e => setAbcUrl(e.target.value)}
            placeholder="ABC 한글대장경 URL (예: https://kabc.dongguk.edu/...)"
            className="w-full border border-ink/20 bg-transparent px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-ink/50"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={abcSourceName}
              onChange={e => setAbcSourceName(e.target.value)}
              placeholder="경전명 (예: 법구경 心品)"
              className="flex-1 border border-ink/20 bg-transparent px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-ink/50"
            />
            <button
              onClick={handleIndexBuddhistCanon}
              disabled={!abcUrl.trim() || abcStatus === 'running'}
              className="px-4 py-1 border border-ink/25 font-mono text-xs hover:bg-ink hover:text-paper transition-all duration-300 disabled:opacity-30 whitespace-nowrap"
            >
              {abcStatus === 'running' ? '처리 중...' : abcStatus === 'done' ? '완료 ✓' : '인덱싱'}
            </button>
          </div>
        </div>

        {buddhistLog.length > 0 && (
          <div className="w-full border border-ink/10 bg-[#fdfbf7] p-4 font-mono text-xs space-y-1 max-h-28 overflow-y-auto">
            {buddhistLog.map((l, i) => <p key={i} className="opacity-70">{l}</p>)}
          </div>
        )}
      </div>

      <div className="w-full border-t border-ink/10 pt-6 flex flex-col items-center gap-4">
        <p className="font-serif text-sm opacity-50">Project Gutenberg 원문 인덱싱</p>
        <p className="text-xs opacity-35 text-center font-serif italic leading-relaxed">
          베네딕토·테오도르 도서만 지원됩니다.<br />
          혜운·연암은 한문 원문이 필요해 제외됩니다.
        </p>
        <div className="w-full flex flex-col gap-2">
          {GUTENBERG_CATALOG.map(({ mentorId, bookId, title }) => {
            const key = `${mentorId}_${bookId}`;
            const state = gutenbergStates[key] ?? 'idle';
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <p className="font-serif text-xs opacity-60 flex-1 text-left">[{mentorId}] {title}</p>
                <button
                  onClick={() => handleIndexGutenberg(mentorId, bookId, title)}
                  disabled={state === 'running'}
                  className="px-4 py-1 border border-ink/25 font-mono text-xs hover:bg-ink hover:text-paper transition-all duration-300 disabled:opacity-30 whitespace-nowrap"
                >
                  {state === 'running' ? '처리 중...' : state === 'done' ? '완료 ✓' : state === 'error' ? '오류' : '인덱싱'}
                </button>
              </div>
            );
          })}
        </div>
        {gutenbergLog.length > 0 && (
          <div className="w-full border border-ink/10 bg-[#fdfbf7] p-4 font-mono text-xs space-y-1 max-h-32 overflow-y-auto">
            {gutenbergLog.map((l, i) => <p key={i} className="opacity-70">{l}</p>)}
          </div>
        )}
      </div>

      {/* 프롬프트 편집기 */}
      <div className="w-full border-t border-ink/10 pt-8">
        <AdminPromptEditor />
      </div>
    </div>
  );
}
