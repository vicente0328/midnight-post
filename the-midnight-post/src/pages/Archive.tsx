import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'motion/react';

export default function Archive() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchEntries = async () => {
      try {
        const q = query(
          collection(db, 'entries'),
          where('uid', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetchedEntries: any[] = [];
        querySnapshot.forEach((doc) => {
          fetchedEntries.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort client-side to avoid composite index requirement
        fetchedEntries.sort((a, b) => {
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setEntries(fetchedEntries);
      } catch (error) {
        console.error("Error fetching entries:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [user]);

  if (loading) {
    return <div className="animate-pulse font-serif italic opacity-50">서재를 정리하는 중...</div>;
  }

  if (entries.length === 0) {
    return <div className="font-serif italic opacity-50">아직 남겨진 기록이 없습니다.</div>;
  }

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <h1 className="text-3xl font-serif mb-12">The Archive</h1>
      <p className="opacity-60 italic text-sm mb-16">당신의 밤이 기록된 서재입니다.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
        {entries.map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="group"
          >
            <Link to={`/envelopes/${entry.id}`} className="block h-full">
              <div className="relative flex flex-col justify-between p-6 border border-ink/20 bg-[#fdfbf7] shadow-sm hover:shadow-md transition-all h-48">
                <div className="absolute top-2 left-2 right-2 bottom-2 border border-ink/5 pointer-events-none" />
                
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-mono opacity-50">
                    {entry.createdAt ? format(entry.createdAt.toDate(), 'yyyy.MM.dd') : 'Unknown Date'}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest opacity-40">
                    {entry.emotion !== 'unknown' ? entry.emotion : ''}
                  </span>
                </div>
                
                <p className="font-serif text-lg leading-relaxed line-clamp-3 opacity-80 group-hover:opacity-100 transition-opacity">
                  {entry.content}
                </p>
                
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
