import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../components/AuthContext';
import { useSound } from '../components/SoundContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateSingleMentorReply, rankMentors } from '../services/ai';

const MENTOR_NAMES = {
  hyewoon: '혜운 스님',
  benedicto: '베네딕토 신부',
  theodore: '테오도르 교수',
  yeonam: '연암 선생'
};

const TIME_CONTENT: Record<string, { subtitle: string; greetings: string[] }> = {
  dawn: {
    subtitle: "새벽에 찾아온 당신의 마음을 한 줄로 남겨주세요.",
    greetings: [
      "이른 새벽, 무엇이 당신을 깨웠나요?",
      "새벽의 고요 속에서 어떤 생각이 머무나요?",
      "남들이 잠든 시간, 혼자 깨어있는 당신에게.",
      "새벽빛이 스미기 전, 마음속 이야기를 나눠요.",
      "당신의 모든 순간을 존중합니다.",
    ],
  },
  morning: {
    subtitle: "오늘 하루, 어떤 마음으로 시작하시나요?",
    greetings: [
      "좋은 아침입니다. 오늘은 어떤 하루를 보내실 건가요?",
      "새로운 하루가 시작되었습니다. 오늘의 마음은 어떤가요?",
      "아침의 첫 마음을 한 줄로 남겨주세요.",
      "오늘 하루를 어떻게 맞이하고 싶으신가요?",
      "천천히, 당신의 속도대로 이야기해주세요.",
    ],
  },
  afternoon: {
    subtitle: "오후의 한 자락, 당신의 이야기를 들려주세요.",
    greetings: [
      "오후의 햇살 속에서 어떤 생각이 스치나요?",
      "하루의 중간, 잠시 마음을 들여다보세요.",
      "오늘 하루는 지금까지 어떠신가요?",
      "잠깐 멈추어, 당신의 마음을 살펴보세요.",
      "마음속에 담아둔 말을 조용히 꺼내보세요.",
    ],
  },
  evening: {
    subtitle: "하루의 끝자락, 마음을 한 줄로 남겨주세요.",
    greetings: [
      "하루를 마무리하며 어떤 감정이 남아있나요?",
      "저녁 노을처럼, 오늘 하루를 되돌아보세요.",
      "수고한 하루를 함께 돌아봐요.",
      "저녁이 왔습니다. 오늘 당신의 마음은 어땠나요?",
      "이곳에서는 어떤 감정이든 괜찮습니다.",
    ],
  },
  night: {
    subtitle: "지친 밤, 당신의 마음을 한 줄로 남겨주세요.",
    greetings: [
      "오늘 하루는 어땠나요?",
      "당신의 밤이 평안하기를 바랍니다.",
      "밤이 깊어가는 시간, 어떤 생각에 잠겨 있나요?",
      "누구에게도 하지 못한 말이 있다면 이곳에 남겨주세요.",
      "오늘 하루도 견뎌내느라 애썼습니다.",
      "당신의 발걸음이 머무는 이 밤.",
      "오늘 하루의 무게를 이곳에 덜어두세요.",
    ],
  },
};

function getTimePeriod(hour: number): string {
  if (hour >= 0 && hour < 5) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export default function Home() {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [timePeriod, setTimePeriod] = useState('night');
  const { user, setShowAuthModal } = useAuth();
  const { setTyping } = useSound();
  const navigate = useNavigate();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const period = getTimePeriod(new Date().getHours());
    setTimePeriod(period);
    const greetings = TIME_CONTENT[period].greetings;
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(false);
    };
  }, [setTyping]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Play typing sound
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 400); // Stop sound after 400ms of no typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    setShowAnimation(true);

    try {
      // 1. Save the entry
      const entryRef = await addDoc(collection(db, 'entries'), {
        uid: user.uid,
        content: content.trim(),
        emotion: 'unknown',
        createdAt: serverTimestamp(),
        status: 'replied'
      });

      // 2. Fire off generation in relevance order (staggered so most relevant starts first)
      const rankedMentors = rankMentors(content.trim());

      const writtenHour = new Date().getHours();
      rankedMentors.forEach((mentorId, index) => {
        setTimeout(async () => {
          try {
            const reply = await generateSingleMentorReply(content, mentorId, writtenHour);

            const replyData: any = {
              uid: user.uid,
              entryId: entryRef.id,
              mentorId: reply.mentorId,
              quote: reply.quote,
              translation: reply.translation,
              advice: reply.advice,
              createdAt: serverTimestamp()
            };

            if (reply.source) replyData.source = reply.source;

            await addDoc(collection(db, 'replies'), replyData);
          } catch (error) {
            console.error(`Failed to generate reply for ${mentorId}:`, error);
          }
        }, index * 150); // 150ms stagger — most relevant starts first
      });

      // 3. Navigate to envelopes immediately after a short "Sent" animation
      setTimeout(() => {
        navigate(`/envelopes/${entryRef.id}`);
      }, 1500);

    } catch (error) {
      console.error("Error submitting entry:", error);
      setIsSubmitting(false);
      setShowAnimation(false);
    }
  };

  if (showAnimation) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center space-y-8"
      >
        <div className="w-24 h-16 bg-ink/10 relative flex items-center justify-center shadow-md">
          <div className="absolute inset-0 border border-ink/20 m-1" />
          <div className="w-6 h-6 rounded-full bg-red-800/80 flex items-center justify-center shadow-sm">
            <span className="text-[8px] text-white/80 font-serif">M</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center space-y-4 min-h-[120px]">
          <p className="text-lg font-serif italic opacity-70 tracking-widest mb-4">편지를 부쳤습니다...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-serif mb-4">The Desk</h1>
        <p className="opacity-60 italic text-sm break-keep">{TIME_CONTENT[timePeriod].subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
        <div className="w-full relative">
          <textarea
            value={content}
            onChange={handleTextChange}
            maxLength={100}
            placeholder={greeting}
            className="w-full h-40 bg-transparent border-b-2 border-ink/20 resize-none focus:outline-none focus:border-ink/60 transition-colors p-4 text-center text-xl font-serif leading-relaxed break-keep"
            disabled={isSubmitting}
          />
          <div className="absolute bottom-2 right-2 text-xs opacity-40 font-mono">
            {content.length} / 100
          </div>
        </div>

        <button
          type="submit"
          disabled={!content.trim() || isSubmitting}
          className="mt-12 px-8 py-3 border border-ink/30 rounded-full hover:bg-ink hover:text-paper transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink tracking-widest uppercase text-sm"
        >
          {isSubmitting ? 'Writing...' : 'Send to Mentors'}
        </button>
      </form>
    </div>
  );
}
