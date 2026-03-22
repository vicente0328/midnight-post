import { useState, useEffect, useRef } from 'react';
import {
  doc,
  setDoc,
  onSnapshot,
  getCountFromServer,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';

export type Plan = 'free' | 'standard';

const ADMIN_EMAIL = 'admin@tmp.com';

// ── 플랜 한도 ──────────────────────────────────────────────────────────────────
export const FREE_LETTER_LIMIT     = 1;   // 일일 편지
export const STANDARD_LETTER_LIMIT = 3;   // 일일 편지
export const FREE_DAMSO_LIMIT      = 5;   // 월간 담소
export const STANDARD_DAMSO_LIMIT  = 15;  // 월간 담소
export const FREE_BOOKMARK_LIMIT   = 10;  // 북마크 최신 N개
export const FREE_HISTORY_LIMIT    = 20;  // 편지/담소 기록 최신 N개

function todayStart(): Timestamp {
  const now = new Date();
  return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

function monthStart(): Timestamp {
  const now = new Date();
  return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function usePlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>('free');
  const [planLoaded, setPlanLoaded] = useState(false);
  const planRef = useRef<Plan>('free');
  const isFirstSnap = useRef(true);

  const isAdmin = user?.email === ADMIN_EMAIL;
  const isStandard = isAdmin || plan === 'standard';

  useEffect(() => {
    if (!user) { setPlanLoaded(true); return; }
    if (isAdmin) { setPlan('standard'); setPlanLoaded(true); return; }

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const newPlan: Plan = snap.exists() ? ((snap.data().plan as Plan) ?? 'free') : 'free';
        // 초기 로드가 아닌 상태에서 free → standard 변경 시 업그레이드 이벤트 발송
        if (!isFirstSnap.current && planRef.current === 'free' && newPlan === 'standard') {
          window.dispatchEvent(new CustomEvent('planUpgraded'));
        }
        isFirstSnap.current = false;
        planRef.current = newPlan;
        setPlan(newPlan);
        setPlanLoaded(true);
      },
      () => setPlanLoaded(true),
    );
    return unsubscribe;
  }, [user, isAdmin]);

  const upgrade = async () => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { plan: 'standard' }, { merge: true });
    setPlan('standard');
  };

  /** 오늘 편지 사용량 확인 (free: 1통/일, standard: 3통/일, admin: 무제한) */
  const checkLetterLimit = async (): Promise<{ allowed: boolean; used: number; limit: number }> => {
    if (isAdmin) return { allowed: true, used: 0, limit: Infinity };
    if (!user) return { allowed: false, used: 0, limit: FREE_LETTER_LIMIT };
    const limit = isStandard ? STANDARD_LETTER_LIMIT : FREE_LETTER_LIMIT;
    try {
      const snap = await getCountFromServer(
        query(collection(db, 'entries'), where('uid', '==', user.uid), where('createdAt', '>=', todayStart()))
      );
      const used = snap.data().count;
      return { allowed: used < limit, used, limit };
    } catch {
      return { allowed: true, used: 0, limit }; // fail open
    }
  };

  /** 이번 달 담소 사용량 확인 (free: 5회/월, standard: 15회/월, admin: 무제한) */
  const checkDamsoLimit = async (): Promise<{ allowed: boolean; used: number; limit: number }> => {
    if (isAdmin) return { allowed: true, used: 0, limit: Infinity };
    if (!user) return { allowed: false, used: 0, limit: FREE_DAMSO_LIMIT };
    const limit = isStandard ? STANDARD_DAMSO_LIMIT : FREE_DAMSO_LIMIT;
    try {
      const snap = await getCountFromServer(
        query(collection(db, 'damso_sessions'), where('uid', '==', user.uid), where('startedAt', '>=', monthStart()))
      );
      const used = snap.data().count;
      return { allowed: used < limit, used, limit };
    } catch {
      return { allowed: true, used: 0, limit }; // fail open
    }
  };

  return {
    plan,
    planLoaded,
    isAdmin,
    isStandard,
    upgrade,
    checkLetterLimit,
    checkDamsoLimit,
  };
}
