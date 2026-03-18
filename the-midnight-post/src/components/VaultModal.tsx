import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useVault } from './VaultContext';
import { useAuth } from './AuthContext';

export default function VaultModal() {
  const { user } = useAuth();
  const { vaultStatus, setupVault, unlockVault, skipVault } = useVault();

  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 로그인하지 않았거나 이미 열려 있거나 필요 없으면 렌더하지 않음
  if (!user || (vaultStatus !== 'no-vault' && vaultStatus !== 'locked')) return null;

  const isSetup = vaultStatus === 'no-vault';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSetup) {
      if (passphrase.length < 4) {
        setError('비밀번호는 4자 이상이어야 합니다.');
        return;
      }
      if (passphrase !== confirm) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
      setLoading(true);
      try {
        await setupVault(passphrase);
      } catch (err) {
        console.error('[VaultModal] setupVault error:', err);
        setError('설정 중 오류가 발생했습니다. 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      const ok = await unlockVault(passphrase);
      setLoading(false);
      if (!ok) setError('비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="vault-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-6"
        style={{ backgroundColor: 'rgba(22,20,18,0.93)', backdropFilter: 'blur(10px)' }}
      >
        <motion.div
          key="vault-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-xs bg-paper rounded-sm shadow-2xl px-8 py-10 font-serif"
          style={{ border: '1px solid rgba(44,42,41,0.1)' }}
        >
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <Lock size={18} strokeWidth={1.5} className="opacity-35" />
            </div>
            <h2 className="text-base tracking-widest uppercase mb-3" style={{ letterSpacing: '0.2em' }}>
              {isSetup ? '일기 보호' : '잠금 해제'}
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(44,42,41,0.45)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
              {isSetup ? (
                <>
                  2차 비밀번호를 설정하여<br />
                  일기와 편지를 암호화하고 안전하게 보호합니다
                </>
              ) : '계속하려면 보호 비밀번호를 입력해주세요.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 비밀번호 입력 */}
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={passphrase}
                onChange={e => { setPassphrase(e.target.value); setError(''); }}
                placeholder={isSetup ? '새 비밀번호 (4자 이상)' : '비밀번호'}
                autoFocus
                className="w-full bg-transparent border-b py-2 pr-8 text-sm outline-none transition-colors placeholder:italic"
                style={{
                  borderColor: 'rgba(44,42,41,0.2)',
                  color: 'rgba(44,42,41,0.85)',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(44,42,41,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(44,42,41,0.2)')}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-0 top-2.5 transition-opacity"
                style={{ color: 'rgba(44,42,41,0.3)' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            {/* 확인 입력 (설정 모드) */}
            {isSetup && (
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                placeholder="비밀번호 확인"
                className="w-full bg-transparent border-b py-2 text-sm outline-none transition-colors placeholder:italic"
                style={{
                  borderColor: 'rgba(44,42,41,0.2)',
                  color: 'rgba(44,42,41,0.85)',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(44,42,41,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(44,42,41,0.2)')}
              />
            )}

            {/* 설정 모드 경고 */}
            {isSetup && (
              <div className="flex items-start gap-2 mt-1">
                <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'rgba(44,42,41,0.35)' }} />
                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(44,42,41,0.38)' }}>
                  비밀번호를 잊으면 일기를 복구할 수 없습니다.
                  안전한 곳에 보관해주세요.
                </p>
              </div>
            )}

            {/* 오류 메시지 */}
            {error && (
              <p className="text-xs text-center" style={{ color: '#b34040' }}>
                {error}
              </p>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading || !passphrase}
              className="mt-3 w-full py-2.5 text-xs tracking-[0.25em] uppercase transition-all duration-300 border"
              style={{
                borderColor: 'rgba(44,42,41,0.2)',
                color: 'rgba(44,42,41,0.7)',
                opacity: loading || !passphrase ? 0.3 : 1,
              }}
              onMouseEnter={e => { if (!loading && passphrase) e.currentTarget.style.borderColor = 'rgba(44,42,41,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(44,42,41,0.2)'; }}
            >
              {loading ? '처리 중…' : isSetup ? '설정하기' : '열기'}
            </button>
          </form>

          {/* 건너뛰기 (설정 모드에서만) */}
          {isSetup && (
            <div className="mt-6 text-center">
              <button
                onClick={skipVault}
                className="text-[10px] italic transition-opacity"
                style={{ color: 'rgba(44,42,41,0.28)' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                나중에 설정하기 — 일기가 암호화되지 않습니다
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
