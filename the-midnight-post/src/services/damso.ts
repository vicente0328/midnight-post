import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export type MentorId = 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';

// ── 담소 진입 prefetch ──────────────────────────────────────────────────────
// 버튼 클릭 시점에 미리 시작된 promise를 보관해두고, Damso.tsx에서 소비함

interface PrefetchedDamso {
  contentPromise: Promise<string>;
  openingPromise: Promise<DamsoOpening>;
}

let _prefetched: PrefetchedDamso | null = null;

export function prefetchDamso(
  mentorId: MentorId,
  getContent: () => Promise<string>,
) {
  const contentPromise = getContent();
  const openingPromise = contentPromise.then(content =>
    generateDamsoOpening(mentorId, content)
  );
  _prefetched = { contentPromise, openingPromise };
}

export function consumePrefetchedDamso(): PrefetchedDamso | null {
  const p = _prefetched;
  _prefetched = null;
  return p;
}

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

export async function generateDamsoOpening(
  mentorId: MentorId,
  entryContent: string
): Promise<DamsoOpening> {
  const fn = httpsCallable<{ mentorId: MentorId; entryContent: string }, DamsoOpening>(
    functions, 'generateDamsoOpening'
  );
  const result = await fn({ mentorId, entryContent });
  return result.data;
}

export async function generateDamsoResponse(
  mentorId: MentorId,
  entryContent: string,
  conversationHistory: DamsoConversationEntry[],
  userInput: string
): Promise<DamsoTurn> {
  const fn = httpsCallable<
    { mentorId: MentorId; entryContent: string; conversationHistory: DamsoConversationEntry[]; userInput: string },
    DamsoTurn
  >(functions, 'generateDamsoResponse');
  const result = await fn({ mentorId, entryContent, conversationHistory, userInput });
  return result.data;
}

export async function generateDamsoClosing(
  mentorId: MentorId,
  entryContent: string,
  conversationHistory: DamsoConversationEntry[],
  userInput: string
): Promise<DamsoTurn> {
  const fn = httpsCallable<
    { mentorId: MentorId; entryContent: string; conversationHistory: DamsoConversationEntry[]; userInput: string },
    DamsoTurn
  >(functions, 'generateDamsoClosing');
  const result = await fn({ mentorId, entryContent, conversationHistory, userInput });
  return result.data;
}
