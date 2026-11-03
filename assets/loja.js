/**
 * Vitrine Rápida — página pública da loja (loja.html).
 * Lê o catálogo do hash (#d=...) e renderiza a vitrine.
 * Com ?preview=1 a página é usada dentro do editor e recebe os dados via postMessage.
 */
import { decodeStore, payloadFromHash } from './codec.js';
import { createStorefront, renderInvalid } from './store-render.js';
import { normalizeStore } from './model.js';

const root = document.getElementById('app');
const isPreview = new URLSearchParams(location.search).has('preview');

function setMeta(store) {
  document.title = `${store.name || 'Loja'} — Catálogo e pedidos`;
  const desc = store.slogan || `Veja o catálogo de ${store.name} e faça seu pedido pelo WhatsApp.`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', store.color);
}

/** Identificador curto da loja para separar as sacolas no sessionStorage. */
function storeKey(store) {
  let hash = 0;
  const s = store.name + '|' + store.whatsapp;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return 'vitrine-rapida:sacola:' + (hash >>> 0).toString(36);
}

let front = null;

function ready() {
  root.classList.remove('sf-loading');
  root.removeAttribute('aria-busy');
}

async function loadFromHash() {
  const payload = payloadFromHash(location.hash);
  ready();
  if (!payload) {
    renderInvalid(root, {
      title: 'Este link não tem uma loja',
      message: 'O endereço está incompleto: falta a parte com o catálogo. Pode ter sido cortado ao copiar ou enviar.',
    });
    document.title = 'Link sem loja — Vitrine Rápida';
    return;
  }
  try {
    const store = await decodeStore(payload);
    if (!store.name || !store.whatsapp) throw new Error('Loja sem nome ou WhatsApp');
    setMeta(store);
    front = createStorefront(root, store, { storageKey: storeKey(store) });
  } catch (err) {
    console.info('[Vitrine Rápida] link inválido:', err.message);
    renderInvalid(root, {
      title: 'Não conseguimos abrir esta loja',
      message: `O link parece estar cortado ou corrompido (${err.message}). Confira se ele foi copiado por inteiro.`,
    });
    document.title = 'Link inválido — Vitrine Rápida';
  }
}

if (isPreview) {
  document.documentElement.classList.add('is-preview');
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'vr:store') return;
    let store;
    ready();
    try {
      store = normalizeStore(e.data.store);
    } catch {
      return;
    }
    if (front) front.update(store);
    else front = createStorefront(root, store, { preview: true });
  });
  window.parent.postMessage({ type: 'vr:ready' }, location.origin);
} else {
  loadFromHash();
  window.addEventListener('hashchange', () => {
    front = null;
    loadFromHash();
  });
}
