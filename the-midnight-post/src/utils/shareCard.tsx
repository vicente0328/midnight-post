import React, { useState } from 'react';

// ── Canvas text wrapping (word-level with character fallback) ──────────────

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (line) {
        lines.push(line);
        line = word;
      } else {
        // Single token too long: character-by-character
        let charLine = '';
        for (const char of word) {
          if (ctx.measureText(charLine + char).width > maxWidth) {
            if (charLine) lines.push(charLine);
            charLine = char;
          } else {
            charLine += char;
          }
        }
        line = charLine;
      }
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
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
  const INK = (a: number) => `rgba(20,12,4,${a})`;
  const GOLD = (a: number) => `rgba(155,115,25,${a})`;

  // ── Background: aged parchment gradient ──────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,    '#F6EDD6');
  bg.addColorStop(0.35, '#EDE0BC');
  bg.addColorStop(0.72, '#F3E8CE');
  bg.addColorStop(1,    '#E9DDB5');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Vignette (dark edges → aged look) ────────────────────────────────────
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.74);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(16,8,2,0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // ── Outer gold border ─────────────────────────────────────────────────────
  const B1 = 58;
  ctx.strokeStyle = GOLD(0.58);
  ctx.lineWidth = 2;
  ctx.strokeRect(B1, B1, W - B1 * 2, H - B1 * 2);

  // ── Inner hairline border ─────────────────────────────────────────────────
  const B2 = 74;
  ctx.strokeStyle = GOLD(0.22);
  ctx.lineWidth = 1;
  ctx.strokeRect(B2, B2, W - B2 * 2, H - B2 * 2);

  // ── Helper: draw corner bracket + diamond tip ─────────────────────────────
  const drawCorner = (ox: number, oy: number, sx: number, sy: number) => {
    const L = 40, d = 7;
    ctx.strokeStyle = GOLD(0.68);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox + sx * L, oy);
    ctx.lineTo(ox, oy);
    ctx.lineTo(ox, oy + sy * L);
    ctx.stroke();
    ctx.fillStyle = GOLD(0.62);
    ctx.beginPath();
    ctx.moveTo(ox, oy - sy * d);
    ctx.lineTo(ox + sx * d, oy);
    ctx.lineTo(ox, oy + sy * d);
    ctx.lineTo(ox - sx * d, oy);
    ctx.closePath();
    ctx.fill();
  };
  const C = B1 + 7;
  drawCorner(C, C, 1, 1);
  drawCorner(W - C, C, -1, 1);
  drawCorner(C, H - C, 1, -1);
  drawCorner(W - C, H - C, -1, -1);

  // ── Helper: small diamond ornament ───────────────────────────────────────
  const diamond = (cx: number, cy: number, d = 5.5, a = 0.44) => {
    ctx.fillStyle = GOLD(a);
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d, cy);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d, cy);
    ctx.closePath();
    ctx.fill();
  };
  diamond(W / 2, B1);
  diamond(W / 2, H - B1);
  diamond(B1, H / 2);
  diamond(W - B1, H / 2);

  // ── Content layout ────────────────────────────────────────────────────────
  const CX = W / 2;
  const CW = W - 220; // content width
  let y = 118;
  ctx.textAlign = 'center';

  // Brand name (very faint, spaced)
  ctx.font = `300 13px ${SERIF}`;
  ctx.fillStyle = INK(0.18);
  ctx.fillText('T H E   M I D N I G H T   P O S T', CX, y);
  y += 30;

  // Brand rule with center diamond
  const rW = 200;
  ctx.fillStyle = GOLD(0.28);
  ctx.fillRect(CX - rW / 2, y, rW, 1);
  diamond(CX, y, 4.5, 0.38);
  y += 42;

  // Mentor name
  ctx.font = `500 27px ${SERIF}`;
  ctx.fillStyle = INK(0.55);
  ctx.fillText(mentorName, CX, y);
  y += 56;

  // ── Large decorative opening " (ghost behind quote) ──────────────────────
  const quoteTopY = y;
  ctx.save();
  ctx.font = `italic 190px ${SERIF}`;
  ctx.fillStyle = GOLD(0.09);
  ctx.textAlign = 'left';
  ctx.fillText('\u201C', 88, quoteTopY + 120);
  ctx.restore();
  ctx.textAlign = 'center';

  // ── Quote — auto-scale font if too many lines ─────────────────────────────
  let qSize = 46;
  ctx.font = `italic 300 ${qSize}px ${SERIF}`;
  let qLines = wrapCanvasText(ctx, quote, CW);
  while (qLines.length > 6 && qSize > 28) {
    qSize -= 2;
    ctx.font = `italic 300 ${qSize}px ${SERIF}`;
    qLines = wrapCanvasText(ctx, quote, CW);
  }
  const qLineH = qSize * 1.44;
  ctx.fillStyle = INK(0.85);
  for (const line of qLines) {
    ctx.fillText(line, CX, y);
    y += qLineH;
  }
  y += 18;

  // Closing ghost quote mark
  ctx.save();
  ctx.font = `italic 190px ${SERIF}`;
  ctx.fillStyle = GOLD(0.07);
  ctx.textAlign = 'right';
  ctx.fillText('\u201D', W - 88, y - 30);
  ctx.restore();
  ctx.textAlign = 'center';

  // Source
  if (source) {
    ctx.font = `300 20px ${SERIF}`;
    ctx.fillStyle = INK(0.28);
    ctx.fillText(`\u2014\u2002${source}\u2002\u2014`, CX, y);
    y += 44;
  }

  // Thin divider rule
  y += 12;
  const divW = 140;
  ctx.fillStyle = INK(0.08);
  ctx.fillRect(CX - divW / 2, y, divW, 1);
  diamond(CX, y, 3.5, 0.22);
  y += 40;

  // ── Translation — auto-scale ──────────────────────────────────────────────
  let tSize = 30;
  ctx.font = `italic 300 ${tSize}px ${SERIF}`;
  let tLines = wrapCanvasText(ctx, translation, CW - 80);
  while (tLines.length > 5 && tSize > 22) {
    tSize -= 2;
    ctx.font = `italic 300 ${tSize}px ${SERIF}`;
    tLines = wrapCanvasText(ctx, translation, CW - 80);
  }
  const tLineH = tSize * 1.58;
  ctx.fillStyle = INK(0.50);
  for (const line of tLines) {
    ctx.fillText(line, CX, y);
    y += tLineH;
  }

  // ── Bottom ornament ───────────────────────────────────────────────────────
  ctx.font = `300 18px ${SERIF}`;
  ctx.fillStyle = GOLD(0.42);
  ctx.fillText('\u2736   \u00B7   \u2736   \u00B7   \u2736', CX, H - 80);

  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}

// ── ShareCardButton — reusable component ──────────────────────────────────

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
        URL.revokeObjectURL(URL.createObjectURL(blob));
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
        <img
          src={cardUrl}
          alt="공유 카드"
          className="w-full max-w-[260px] border border-[#D4AF37]/20 shadow-md"
        />
        <div className="flex gap-5">
          <button
            onClick={handleDownload}
            className="font-serif text-sm italic opacity-55 hover:opacity-90 transition-opacity border-b border-ink/20 pb-px"
          >
            이미지 저장
          </button>
          <button
            onClick={handleClose}
            className="font-serif text-sm italic opacity-30 hover:opacity-55 transition-opacity"
          >
            닫기
          </button>
        </div>
        <p className="text-[10px] opacity-30 font-serif italic text-center">
          인스타그램 스토리나 피드에 공유해보세요.
        </p>
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
