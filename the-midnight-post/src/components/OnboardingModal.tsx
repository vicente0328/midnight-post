import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onClose: () => void;
  isInitial?: boolean;
}

const MENTORS = [
  {
    id: 'hyewoon',
    name: '혜운 스님',
    tradition: '선불교',
    desc: '비움과 머무름의 수행자. 집착을 내려놓고 지금 이 순간에 머무는 법을 전합니다.',
    symbol: '☸',
  },
  {
    id: 'benedicto',
    name: '베네딕토 신부',
    tradition: '가톨릭 영성',
    desc: '사랑과 위로의 동반자. 연약함을 긍정하고 존엄을 포용합니다.',
    symbol: '✝',
  },
  {
    id: 'theodore',
    name: '테오도르 교수',
    tradition: '스토아 · 실존주의',
    desc: '이성과 실존의 철학자. 내면의 자유로 이끄는 길을 밝힙니다.',
    symbol: '⚖',
  },
  {
    id: 'yeonam',
    name: '연암 선생',
    tradition: '유교 · 도가',
    desc: '순리와 조화의 선비. 자연의 흐름에서 삶의 지혜를 길어 올립니다.',
    symbol: '☯',
  },
];

const STEPS = [
  {
    title: '밤의 우편함에\n오신 것을 환영합니다.',
    subtitle: '지친 마음을 한 줄로 적어 보내면,\n네 명의 현자가 편지로 답합니다.',
    cta: '현자들을 만나볼게요',
  },
  {
    title: '네 명의 현자가\n기다리고 있습니다.',
    subtitle: '',
    cta: '어떻게 쓰는 건가요?',
  },
  {
    title: '단 100자면\n충분합니다.',
    subtitle: '완벽한 문장이 아니어도 됩니다.\n지금 이 마음을 그대로 꺼내 보세요.',
    cta: '편지를 쓰러 가겠습니다',
  },
];

/* 가느다란 금색 장식선 */
function GoldRule() {
  return (
    <div className="flex items-center justify-center gap-2 my-5">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/40" />
      <span className="text-[#D4AF37]/60 text-xs">✦</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/40" />
    </div>
  );
}

export default function OnboardingModal({ onClose, isInitial = false }: Props) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(18, 12, 6, 0.65)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full sm:max-w-md overflow-hidden"
        style={{
          maxHeight: '92dvh',
          background: 'linear-gradient(160deg, #FBF6EC 0%, #F5EDE0 100%)',
          borderRadius: '1.25rem 1.25rem 0 0',
          boxShadow: '0 -4px 60px rgba(18,12,6,0.35), 0 0 0 1px rgba(212,175,55,0.18)',
        }}
      >
        {/* 상단 금색 라인 */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

        {/* 둥근 핸들 (모바일 bottom sheet 느낌) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-0.5 rounded-full bg-[#2A2118]/20" />
        </div>

        {/* 진행 점 — 금색 다이아몬드 */}
        <div className="flex justify-center gap-2.5 pt-4 pb-1">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i === step ? 1 : 0.7,
                opacity: i === step ? 1 : 0.3,
              }}
              transition={{ duration: 0.2 }}
              className="text-[#D4AF37]"
              style={{ fontSize: '8px' }}
            >
              ◆
            </motion.div>
          ))}
        </div>

        {/* 본문 */}
        <div
          className="px-8 pb-8 overflow-y-auto"
          style={{ maxHeight: 'calc(92dvh - 72px)', color: '#2A2118' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {/* 장식 기호 */}
              <div className="text-center mt-4 mb-3">
                <span
                  className="text-[#D4AF37]/50"
                  style={{ fontFamily: 'serif', fontSize: '22px', letterSpacing: '0.3em' }}
                >
                  {step === 0 ? '✦' : step === 1 ? '☽' : '✉'}
                </span>
              </div>

              {/* 제목 */}
              <h2
                className="text-center font-serif leading-relaxed whitespace-pre-line mb-0"
                style={{ fontSize: '1.35rem', letterSpacing: '0.01em', wordBreak: 'keep-all', color: '#2A2118' }}
              >
                {STEPS[step].title}
              </h2>

              <GoldRule />

              {/* 부제 */}
              {STEPS[step].subtitle && (
                <p
                  className="text-center font-serif italic leading-relaxed whitespace-pre-line mb-6"
                  style={{ fontSize: '0.8rem', color: '#2A2118', opacity: 0.55, wordBreak: 'keep-all' }}
                >
                  {STEPS[step].subtitle}
                </p>
              )}

              {/* Step 1: 현자 카드 */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {MENTORS.map((mentor) => (
                    <div
                      key={mentor.id}
                      className="relative p-3.5"
                      style={{
                        background: 'linear-gradient(135deg, #FDF9F1 0%, #F6EDD8 100%)',
                        border: '1px solid rgba(212,175,55,0.22)',
                        borderRadius: '6px',
                      }}
                    >
                      {/* 모서리 장식 */}
                      <span className="absolute top-1.5 right-2 text-[#D4AF37]/30 text-[9px]">✦</span>

                      <div className="text-xl mb-1.5" style={{ color: '#D4AF37', opacity: 0.7 }}>
                        {mentor.symbol}
                      </div>
                      <div
                        className="font-serif font-medium mb-0.5"
                        style={{ fontSize: '0.78rem', color: '#2A2118' }}
                      >
                        {mentor.name}
                      </div>
                      <div
                        className="mb-1.5"
                        style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#2A2118', opacity: 0.38, textTransform: 'uppercase' }}
                      >
                        {mentor.tradition}
                      </div>
                      <p
                        className="font-serif italic leading-relaxed"
                        style={{ fontSize: '0.68rem', color: '#2A2118', opacity: 0.55, wordBreak: 'keep-all' }}
                      >
                        {mentor.desc}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 2: 흐름 다이어그램 */}
              {step === 2 && (
                <div className="flex items-start justify-center gap-2 mb-7">
                  {[
                    { ko: '글', label: 'Desk', sub: '마음을 담아' },
                    { ko: '편', label: 'Letters', sub: '편지가 도착하고' },
                    { ko: '담', label: 'Talk', sub: '현자와 마주 앉아' },
                  ].map((item, i) => (
                    <React.Fragment key={item.label}>
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="w-11 h-11 flex items-center justify-center"
                          style={{
                            border: '1px solid rgba(212,175,55,0.35)',
                            background: 'rgba(212,175,55,0.06)',
                          }}
                        >
                          <span className="font-serif text-sm" style={{ color: '#2A2118', opacity: 0.7 }}>
                            {item.ko}
                          </span>
                        </div>
                        <span
                          style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#2A2118', opacity: 0.4, textTransform: 'uppercase' }}
                        >
                          {item.label}
                        </span>
                        <span
                          className="font-serif italic text-center"
                          style={{ fontSize: '9px', color: '#2A2118', opacity: 0.4, wordBreak: 'keep-all', maxWidth: '52px' }}
                        >
                          {item.sub}
                        </span>
                      </div>
                      {i < 2 && (
                        <div className="flex items-start pt-3.5">
                          <span style={{ color: '#D4AF37', opacity: 0.4, fontSize: '10px' }}>—</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* CTA 버튼 */}
          <button
            onClick={handleNext}
            className="w-full py-3 font-serif tracking-widest transition-all duration-200"
            style={{
              border: '1px solid rgba(42,33,24,0.25)',
              background: 'transparent',
              color: '#2A2118',
              fontSize: '0.78rem',
              letterSpacing: '0.12em',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#2A2118';
              (e.currentTarget as HTMLButtonElement).style.color = '#F5EDE0';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#2A2118';
            }}
          >
            {STEPS[step].cta}
          </button>

          {/* 건너뛰기 — 초기 온보딩에서만 */}
          {isInitial && step < STEPS.length - 1 && (
            <button
              onClick={onClose}
              className="w-full mt-3 py-1.5 font-serif italic transition-opacity"
              style={{ fontSize: '0.72rem', color: '#2A2118', opacity: 0.28, letterSpacing: '0.05em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.28'; }}
            >
              나중에 읽겠습니다
            </button>
          )}

          {/* Guide 모드에서 닫기 */}
          {!isInitial && (
            <button
              onClick={onClose}
              className="w-full mt-3 py-1.5 font-serif italic transition-opacity"
              style={{ fontSize: '0.72rem', color: '#2A2118', opacity: 0.28, letterSpacing: '0.05em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.28'; }}
            >
              닫기
            </button>
          )}

          <div className="pb-safe" />
        </div>

        {/* 하단 금색 라인 */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D4AF37]/30 to-transparent" />
      </motion.div>
    </div>
  );
}
