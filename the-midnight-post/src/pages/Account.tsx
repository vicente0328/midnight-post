import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { LogOut, Scroll } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

export default function Account() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ letters: 0, bookmarks: 0, damso: 0 });

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

      {/* 로그아웃 */}
      <button
        onClick={signOut}
        className="group flex items-center gap-3 font-serif text-sm italic opacity-40 hover:opacity-80 transition-opacity duration-300"
      >
        <LogOut size={14} strokeWidth={1.5} />
        {t('account.logout')}
      </button>
    </div>
  );
}
