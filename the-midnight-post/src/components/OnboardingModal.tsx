import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flower2, Cross, Pen, Brush, Mail, Library, BookMarked, Feather } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  onClose: () => void;
  isInitial?: boolean;
}

/* ── 폰트 & 색상 ──────────────────────────────────────────────────────────── */
const SERIF = `'Cormorant Garamond', 'Nanum Myeongjo', serif`;
const PAPER = '#EDE6CC';
const INK   = '#1A1208';
const GOLD  = 'rgba(148,112,28,0.7)';
const MUTE  = `rgba(26,18,8,`;

/* ── 현자 아이콘만 ───────────────────────────────────────────────────────── */
const MENTOR_ICONS = [
  { id: 'hyewoon',   Icon: Flower2 },
  { id: 'benedicto', Icon: Cross   },
  { id: 'theodore',  Icon: Pen     },
  { id: 'yeonam',    Icon: Brush   },
] as const;

/* ── 흐름 아이콘만 ───────────────────────────────────────────────────────── */
const FLOW_ICONS = [
  { key: 'letter', Icon: Mail       },
  { key: 'reply',  Icon: Feather    },
  { key: 'damso',  Icon: BookMarked },
] as const;

/* ── 샘플 편지 아이콘만 ───────────────────────────────────────────────────── */
const SAMPLE_ICONS = [
  { id: 'hyewoon',   Icon: Flower2 },
  { id: 'benedicto', Icon: Cross   },
] as const;

/* ── * * * 문학적 분리선 ─────────────────────────────────────────────────── */
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

/* ── CTA 버튼 ─────────────────────────────────────────────────────────────── */
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
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const cta = t('onboarding.cta', { returnObjects: true }) as string[];
  const TOTAL = cta.length; // 5
  const advance = () => step < TOTAL - 1 ? setStep(s => s + 1) : onClose();

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
          {['I', 'II', 'III', 'IV', 'V'].map((num, i) => (
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
                  <PageTitle>{t('onboarding.welcome.title')}</PageTitle>
                  <Asterism />
                  <Body center>{t('onboarding.welcome.body')}</Body>
                  <div style={{ height: '36px' }} />
                </div>
              )}

              {/* ════ II. 현자 ═══════════════════════════════════════════════ */}
              {step === 1 && (
                <div style={{ paddingTop: '24px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <PageTitle>{t('onboarding.mentors.title')}</PageTitle>
                  </div>
                  <Asterism />

                  {MENTOR_ICONS.map(({ id, Icon }, i) => (
                    <div key={id}>
                      {i > 0 && <HRule my="0px" />}
                      <div style={{ display: 'flex', gap: '14px', padding: '13px 0', alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, paddingTop: '3px' }}>
                          <Icon size={15} strokeWidth={1.2} color={INK} style={{ opacity: 0.55 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontFamily: SERIF, fontWeight: 500,
                            fontSize: '0.9rem', letterSpacing: '0.03em',
                            color: INK, marginBottom: '3px',
                          }}>
                            {t(`mentors.${id}.name`)}
                          </div>
                          <div style={{
                            fontSize: '9px', letterSpacing: '0.16em',
                            color: INK, opacity: 0.32,
                            textTransform: 'uppercase',
                            fontFamily: SERIF, margin: 0,
                          }}>
                            {t(`mentors.${id}.tradition`)}
                          </div>
                          <p style={{
                            fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                            fontSize: '0.72rem', lineHeight: 1.7,
                            color: INK, opacity: 0.48,
                            wordBreak: 'keep-all', margin: '5px 0 0',
                          }}>
                            {t(`onboarding.mentors.${id}.desc`)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ height: '12px' }} />
                </div>
              )}

              {/* ════ III. 편지·답장·담소 ════════════════════════════════════ */}
              {step === 2 && (
                <div style={{ paddingTop: '32px', textAlign: 'center' }}>
                  <PageTitle>{t('onboarding.howItWorks.title')}</PageTitle>
                  <Asterism />
                  <Body center>{t('onboarding.howItWorks.body')}</Body>

                  <div style={{ margin: '28px 0' }}>
                    {FLOW_ICONS.map(({ key, Icon }, i) => (
                      <React.Fragment key={key}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', textAlign: 'left' }}>
                          <div style={{ flexShrink: 0, paddingTop: '3px' }}>
                            <Icon size={15} strokeWidth={1.2} color={INK} style={{ opacity: 0.5 }} />
                          </div>
                          <div>
                            <div style={{
                              fontFamily: SERIF, fontWeight: 500,
                              fontSize: '0.95rem', letterSpacing: '0.05em',
                              color: INK, marginBottom: '4px',
                            }}>
                              {t(`onboarding.howItWorks.${key}.title`)}
                            </div>
                            <p style={{
                              fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                              fontSize: '0.76rem', lineHeight: 1.8,
                              color: INK, opacity: 0.5,
                              whiteSpace: 'pre-line', wordBreak: 'keep-all', margin: 0,
                            }}>
                              {t(`onboarding.howItWorks.${key}.desc`)}
                            </p>
                          </div>
                        </div>
                        {i < 2 && <HRule my="14px" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* ════ IV. 샘플 편지 미리보기 ════════════════════════════════ */}
              {step === 3 && (
                <div style={{ paddingTop: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <PageTitle>{t('onboarding.sampleLetters.title')}</PageTitle>
                  </div>
                  <Asterism />

                  {/* 샘플 일기 */}
                  <div style={{
                    borderLeft: `2px solid ${MUTE}0.15)`,
                    paddingLeft: '12px', marginBottom: '18px',
                  }}>
                    <p style={{
                      fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                      fontSize: '0.8rem', color: INK, opacity: 0.45,
                      lineHeight: 1.6, margin: '0 0 3px',
                    }}>
                      {t('onboarding.sampleLetters.sampleDiary')}
                    </p>
                    <p style={{
                      fontSize: '9px', letterSpacing: '0.18em',
                      textTransform: 'uppercase', color: INK, opacity: 0.25,
                      fontFamily: SERIF, margin: 0,
                    }}>
                      {t('onboarding.sampleLetters.sampleLabel')}
                    </p>
                  </div>

                  {/* 샘플 편지 카드 2통 */}
                  {SAMPLE_ICONS.map(({ id, Icon }, i) => (
                    <div key={id}>
                      {i > 0 && <div style={{ height: '10px' }} />}
                      <div style={{
                        border: `1px solid ${MUTE}0.1)`,
                        background: 'rgba(255,255,255,0.35)',
                        padding: '12px 14px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                          <Icon size={12} strokeWidth={1.2} color={INK} style={{ opacity: 0.45 }} />
                          <span style={{
                            fontFamily: SERIF, fontWeight: 500,
                            fontSize: '0.8rem', color: INK, opacity: 0.7,
                          }}>{t(`mentors.${id}.name`)}</span>
                        </div>
                        <p style={{
                          fontFamily: SERIF, fontStyle: 'italic',
                          fontSize: '0.74rem', color: INK, opacity: 0.62,
                          lineHeight: 1.5, margin: '0 0 4px',
                        }}>
                          "{t(`onboarding.sampleLetters.${id}.quote`)}"
                        </p>
                        <p style={{
                          fontSize: '9px', letterSpacing: '0.08em',
                          color: INK, opacity: 0.28, fontFamily: SERIF, margin: '0 0 9px',
                        }}>
                          {t(`onboarding.sampleLetters.${id}.source`)} · {t(`onboarding.sampleLetters.${id}.translation`)}
                        </p>
                        <div style={{ height: '1px', background: `${MUTE}0.08)`, marginBottom: '9px' }} />
                        <p style={{
                          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                          fontSize: '0.73rem', lineHeight: 1.8,
                          color: INK, opacity: 0.55,
                          wordBreak: 'keep-all', margin: 0,
                        }}>
                          {t(`onboarding.sampleLetters.${id}.snippet`)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div style={{ height: '12px' }} />
                </div>
              )}

              {/* ════ V. 지혜 카드 & 책갈피 ════════════════════════════════ */}
              {step === 4 && (
                <div style={{ paddingTop: '32px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <PageTitle>{t('onboarding.features.title')}</PageTitle>
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
                        {t('onboarding.features.knowledge.title')}
                      </div>
                      <p style={{
                        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                        fontSize: '0.76rem', lineHeight: 1.8,
                        color: INK, opacity: 0.52,
                        wordBreak: 'keep-all', margin: 0,
                      }}>
                        {t('onboarding.features.knowledge.desc')}
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
                        {t('onboarding.features.bookmark.title')}
                      </div>
                      <p style={{
                        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300,
                        fontSize: '0.76rem', lineHeight: 1.8,
                        color: INK, opacity: 0.52,
                        wordBreak: 'keep-all', margin: 0,
                      }}>
                        {t('onboarding.features.bookmark.desc')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          <CtaButton label={cta[step]} onClick={advance} />
          {isInitial && step < TOTAL - 1 && (
            <SubButton label={t('onboarding.skipForNow')} onClick={onClose} />
          )}
          {!isInitial && <SubButton label={t('onboarding.close')} onClick={onClose} />}

          {/* AI 생성 안내 */}
          <p style={{
            fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.65rem',
            color: INK, opacity: 0.22, textAlign: 'center',
            lineHeight: 1.7, marginTop: '14px', wordBreak: 'keep-all',
          }}>
            이 서비스의 멘토들은 생성형 AI 기술을 통해 응답합니다.{'\n'}
            작성하신 일기는 AI 답장 생성에만 사용되며, 전문적 심리 상담을 대체하지 않습니다.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
