import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { LogOut, Scroll } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { usePlan, FREE_LETTER_LIMIT, STANDARD_LETTER_LIMIT, FREE_DAMSO_LIMIT, STANDARD_DAMSO_LIMIT, FREE_BOOKMARK_LIMIT, FREE_HISTORY_LIMIT } from '../hooks/usePlan';
import UpgradeModal from '../components/UpgradeModal';

export default function Account() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ letters: 0, bookmarks: 0, damso: 0 });
  const { plan, planLoaded, isAdmin, isStandard, upgrade } = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    Promise.all([
      getCountFromServer(query(collection(db, 'entries'),        where('uid', '==', uid))),
      getCountFromServer(query(collection(db, 'bookmarks'),      where('uid', '==', uid))),
      getCountFromServer(query(collection(db, 'damso_sessions'), where('uid', '==', uid))),
    ]).then(([letters, bookmarks, damso]) => {
      setStats({
        letters:   letters.data().count,
        bookmarks: bookmarks.data().count,
        damso:     damso.data().count,
      });
    }).catch(() => {});
  }, [user]);

  if (!user) return null;

  const initial = (user.email ?? '?')[0].toUpperCase();
  const joinDate = user.metadata.creationTime
    ? format(new Date(user.metadata.creationTime), 'yyyy.MM.dd')
    : null;

  return (
    <div className="w-full max-w-md flex flex-col items-center">
      {/* 아바타 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center shadow-lg mb-6"
      >
        <div className="absolute inset-1 rounded-full border border-[#D4AF37]/40" />
        <span className="font-serif text-2xl text-[#D4AF37] font-bold relative z-10">
          {initial}
        </span>
      </motion.div>

      {/* 이메일 */}
      <p className="font-serif text-base opacity-75 mb-1">{user.email}</p>
      {joinDate && (
        <p className="text-[10px] uppercase tracking-[0.25em] opacity-35 mb-10">
          {t('account.joinedSince', { date: joinDate })}
        </p>
      )}

      {/* 구분선 */}
      <div className="flex items-center gap-3 mb-10 opacity-20 w-full">
        <div className="flex-1 h-px bg-ink" />
        <Scroll size={12} strokeWidth={1.5} className="opacity-60" />
        <div className="flex-1 h-px bg-ink" />
      </div>

      {/* 활동 통계 */}
      <div className="grid grid-cols-3 gap-6 w-full mb-12">
        {[
          { label: t('account.stats.letters'),   value: stats.letters   },
          { label: t('account.stats.bookmarks'), value: stats.bookmarks },
          { label: t('account.stats.damso'),     value: stats.damso     },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="font-serif text-2xl font-bold text-ink/80">{value}</span>
            <span className="text-[9px] uppercase tracking-widest opacity-40 text-center break-keep">{label}</span>
          </div>
        ))}
      </div>

      {/* 플랜 섹션 */}
      {planLoaded && (
        <div className="w-full border border-ink/10 p-6 mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-widest opacity-30">Plan</p>
            {isAdmin ? (
              <span className="font-serif text-xs italic opacity-50">Admin</span>
            ) : (
              <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border
                ${isStandard ? 'border-[#D4AF37]/40 text-[#D4AF37]/70' : 'border-ink/20 opacity-40'}`}>
                {isStandard ? 'Standard' : 'Free'}
              </span>
            )}
          </div>

          {/* 한도 표시 */}
          {!isAdmin && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '편지', free: `일 ${FREE_LETTER_LIMIT}통`, std: `일 ${STANDARD_LETTER_LIMIT}통` },
                { label: '담소', free: `월 ${FREE_DAMSO_LIMIT}회`, std: `월 ${STANDARD_DAMSO_LIMIT}회` },
                { label: '북마크', free: `최신 ${FREE_BOOKMARK_LIMIT}개`, std: '무제한' },
                { label: '기록', free: `최신 ${FREE_HISTORY_LIMIT}개`, std: '무제한' },
              ].map(({ label, free, std }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest opacity-25">{label}</span>
                  <span className="font-serif text-xs italic opacity-60">{isStandard ? std : free}</span>
                </div>
              ))}
            </div>
          )}

          {/* 업그레이드 버튼 */}
          {!isStandard && !isAdmin && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="w-full py-2.5 border border-[#D4AF37]/30 font-serif text-sm italic tracking-wide text-[#D4AF37]/70 hover:bg-[#D4AF37]/5 transition-all duration-300"
            >
              Standard로 업그레이드
            </button>
          )}
        </div>
      )}

      {/* 로그아웃 */}
      <button
        onClick={signOut}
        className="group flex items-center gap-3 font-serif text-sm italic opacity-40 hover:opacity-80 transition-opacity duration-300"
      >
        <LogOut size={14} strokeWidth={1.5} />
        {t('account.logout')}
      </button>

      <AnimatePresence>
        {showUpgradeModal && (
          <UpgradeModal
            reason="letter"
            used={0}
            onUpgrade={async () => {
              setUpgrading(true);
              await upgrade();
              setUpgrading(false);
            }}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
