import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flower2, Cross, Pen, Brush, Mail, Library, BookMarked, Feather } from 'lucide-react';

interface Props {
  onClose: () => void;
  isInitial?: boolean;
}

/* ── 폰트 & 색상 ──────────────────────────────────────────────────────────── */
const SERIF = `'Cormorant Garamond', 'Nanum Myeongjo', serif`;
const PAPER = '#EDE6CC';          // 단일 양피지 — 그라디언트 없음
const INK   = '#1A1208';          // 따뜻한 거의-검정
const GOLD  = 'rgba(148,112,28,0.7)'; // 극소량만 사용 (상하 테두리선)
const MUTE  = `rgba(26,18,8,`;    // 잉크 기반 opacity 헬퍼

/* ── 현자 ─────────────────────────────────────────────────────────────────── */
const MENTORS = [
  { id: 'hyewoon',   Icon: Flower2, name: '혜운 스님',    tradition: '선불교',           desc: '비움과 머무름의 수행자. 집착을 내려놓고 지금 이 순간에 머무는 법을 전합니다.' },
  { id: 'benedicto', Icon: Cross,   name: '베네딕토 신부', tradition: '가톨릭 영성',       desc: '사랑과 위로의 동반자. 연약함을 긍정하고 모든 존재의 존엄을 포용합니다.' },
  { id: 'theodore',  Icon: Pen,     name: '테오도르 교수', tradition: '스토아 · 실존주의',  desc: '이성과 실존의 철학자. 내면의 자유로 이끄는 길을 밝힙니다.' },
  { id: 'yeonam',    Icon: Brush,   name: '연암 선생',    tradition: '유교 · 도가',        desc: '순리와 조화의 선비. 자연의 흐름에서 삶의 지혜를 길어 올립니다.' },
];

/* ── 흐름 단계 ───────────────────────────────────────────────────────────── */
const FLOW = [
  { Icon: Mail,       title: '편지',  desc: '책상에서 100자의 마음을\n현자들에게 부칩니다.' },
  { Icon: Feather,    title: '답장',  desc: '네 현자가 각자의 고전으로\n위로의 편지를 씁니다.' },
  { Icon: BookMarked, title: '담소',  desc: '현자의 방을 찾아가\n마주 앉아 이야기 나눕니다.' },
];

/* ── 페이지 CTA ───────────────────────────────────────────────────────────── */
const PAGES = [
  { cta: '현자들을 만나볼게요'      },
  { cta: '어떻게 쓰는 건가요?'     },
  { cta: '또 무엇이 있나요?'        },
  { cta: '편지를 쓰러 가겠습니다'  },
];

/* ── * * * 문학적 분리선 ────────────────────────────────────────────────────
   고서 표준 섹션 구분자. 금색 없이 잉크로만.                                */
function Asterism() {
  return (
    <div style={{
      textAlign: 'center', margin: '22px 0',
      fontFamily: SERIF, fontSize: '0.72rem',
      color: INK, opacity: 0.28, letterSpacing: '14px',
    }}>
      * * *
    </div>
  );
}

/* ── 얇은 잉크 선 ────────────────────────────────────────────────────────── */
function HRule({ my = '16px' }: { my?: string }) {
  return <div style={{ height: '1px', background: `${MUTE}0.1)`, margin: `${my} 0` }} />;
}

/* ── CTA 버튼 — 활자 도장 느낌 ───────────────────────────────────────────── */
function CtaButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '14px 0',
        border: `1px solid ${MUTE}${hov ? '0.7' : '0.2'})`,
        background: hov ? INK : 'transparent',
        color: hov ? PAPER : INK,
        fontFamily: SERIF, fontStyle: 'italic',
        fontSize: '0.9rem', letterSpacing: '0.1em',
        transition: 'all 0.2s ease', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/* ── 보조 버튼 ───────────────────────────────────────────────────────────── */
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
        fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.75rem',
        color: INK, opacity: hov ? 0.45 : 0.22,
        letterSpacing: '0.05em', transition: 'opacity 0.18s', cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/* ── 페이지 타이틀 ────────────────────────────────────────────────────────── */
function PageTitle({ children }: { children: string }) {
  return (
    <h2 style={{
      fontFamily: SERIF, fontWeight: 300,
      fontSize: '1.7rem', lineHeight: 1.55, letterSpacing: '0.015em',
      color: INK, whiteSpace: 'pre-line', wordBreak: 'keep-all',
      textAlign: 'center', margin: 0,
    }}>
      {children}
    </h2>
  );
}

/* ── 본문 이탤릭 ──────────────────────────────────────────────────────────── */
function Body({ children, center }: { children: string; center?: boolean }) {
  return (
    <p style={{
      fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
      fontSize: '0.86rem', lineHeight: 1.95, letterSpacing: '0.01em',
      color: INK, opacity: 0.58,
      textAlign: center ? 'center' : 'left',
      whiteSpace: 'pre-line', wordBreak: 'keep-all', margin: 0,
    }}>
      {children}
    </p>
  );
}

/* ════════════════════════════ 메인 ════════════════════════════════════════ */
export default function OnboardingModal({ onClose, isInitial = false }: Props) {
  const [step, setStep] = useState(0);
  const advance = () => step < PAGES.length - 1 ? setStep(s => s + 1) : onClose();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(6, 3, 0, 0.75)',
        backdropFilter: 'blur(7px)',
      }}
      className="sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%', maxWidth: '400px', maxHeight: '92dvh',
          background: PAPER,
          /* 상하 테두리에만 금색 — 그것 외엔 잉크 */
          borderTop:    `1.5px solid ${GOLD}`,
          borderLeft:   `1px solid ${MUTE}0.12)`,
          borderRight:  `1px solid ${MUTE}0.12)`,
          borderBottom: `1.5px solid ${GOLD}`,
          boxShadow: `0 -20px 80px rgba(6,3,0,0.5), 0 0 0 1px ${MUTE}0.08)`,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* 모바일 핸들 */}
        <div className="sm:hidden" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: '28px', height: '1.5px', background: `${MUTE}0.2)` }} />
        </div>

        {/* 로마 숫자 진행 표시 */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '18px',
          padding: '14px 0 0',
        }}>
          {['I', 'II', 'III', 'IV'].map((num, i) => (
            <span key={num} style={{
              fontFamily: SERIF, fontStyle: 'italic',
              fontSize: '0.72rem', letterSpacing: '0.04em',
              color: INK,
              opacity: i === step ? 0.75 : 0.18,
              transition: 'opacity 0.25s',
            }}>
              {num}
            </span>
          ))}
        </div>

        {/* 스크롤 영역 */}
        <div style={{ overflowY: 'auto', padding: '4px 38px 32px', flex: 1 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >

              {/* ════ I. 환영 ═══════════════════════════════════════════════ */}
              {step === 0 && (
                <div style={{ paddingTop: '32px', textAlign: 'center' }}>
                  <PageTitle>{'밤의 우편함에\n오신 것을 환영합니다.'}</PageTitle>
                  <Asterism />
                  <Body center>
                    {'지친 마음을 한 줄로 적어 보내면,\n네 명의 현자가 편지로 답합니다.'}
                  </Body>
                  <div style={{ height: '36px' }} />
                </div>
              )}

              {/* ════ II. 현자 ═══════════════════════════════════════════════ */}
              {step === 1 && (
                <div style={{ paddingTop: '28px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <PageTitle>{'네 명의 현자가\n기다리고 있습니다.'}</PageTitle>
                  </div>
                  <Asterism />

                  {MENTORS.map(({ id, Icon, name, tradition, desc }, i) => (
                    <div key={id}>
                      {i > 0 && <HRule my="0px" />}
                      <div style={{ display: 'flex', gap: '14px', padding: '15px 0' }}>
                        {/* 아이콘 — 프레임 없이 잉크색으로만 */}
                        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                          <Icon size={16} strokeWidth={1.2} color={INK} style={{ opacity: 0.55 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontFamily: SERIF, fontWeight: 500,
                            fontSize: '0.92rem', letterSpacing: '0.03em',
                            color: INK, marginBottom: '2px',
                          }}>
                            {name}
                          </div>
                          <div style={{
                            fontSize: '9px', letterSpacing: '0.16em',
                            color: INK, opacity: 0.32,
                            textTransform: 'uppercase', marginBottom: '6px',
                            fontFamily: SERIF,
                          }}>
                            {tradition}
                          </div>
                          <p style={{
                            fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                            fontSize: '0.75rem', lineHeight: 1.75,
                            color: INK, opacity: 0.52,
                            wordBreak: 'keep-all', margin: 0,
                          }}>
                            {desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ height: '20px' }} />
                </div>
              )}

              {/* ════ III. 편지·답장·담소 ════════════════════════════════════ */}
              {step === 2 && (
                <div style={{ paddingTop: '32px', textAlign: 'center' }}>
                  <PageTitle>{'단 100자면\n충분합니다.'}</PageTitle>
                  <Asterism />
                  <Body center>
                    {'완벽한 문장이 아니어도 됩니다.\n지금 이 마음을 그대로 꺼내 보세요.'}
                  </Body>

                  <div style={{ margin: '28px 0' }}>
                    {FLOW.map(({ Icon, title, desc }, i) => (
                      <React.Fragment key={title}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', textAlign: 'left' }}>
                          {/* 아이콘 */}
                          <div style={{ flexShrink: 0, paddingTop: '3px' }}>
                            <Icon size={15} strokeWidth={1.2} color={INK} style={{ opacity: 0.5 }} />
                          </div>
                          <div>
                            <div style={{
                              fontFamily: SERIF, fontWeight: 500,
                              fontSize: '0.95rem', letterSpacing: '0.05em',
                              color: INK, marginBottom: '4px',
                            }}>
                              {title}
                            </div>
                            <p style={{
                              fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                              fontSize: '0.76rem', lineHeight: 1.8,
                              color: INK, opacity: 0.5,
                              whiteSpace: 'pre-line', wordBreak: 'keep-all', margin: 0,
                            }}>
                              {desc}
                            </p>
                          </div>
                        </div>
                        {i < 2 && <HRule my="14px" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* ════ IV. 지혜 카드 & 책갈피 ════════════════════════════════ */}
              {step === 3 && (
                <div style={{ paddingTop: '32px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <PageTitle>{'지혜는 계속\n쌓여갑니다.'}</PageTitle>
                  </div>
                  <Asterism />

                  {/* 지혜 카드 */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '8px' }}>
                    <div style={{ flexShrink: 0, paddingTop: '3px' }}>
                      <Library size={15} strokeWidth={1.2} color={INK} style={{ opacity: 0.5 }} />
                    </div>
                    <div>
                      <div style={{
                        fontFamily: SERIF, fontWeight: 500,
                        fontSize: '0.92rem', letterSpacing: '0.03em',
                        color: INK, marginBottom: '5px',
                      }}>
                        지혜 카드
                      </div>
                      <p style={{
                        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                        fontSize: '0.76rem', lineHeight: 1.8,
                        color: INK, opacity: 0.52,
                        wordBreak: 'keep-all', margin: 0,
                      }}>
                        매일 아침과 저녁, 현자들이 선별한 고전의 구절이 새롭게 업데이트됩니다. 하단 탭 Library에서 만날 수 있습니다.
                      </p>
                    </div>
                  </div>

                  <HRule my="18px" />

                  {/* 책갈피 */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '36px' }}>
                    <div style={{ flexShrink: 0, paddingTop: '3px' }}>
                      <BookMarked size={15} strokeWidth={1.2} color={INK} style={{ opacity: 0.5 }} />
                    </div>
                    <div>
                      <div style={{
                        fontFamily: SERIF, fontWeight: 500,
                        fontSize: '0.92rem', letterSpacing: '0.03em',
                        color: INK, marginBottom: '5px',
                      }}>
                        책갈피
                      </div>
                      <p style={{
                        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                        fontSize: '0.76rem', lineHeight: 1.8,
                        color: INK, opacity: 0.52,
                        wordBreak: 'keep-all', margin: 0,
                      }}>
                        마음에 울림을 준 편지나 지혜 구절은 책갈피로 저장해 Archive에서 언제든 다시 꺼내볼 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          <CtaButton label={PAGES[step].cta} onClick={advance} />
          {isInitial && step < PAGES.length - 1 && (
            <SubButton label="나중에 읽겠습니다" onClick={onClose} />
          )}
          {!isInitial && <SubButton label="닫기" onClick={onClose} />}
        </div>
      </motion.div>
    </div>
  );
}
