import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Heart, Scale, Leaf, Feather, Mail, Library, BookMarked } from 'lucide-react';

interface Props {
  onClose: () => void;
  isInitial?: boolean;
}

/* ─────────────────────────── 색상 상수 ─────────────────────────────────── */
const GOLD   = '#A8892A';
const TEXT   = '#1D1508';
const PAPER  = 'linear-gradient(168deg, #F5EECF 0%, #EDE2B8 55%, #E5D5A3 100%)';
const RULE   = 'rgba(168,137,42,0.22)';

/* ─────────────────────────── 현자 데이터 ───────────────────────────────── */
const MENTORS = [
  {
    id: 'hyewoon',
    Icon: Moon,
    name: '혜운 스님',
    tradition: '선불교',
    desc: '비움과 머무름의 수행자. 집착을 내려놓고 지금 이 순간에 머무는 법을 전합니다.',
  },
  {
    id: 'benedicto',
    Icon: Heart,
    name: '베네딕토 신부',
    tradition: '가톨릭 영성',
    desc: '사랑과 위로의 동반자. 연약함을 긍정하고 모든 존재의 존엄을 포용합니다.',
  },
  {
    id: 'theodore',
    Icon: Scale,
    name: '테오도르 교수',
    tradition: '스토아 · 실존주의',
    desc: '이성과 실존의 철학자. 내면의 자유로 이끄는 길을 밝힙니다.',
  },
  {
    id: 'yeonam',
    Icon: Leaf,
    name: '연암 선생',
    tradition: '유교 · 도가',
    desc: '순리와 조화의 선비. 자연의 흐름에서 삶의 지혜를 길어 올립니다.',
  },
];

/* ─────────────────────────── 단계 ──────────────────────────────────────── */
const STEPS = [
  { Icon: Feather,    cta: '현자들을 만나볼게요'      },
  { Icon: Moon,       cta: '어떻게 쓰는 건가요?'      },
  { Icon: Mail,       cta: '또 무엇이 있나요?'         },
  { Icon: Library,    cta: '편지를 쓰러 가겠습니다'   },
];

/* ─────────────────────────── 금 분리선 ─────────────────────────────────── */
function Rule() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, transparent, ${RULE})` }} />
      <div style={{ width: '4px', height: '4px', background: GOLD, opacity: 0.45, transform: 'rotate(45deg)' }} />
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(to left, transparent, ${RULE})` }} />
    </div>
  );
}

/* ─────────────────────────── CTA 버튼 ──────────────────────────────────── */
function CtaButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '14px 0',
        border: `1px solid rgba(29,21,8,${hov ? '0.8' : '0.22'})`,
        background: hov ? TEXT : 'transparent',
        color: hov ? '#F5EECF' : TEXT,
        fontFamily: 'serif', fontSize: '0.76rem',
        letterSpacing: '0.18em', textTransform: 'uppercase' as const,
        transition: 'all 0.22s ease', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/* ─────────────────────────── 보조 버튼 ─────────────────────────────────── */
function SubButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', marginTop: '10px', padding: '7px 0',
        background: 'none', border: 'none',
        fontFamily: 'serif', fontStyle: 'italic', fontSize: '0.7rem',
        color: TEXT, opacity: hov ? 0.45 : 0.22,
        letterSpacing: '0.06em', transition: 'opacity 0.18s', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/* ─────────────────────────── 메인 ──────────────────────────────────────── */
export default function OnboardingModal({ onClose, isInitial = false }: Props) {
  const [step, setStep] = useState(0);
  const advance = () => step < STEPS.length - 1 ? setStep(s => s + 1) : onClose();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(8, 5, 1, 0.72)',
        backdropFilter: 'blur(6px)',
      }}
      className="sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%', maxWidth: '410px', maxHeight: '92dvh',
          background: PAPER,
          borderRadius: '1px 1px 0 0',
          boxShadow: `0 0 0 1px rgba(168,137,42,0.32), 0 -16px 80px rgba(8,5,1,0.5)`,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* 상단 금선 */}
        <div style={{ height: '1.5px', background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`, flexShrink: 0 }} />

        {/* 모바일 핸들 */}
        <div className="sm:hidden" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: '28px', height: '2px', background: `rgba(168,137,42,0.3)`, borderRadius: '1px' }} />
        </div>

        {/* 진행 표시 — 가로선 위 점 */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '16px 0 0' }}>
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{ opacity: i === step ? 1 : 0.2, scale: i === step ? 1.2 : 0.85 }}
              transition={{ duration: 0.2 }}
              style={{ width: '5px', height: '5px', background: GOLD, transform: 'rotate(45deg)', transformOrigin: 'center' }}
            />
          ))}
        </div>

        {/* 스크롤 영역 */}
        <div style={{ overflowY: 'auto', padding: '0 36px 32px', flex: 1 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >

              {/* ════════ STEP 0 — 환영 ════════════════════════════════════ */}
              {step === 0 && (
                <div style={{ textAlign: 'center', paddingTop: '28px' }}>
                  {/* 아이콘 */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <Feather size={22} strokeWidth={1.2} color={GOLD} style={{ opacity: 0.7 }} />
                  </div>
                  <h2 style={{
                    fontFamily: 'serif', fontSize: '1.6rem', lineHeight: 1.65,
                    letterSpacing: '0.02em', color: TEXT,
                    whiteSpace: 'pre-line', wordBreak: 'keep-all', margin: 0,
                  }}>
                    {'밤의 우편함에\n오신 것을 환영합니다.'}
                  </h2>
                  <Rule />
                  <p style={{
                    fontFamily: 'serif', fontStyle: 'italic', fontSize: '0.85rem',
                    lineHeight: 1.9, color: TEXT, opacity: 0.55,
                    whiteSpace: 'pre-line', wordBreak: 'keep-all', marginBottom: '36px',
                  }}>
                    {'지친 마음을 한 줄로 적어 보내면,\n네 명의 현자가 편지로 답합니다.'}
                  </p>
                </div>
              )}

              {/* ════════ STEP 1 — 현자 ════════════════════════════════════ */}
              {step === 1 && (
                <div style={{ paddingTop: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <Moon size={20} strokeWidth={1.2} color={GOLD} style={{ opacity: 0.65 }} />
                  </div>
                  <h2 style={{
                    fontFamily: 'serif', fontSize: '1.35rem', lineHeight: 1.65,
                    letterSpacing: '0.02em', color: TEXT,
                    whiteSpace: 'pre-line', wordBreak: 'keep-all',
                    textAlign: 'center', margin: 0,
                  }}>
                    {'네 명의 현자가\n기다리고 있습니다.'}
                  </h2>
                  <Rule />

                  {/* 현자 목록 */}
                  <div style={{ marginBottom: '28px' }}>
                    {MENTORS.map(({ id, Icon, name, tradition, desc }, i) => (
                      <div
                        key={id}
                        style={{
                          display: 'flex', gap: '16px',
                          padding: '14px 0',
                          borderBottom: i < MENTORS.length - 1
                            ? '1px solid rgba(168,137,42,0.13)'
                            : 'none',
                        }}
                      >
                        {/* 아이콘 프레임 */}
                        <div style={{
                          flexShrink: 0,
                          width: '38px', height: '38px',
                          border: '1px solid rgba(29,21,8,0.18)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(29,21,8,0.03)',
                        }}>
                          <Icon size={17} strokeWidth={1.3} color={TEXT} style={{ opacity: 0.7 }} />
                        </div>
                        {/* 텍스트 */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontFamily: 'serif', fontSize: '0.9rem', fontWeight: 500,
                            color: TEXT, letterSpacing: '0.02em', marginBottom: '2px',
                          }}>
                            {name}
                          </div>
                          <div style={{
                            fontSize: '9px', letterSpacing: '0.14em',
                            color: TEXT, opacity: 0.35,
                            textTransform: 'uppercase', marginBottom: '6px',
                          }}>
                            {tradition}
                          </div>
                          <p style={{
                            fontFamily: 'serif', fontStyle: 'italic',
                            fontSize: '0.72rem', lineHeight: 1.7,
                            color: TEXT, opacity: 0.5,
                            wordBreak: 'keep-all', margin: 0,
                          }}>
                            {desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════ STEP 2 — 편지·답장·담소 ═══════════════════════════ */}
              {step === 2 && (
                <div style={{ textAlign: 'center', paddingTop: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <Mail size={20} strokeWidth={1.2} color={GOLD} style={{ opacity: 0.65 }} />
                  </div>
                  <h2 style={{
                    fontFamily: 'serif', fontSize: '1.35rem', lineHeight: 1.65,
                    letterSpacing: '0.02em', color: TEXT,
                    whiteSpace: 'pre-line', wordBreak: 'keep-all', margin: 0,
                  }}>
                    {'단 100자면\n충분합니다.'}
                  </h2>
                  <Rule />
                  <p style={{
                    fontFamily: 'serif', fontStyle: 'italic', fontSize: '0.82rem',
                    lineHeight: 1.85, color: TEXT, opacity: 0.52,
                    wordBreak: 'keep-all', marginBottom: '28px',
                  }}>
                    {'완벽한 문장이 아니어도 됩니다.\n지금 이 마음을 그대로 꺼내 보세요.'}
                  </p>

                  {/* 3단 흐름 */}
                  {[
                    { Icon: Mail,      title: '편지',  body: '책상에서 100자의 마음을\n현자들에게 부칩니다.' },
                    { Icon: Feather,   title: '답장',  body: '네 현자가 각자의 고전으로\n위로의 편지를 씁니다.' },
                    { Icon: BookMarked,title: '담소',  body: '현자의 방을 찾아가\n마주 앉아 이야기 나눕니다.' },
                  ].map((item, i) => (
                    <React.Fragment key={item.title}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                          <item.Icon size={20} strokeWidth={1.2} color={GOLD} style={{ opacity: 0.6 }} />
                        </div>
                        <div style={{
                          fontFamily: 'serif', fontSize: '0.95rem', fontWeight: 500,
                          color: TEXT, letterSpacing: '0.06em', marginBottom: '6px',
                        }}>
                          {item.title}
                        </div>
                        <p style={{
                          fontFamily: 'serif', fontStyle: 'italic',
                          fontSize: '0.74rem', lineHeight: 1.8,
                          color: TEXT, opacity: 0.48,
                          whiteSpace: 'pre-line', wordBreak: 'keep-all', margin: 0,
                        }}>
                          {item.body}
                        </p>
                      </div>
                      {i < 2 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          margin: '16px auto', width: '40px',
                          justifyContent: 'center',
                        }}>
                          <div style={{ flex: 1, height: '1px', background: RULE }} />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  <div style={{ marginBottom: '28px' }} />
                </div>
              )}

              {/* ════════ STEP 3 — 지혜 카드 & 책갈피 ════════════════════════ */}
              {step === 3 && (
                <div style={{ paddingTop: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <Library size={20} strokeWidth={1.2} color={GOLD} style={{ opacity: 0.65 }} />
                  </div>
                  <h2 style={{
                    fontFamily: 'serif', fontSize: '1.35rem', lineHeight: 1.65,
                    letterSpacing: '0.02em', color: TEXT,
                    whiteSpace: 'pre-line', wordBreak: 'keep-all',
                    textAlign: 'center', margin: 0,
                  }}>
                    {'지혜는 계속\n쌓여갑니다.'}
                  </h2>
                  <Rule />

                  {/* 지혜 카드 */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
                    <div style={{
                      flexShrink: 0, width: '38px', height: '38px',
                      border: '1px solid rgba(29,21,8,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(29,21,8,0.03)',
                    }}>
                      <Library size={17} strokeWidth={1.3} color={TEXT} style={{ opacity: 0.65 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'serif', fontSize: '0.9rem', fontWeight: 500,
                        color: TEXT, letterSpacing: '0.02em', marginBottom: '5px',
                      }}>
                        지혜 카드
                      </div>
                      <p style={{
                        fontFamily: 'serif', fontStyle: 'italic',
                        fontSize: '0.73rem', lineHeight: 1.75,
                        color: TEXT, opacity: 0.5, wordBreak: 'keep-all', margin: 0,
                      }}>
                        매일 아침과 저녁, 현자들이 선별한 고전의 구절이 새롭게 업데이트됩니다. 하단 탭 Library에서 만날 수 있습니다.
                      </p>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: RULE, opacity: 0.6, margin: '18px 0' }} />

                  {/* 책갈피 */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '36px' }}>
                    <div style={{
                      flexShrink: 0, width: '38px', height: '38px',
                      border: '1px solid rgba(29,21,8,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(29,21,8,0.03)',
                    }}>
                      <BookMarked size={17} strokeWidth={1.3} color={TEXT} style={{ opacity: 0.65 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'serif', fontSize: '0.9rem', fontWeight: 500,
                        color: TEXT, letterSpacing: '0.02em', marginBottom: '5px',
                      }}>
                        책갈피
                      </div>
                      <p style={{
                        fontFamily: 'serif', fontStyle: 'italic',
                        fontSize: '0.73rem', lineHeight: 1.75,
                        color: TEXT, opacity: 0.5, wordBreak: 'keep-all', margin: 0,
                      }}>
                        마음에 울림을 준 편지나 지혜 구절은 책갈피로 저장해 Archive에서 언제든 다시 꺼내볼 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          <CtaButton label={STEPS[step].cta} onClick={advance} />
          {isInitial && step < STEPS.length - 1 && (
            <SubButton label="나중에 읽겠습니다" onClick={onClose} />
          )}
          {!isInitial && <SubButton label="닫기" onClick={onClose} />}
        </div>

        {/* 하단 금선 */}
        <div style={{ height: '1px', background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`, opacity: 0.28, flexShrink: 0 }} />
      </motion.div>
    </div>
  );
}
