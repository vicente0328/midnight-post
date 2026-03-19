import React, { useState } from 'react';

// ── CJK detection ──────────────────────────────────────────────────────────

function hasCJK(text: string): boolean {
  return /[\u2E80-\u9FFF\uF900-\uFAFF]/.test(text);
}

// ── Word-level wrap (Latin / space-separated text) ─────────────────────────

function wrapByWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ── Cascade score (rewards ascending line lengths for Latin text) ──────────

function cascadeScore(ctx: CanvasRenderingContext2D, lines: string[]): number {
  if (lines.length <= 1) return 0;
  let score = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const w1 = ctx.measureText(lines[i]).width;
    const w2 = ctx.measureText(lines[i + 1]).width;
    const ratio = w2 / w1;
    if (ratio >= 1.0 && ratio <= 1.35) score += 3;
    else if (ratio >= 0.75 && ratio < 1.0) score += 1;
    else if (ratio >= 0.6 && ratio < 0.75) score -= 1;
    else score -= 3;
  }
  return score;
}

// ── Balanced cascade wrap (Latin) ─────────────────────────────────────────

function wrapCascade(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const natural = wrapByWords(ctx, text, maxWidth);
  if (natural.length <= 1) return natural;

  let best = natural;
  let bestScore = cascadeScore(ctx, natural);

  for (let w = Math.floor(maxWidth * 0.60); w < maxWidth; w += 10) {
    const lines = wrapByWords(ctx, text, w);
    if (lines.length !== natural.length) continue;
    const score = cascadeScore(ctx, lines);
    if (score > bestScore) {
      bestScore = score;
      best = lines;
    }
  }
  return best;
}

// ── Character-level wrap for CJK ──────────────────────────────────────────

function wrapCJKChars(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ── Balanced CJK wrap — minimises variance across line widths ─────────────
// Tries multiple wrap widths at the same line count; picks the most uniform.

function wrapCJKBalanced(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const natural = wrapCJKChars(ctx, text, maxWidth);
  if (natural.length <= 1) return natural;

  const n = natural.length;
  let best = natural;
  let bestVariance = Infinity;

  for (let w = Math.floor(maxWidth * 0.50); w <= maxWidth; w += 4) {
    const lines = wrapCJKChars(ctx, text, w);
    if (lines.length !== n) continue;
    const widths = lines.map(l => ctx.measureText(l).width);
    const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
    const variance = widths.reduce((acc, lw) => acc + (lw - mean) ** 2, 0);
    if (variance < bestVariance) {
      bestVariance = variance;
      best = lines;
    }
  }
  return best;
}

// ── Smart dispatcher ───────────────────────────────────────────────────────

function wrapSmart(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  return hasCJK(text)
    ? wrapCJKBalanced(ctx, text, maxWidth)
    : wrapCascade(ctx, text, maxWidth);
}

// ── Share card canvas generator ───────────────────────────────────────────

export async function generateShareCardBlob(
  mentorName: string,
  quote: string,
  source: string,
  translation: string,
): Promise<Blob | null> {
  await document.fonts.ready;

  const W = 1080, H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const SERIF = "'Cormorant Garamond', 'Nanum Myeongjo', serif";
  const INK   = (a: number) => `rgba(44,42,41,${a})`;
  const GOLD  = (a: number) => `rgba(148,108,22,${a})`;

  // ── Background ────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,    '#F8F5EE');
  bg.addColorStop(0.35, '#F1EDE3');
  bg.addColorStop(0.70, '#F5F1E8');
  bg.addColorStop(1,    '#EDE8DC');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const stain = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.65);
  stain.addColorStop(0, 'rgba(200,170,100,0.06)');
  stain.addColorStop(1, 'rgba(200,170,100,0)');
  ctx.fillStyle = stain;
  ctx.fillRect(0, 0, W, H);

  // ── Foxing ────────────────────────────────────────────────────────────────
  ctx.save();
  for (let i = 0; i < 55; i++) {
    const fx = 70 + Math.random() * (W - 140);
    const fy = 70 + Math.random() * (H - 140);
    const fr = 1.2 + Math.random() * 4.5;
    ctx.globalAlpha = 0.012 + Math.random() * 0.038;
    ctx.fillStyle = `rgb(${130 + Math.random() * 50|0},${82 + Math.random() * 30|0},${28 + Math.random() * 20|0})`;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── Vignette ──────────────────────────────────────────────────────────────
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.74);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(30,22,10,0.18)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // ── Borders ───────────────────────────────────────────────────────────────
  const B1 = 52;
  ctx.strokeStyle = GOLD(0.62);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(B1, B1, W - B1 * 2, H - B1 * 2);

  const B2 = 62;
  ctx.strokeStyle = GOLD(0.28);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(B2, B2, W - B2 * 2, H - B2 * 2);

  const B3 = 76;
  ctx.strokeStyle = GOLD(0.12);
  ctx.lineWidth = 0.6;
  ctx.strokeRect(B3, B3, W - B3 * 2, H - B3 * 2);

  // ── Corner ornaments ──────────────────────────────────────────────────────
  const drawCorner = (ox: number, oy: number, sx: number, sy: number) => {
    const L = 44, d = 8;
    ctx.strokeStyle = GOLD(0.72);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox + sx * L, oy);
    ctx.lineTo(ox, oy);
    ctx.lineTo(ox, oy + sy * L);
    ctx.stroke();
    ctx.fillStyle = GOLD(0.65);
    ctx.beginPath();
    ctx.moveTo(ox,          oy - sy * d);
    ctx.lineTo(ox + sx * d, oy);
    ctx.lineTo(ox,          oy + sy * d);
    ctx.lineTo(ox - sx * d, oy);
    ctx.closePath();
    ctx.fill();
  };
  const C = B1 + 8;
  drawCorner(C, C, 1, 1);
  drawCorner(W - C, C, -1, 1);
  drawCorner(C, H - C, 1, -1);
  drawCorner(W - C, H - C, -1, -1);

  // ── Diamond helper ────────────────────────────────────────────────────────
  const diamond = (cx: number, cy: number, d = 5.5, a = 0.44) => {
    ctx.fillStyle = GOLD(a);
    ctx.beginPath();
    ctx.moveTo(cx, cy - d); ctx.lineTo(cx + d, cy);
    ctx.lineTo(cx, cy + d); ctx.lineTo(cx - d, cy);
    ctx.closePath(); ctx.fill();
  };
  diamond(W / 2, B1, 5, 0.42);
  diamond(W / 2, H - B1, 5, 0.42);
  diamond(B1, H / 2, 5, 0.42);
  diamond(W - B1, H / 2, 5, 0.42);

  // ── Ornamental rule ───────────────────────────────────────────────────────
  const ornRule = (cx: number, cy: number, rW: number) => {
    const gap = 14;
    ctx.fillStyle = GOLD(0.28);
    ctx.fillRect(cx - rW / 2, cy, rW / 2 - gap, 0.8);
    ctx.fillRect(cx + gap,    cy, rW / 2 - gap, 0.8);
    diamond(cx, cy, 3.8, 0.35);
    diamond(cx - 9, cy, 2, 0.20);
    diamond(cx + 9, cy, 2, 0.20);
  };

  // ── Content metrics ───────────────────────────────────────────────────────
  const CX = W / 2;
  // CJK quotes use a narrower wrap width to keep more padding (more editorial)
  const isCJKQuote = hasCJK(quote);
  const CW_quote  = isCJKQuote ? W - 280 : W - 240;   // 800 vs 840
  const CW_trans  = W - 300;                            // 780 — slightly narrower

  // ── Quote auto-scale ──────────────────────────────────────────────────────
  // CJK: smaller initial size since characters are denser visually
  let qSize = isCJKQuote ? 42 : 46;
  ctx.font = `italic 300 ${qSize}px ${SERIF}`;
  let qLines = wrapSmart(ctx, quote, CW_quote);

  // Scale down until ≤ 6 lines (max 8 for very long CJK), min 20px
  const qMaxLines = isCJKQuote ? 7 : 6;
  const qMinSize  = 20;
  while (qLines.length > qMaxLines && qSize > qMinSize) {
    qSize -= 2;
    ctx.font = `italic 300 ${qSize}px ${SERIF}`;
    qLines = wrapSmart(ctx, quote, CW_quote);
  }
  // CJK line height: slightly tighter; Latin: original ratio
  const qLineH = isCJKQuote ? qSize * 1.52 : qSize * 1.46;

  // ── Translation auto-scale ────────────────────────────────────────────────
  let tSize = 26;
  ctx.font = `italic 300 ${tSize}px ${SERIF}`;
  let tLines = wrapSmart(ctx, translation, CW_trans);
  while (tLines.length > 5 && tSize > 18) {
    tSize -= 2;
    ctx.font = `italic 300 ${tSize}px ${SERIF}`;
    tLines = wrapSmart(ctx, translation, CW_trans);
  }
  const tLineH = tSize * 1.60;

  // ── Vertical layout calculation ───────────────────────────────────────────
  const brandH  = 15 + 28 + 44;
  const nameH   = 30 + 52;
  const quoteH  = qLines.length * qLineH + 18;
  const sourceH = source ? 52 : 12;
  const divH    = 52;
  const transH  = tLines.length * tLineH;
  const totalContentH = brandH + nameH + quoteH + sourceH + divH + transH;

  const availH = H - B3 * 2 - 40;
  const startY = B3 + 20 + Math.max(0, (availH - totalContentH) / 2);

  // ── Draw content ──────────────────────────────────────────────────────────
  let y = startY;
  ctx.textAlign = 'center';

  // Brand
  ctx.font = `300 12.5px ${SERIF}`;
  ctx.fillStyle = INK(0.20);
  ctx.fillText('T H E   M I D N I G H T   P O S T', CX, y);
  y += brandH - 44;

  ornRule(CX, y, 180);
  y += 44;

  // Mentor name
  ctx.font = `500 26px ${SERIF}`;
  ctx.fillStyle = INK(0.58);
  ctx.fillText(mentorName, CX, y);
  y += nameH;

  // Ghost opening quote mark (only for non-CJK; looks odd with Han characters)
  if (!isCJKQuote) {
    ctx.save();
    ctx.font = `italic 180px ${SERIF}`;
    ctx.fillStyle = GOLD(0.08);
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', 82, y + 105);
    ctx.restore();
    ctx.textAlign = 'center';
  } else {
    // For CJK: subtle vertical red-seal-style dot ornament above the quote
    ctx.save();
    ctx.fillStyle = GOLD(0.13);
    ctx.font = `300 ${qSize * 3.2}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.07;
    ctx.fillText('文', CX, y + qSize * 2.0);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.textAlign = 'center';
  }

  // ── Quote lines ───────────────────────────────────────────────────────────
  ctx.font = `italic 300 ${qSize}px ${SERIF}`;
  ctx.fillStyle = INK(0.88);
  for (const line of qLines) {
    ctx.fillText(line, CX, y);
    y += qLineH;
  }

  // Ghost closing quote mark (Latin only)
  if (!isCJKQuote) {
    ctx.save();
    ctx.font = `italic 180px ${SERIF}`;
    ctx.fillStyle = GOLD(0.06);
    ctx.textAlign = 'right';
    ctx.fillText('\u201D', W - 82, y - qLineH * 0.3);
    ctx.restore();
    ctx.textAlign = 'center';
  }
  y += 18;

  // ── Source ────────────────────────────────────────────────────────────────
  if (source) {
    // Truncate source if very long
    const maxSourceWidth = CW_quote - 40;
    ctx.font = `300 18.5px ${SERIF}`;
    let sourceText = `\u2014\u2002${source}\u2002\u2014`;
    // Shrink font for long sources
    let srcSize = 18.5;
    while (ctx.measureText(sourceText).width > maxSourceWidth && srcSize > 13) {
      srcSize -= 0.5;
      ctx.font = `300 ${srcSize}px ${SERIF}`;
    }
    ctx.fillStyle = INK(0.30);
    ctx.fillText(sourceText, CX, y);
    y += sourceH;
  } else {
    y += 12;
  }

  // ── Ornamental divider ────────────────────────────────────────────────────
  ornRule(CX, y, 160);
  y += divH;

  // ── Translation ───────────────────────────────────────────────────────────
  ctx.font = `italic 300 ${tSize}px ${SERIF}`;
  ctx.fillStyle = INK(0.52);
  for (const line of tLines) {
    ctx.fillText(line, CX, y);
    y += tLineH;
  }

  // ── Bottom ornament ───────────────────────────────────────────────────────
  ctx.font = `300 14px ${SERIF}`;
  ctx.fillStyle = GOLD(0.45);
  ctx.fillText('\u2736 \u00B7 \u2736 \u00B7 \u2736', CX, H - B1 - 22);

  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}

// ── ShareCardButton ───────────────────────────────────────────────────────

interface ShareCardButtonProps {
  mentorName: string;
  quote: string;
  source: string;
  translation: string;
}

export function ShareCardButton({ mentorName, quote, source, translation }: ShareCardButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateShareCardBlob(mentorName, quote, source, translation);
      if (!blob) return;
      const file = new File([blob], 'midnight-post.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'The Midnight Post' });
      } else {
        setCardUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      console.error('공유 카드 생성 실패:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!cardUrl) return;
    const a = document.createElement('a');
    a.href = cardUrl;
    a.download = 'midnight-post-card.png';
    a.click();
  };

  const handleClose = () => {
    if (cardUrl) URL.revokeObjectURL(cardUrl);
    setCardUrl(null);
  };

  if (cardUrl) {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <img src={cardUrl} alt="공유 카드" className="w-full max-w-[260px] border border-[#D4AF37]/20 shadow-md" />
        <div className="flex gap-5">
          <button onClick={handleDownload} className="font-serif text-sm italic opacity-55 hover:opacity-90 transition-opacity border-b border-ink/20 pb-px">
            이미지 저장
          </button>
          <button onClick={handleClose} className="font-serif text-sm italic opacity-30 hover:opacity-55 transition-opacity">
            닫기
          </button>
        </div>
        <p className="text-[10px] opacity-30 font-serif italic text-center">인스타그램 스토리나 피드에 공유해보세요.</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={isGenerating}
      className="font-serif text-sm italic opacity-40 hover:opacity-75 transition-opacity disabled:opacity-20"
    >
      {isGenerating ? '카드 생성 중…' : '공유 카드 만들기 →'}
    </button>
  );
}
