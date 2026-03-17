import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

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
