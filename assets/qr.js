/**
 * Vitrine Rápida — QR code e cartaz para impressão.
 * Usa a biblioteca qrcode-generator (Kazuhiko Arase, MIT), incluída em assets/vendor/qrcode.js
 * e carregada como script clássico (variável global `qrcode`).
 */
import { brandVars, formatPhone, EXAMPLE_PHONE } from './model.js';

// Capacidade aproximada em bytes (modo byte, correção L) usada para avisos de densidade.
export const QR_LIMITS = { easy: 520 /* versão 15 */, dense: 1273 /* versão 25 */, max: 2953 /* versão 40 */ };

function lib() {
  const q = window.qrcode;
  if (!q) throw new Error('Biblioteca de QR code não carregada');
  if (q.stringToBytesFuncs && q.stringToBytesFuncs['UTF-8']) q.stringToBytes = q.stringToBytesFuncs['UTF-8'];
  return q;
}

const byteLength = (s) => new TextEncoder().encode(s).length;

/** Classifica o quão "pesado" fica o QR de um texto. */
export function qrFits(text) {
  const n = byteLength(text || '');
  if (n <= QR_LIMITS.easy) return { level: 'ok', bytes: n };
  if (n <= QR_LIMITS.dense) return { level: 'dense', bytes: n };
  if (n <= QR_LIMITS.max) return { level: 'heavy', bytes: n };
  return { level: 'none', bytes: n };
}

/**
 * Gera a matriz do QR. Links curtos usam correção M (mais tolerante a sujeira/dobra);
 * links longos usam L para caber com o menor número de módulos possível.
 */
export function makeQR(text) {
  const q = lib();
  const ecl = byteLength(text) <= 300 ? 'M' : 'L';
  try {
    const qr = q(0, ecl);
    qr.addData(text, 'Byte');
    qr.make();
    return qr;
  } catch {
    return null; // longo demais
  }
}

/** Desenha o QR em um canvas quadrado. Retorna false se não couber. */
export function drawQR(canvas, text, { size = 600, margin = 4, dark = '#111111', light = '#FFFFFF' } = {}) {
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);
  const qr = text ? makeQR(text) : null;
  if (!qr) {
    ctx.fillStyle = '#9CA3AF';
    ctx.font = `600 ${Math.round(size / 18)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Link longo demais', size / 2, size / 2);
    return false;
  }
  paintModules(ctx, qr, 0, 0, size, margin, dark);
  return true;
}

function paintModules(ctx, qr, x, y, size, margin, dark) {
  const count = qr.getModuleCount();
  const cell = Math.max(1, Math.floor(size / (count + margin * 2)));
  const offset = Math.floor((size - cell * count) / 2);
  ctx.fillStyle = dark;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(x + offset + c * cell, y + offset + r * cell, cell, cell);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, startSize, weight, family) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 24);
  return size;
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

/**
 * Desenha o cartaz A5 (1748 × 2480 px ≈ 300 dpi). Retorna false se o QR não couber.
 */
export async function renderPoster(canvas, store, url) {
  const qr = makeQR(url);
  if (!qr) return false;
  try {
    await Promise.all([
      document.fonts.load('800 120px Poppins'),
      document.fonts.load('700 60px Poppins'),
      document.fonts.load('500 40px Inter'),
      document.fonts.load('600 40px Inter'),
    ]);
  } catch {
    /* usa fontes do sistema */
  }
  const W = 1748;
  const H = 2480;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const v = brandVars(store.color);
  const brand = v['--brand'];
  const ink = v['--brand-ink'];
  const POP = 'Poppins, "Segoe UI", sans-serif';
  const INTER = 'Inter, "Segoe UI", sans-serif';

  // fundo
  ctx.fillStyle = v['--brand-soft'];
  ctx.fillRect(0, 0, W, H);

  // faixa superior da marca
  const bandH = 860;
  ctx.fillStyle = brand;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, bandH - 120);
  ctx.quadraticCurveTo(W / 2, bandH + 90, 0, bandH - 120);
  ctx.closePath();
  ctx.fill();
  // círculos decorativos
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.arc(W - 120, 120, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(110, bandH - 260, 150, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // logo
  const logoR = 120;
  const logoY = 230;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.18)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.arc(W / 2, logoY, logoR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const logo = store.emoji || (store.name.trim()[0] || '?').toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = v['--brand-text'];
  ctx.font = `800 130px ${POP}, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"`;
  ctx.fillText(logo, W / 2, logoY + 8);

  // nome e slogan
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  const nameSize = fitText(ctx, store.name, W - 220, 128, 800, POP);
  ctx.font = `800 ${nameSize}px ${POP}`;
  ctx.fillText(store.name, W / 2, 500);
  if (store.slogan) {
    ctx.font = `500 50px ${INTER}`;
    ctx.globalAlpha = 0.92;
    wrapLines(ctx, store.slogan, W - 300, 2).forEach((l, i) => ctx.fillText(l, W / 2, 590 + i * 64));
    ctx.globalAlpha = 1;
  }

  // cartão do QR
  const cardW = 1300;
  const cardX = (W - cardW) / 2;
  const cardY = 780;
  const cardH = 1300;
  ctx.save();
  ctx.shadowColor = 'rgba(17,24,39,.16)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, cardX, cardY, cardW, cardH, 64);
  ctx.fill();
  ctx.restore();
  const qrSize = 1160;
  paintModules(ctx, qr, (W - qrSize) / 2, cardY + (cardH - qrSize) / 2, qrSize, 2, '#111111');

  // chamada
  ctx.fillStyle = '#111827';
  ctx.font = `800 92px ${POP}`;
  ctx.fillText('Aponte a câmera', W / 2, 2215);
  ctx.fillStyle = v['--brand-text'];
  ctx.fillText('e faça seu pedido', W / 2, 2318);

  // rodapé
  ctx.fillStyle = '#4B5563';
  ctx.font = `600 40px ${INTER}`;
  const bits = [];
  if (store.whatsapp && store.whatsapp !== EXAMPLE_PHONE) bits.push(`WhatsApp ${formatPhone(store.whatsapp)}`);
  if (store.hours) bits.push(store.hours);
  const foot = bits.join('  ·  ');
  if (foot) {
    fitText(ctx, foot, W - 200, 40, 600, INTER);
    ctx.fillText(foot, W / 2, 2405);
  }
  return true;
}
