import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import {
  FREE_LETTER_LIMIT, STANDARD_LETTER_LIMIT,
  FREE_DAMSO_LIMIT, STANDARD_DAMSO_LIMIT,
  FREE_BOOKMARK_LIMIT, FREE_HISTORY_LIMIT,
} from '../hooks/usePlan';

interface Props {
  reason: 'letter' | 'damso' | 'bookmark' | 'history';
  used: number;
  onUpgrade: () => Promise<void>;
  onClose: () => void;
}

export default function UpgradeModal({ reason, used, onUpgrade, onClose }: Props) {
  const [upgrading, setUpgrading] = useState(false);
  const [done, setDone] = useState(false);

  const REASON_META = {
    letter:   { label: '오늘 편지',   freeLimit: `일 ${FREE_LETTER_LIMIT}통`,   stdLimit: `일 ${STANDARD_LETTER_LIMIT}통` },
    damso:    { label: '이번 달 담소', freeLimit: `월 ${FREE_DAMSO_LIMIT}회`,    stdLimit: `월 ${STANDARD_DAMSO_LIMIT}회` },
    bookmark: { label: '북마크',       freeLimit: `최신 ${FREE_BOOKMARK_LIMIT}개`, stdLimit: '무제한' },
    history:  { label: '기록',         freeLimit: `최신 ${FREE_HISTORY_LIMIT}개`, stdLimit: '무제한' },
  };
  const meta = REASON_META[reason];

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await onUpgrade();
      setDone(true);
      setTimeout(onClose, 900);
    } catch {
      setUpgrading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-sm bg-[#fdfbf7] border border-[#D4AF37]/20 p-8"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          boxShadow: 'inset 0 0 60px rgba(139,115,85,0.08), 0 20px 50px rgba(0,0,0,0.4)',
        }}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 opacity-25 hover:opacity-60 transition-opacity"
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* 제목 */}
        <p className="font-mono text-[9px] uppercase tracking-[0.35em] opacity-30 mb-4">Plan</p>
        <h2 className="font-serif text-lg mb-2 leading-snug">
          {meta.label} 한도에 도달했습니다
        </h2>
        <p className="font-serif text-[13px] italic opacity-50 mb-8 leading-relaxed">
          Free 플랜 한도({meta.freeLimit})를 모두 사용했습니다.
          Standard 플랜으로 업그레이드하면 더 많이 이용할 수 있습니다.
        </p>

        {/* 플랜 비교 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-ink/10 p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest opacity-30 mb-3">Free</p>
            <ul className="font-serif text-[12px] italic opacity-55 space-y-1.5">
              <li>편지 일 {FREE_LETTER_LIMIT}통</li>
              <li>담소 월 {FREE_DAMSO_LIMIT}회</li>
              <li>북마크 최신 {FREE_BOOKMARK_LIMIT}개</li>
              <li>기록 최신 {FREE_HISTORY_LIMIT}개</li>
            </ul>
          </div>
          <div className="border border-[#D4AF37]/30 p-4 bg-[#D4AF37]/[0.03]">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#D4AF37]/60 mb-3">Standard</p>
            <ul className="font-serif text-[12px] italic opacity-75 space-y-1.5">
              <li>편지 일 {STANDARD_LETTER_LIMIT}통</li>
              <li>담소 월 {STANDARD_DAMSO_LIMIT}회</li>
              <li>북마크 무제한</li>
              <li>기록 무제한</li>
            </ul>
          </div>
        </div>

        {/* 업그레이드 버튼 */}
        <button
          onClick={handleUpgrade}
          disabled={upgrading || done}
          className="w-full py-3 border border-ink/30 font-serif text-sm italic tracking-wide hover:bg-ink hover:text-paper transition-all duration-300 disabled:opacity-40"
        >
          {done ? 'Standard로 전환됨 ✓' : upgrading ? '처리 중...' : 'Standard로 업그레이드'}
        </button>

        <p className="font-serif text-[10px] italic opacity-25 text-center mt-3">
          현재 무료 전환 · 추후 결제 기능 연동 예정
        </p>
      </motion.div>
    </motion.div>
  );
}
