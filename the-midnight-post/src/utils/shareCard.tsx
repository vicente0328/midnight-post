import React, { useState } from 'react';

// ── Word-level text wrapping (no mid-word breaks) ──────────────────────────

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

// ── Cascade line scoring: reward ascending line lengths ────────────────────

function cascadeScore(ctx: CanvasRenderingContext2D, lines: string[]): number {
  if (lines.length <= 1) return 0;
  let score = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const w1 = ctx.measureText(lines[i]).width;
    const w2 = ctx.measureText(lines[i + 1]).width;
    const ratio = w2 / w1;
    if (ratio >= 1.0 && ratio <= 1.35) score += 3;       // ideal: next line longer
    else if (ratio >= 0.75 && ratio < 1.0) score += 1;   // ok: slightly shorter
    else if (ratio >= 0.6 && ratio < 0.75) score -= 1;   // bad: noticeably shorter
    else score -= 3;                                       // very bad: too extreme
  }
  return score;
}

// ── Balanced cascade wrapping ──────────────────────────────────────────────
// Tries multiple wrap widths, picks the one that best satisfies:
// (1) no mid-word breaks, (2) bottom lines ≥ top lines width × ~0.6,
// (3) ideally ascending cascade

function wrapCascade(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const natural = wrapByWords(ctx, text, maxWidth);
  if (natural.length <= 1) return natural;

  let best = natural;
  let bestScore = cascadeScore(ctx, natural);

  // Scan narrower widths that preserve the same line count
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

  // ── Palette ───────────────────────────────────────────────────────────────
  const SERIF = "'Cormorant Garamond', 'Nanum Myeongjo', serif";
  const INK   = (a: number) => `rgba(38,22,8,${a})`;   // warm sepia-black
  const GOLD  = (a: number) => `rgba(148,108,22,${a})`; // antique gold

  // ── Background: deep amber vellum ────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,    '#EDD4A2');
  bg.addColorStop(0.30, '#D9BC82');
  bg.addColorStop(0.65, '#E4CB94');
  bg.addColorStop(1,    '#C8A96A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Warm age stain (top-left corner) ─────────────────────────────────────
  const stain = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.55);
  stain.addColorStop(0, 'rgba(90,55,10,0.12)');
  stain.addColorStop(1, 'rgba(90,55,10,0)');
  ctx.fillStyle = stain;
  ctx.fillRect(0, 0, W, H);

  // ── Foxing: scattered aged paper spots ───────────────────────────────────
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

  // ── Vignette ─────────────────────────────────────────────────────────────
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(22,12,2,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // ── Outer border ─────────────────────────────────────────────────────────
  const B1 = 52;
  ctx.strokeStyle = GOLD(0.62);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(B1, B1, W - B1 * 2, H - B1 * 2);

  // ── Second border (inner) ─────────────────────────────────────────────────
  const B2 = 62;
  ctx.strokeStyle = GOLD(0.28);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(B2, B2, W - B2 * 2, H - B2 * 2);

  // ── Third hairline (innermost) ────────────────────────────────────────────
  const B3 = 76;
  ctx.strokeStyle = GOLD(0.12);
  ctx.lineWidth = 0.6;
  ctx.strokeRect(B3, B3, W - B3 * 2, H - B3 * 2);

  // ── Corner ornament helper ────────────────────────────────────────────────
  const drawCorner = (ox: number, oy: number, sx: number, sy: number) => {
    const L = 44, d = 8;
    ctx.strokeStyle = GOLD(0.72);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox + sx * L, oy);
    ctx.lineTo(ox, oy);
    ctx.lineTo(ox, oy + sy * L);
    ctx.stroke();
    // Diamond tip
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
  // Mid-border ornaments
  diamond(W / 2, B1, 5, 0.42);
  diamond(W / 2, H - B1, 5, 0.42);
  diamond(B1, H / 2, 5, 0.42);
  diamond(W - B1, H / 2, 5, 0.42);

  // ── Ornamental rule helper (flanked by thin lines) ────────────────────────
  const ornRule = (cx: number, cy: number, rW: number) => {
    const gap = 14;
    ctx.fillStyle = GOLD(0.28);
    ctx.fillRect(cx - rW / 2, cy, rW / 2 - gap, 0.8);
    ctx.fillRect(cx + gap,    cy, rW / 2 - gap, 0.8);
    diamond(cx, cy, 3.8, 0.35);
    diamond(cx - 9, cy, 2, 0.20);
    diamond(cx + 9, cy, 2, 0.20);
  };

  // ── Measure content to center vertically ─────────────────────────────────
  const CX = W / 2;
  const CW = W - 240;

  // Compute font sizes with auto-scale
  let qSize = 46;
  ctx.font = `italic 300 ${qSize}px ${SERIF}`;
  let qLines = wrapCascade(ctx, quote, CW);
  while (qLines.length > 6 && qSize > 28) {
    qSize -= 2;
    ctx.font = `italic 300 ${qSize}px ${SERIF}`;
    qLines = wrapCascade(ctx, quote, CW);
  }
  const qLineH = qSize * 1.46;

  let tSize = 28;
  ctx.font = `italic 300 ${tSize}px ${SERIF}`;
  let tLines = wrapCascade(ctx, translation, CW - 60);
  while (tLines.length > 5 && tSize > 20) {
    tSize -= 2;
    ctx.font = `italic 300 ${tSize}px ${SERIF}`;
    tLines = wrapCascade(ctx, translation, CW - 60);
  }
  const tLineH = tSize * 1.60;

  // Content block height estimate
  const brandH   = 15 + 28 + 44;          // brand text + gap + rule spacing
  const nameH    = 30 + 52;               // mentor name + gap below
  const quoteH   = qLines.length * qLineH + 18;
  const sourceH  = source ? 52 : 12;
  const divH     = 52;
  const transH   = tLines.length * tLineH;
  const totalContentH = brandH + nameH + quoteH + sourceH + divH + transH;

  // Vertically center, respecting border margins
  const availH = H - B3 * 2 - 40;
  const startY = B3 + 20 + Math.max(0, (availH - totalContentH) / 2);

  // ── Draw content ──────────────────────────────────────────────────────────
  let y = startY;
  ctx.textAlign = 'center';

  // Brand name
  ctx.font = `300 12.5px ${SERIF}`;
  ctx.fillStyle = INK(0.20);
  ctx.fillText('T H E   M I D N I G H T   P O S T', CX, y);
  y += brandH - 44;

  // Brand ornamental rule
  ornRule(CX, y, 180);
  y += 44;

  // Mentor name
  ctx.font = `500 26px ${SERIF}`;
  ctx.fillStyle = INK(0.58);
  ctx.fillText(mentorName, CX, y);
  y += nameH;

  // ── Large decorative ghost quotation mark ─────────────────────────────────
  ctx.save();
  ctx.font = `italic 180px ${SERIF}`;
  ctx.fillStyle = GOLD(0.08);
  ctx.textAlign = 'left';
  ctx.fillText('\u201C', 82, y + 105);
  ctx.restore();
  ctx.textAlign = 'center';

  // ── Quote ─────────────────────────────────────────────────────────────────
  ctx.font = `italic 300 ${qSize}px ${SERIF}`;
  ctx.fillStyle = INK(0.86);
  for (const line of qLines) {
    ctx.fillText(line, CX, y);
    y += qLineH;
  }

  // Ghost closing quote
  ctx.save();
  ctx.font = `italic 180px ${SERIF}`;
  ctx.fillStyle = GOLD(0.06);
  ctx.textAlign = 'right';
  ctx.fillText('\u201D', W - 82, y - qLineH * 0.3);
  ctx.restore();
  ctx.textAlign = 'center';
  y += 18;

  // Source
  if (source) {
    ctx.font = `300 18.5px ${SERIF}`;
    ctx.fillStyle = INK(0.30);
    ctx.fillText(`\u2014\u2002${source}\u2002\u2014`, CX, y);
    y += sourceH;
  } else {
    y += 12;
  }

  // Ornamental divider
  ornRule(CX, y, 160);
  y += divH;

  // Translation
  ctx.font = `italic 300 ${tSize}px ${SERIF}`;
  ctx.fillStyle = INK(0.52);
  for (const line of tLines) {
    ctx.fillText(line, CX, y);
    y += tLineH;
  }

  // ── Bottom ornament (fixed to border area) ────────────────────────────────
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
