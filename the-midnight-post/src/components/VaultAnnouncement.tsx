import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVault } from './VaultContext';
import { useAuth } from './AuthContext';

const LS_KEY = 'vault_announced';

export default function VaultAnnouncement() {
  const { user } = useAuth();
  const { vaultStatus } = useVault();
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
            <p>
              안녕하세요, <em>'The Midnight Post'</em>입니다.
            </p>
            <p>
              당신의 가장 소중한 생각과 기록을 위한 안전한 공간이 되어드리고자,{' '}
              <em>'Vault'</em> 기능을 도입하였습니다.
            </p>
            <p>
              이제 당신의 모든 기록은 서버에 저장되기 전, 당신의 기기에서 먼저 암호화됩니다.
            </p>
            <p>
              이는 마치 당신의 일기를 아무도 열 수 없는 견고한 개인 금고에 넣고,
              그 열쇠는 오직 당신만 갖게 되는 것과 같습니다.
            </p>
            <p>
              이 금고를 열 수 있는 유일한 방법은 당신이 직접 설정하는{' '}
              <em>'Vault 비밀번호'</em>입니다. 이 비밀번호 덕분에, 저희 관리자를 포함한
              그 누구도 당신의 기록을 절대 열어볼 수 없습니다. 모든 프라이버시는 완벽히
              당신의 손에 달려 있습니다.
            </p>
            <p>
              서버에는 암호화된 문장만 저장됩니다.{' '}
              <span
                className="inline-block px-1 text-[11px] italic"
                style={{
                  background: 'rgba(44,42,41,0.06)',
                  border: '1px solid rgba(44,42,41,0.12)',
                  borderRadius: '2px',
                  color: 'rgba(44,42,41,0.5)',
                }}
              >
                [잠긴 내용]
              </span>
              {' '}은 관리자가 데이터를 열어봐도 원본이 보이지 않습니다.
            </p>
            <p>
              <em>'Vault 비밀번호'</em>는 당신의 프라이버시를 위한 가장 강력한 보호
              장치이므로, 저희 서버에 저장되지 않습니다.
            </p>

            {/* 주의사항 */}
            <div
              className="mt-2 pt-4 border-t text-[12px] leading-[1.85] space-y-1"
              style={{ borderColor: 'rgba(44,42,41,0.1)', color: 'rgba(44,42,41,0.5)' }}
            >
              <p className="uppercase tracking-[0.2em] text-[10px] mb-2" style={{ color: 'rgba(44,42,41,0.35)' }}>
                주의사항
              </p>
              <p>
                만약 비밀번호를 잃어버리면 저희도 도와드릴 방법이 없습니다.
                비밀번호를 분실하면 당신의 소중한 기록은 영원히 잠기게 되니,
                반드시 잊어버리지 않을 안전한 곳에 보관해주세요.
              </p>
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
            이해했습니다
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
