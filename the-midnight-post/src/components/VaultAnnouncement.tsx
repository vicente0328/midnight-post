import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVault } from './VaultContext';
import { useAuth } from './AuthContext';
import { useTranslation } from 'react-i18next';

const LS_KEY = 'vault_announced';

export default function VaultAnnouncement() {
  const { user } = useAuth();
  const { vaultStatus } = useVault();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(LS_KEY) === '1';
  });

  // 로그인 안 됨, vault 이미 설정됨, 또는 이미 안내 확인했으면 렌더 안 함
  if (!user || vaultStatus !== 'no-vault' || dismissed) return null;

  const handleConfirm = () => {
    localStorage.setItem(LS_KEY, '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="vault-announcement-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] flex items-center justify-center p-6"
        style={{ backgroundColor: 'rgba(22,20,18,0.96)', backdropFilter: 'blur(12px)' }}
      >
        <motion.div
          key="vault-announcement-card"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-sm bg-paper rounded-sm shadow-2xl px-8 py-10 font-serif overflow-y-auto max-h-[88vh]"
          style={{
            border: '1px solid rgba(44,42,41,0.15)',
            boxShadow: 'inset 0 0 60px rgba(139,115,85,0.06), 0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* 상단 장식선 */}
          <div className="flex items-center justify-center gap-2 mb-8 opacity-30">
            <div className="h-px flex-1 bg-ink/40" />
            <span className="text-[10px] tracking-[0.35em] uppercase" style={{ color: 'rgba(44,42,41,0.7)' }}>The Midnight Post</span>
            <div className="h-px flex-1 bg-ink/40" />
          </div>

          {/* 본문 */}
          <div
            className="text-[13px] leading-[1.95] space-y-4"
            style={{ color: 'rgba(44,42,41,0.72)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}
          >
            <p dangerouslySetInnerHTML={{ __html: t('vault.announcement.body1') }} />
            <p dangerouslySetInnerHTML={{ __html: t('vault.announcement.body2') }} />
            <p dangerouslySetInnerHTML={{ __html: t('vault.announcement.body3') }} />
            <p dangerouslySetInnerHTML={{ __html: t('vault.announcement.body4') }} />
            <p dangerouslySetInnerHTML={{ __html: t('vault.announcement.body5') }} />
            <p>
              {t('vault.announcement.body6').split('<locked>')[0]}
              <span
                className="inline-block px-1 text-[11px] italic"
                style={{
                  background: 'rgba(44,42,41,0.06)',
                  border: '1px solid rgba(44,42,41,0.12)',
                  borderRadius: '2px',
                  color: 'rgba(44,42,41,0.5)',
                }}
              >
                {t('vault.announcement.lockedLabel')}
              </span>
              {t('vault.announcement.body6').split('</locked>')[1] ?? t('vault.announcement.body6').split('<locked>')[1]?.split('</locked>')[0]}
            </p>
            <p dangerouslySetInnerHTML={{ __html: t('vault.announcement.body7') }} />

            {/* 주의사항 */}
            <div
              className="mt-2 pt-4 border-t text-[12px] leading-[1.85] space-y-1"
              style={{ borderColor: 'rgba(44,42,41,0.1)', color: 'rgba(44,42,41,0.5)' }}
            >
              <p className="uppercase tracking-[0.2em] text-[10px] mb-2" style={{ color: 'rgba(44,42,41,0.35)' }}>
                {t('vault.announcement.warningTitle')}
              </p>
              <p>{t('vault.announcement.warning')}</p>
            </div>
          </div>

          {/* 하단 장식선 */}
          <div className="flex items-center justify-center gap-2 my-7 opacity-20">
            <div className="w-1 h-1 rotate-45 bg-ink" />
            <div className="h-px w-8 bg-ink" />
            <div className="w-1 h-1 rotate-45 bg-ink" />
          </div>

          {/* 확인 버튼 */}
          <button
            onClick={handleConfirm}
            className="w-full py-2.5 text-xs tracking-[0.28em] uppercase transition-all duration-300 border"
            style={{
              borderColor: 'rgba(44,42,41,0.2)',
              color: 'rgba(44,42,41,0.65)',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(44,42,41,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(44,42,41,0.2)')}
          >
            {t('vault.announcement.confirm')}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
