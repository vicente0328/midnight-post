import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import { useSound } from '../components/SoundContext';
import { MentorReply } from '../services/ai';
import { X, Feather, Flower2, Cross, Brush, Loader2 } from 'lucide-react';

const LOADING_PHRASES = [
  "마음을 비우는 중입니다...",
  "당신의 하루를 헤아려보고 있습니다...",
  "조용히 촛불을 밝히는 중입니다...",
  "위로의 문장을 고르고 있습니다...",
  "당신의 감정에 귀 기울이고 있습니다...",
  "깊은 생각에 잠겨 있습니다..."
];

const MENTORS = {
  hyewoon: { 
    name: '혜운 스님', 
    title: '비움과 머무름의 수행자', 
    icon: <Flower2 className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-stone-700 to-stone-900'
  },
  benedicto: { 
    name: '베네딕토 신부', 
    title: '사랑과 위로의 동반자', 
    icon: <Cross className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-red-900 to-red-950'
  },
  theodore: { 
    name: '테오도르 교수', 
    title: '이성과 실존의 철학자', 
    icon: <Feather className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-slate-800 to-slate-950'
  },
  yeonam: { 
    name: '연암 선생', 
    title: '순리와 조화의 선비', 
    icon: <Brush className="w-8 h-8 text-[#D4AF37]" strokeWidth={1.5} />,
    color: 'from-emerald-900 to-emerald-950'
  }
};

export default function Envelopes() {
  const { entryId } = useParams();
  const { user } = useAuth();
  const { playPageTurn, playArrivalSound } = useSound();
  const navigate = useNavigate();
  const [replies, setReplies] = useState<MentorReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReply, setSelectedReply] = useState<MentorReply | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [justArrived, setJustArrived] = useState<string[]>([]);
  const prevRepliesRef = React.useRef<MentorReply[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (prevRepliesRef.current.length > 0 && replies.length > prevRepliesRef.current.length) {
      const newReplies = replies.filter(r => !prevRepliesRef.current.find(pr => pr.mentorId === r.mentorId));
      if (newReplies.length > 0) {
        playArrivalSound();
        const newMentorIds = newReplies.map(r => r.mentorId);
        setJustArrived(prev => [...prev, ...newMentorIds]);
        
        setTimeout(() => {
          setJustArrived(prev => prev.filter(id => !newMentorIds.includes(id)));
        }, 3000);
      }
    }
    prevRepliesRef.current = replies;
  }, [replies, playArrivalSound]);

  useEffect(() => {
    if (!user || !entryId) return;

    const q = query(
      collection(db, 'replies'), 
      where('uid', '==', user.uid),
      where('entryId', '==', entryId)
    );

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReplies: MentorReply[] = [];
      snapshot.forEach((doc) => {
        fetchedReplies.push(doc.data() as MentorReply);
      });
      setReplies(fetchedReplies);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to replies:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [entryId, user]);

  const handleOpenLetter = (reply: MentorReply) => {
    playPageTurn();
    setSelectedReply(reply);
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-center">
      <h1 className="text-3xl font-serif mb-12">The Four Envelopes</h1>
      <p className="opacity-60 italic text-sm mb-16">네 명의 현자가 당신에게 보내는 위로의 편지입니다.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
        {(Object.keys(MENTORS) as Array<keyof typeof MENTORS>).map((mentorId, index) => {
          const mentor = MENTORS[mentorId];
          const reply = replies.find(r => r.mentorId === mentorId);

          if (!reply) {
            // Skeleton / Loading State
            return (
              <motion.div
                key={`loading-${mentorId}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative flex flex-col items-center justify-center p-8 bg-[#FAFAFA]/50 border border-[#E5E0D8]/50 shadow-sm h-72 overflow-hidden"
              >
                <div className="absolute top-2 left-2 w-6 h-6 border-t border-l border-[#D4AF37]/20 pointer-events-none" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t border-r border-[#D4AF37]/20 pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b border-l border-[#D4AF37]/20 pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b border-r border-[#D4AF37]/20 pointer-events-none" />

                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${mentor.color} opacity-20 p-1 mb-8 relative flex items-center justify-center`}>
                  <Loader2 className="w-6 h-6 text-ink/40 animate-spin" />
                </div>

                <h3 className="font-serif text-lg font-bold mb-2 text-ink/40">{mentor.name}</h3>
                <div className="h-6 relative w-full flex justify-center items-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={phraseIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.5 }}
                      className="text-[10px] opacity-50 uppercase tracking-widest text-center absolute w-full"
                    >
                      {LOADING_PHRASES[phraseIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          }

          // Loaded State
          const isNew = justArrived.includes(mentorId);

          return (
            <motion.div
              key={reply.mentorId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              onClick={() => handleOpenLetter(reply)}
              className={`cursor-pointer group relative flex flex-col items-center justify-center p-8 bg-[#FAFAFA] transition-all duration-1000 h-72 overflow-hidden ${
                isNew 
                  ? 'border-[#D4AF37] shadow-[0_0_40px_rgba(212,175,55,0.4)]' 
                  : 'border-[#E5E0D8] shadow-md hover:shadow-xl'
              }`}
            >
              <div className="absolute top-2 left-2 w-6 h-6 border-t border-l border-[#D4AF37]/40 pointer-events-none" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t border-r border-[#D4AF37]/40 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b border-l border-[#D4AF37]/40 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b border-r border-[#D4AF37]/40 pointer-events-none" />

              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${mentor.color} p-1 shadow-lg mb-8 group-hover:scale-110 transition-transform duration-500 relative flex items-center justify-center`}>
                <div className="absolute inset-1 rounded-full border border-[#D4AF37]/50"></div>
                <div className="absolute inset-2 rounded-full border border-dashed border-[#D4AF37]/40"></div>
                {mentor.icon}
              </div>

              <h3 className="font-serif text-lg font-bold mb-2 text-ink/90">{mentor.name}</h3>
              <p className="text-[10px] opacity-60 uppercase tracking-widest text-center">{mentor.title}</p>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedReply && (
          <LetterModal reply={selectedReply} onClose={() => setSelectedReply(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LetterModal({ reply, onClose }: { reply: MentorReply; onClose: () => void }) {
  const mentor = MENTORS[reply.mentorId];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 md:p-8 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-[#fdfbf7] p-10 md:p-20 shadow-[0_0_60px_rgba(0,0,0,0.5)] overflow-y-auto max-h-[90vh] letter-scroll border border-[#D4AF37]/20"
        style={{ 
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 100px rgba(139, 115, 85, 0.1), 0 20px 60px rgba(0,0,0,0.4)'
        }}
      >
        {/* Elegant Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-8 right-8 opacity-40 hover:opacity-100 transition-all duration-300 hover:rotate-90"
        >
          <X size={28} strokeWidth={1} />
        </button>

        {/* Header: Mentor Info */}
        <div className="flex flex-col items-center mb-16">
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${mentor.color} p-1 shadow-md mb-6 relative flex items-center justify-center`}>
            <div className="absolute inset-1 rounded-full border border-[#D4AF37]/50"></div>
            {React.cloneElement(mentor.icon as React.ReactElement, { className: "w-6 h-6 text-[#D4AF37]" })}
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-widest text-ink/90">{mentor.name}</h2>
          <p className="text-xs opacity-50 uppercase tracking-[0.3em] mt-2">{mentor.title}</p>
        </div>

        <div className="font-serif text-ink/90">
          {/* Lyrical Quote Section */}
          <div className="text-center mb-16 relative px-4 md:px-12">
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-8xl text-[#D4AF37]/15 font-serif leading-none select-none">"</span>
            
            <p className="text-2xl md:text-3xl leading-relaxed italic text-ink/90 mb-8 relative z-10 break-keep font-medium">
              {reply.quote}
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-8 opacity-60">
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-ink/40 to-transparent"></div>
              {reply.source && <span className="text-sm tracking-widest">{reply.source}</span>}
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-ink/40 to-transparent"></div>
            </div>
            
            <p className="text-base md:text-lg leading-relaxed text-ink/70 max-w-xl mx-auto break-keep">
              {reply.translation}
            </p>
          </div>

          {/* Elegant Divider */}
          <div className="flex justify-center items-center gap-3 my-16 opacity-40">
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]"></div>
            <div className="w-1 h-1 rotate-45 bg-[#D4AF37]/60"></div>
            <div className="w-1.5 h-1.5 rotate-45 bg-[#D4AF37]"></div>
          </div>

          {/* Advice Section with Drop Cap */}
          <div className="space-y-8 text-lg md:text-xl leading-[2.2] text-ink/90 text-justify break-keep px-2 md:px-8">
            {reply.advice.split('\n').map((paragraph, index) => {
              if (!paragraph.trim()) return null;
              
              // Apply Drop Cap to the first paragraph
              const isFirstParagraph = index === 0;
              
              return (
                <p 
                  key={index} 
                  className={`mb-8 ${isFirstParagraph ? 'first-letter:text-5xl first-letter:font-bold first-letter:text-[#D4AF37] first-letter:mr-2 first-letter:float-left first-letter:leading-none first-letter:mt-2' : ''}`}
                >
                  {paragraph}
                </p>
              );
            })}
          </div>
          
          {/* Footer Signature */}
          <div className="mt-24 text-right pr-8 opacity-60 italic">
            <p className="text-lg">당신의 평안을 기원하며,</p>
            <p className="text-xl mt-2 font-bold">{mentor.name} 드림</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
