/**
 * /seed — Admin 관리 페이지
 */
import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { forceRegenerateKnowledge, KnowledgeEntry } from '../services/knowledge';
import { useAuth } from '../components/AuthContext';
import AdminPromptEditor from '../components/AdminPromptEditor';



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
  const [regenStatus, setRegenStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [buddhistUploadStatus, setBuddhistUploadStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [buddhistLog, setBuddhistLog] = useState<string[]>([]);
  const [abcUrl, setAbcUrl] = useState('');
  const [abcSourceName, setAbcSourceName] = useState('');
  const [abcStatus, setAbcStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');

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
      <h1 className="font-serif text-2xl">관리자</h1>

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

      {/* 프롬프트 편집기 */}
      <div className="w-full border-t border-ink/10 pt-8">
        <AdminPromptEditor />
      </div>
    </div>
  );
}
