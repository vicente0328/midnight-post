import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { getRecentKnowledge, KnowledgeEntry } from './knowledge';

export interface MentorReply {
  mentorId: 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam';
  quote: string;
  source?: string;
  translation: string;
  advice: string;
}

export async function generateSingleMentorReply(
  content: string,
  mentorId: 'hyewoon' | 'benedicto' | 'theodore' | 'yeonam',
  writtenHour?: number
): Promise<MentorReply> {
  const knowledgeEntries: KnowledgeEntry[] = await getRecentKnowledge(mentorId, 5).catch(() => []);

  const fn = httpsCallable<
    { content: string; mentorId: string; writtenHour?: number; knowledgeEntries: KnowledgeEntry[] },
    MentorReply
  >(functions, 'generateMentorReply');

  const result = await fn({ content, mentorId, writtenHour, knowledgeEntries });
  return result.data;
}

// Rank mentors by relevance to content using keyword heuristics (no API call)
export function rankMentors(
  content: string
): Array<'hyewoon' | 'benedicto' | 'theodore' | 'yeonam'> {
  const scores: Record<string, number> = { hyewoon: 0, benedicto: 0, theodore: 0, yeonam: 0 };

  if (/집착|버리|비우|내려놓|놓아|흘러|순간|지금|현재|고요|평온|명상|수행|마음/.test(content))
    scores.hyewoon += 2;
  if (/슬프|그립|외롭|힘들|아프|울|눈물|위로|감사|사랑|용서|잃|상실|쓸쓸|보고싶/.test(content))
    scores.benedicto += 2;
  if (/왜|이유|의미|모르|혼란|복잡|판단|결정|선택|불안|걱정|두렵|생각|고민/.test(content))
    scores.theodore += 2;
  if (/자연|계절|흐름|세월|시간|인연|관계|사람|함께|봄|여름|가을|겨울|오늘|하루/.test(content))
    scores.yeonam += 2;

  const all: Array<'hyewoon' | 'benedicto' | 'theodore' | 'yeonam'> = [
    'hyewoon', 'benedicto', 'theodore', 'yeonam',
  ];
  return [...all].sort((a, b) => scores[b] - scores[a]);
}
