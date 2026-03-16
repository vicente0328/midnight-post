import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useAuth } from './AuthContext';

type Mode = 'login' | 'signup' | 'reset';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return '이메일 형식이 올바르지 않습니다.';
    case 'auth/user-not-found': return '등록되지 않은 이메일입니다.';
    case 'auth/wrong-password': return '비밀번호가 틀렸습니다.';
    case 'auth/invalid-credential': return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/email-already-in-use': return '이미 사용 중인 이메일입니다.';
    case 'auth/weak-password': return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/too-many-requests': return '잠시 후 다시 시도해주세요.';
    case 'auth/popup-closed-by-user': return '';
    default: return '오류가 발생했습니다. 다시 시도해주세요.';
  }
}

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setError('');
    setResetSent(false);
    setLoading(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearForm();
  };

  const close = () => {
    setShowAuthModal(false);
    setTimeout(clearForm, 300);
    setMode('login');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      const msg = getFirebaseErrorMessage(e?.code ?? '');
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (e: any) {
      setError(getFirebaseErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (e: any) {
      setError(getFirebaseErrorMessage(e?.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {showAuthModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={close}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm bg-paper shadow-2xl"
            style={{ border: '1px solid rgba(var(--color-ink-rgb, 30,20,10), 0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative top border */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />

            <div className="px-8 py-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-serif text-xl tracking-wide">
                    {mode === 'reset' ? '비밀번호 재설정' : mode === 'login' ? '다시 오셨군요' : '처음 오셨나요'}
                  </h2>
                  <p className="text-xs opacity-40 italic mt-1 font-serif">
                    {mode === 'reset'
                      ? '가입한 이메일을 입력해주세요.'
                      : mode === 'login'
                      ? '당신의 서재로 돌아오세요.'
                      : '새로운 밤, 새로운 이야기.'}
                  </p>
                </div>
                <button
                  onClick={close}
                  className="text-ink/30 hover:text-ink/70 transition-colors mt-0.5"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Mode tabs (login / signup) */}
              {mode !== 'reset' && (
                <div className="flex border-b border-ink/10 mb-6 gap-4">
                  {(['login', 'signup'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className={`pb-2 text-xs tracking-widest uppercase transition-colors ${
                        mode === m
                          ? 'border-b border-ink/60 opacity-100'
                          : 'opacity-30 hover:opacity-50'
                      }`}
                    >
                      {m === 'login' ? '로그인' : '회원가입'}
                    </button>
                  ))}
                </div>
              )}

              {/* Google button */}
              {mode !== 'reset' && (
                <>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 border border-ink/20 py-2.5 text-sm tracking-wide hover:bg-ink/5 transition-colors disabled:opacity-40"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google로 {mode === 'login' ? '로그인' : '시작하기'}
                  </button>

                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-ink/10" />
                    <span className="text-xs opacity-30 font-serif italic">또는</span>
                    <div className="flex-1 h-px bg-ink/10" />
                  </div>
                </>
              )}

              {/* Email form */}
              <form onSubmit={mode === 'reset' ? handleReset : handleEmailSubmit} className="space-y-3">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일"
                    required
                    className="w-full bg-transparent border-b border-ink/20 py-2 text-sm focus:outline-none focus:border-ink/60 transition-colors placeholder:opacity-30 placeholder:italic font-serif"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {mode !== 'reset' && (
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="비밀번호"
                      required
                      minLength={6}
                      className="w-full bg-transparent border-b border-ink/20 py-2 text-sm focus:outline-none focus:border-ink/60 transition-colors placeholder:opacity-30 placeholder:italic font-serif"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                )}

                {error && (
                  <p className="text-red-700/70 text-xs italic">{error}</p>
                )}

                {resetSent && (
                  <p className="text-green-700/70 text-xs italic">재설정 링크를 이메일로 보냈습니다.</p>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || (mode === 'reset' && resetSent)}
                    className="w-full border border-ink/30 py-2.5 text-sm tracking-widest uppercase hover:bg-ink hover:text-paper transition-colors disabled:opacity-30"
                  >
                    {loading
                      ? '...'
                      : mode === 'reset'
                      ? '재설정 링크 보내기'
                      : mode === 'login'
                      ? '로그인'
                      : '가입하기'}
                  </button>
                </div>
              </form>

              {/* Footer links */}
              <div className="mt-5 flex justify-center gap-4 text-xs opacity-40">
                {mode === 'login' && (
                  <button
                    onClick={() => switchMode('reset')}
                    className="hover:opacity-70 transition-opacity italic font-serif"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                )}
                {mode === 'reset' && (
                  <button
                    onClick={() => switchMode('login')}
                    className="hover:opacity-70 transition-opacity italic font-serif"
                  >
                    돌아가기
                  </button>
                )}
              </div>
            </div>

            {/* Decorative bottom border */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
