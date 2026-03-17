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
    emblem: '禪',
    emblemSub: 'Seon',
  },
  {
    id: 'benedicto',
    name: '베네딕토 신부',
    tradition: '가톨릭 영성',
    desc: '사랑과 위로의 동반자. 연약함을 긍정하고 모든 존재의 존엄을 포용합니다.',
    emblem: 'IHS',
    emblemSub: 'In Hoc Signo',
  },
  {
    id: 'theodore',
    name: '테오도르 교수',
    tradition: '스토아 · 실존주의',
    desc: '이성과 실존의 철학자. 내면의 자유로 이끄는 길을 밝힙니다.',
    emblem: 'Ψ',
    emblemSub: 'Philosophia',
  },
  {
    id: 'yeonam',
    name: '연암 선생',
    tradition: '유교 · 도가',
    desc: '순리와 조화의 선비. 자연의 흐름에서 삶의 지혜를 길어 올립니다.',
    emblem: '道',
    emblemSub: 'Dao',
  },
];

const FLOW = [
  {
    symbol: '✉',
    label: '편지',
    sub: '100자의 마음을\n책상에서 부칩니다',
  },
  {
    symbol: '✦',
    label: '답장',
    sub: '네 현자가 각자의\n고전으로 답합니다',
  },
  {
    symbol: '☽',
    label: '담소',
    sub: '현자의 방에서\n직접 마주 앉습니다',
  },
];

const STEPS = [
  { id: 'welcome', cta: '현자들을 만나볼게요' },
  { id: 'mentors', cta: '어떻게 쓰는 건가요?' },
  { id: 'flow',    cta: '또 무엇이 있나요?' },
  { id: 'wisdom',  cta: '편지를 쓰러 가겠습니다' },
];

function GoldRule() {
  return (
    <div className="flex items-center justify-center gap-2 my-5">
      <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.4))' }} />
      <span style={{ color: 'rgba(212,175,55,0.6)', fontSize: '8px' }}>✦</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(212,175,55,0.4))' }} />
    </div>
  );
}

export default function OnboardingModal({ onClose, isInitial = false }: Props) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onClose();
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
        <div className="h-px w-full" style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.55), transparent)' }} />

        {/* 모바일 핸들 */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-8 h-0.5 rounded-full" style={{ background: 'rgba(42,33,24,0.18)' }} />
        </div>

        {/* 진행 다이아몬드 */}
        <div className="flex justify-center gap-3 pt-4 pb-1">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: i === step ? 1 : 0.65, opacity: i === step ? 1 : 0.28 }}
              transition={{ duration: 0.22 }}
              style={{ color: '#D4AF37', fontSize: '8px' }}
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
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >

              {/* ── Step 0: 환영 ──────────────────────────────────────────────── */}
              {step === 0 && (
                <>
                  <div className="text-center mt-5 mb-3" style={{ color: 'rgba(212,175,55,0.55)', fontFamily: 'serif', fontSize: '22px', letterSpacing: '0.3em' }}>
                    ✦
                  </div>
                  <h2 className="text-center font-serif leading-relaxed whitespace-pre-line" style={{ fontSize: '1.35rem', letterSpacing: '0.01em', wordBreak: 'keep-all', color: '#2A2118' }}>
                    {'밤의 우편함에\n오신 것을 환영합니다.'}
                  </h2>
                  <GoldRule />
                  <p className="text-center font-serif italic leading-relaxed whitespace-pre-line mb-8" style={{ fontSize: '0.82rem', color: '#2A2118', opacity: 0.55, wordBreak: 'keep-all' }}>
                    {'지친 마음을 한 줄로 적어 보내면,\n네 명의 현자가 편지로 답합니다.'}
                  </p>
                </>
              )}

              {/* ── Step 1: 현자 소개 ─────────────────────────────────────────── */}
              {step === 1 && (
                <>
                  <div className="text-center mt-5 mb-3" style={{ color: 'rgba(212,175,55,0.55)', fontFamily: 'serif', fontSize: '20px', letterSpacing: '0.3em' }}>
                    ☽
                  </div>
                  <h2 className="text-center font-serif leading-relaxed whitespace-pre-line" style={{ fontSize: '1.35rem', letterSpacing: '0.01em', wordBreak: 'keep-all', color: '#2A2118' }}>
                    {'네 명의 현자가\n기다리고 있습니다.'}
                  </h2>
                  <GoldRule />
                  <div className="grid grid-cols-2 gap-2.5 mb-6">
                    {MENTORS.map((mentor) => (
                      <div
                        key={mentor.id}
                        className="relative p-3.5"
                        style={{
                          background: 'linear-gradient(135deg, #FDF9F1 0%, #F6EDD8 100%)',
                          border: '1px solid rgba(212,175,55,0.25)',
                          borderRadius: '4px',
                        }}
                      >
                        {/* 모서리 장식 */}
                        <span className="absolute top-1.5 right-2" style={{ color: 'rgba(212,175,55,0.3)', fontSize: '8px' }}>✦</span>

                        {/* 엠블럼 */}
                        <div className="mb-2.5">
                          <div
                            className="inline-flex flex-col items-center justify-center"
                            style={{
                              width: '38px',
                              height: '38px',
                              border: '1px solid rgba(212,175,55,0.35)',
                              background: 'rgba(212,175,55,0.07)',
                            }}
                          >
                            <span
                              className="font-serif leading-none"
                              style={{
                                fontSize: mentor.emblem.length > 2 ? '11px' : '16px',
                                color: '#D4AF37',
                                opacity: 0.85,
                                letterSpacing: mentor.emblem === 'IHS' ? '0.05em' : '0',
                              }}
                            >
                              {mentor.emblem}
                            </span>
                          </div>
                          <div style={{ fontSize: '8px', color: 'rgba(212,175,55,0.45)', letterSpacing: '0.08em', marginTop: '3px', fontFamily: 'serif', fontStyle: 'italic' }}>
                            {mentor.emblemSub}
                          </div>
                        </div>

                        <div className="font-serif font-medium mb-0.5" style={{ fontSize: '0.78rem', color: '#2A2118' }}>
                          {mentor.name}
                        </div>
                        <div className="mb-1.5" style={{ fontSize: '9px', letterSpacing: '0.12em', color: '#2A2118', opacity: 0.38, textTransform: 'uppercase' }}>
                          {mentor.tradition}
                        </div>
                        <p className="font-serif italic leading-relaxed" style={{ fontSize: '0.68rem', color: '#2A2118', opacity: 0.52, wordBreak: 'keep-all' }}>
                          {mentor.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Step 2: 흐름 (편지 → 답장 → 담소) ───────────────────────── */}
              {step === 2 && (
                <>
                  <div className="text-center mt-5 mb-3" style={{ color: 'rgba(212,175,55,0.55)', fontFamily: 'serif', fontSize: '22px', letterSpacing: '0.3em' }}>
                    ✉
                  </div>
                  <h2 className="text-center font-serif leading-relaxed whitespace-pre-line" style={{ fontSize: '1.35rem', wordBreak: 'keep-all', color: '#2A2118' }}>
                    {'단 100자면\n충분합니다.'}
                  </h2>
                  <GoldRule />
                  <p className="text-center font-serif italic leading-relaxed whitespace-pre-line mb-7" style={{ fontSize: '0.8rem', color: '#2A2118', opacity: 0.52, wordBreak: 'keep-all' }}>
                    {'완벽한 문장이 아니어도 됩니다.\n지금 이 마음을 그대로 꺼내 보세요.'}
                  </p>

                  {/* 흐름 다이어그램 */}
                  <div className="flex items-start justify-center gap-1 mb-7">
                    {FLOW.map((item, i) => (
                      <React.Fragment key={item.label}>
                        <div className="flex flex-col items-center gap-2" style={{ width: '88px' }}>
                          {/* 아이콘 박스 */}
                          <div
                            className="flex items-center justify-center"
                            style={{
                              width: '46px',
                              height: '46px',
                              border: '1px solid rgba(212,175,55,0.35)',
                              background: 'rgba(212,175,55,0.06)',
                            }}
                          >
                            <span style={{ fontFamily: 'serif', fontSize: '20px', color: '#D4AF37', opacity: 0.7 }}>
                              {item.symbol}
                            </span>
                          </div>
                          {/* 라벨 */}
                          <span className="font-serif font-medium" style={{ fontSize: '0.8rem', color: '#2A2118', letterSpacing: '0.06em' }}>
                            {item.label}
                          </span>
                          {/* 설명 */}
                          <p className="text-center font-serif italic whitespace-pre-line" style={{ fontSize: '0.65rem', color: '#2A2118', opacity: 0.45, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                            {item.sub}
                          </p>
                        </div>
                        {i < 2 && (
                          <div className="pt-5" style={{ color: 'rgba(212,175,55,0.4)', fontSize: '14px', paddingLeft: '2px', paddingRight: '2px' }}>
                            ›
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}

              {/* ── Step 3: 지혜 카드 & 북마크 ───────────────────────────────── */}
              {step === 3 && (
                <>
                  <div className="text-center mt-5 mb-3" style={{ color: 'rgba(212,175,55,0.55)', fontFamily: 'serif', fontSize: '22px', letterSpacing: '0.3em' }}>
                    ✦
                  </div>
                  <h2 className="text-center font-serif leading-relaxed whitespace-pre-line" style={{ fontSize: '1.35rem', wordBreak: 'keep-all', color: '#2A2118' }}>
                    {'지혜는 계속\n쌓여갑니다.'}
                  </h2>
                  <GoldRule />

                  {/* 지혜 카드 소개 */}
                  <div
                    className="mb-3 p-4 relative"
                    style={{
                      background: 'linear-gradient(135deg, #FDF9F1 0%, #F6EDD8 100%)',
                      border: '1px solid rgba(212,175,55,0.28)',
                      borderRadius: '4px',
                    }}
                  >
                    <span className="absolute top-2 right-3" style={{ color: 'rgba(212,175,55,0.3)', fontSize: '8px' }}>✦</span>
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{ width: '36px', height: '36px', border: '1px solid rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.07)', fontSize: '16px', color: '#D4AF37', opacity: 0.8 }}
                      >
                        ✦
                      </div>
                      <div>
                        <div className="font-serif font-medium mb-1" style={{ fontSize: '0.82rem', color: '#2A2118' }}>
                          지혜 카드
                        </div>
                        <p className="font-serif italic leading-relaxed" style={{ fontSize: '0.72rem', color: '#2A2118', opacity: 0.55, wordBreak: 'keep-all' }}>
                          매일 아침과 저녁, 현자들이 고른 고전의 구절이 새롭게 업데이트됩니다. Library에서 만나볼 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 북마크 소개 */}
                  <div
                    className="mb-7 p-4 relative"
                    style={{
                      background: 'linear-gradient(135deg, #FDF9F1 0%, #F6EDD8 100%)',
                      border: '1px solid rgba(212,175,55,0.28)',
                      borderRadius: '4px',
                    }}
                  >
                    <span className="absolute top-2 right-3" style={{ color: 'rgba(212,175,55,0.3)', fontSize: '8px' }}>✦</span>
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{ width: '36px', height: '36px', border: '1px solid rgba(212,175,55,0.35)', background: 'rgba(212,175,55,0.07)', fontSize: '15px', color: '#D4AF37', opacity: 0.8 }}
                      >
                        ☆
                      </div>
                      <div>
                        <div className="font-serif font-medium mb-1" style={{ fontSize: '0.82rem', color: '#2A2118' }}>
                          책갈피
                        </div>
                        <p className="font-serif italic leading-relaxed" style={{ fontSize: '0.72rem', color: '#2A2118', opacity: 0.55, wordBreak: 'keep-all' }}>
                          마음에 울림을 준 편지나 지혜 구절은 책갈피로 저장해 언제든 다시 꺼내볼 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>

          {/* CTA 버튼 */}
          <button
            onClick={handleNext}
            className="w-full py-3 font-serif tracking-widest transition-all duration-200"
            style={{ border: '1px solid rgba(42,33,24,0.25)', background: 'transparent', color: '#2A2118', fontSize: '0.78rem', letterSpacing: '0.12em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2A2118'; (e.currentTarget as HTMLButtonElement).style.color = '#F5EDE0'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#2A2118'; }}
          >
            {STEPS[step].cta}
          </button>

          {/* 건너뛰기 / 닫기 */}
          {(isInitial ? step < STEPS.length - 1 : true) && (
            <button
              onClick={onClose}
              className="w-full mt-3 py-1.5 font-serif italic transition-opacity"
              style={{ fontSize: '0.72rem', color: '#2A2118', opacity: 0.28, letterSpacing: '0.05em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.28'; }}
            >
              {isInitial && step < STEPS.length - 1 ? '나중에 읽겠습니다' : '닫기'}
            </button>
          )}

          <div className="pb-safe" />
        </div>

        {/* 하단 금색 라인 */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.3), transparent)' }} />
      </motion.div>
    </div>
  );
}
