/**
 * Vitrine Rápida — modelo de dados, validação e utilidades compartilhadas.
 * Usado pelo editor (index.html) e pela vitrine pública (loja.html).
 */

export const EXAMPLE_PHONE = '5569900000000';

export const BRAND_PRESETS = [
  { name: 'Laranja padaria', value: '#E8590C' },
  { name: 'Vermelho', value: '#E03131' },
  { name: 'Rosa', value: '#D6336C' },
  { name: 'Roxo', value: '#7048E8' },
  { name: 'Azul', value: '#1971C2' },
  { name: 'Verde', value: '#2B8A3E' },
];

export const PAYMENT_LABELS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };

/** Loja vazia (estado inicial de "Começar do zero"). */
export function emptyStore() {
  return {
    name: '',
    slogan: '',
    emoji: '🛍️',
    color: '#7048E8',
    whatsapp: '',
    address: '',
    hours: '',
    pickup: true,
    delivery: false,
    deliveryFee: 0,
    payments: { pix: true, dinheiro: true, cartao: false },
    pixKey: '',
    minOrder: 0,
    categories: [{ name: 'Produtos', items: [] }],
  };
}

/** Loja fictícia de exemplo. */
export function exampleStore() {
  const it = (name, description, price, emoji, extra = {}) => ({
    name, description, price, emoji, from: false, soldOut: false, image: '', ...extra,
  });
  return {
    name: 'Padaria Pão Quente',
    slogan: 'Pão fresquinho saindo toda hora desde 1998',
    emoji: '🥖',
    color: '#E8590C',
    whatsapp: EXAMPLE_PHONE,
    address: 'Av. Tancredo Neves, 1234 — Centro, Ariquemes-RO',
    hours: 'Seg a sáb, 6h às 20h · Dom, 6h às 12h',
    pickup: true,
    delivery: true,
    deliveryFee: 500,
    payments: { pix: true, dinheiro: true, cartao: true },
    pixKey: 'padariapaoquente@exemplo.com',
    minOrder: 1500,
    categories: [
      {
        name: 'Pães',
        items: [
          it('Pão francês', 'Casquinha crocante, assado a cada hora. Preço por unidade.', 90, '🥖'),
          it('Pão de queijo', 'Receita mineira com queijo canastra. Porção com 10 unidades.', 1200, '🧀'),
          it('Pão caseiro', 'Massa macia, fermentação natural. Unidade de 500 g.', 1100, '🍞'),
          it('Pão integral com grãos', 'Aveia, linhaça e girassol. Fatiado, 400 g.', 1350, '🌾', { soldOut: true }),
        ],
      },
      {
        name: 'Doces',
        items: [
          it('Bolo de cenoura com chocolate', 'Fatia generosa com cobertura de brigadeiro.', 850, '🍰'),
          it('Sonho de creme', 'Recheio de creme de baunilha e açúcar de confeiteiro.', 650, '🍩'),
          it('Torta de morango', 'Encomende com 2 dias de antecedência. Valor varia por tamanho.', 7500, '🍓', { from: true }),
          it('Brigadeiro gourmet', 'Chocolate belga 50% cacau. Unidade.', 350, '🍫'),
        ],
      },
      {
        name: 'Bebidas',
        items: [
          it('Café coado', 'Café da região de Rondônia, coado na hora. 200 ml.', 500, '☕'),
          it('Suco natural de laranja', 'Espremido na hora, sem açúcar. 400 ml.', 900, '🍊'),
          it('Achocolatado gelado', 'Leite integral batido com cacau. 300 ml.', 700, '🥤'),
        ],
      },
    ],
  };
}

const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max);
const int = (v, max = 100000000) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

/** Garante que um objeto (vindo de backup, link ou localStorage) siga o formato esperado. */
export function normalizeStore(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Formato inválido');
  const base = emptyStore();
  const color = /^#[0-9a-f]{6}$/i.test(raw.color || '') ? raw.color.toUpperCase() : base.color;
  const payments = raw.payments && typeof raw.payments === 'object' ? raw.payments : base.payments;
  const cats = Array.isArray(raw.categories) ? raw.categories : [];
  return {
    name: str(raw.name, 60),
    slogan: str(raw.slogan, 120),
    emoji: str(raw.emoji, 8),
    color,
    whatsapp: str(raw.whatsapp, 20).replace(/\D/g, ''),
    address: str(raw.address, 140),
    hours: str(raw.hours, 120),
    pickup: raw.pickup !== false,
    delivery: !!raw.delivery,
    deliveryFee: int(raw.deliveryFee, 100000),
    payments: { pix: !!payments.pix, dinheiro: !!payments.dinheiro, cartao: !!payments.cartao },
    pixKey: str(raw.pixKey, 90),
    minOrder: int(raw.minOrder, 1000000),
    categories: cats.slice(0, 30).map((c) => ({
      name: str(c && c.name, 40),
      items: (Array.isArray(c && c.items) ? c.items : []).slice(0, 200).map((i) => ({
        name: str(i && i.name, 70),
        description: str(i && i.description, 200),
        price: int(i && i.price, 10000000),
        emoji: str(i && i.emoji, 8),
        from: !!(i && i.from),
        soldOut: !!(i && i.soldOut),
        image: safeImageUrl(i && i.image),
      })),
    })),
  };
}

/** Aceita somente URLs http(s) para imagens. */
export function safeImageUrl(v) {
  const s = str(v, 500);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

/* ---------------- Dinheiro ---------------- */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 1250 -> "R$ 12,50" (com espaço normal, sem NBSP, para mensagens). */
export function formatBRL(cents) {
  return BRL.format((cents || 0) / 100).replace(/ /g, ' ');
}

/** 1250 -> "12,50" (para campos de formulário). */
export function centsToInput(cents) {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Converte texto digitado em centavos. Aceita "12,50", "12.50", "1.234,56", "R$ 9", "9".
 * Retorna null se não for um número válido.
 */
export function parseBRL(text) {
  let s = String(text ?? '').replace(/[R$\s ]/gi, '');
  if (!s) return 0;
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // O separador que aparece por último é o decimal.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    const dots = (s.match(/\./g) || []).length;
    // "1.234" (milhar) vs "12.5" (decimal)
    if (dots > 1 || decimals === 3) s = s.replace(/\./g, '');
  }
  if ((s.match(/\./g) || []).length > 1) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/* ---------------- WhatsApp ---------------- */

/**
 * Valida e normaliza um número de WhatsApp brasileiro.
 * Aceita "(69) 99999-1234", "69999991234", "+55 69 9999-1234"...
 * Retorna { ok, value: '55DDNNNNNNNNN', error }.
 */
export function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (!d) return { ok: false, value: '', error: 'Informe o WhatsApp com DDD.' };
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) {
    return { ok: false, value: '', error: 'Use DDD + número, ex.: (69) 99999-1234.' };
  }
  const ddd = d.slice(0, 2);
  if (!/^[1-9][1-9]$/.test(ddd)) return { ok: false, value: '', error: 'DDD inválido.' };
  if (d.length === 11 && d[2] !== '9') {
    return { ok: false, value: '', error: 'Celular com 11 dígitos deve começar com 9 após o DDD.' };
  }
  return { ok: true, value: '55' + d, error: '' };
}

/** "5569999991234" -> "(69) 99999-1234" */
export function formatPhone(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value || '';
}

/* ---------------- Cor da marca ---------------- */

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function mix(rgb, target, t) {
  return rgb.map((c, i) => Math.round(c + (target[i] - c) * t));
}
const toHex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

/**
 * Deriva as variáveis de cor a partir da cor da marca, garantindo contraste.
 * --brand: fundo de botões; --brand-ink: texto sobre a marca;
 * --brand-text: cor da marca escurecida para texto sobre branco; --brand-soft: fundo suave.
 */
export function brandVars(hex) {
  const rgb = hexToRgb(/^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#7048E8');
  const white = [255, 255, 255];
  const ink = [17, 24, 39];
  const onBrand = contrast(rgb, white) >= 3 ? '#FFFFFF' : '#111827';
  let text = rgb;
  for (let i = 0; i < 12 && contrast(text, white) < 4.5; i++) text = mix(text, ink, 0.12);
  return {
    '--brand': toHex(rgb),
    '--brand-ink': onBrand,
    '--brand-text': toHex(text),
    '--brand-soft': toHex(mix(rgb, white, 0.9)),
    '--brand-soft-2': toHex(mix(rgb, white, 0.8)),
    '--brand-dark': toHex(mix(rgb, ink, 0.25)),
  };
}

/** Remove acentos e caixa para buscas. */
export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
