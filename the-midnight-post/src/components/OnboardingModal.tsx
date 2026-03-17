import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthContext';

const MENTORS = [
  {
    id: 'hyewoon',
    name: '혜운 스님',
    tradition: '선불교',
    desc: '비움과 머무름의 수행자. 집착을 내려놓고 지금 이 순간에 머무는 법을 가르칩니다.',
    symbol: '☸',
    color: 'from-stone-100 to-stone-50',
  },
  {
    id: 'benedicto',
    name: '베네딕토 신부',
    tradition: '가톨릭 영성',
    desc: '사랑과 위로의 동반자. 연약함을 긍정하고 모든 존재의 존엄을 포용합니다.',
    symbol: '✝',
    color: 'from-amber-50 to-stone-50',
  },
  {
    id: 'theodore',
    name: '테오도르 교수',
    tradition: '스토아 · 실존주의',
    desc: '이성과 실존의 철학자. 통제할 수 없는 것을 내려놓고 내면의 자유를 찾도록 이끕니다.',
    symbol: '⚖',
    color: 'from-slate-100 to-stone-50',
  },
  {
    id: 'yeonam',
    name: '연암 선생',
    tradition: '유교 · 도가',
    desc: '순리와 조화의 선비. 자연의 흐름에서 삶의 지혜를 길어 올립니다.',
    symbol: '☯',
    color: 'from-emerald-50 to-stone-50',
  },
];

const STEPS = [
  {
    title: '밤의 우편함에 오신 것을\n환영합니다.',
    body: '지친 마음을 한 줄로 적어 보내면,\n네 명의 현자가 편지로 답합니다.',
    cta: '만나볼게요',
  },
  {
    title: '네 명의 현자가\n기다리고 있습니다.',
    body: '',
    cta: '어떻게 쓰나요?',
  },
  {
    title: '단 100자면\n충분합니다.',
    body: '완벽한 문장이 아니어도 됩니다.\n지금 이 마음을 그대로 꺼내 보세요.\n현자들이 그 마음을 받아 편지를 씁니다.',
    cta: '시작하기',
  },
];

export default function OnboardingModal() {
  const { markOnboarded } = useAuth();
  const [step, setStep] = useState(0);

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      await markOnboarded();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full sm:max-w-lg bg-paper rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '92dvh' }}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-[#D4AF37]' : 'w-1.5 bg-ink/20'
              }`}
            />
          ))}
        </div>

        <div className="px-8 py-6 overflow-y-auto" style={{ maxHeight: 'calc(92dvh - 48px)' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Title */}
              <h2 className="text-2xl font-serif leading-snug mb-4 whitespace-pre-line" style={{ wordBreak: 'keep-all' }}>
                {STEPS[step].title}
              </h2>

              {/* Step 0 & 2: body text */}
              {STEPS[step].body && (
                <p className="text-sm opacity-60 leading-relaxed whitespace-pre-line mb-8" style={{ wordBreak: 'keep-all' }}>
                  {STEPS[step].body}
                </p>
              )}

              {/* Step 1: mentor cards */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {MENTORS.map((mentor) => (
                    <div
                      key={mentor.id}
                      className={`bg-gradient-to-br ${mentor.color} border border-ink/10 rounded-xl p-4`}
                    >
                      <div className="text-2xl mb-2 opacity-60">{mentor.symbol}</div>
                      <div className="font-serif text-sm font-medium mb-0.5">{mentor.name}</div>
                      <div className="text-[10px] opacity-40 tracking-wide uppercase mb-2">{mentor.tradition}</div>
                      <p className="text-xs opacity-60 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                        {mentor.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 2: visual hint */}
              {step === 2 && (
                <div className="flex items-center justify-center gap-3 mb-8 opacity-50">
                  <div className="text-center">
                    <div className="w-10 h-10 border border-ink/30 rounded-sm flex items-center justify-center mb-1">
                      <span className="text-xs font-serif">글</span>
                    </div>
                    <span className="text-[10px] tracking-wider">Desk</span>
                  </div>
                  <div className="text-ink/30">→</div>
                  <div className="text-center">
                    <div className="w-10 h-10 border border-ink/30 rounded-sm flex items-center justify-center mb-1">
                      <span className="text-xs font-serif">편</span>
                    </div>
                    <span className="text-[10px] tracking-wider">Letters</span>
                  </div>
                  <div className="text-ink/30">→</div>
                  <div className="text-center">
                    <div className="w-10 h-10 border border-ink/30 rounded-sm flex items-center justify-center mb-1">
                      <span className="text-xs font-serif">담</span>
                    </div>
                    <span className="text-[10px] tracking-wider">Talk</span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* CTA button */}
          <button
            onClick={handleNext}
            className="w-full py-3.5 border border-ink/30 rounded-full text-sm tracking-widest uppercase font-medium hover:bg-ink hover:text-paper transition-colors"
          >
            {STEPS[step].cta}
          </button>

          {/* Skip */}
          {step < STEPS.length - 1 && (
            <button
              onClick={() => markOnboarded()}
              className="w-full mt-3 py-2 text-xs opacity-30 hover:opacity-60 transition-opacity tracking-wider"
            >
              건너뛰기
            </button>
          )}

          <div className="h-safe-bottom" />
        </div>
      </motion.div>
    </div>
  );
}
