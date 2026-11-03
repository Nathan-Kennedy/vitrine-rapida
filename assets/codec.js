/**
 * Vitrine Rápida — codificação do catálogo para o link.
 *
 * Fluxo: objeto da loja -> formato compacto (chaves curtas, itens em arrays)
 *        -> JSON -> deflate-raw (CompressionStream) -> base64url.
 *
 * O resultado recebe um prefixo de 1 caractere indicando o formato:
 *   "z" = JSON compactado com deflate-raw
 *   "j" = JSON puro em base64url (navegadores sem CompressionStream)
 *
 * O link final fica assim: loja.html#d=z3Vb...
 */
import { normalizeStore } from './model.js';

const FORMAT_VERSION = 1;
const PAY_KEYS = [['pix', 'p'], ['dinheiro', 'd'], ['cartao', 'c']];

/* ---------- formato compacto ---------- */

/** Converte a loja em uma estrutura menor (menos bytes no link). */
export function pack(store) {
  const s = normalizeStore(store);
  const o = { v: FORMAT_VERSION, n: s.name, c: s.color, w: s.whatsapp };
  if (s.slogan) o.s = s.slogan;
  if (s.emoji) o.e = s.emoji;
  if (s.address) o.a = s.address;
  if (s.hours) o.h = s.hours;
  // Entrega: bit 1 = retirada, bit 2 = entrega
  o.d = (s.pickup ? 1 : 0) | (s.delivery ? 2 : 0);
  if (s.delivery && s.deliveryFee) o.f = s.deliveryFee;
  o.p = PAY_KEYS.filter(([k]) => s.payments[k]).map(([, c]) => c).join('');
  if (s.pixKey) o.k = s.pixKey;
  if (s.minOrder) o.m = s.minOrder;
  o.g = s.categories.map((cat) => [
    cat.name,
    cat.items.map((i) => {
      // [nome, descrição, preço, flags, emoji, imagem]; flags: 1 = "a partir de", 2 = esgotado
      const arr = [i.name, i.description, i.price, (i.from ? 1 : 0) | (i.soldOut ? 2 : 0), i.emoji, i.image];
      while (arr.length > 3 && !arr[arr.length - 1]) arr.pop();
      return arr;
    }),
  ]);
  return o;
}

/** Inverso de pack(). */
export function unpack(o) {
  if (!o || typeof o !== 'object' || o.v !== FORMAT_VERSION) throw new Error('Versão de link desconhecida');
  const p = typeof o.p === 'string' ? o.p : '';
  return normalizeStore({
    name: o.n,
    slogan: o.s,
    emoji: o.e,
    color: o.c,
    whatsapp: o.w,
    address: o.a,
    hours: o.h,
    pickup: !!(o.d & 1),
    delivery: !!(o.d & 2),
    deliveryFee: o.f,
    payments: Object.fromEntries(PAY_KEYS.map(([k, c]) => [k, p.includes(c)])),
    pixKey: o.k,
    minOrder: o.m,
    categories: (Array.isArray(o.g) ? o.g : []).map((g) => ({
      name: g[0],
      items: (Array.isArray(g[1]) ? g[1] : []).map((a) => ({
        name: a[0],
        description: a[1],
        price: a[2],
        from: !!(a[3] & 1),
        soldOut: !!(a[3] & 2),
        emoji: a[4],
        image: a[5],
      })),
    })),
  });
}

/* ---------- base64url ---------- */

export function bytesToBase64url(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- compressão ---------- */

export const supportsCompression =
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function pipeThrough(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Loja -> texto para usar após "#d=". */
export async function encodeStore(store, { compress = supportsCompression } = {}) {
  const json = JSON.stringify(pack(store));
  const bytes = new TextEncoder().encode(json);
  if (compress) {
    try {
      const deflated = await pipeThrough(bytes, new CompressionStream('deflate-raw'));
      return 'z' + bytesToBase64url(deflated);
    } catch {
      /* cai para o formato sem compressão */
    }
  }
  return 'j' + bytesToBase64url(bytes);
}

/** Texto após "#d=" -> loja. Lança erro com mensagem amigável se não for possível. */
export async function decodeStore(payload) {
  if (!payload || payload.length < 2) throw new Error('Link vazio');
  const kind = payload[0];
  let bytes;
  try {
    bytes = base64urlToBytes(payload.slice(1));
  } catch {
    throw new Error('Link corrompido');
  }
  if (kind === 'z') {
    if (!supportsCompression) {
      throw new Error('Seu navegador é antigo demais para abrir este link. Atualize-o e tente de novo.');
    }
    try {
      bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    } catch {
      throw new Error('Link incompleto ou corrompido');
    }
  } else if (kind !== 'j') {
    throw new Error('Formato de link desconhecido');
  }
  let obj;
  try {
    obj = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Link corrompido');
  }
  return unpack(obj);
}

/** Lê o parâmetro "d" do hash (ex.: "#d=z...") */
export function payloadFromHash(hash) {
  const h = String(hash || '').replace(/^#/, '');
  const params = new URLSearchParams(h);
  return params.get('d') || '';
}

/** Monta o link público da loja a partir do endereço atual da página. */
export function buildStoreUrl(payload, base = location.href) {
  const u = new URL('loja.html', base);
  u.search = '';
  u.hash = 'd=' + payload;
  return u.href;
}
