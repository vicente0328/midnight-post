import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Feather, Flower2, Cross, Brush } from 'lucide-react';

const MENTOR_ICONS: Record<string, { icon: React.ReactElement; color: string }> = {
  hyewoon:   { icon: <Flower2 className="w-6 h-6 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-stone-700 to-stone-900' },
  benedicto: { icon: <Cross   className="w-6 h-6 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-red-900 to-red-950' },
  theodore:  { icon: <Feather className="w-6 h-6 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-slate-800 to-slate-950' },
  yeonam:    { icon: <Brush   className="w-6 h-6 text-[#D4AF37]" strokeWidth={1.5} />, color: 'from-emerald-900 to-emerald-950' },
};

function splitDialogue(text: string): { text: string; isDialogue: boolean }[] {
  const regex = /("([^"]*?)"|"([^"]*?)")/g;
  const segments: { text: string; isDialogue: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), isDialogue: false });
    segments.push({ text: match[0], isDialogue: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isDialogue: false });
  return segments.length > 0 ? segments : [{ text, isDialogue: false }];
}

interface LetterDoc {
  mentorId: string;
  quote: string;
  source: string;
  translation: string;
  advice: string;
  date: string;
  read: boolean;
}

export default function MentorLetter() {
  const { letterId } = useParams<{ letterId: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [letter, setLetter] = useState<LetterDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !letterId) return;
    getDoc(doc(db, 'mentor_initials', letterId))
      .then(snap => {
        if (!snap.exists() || snap.data().uid !== user.uid) {
          navigate('/', { replace: true });
          return;
        }
        const data = snap.data() as LetterDoc;
        setLetter(data);
        // 읽음 표시
        if (!data.read) {
          updateDoc(snap.ref, { read: true }).catch(() => {});
        }
      })
      .catch(() => navigate('/', { replace: true }))
      .finally(() => setLoading(false));
  }, [user, letterId, navigate]);

  if (loading) return null;
  if (!letter) return null;

  const mentor = MENTOR_ICONS[letter.mentorId] ?? MENTOR_ICONS.hyewoon;
  const mentorName = t(`mentors.${letter.mentorId}.name`);
  const mentorTitle = t(`mentors.${letter.mentorId}.title`);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 overflow-y-auto"
      style={{
        backgroundColor: '#fdfbf7',
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
      }}
    >
      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-5 left-4 sm:top-8 sm:left-8 flex items-center gap-1.5 opacity-40 hover:opacity-80 transition-opacity z-50"
      >
        <ChevronLeft size={18} strokeWidth={1.5} />
        <span className="font-serif text-xs italic">돌아가기</span>
      </button>

      <div className="w-full max-w-3xl mx-auto px-5 sm:px-10 md:px-20 py-16 sm:py-24">

        {/* 멘토 헤더 */}
        <div className="flex flex-col items-center mb-10 md:mb-16">
          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${mentor.color} p-1 shadow-md mb-4 relative flex items-center justify-center`}>
            <div className="absolute inset-1 rounded-full border border-[#D4AF37]/50" />
            {mentor.icon}
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-wider text-ink/90">{mentorName}</h2>
          <p className="text-[10px] sm:text-xs opacity-50 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-2">{mentorTitle}</p>
          <p className="font-mono text-[9px] opacity-25 uppercase tracking-widest mt-3">{letter.date}</p>
        </div>

        <div className="font-serif text-ink/90">
          {/* 인용구 */}
          <div className="text-center mb-8 md:mb-16 relative px-0 md:px-12">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-7xl sm:text-8xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>
            <p className="text-base sm:text-2xl md:text-3xl leading-relaxed italic text-ink/90 mb-5 relative z-10 font-medium break-keep break-words" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {letter.quote}
            </p>
            <div className="flex items-center justify-center gap-3 mb-5 opacity-60">
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent" />
              {letter.source && <span className="text-xs sm:text-sm tracking-wider break-keep shrink-0">{letter.source}</span>}
              <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-transparent via-ink/40 to-transparent" />
            </div>
            <p className="text-sm sm:text-base md:text-lg leading-relaxed text-ink/70 mx-auto break-keep break-words" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {letter.translation}
            </p>
          </div>

          {/* 구분선 */}
          <div className="flex justify-center items-center gap-3 my-8 md:my-16 opacity-40">
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
            <div className="w-1 h-1 rotate-45 bg-[#D4AF37]/60" />
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]" />
          </div>

          {/* 편지 본문 */}
          <div className="text-[15px] sm:text-lg md:text-xl leading-[1.85] sm:leading-[2.1] md:leading-[2.2] text-ink/90 md:text-justify md:break-keep px-0 md:px-8">
            {letter.advice.replace(/\\n/g, '\n').split('\n').map((paragraph, index) => {
              if (!paragraph.trim()) return null;
              const isFirst = index === 0;
              const segments = splitDialogue(paragraph);
              return (
                <p
                  key={index}
                  className={`mb-5 md:mb-7 ${isFirst ? 'sm:first-letter:text-5xl sm:first-letter:font-bold sm:first-letter:text-[#D4AF37] sm:first-letter:mr-2 sm:first-letter:float-left sm:first-letter:leading-none sm:first-letter:mt-2' : ''}`}
                >
                  {segments.map((seg, si) =>
                    seg.isDialogue
                      ? <span key={si} className="block mt-1 mb-1">{seg.text}</span>
                      : <span key={si}>{seg.text}</span>
                  )}
                </p>
              );
            })}
          </div>

          {/* 서명 */}
          <div className="mt-10 md:mt-24 text-right opacity-60 italic">
            <p className="text-sm sm:text-lg">{t('envelopes.footer')}</p>
            <p className="text-base sm:text-xl mt-1 sm:mt-2 font-bold">{t('envelopes.from', { name: mentorName })}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
