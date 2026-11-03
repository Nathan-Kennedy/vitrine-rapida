/**
 * Vitrine Rápida — editor do catálogo (index.html).
 * Estado em memória -> salvo no localStorage -> enviado para a pré-visualização
 * (iframe da loja.html?preview=1) -> codificado no link público.
 */
import {
  emptyStore, exampleStore, normalizeStore, normalizePhone, formatPhone, parseBRL, centsToInput,
  formatBRL, BRAND_PRESETS, EXAMPLE_PHONE,
} from './model.js';
import { encodeStore, decodeStore, payloadFromHash, buildStoreUrl } from './codec.js';
import { h, toast, copyText, ICONS } from './store-render.js';
import { drawQR, qrFits, renderPoster, QR_LIMITS } from './qr.js';

const STORAGE_KEY = 'vitrine-rapida:editor:v1';
const SHORT_KEY = 'vitrine-rapida:short-link:v1';
const LONG_LINK = 6000;
const EMOJIS = ['🥖', '🍰', '🍔', '🍕', '☕', '🍦', '🥬', '🍓', '👗', '👟', '💇', '💅', '🌸', '🛍️'];

const $ = (sel) => document.querySelector(sel);
const form = $('#editor-form');
const frame = $('#preview-frame');

let state = loadInitial();
let phoneText = state.whatsapp ? formatPhone(state.whatsapp) : '';
let currentLink = '';
let linkShown = false;
let previewReady = false;
const expanded = new WeakSet();

/* ---------------- persistência ---------------- */

function loadInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeStore(JSON.parse(saved));
  } catch {
    /* dados inválidos: começa com o exemplo */
  }
  return exampleStore();
}

let saveTimer = 0;
function changed({ structure = false } = {}) {
  if (structure) renderCatalog();
  updateCatalogCount();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* armazenamento cheio ou bloqueado */
    }
    sendPreview();
    if (linkShown) generateLink({ silent: true });
  }, 180);
  updateExampleBanner();
}

function sendPreview() {
  if (previewReady && frame.contentWindow) {
    frame.contentWindow.postMessage({ type: 'vr:store', store: state }, location.origin);
  }
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
  if (e.data && e.data.type === 'vr:ready') {
    previewReady = true;
    sendPreview();
  }
});

/* ---------------- campos gerais ---------------- */

function bindText(id, key) {
  const input = $(id);
  input.addEventListener('input', () => {
    state[key] = input.value;
    if (key === 'name') clearError('f-name');
    changed();
  });
}
bindText('#f-name', 'name');
bindText('#f-slogan', 'slogan');
bindText('#f-emoji', 'emoji');
bindText('#f-address', 'address');
bindText('#f-hours', 'hours');
bindText('#f-pix', 'pixKey');

function bindMoney(input, get, set) {
  input.addEventListener('input', () => {
    const v = parseBRL(input.value);
    input.toggleAttribute('aria-invalid', v === null);
    if (v !== null) {
      set(v);
      changed();
    }
  });
  input.addEventListener('blur', () => {
    if (parseBRL(input.value) !== null) input.value = centsToInput(get());
  });
}
bindMoney($('#f-fee'), () => state.deliveryFee, (v) => (state.deliveryFee = v));
bindMoney($('#f-min'), () => state.minOrder, (v) => (state.minOrder = v));

const phoneInput = $('#f-phone');
phoneInput.addEventListener('input', () => {
  phoneText = phoneInput.value;
  const r = normalizePhone(phoneText);
  state.whatsapp = r.ok ? r.value : phoneText.replace(/\D/g, '');
  if (r.ok) clearError('f-phone');
  updatePhoneHint();
  changed();
});
phoneInput.addEventListener('blur', () => {
  const r = normalizePhone(phoneInput.value);
  if (r.ok) {
    phoneInput.value = formatPhone(r.value);
    clearError('f-phone');
  } else if (phoneInput.value.trim()) showError('f-phone', r.error);
});

function updatePhoneHint() {
  const hint = $('#f-phone-hint');
  const r = normalizePhone(phoneInput.value);
  if (r.ok && r.value === EXAMPLE_PHONE) {
    hint.textContent = 'Este é o número fictício do exemplo. Troque pelo seu WhatsApp.';
    hint.className = 'hint hint-warn';
  } else if (r.ok) {
    hint.textContent = `✓ Os pedidos chegarão em +55 ${formatPhone(r.value)} (wa.me/${r.value}).`;
    hint.className = 'hint hint-ok';
  } else {
    hint.textContent = 'Os pedidos chegam neste número. Ex.: (69) 99999-1234.';
    hint.className = 'hint';
  }
}

$('#f-pickup').addEventListener('change', (e) => { state.pickup = e.target.checked; syncModes(); changed(); });
$('#f-delivery').addEventListener('change', (e) => { state.delivery = e.target.checked; syncModes(); changed(); });
for (const k of ['pix', 'dinheiro', 'cartao']) {
  $(`#f-pay-${k}`).addEventListener('change', (e) => { state.payments[k] = e.target.checked; changed(); });
}

function syncModes() {
  $('#fee-field').hidden = !state.delivery;
  if (!state.pickup && !state.delivery) showError('f-modes', 'Marque ao menos uma opção.');
  else clearError('f-modes');
}

/* cor e emoji */
const colorInput = $('#f-color');
colorInput.addEventListener('input', () => { state.color = colorInput.value.toUpperCase(); syncSwatches(); changed(); });
const swatches = $('#swatches');
for (const p of BRAND_PRESETS) {
  swatches.append(h('button', {
    type: 'button', class: 'swatch', style: { '--c': p.value }, 'data-color': p.value,
    'aria-label': `Cor ${p.name}`, title: p.name,
    onclick: () => { state.color = p.value; colorInput.value = p.value; syncSwatches(); changed(); },
  }));
}
function syncSwatches() {
  swatches.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.color === state.color.toUpperCase())));
}
const emojiRow = $('#emoji-row');
for (const e of EMOJIS) {
  emojiRow.append(h('button', {
    type: 'button', class: 'emoji-btn', text: e, 'aria-label': `Usar ${e}`,
    onclick: () => { state.emoji = e; $('#f-emoji').value = e; changed(); },
  }));
}

function fillForm() {
  $('#f-name').value = state.name;
  $('#f-slogan').value = state.slogan;
  $('#f-emoji').value = state.emoji;
  $('#f-address').value = state.address;
  $('#f-hours').value = state.hours;
  $('#f-pix').value = state.pixKey;
  $('#f-fee').value = centsToInput(state.deliveryFee);
  $('#f-min').value = centsToInput(state.minOrder);
  phoneText = state.whatsapp ? formatPhone(state.whatsapp) : '';
  phoneInput.value = phoneText;
  colorInput.value = state.color;
  $('#f-pickup').checked = state.pickup;
  $('#f-delivery').checked = state.delivery;
  for (const k of ['pix', 'dinheiro', 'cartao']) $(`#f-pay-${k}`).checked = state.payments[k];
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.error').forEach((el) => (el.textContent = ''));
  syncSwatches();
  syncModes();
  updatePhoneHint();
  updateExampleBanner();
  renderCatalog();
  updateCatalogCount();
}

function updateExampleBanner() {
  $('#example-banner').hidden = state.whatsapp !== EXAMPLE_PHONE;
}
$('#btn-focus-phone').addEventListener('click', () => {
  phoneInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
  phoneInput.focus({ preventScroll: true });
  phoneInput.select();
});

function showError(id, msg) {
  const el = $(`#${id}-err`);
  if (el) el.textContent = msg;
  $(`#${id}`)?.setAttribute('aria-invalid', 'true');
}
function clearError(id) {
  const el = $(`#${id}-err`);
  if (el) el.textContent = '';
  $(`#${id}`)?.removeAttribute('aria-invalid');
}

/* ---------------- catálogo ---------------- */

const catsEl = $('#categories');

function move(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}

const BTN_ICONS = { '↑': 'up', '↓': 'down', '🗑': 'trash' };
function iconBtn(label, glyph, onclick, extra = {}) {
  return h('button', { type: 'button', class: 'icon-btn icon-btn-sm', 'aria-label': label, title: label, html: ICONS[BTN_ICONS[glyph]], onclick, ...extra });
}

function renderCatalog(focusSel) {
  catsEl.textContent = '';
  state.categories.forEach((cat, ci) => {
    const catNameId = `cat-${ci}-name`;
    const itemsEl = h('ul', { class: 'items' });
    cat.items.forEach((item, ii) => itemsEl.append(renderItem(cat, item, ci, ii)));
    if (!cat.items.length) itemsEl.append(h('li', { class: 'items-empty', text: 'Nenhum produto nesta categoria ainda.' }));

    catsEl.append(h('div', { class: 'cat', 'data-ci': ci },
      h('div', { class: 'cat-head' },
        h('label', { class: 'sr-only', for: catNameId, text: `Nome da categoria ${ci + 1}` }),
        h('input', {
          id: catNameId, class: 'cat-name', type: 'text', maxlength: '40', value: cat.name, placeholder: 'Nome da categoria',
          oninput: (e) => { cat.name = e.target.value; changed(); },
        }),
        h('div', { class: 'cat-actions' },
          iconBtn('Mover categoria para cima', '↑', () => { if (move(state.categories, ci, -1)) changed({ structure: true }); focusAfter(`[data-ci="${ci - 1}"] .cat-actions button`); }, { disabled: ci === 0 }),
          iconBtn('Mover categoria para baixo', '↓', () => { if (move(state.categories, ci, 1)) changed({ structure: true }); focusAfter(`[data-ci="${ci + 1}"] .cat-actions button:nth-child(2)`); }, { disabled: ci === state.categories.length - 1 }),
          iconBtn('Excluir categoria', '🗑', () => deleteCategory(ci), { class: 'icon-btn icon-btn-sm icon-btn-danger' }),
        ),
      ),
      itemsEl,
      h('button', {
        type: 'button', class: 'btn btn-ghost btn-sm add-item', text: '+ Adicionar produto',
        onclick: () => {
          const item = { name: '', description: '', price: 0, emoji: '', from: false, soldOut: false, image: '' };
          cat.items.push(item);
          expanded.add(item);
          changed({ structure: true });
          focusAfter(`[data-ci="${ci}"] .item:last-child .item-name-input`);
        },
      }),
    ));
  });
  if (focusSel) focusAfter(focusSel);
}

function focusAfter(sel) {
  requestAnimationFrame(() => document.querySelector(sel)?.focus());
}

function itemSummaryText(item) {
  return item.name || 'Produto sem nome';
}

function renderItem(cat, item, ci, ii) {
  const uid = `it-${ci}-${ii}`;
  const isOpen = expanded.has(item);
  const sumName = h('span', { class: 'item-sum-name', text: itemSummaryText(item) });
  const sumPrice = h('span', { class: 'item-sum-price', text: (item.from ? 'a partir de ' : '') + formatBRL(item.price) });
  const sumEmoji = h('span', { class: 'item-sum-emoji', 'aria-hidden': 'true', text: item.emoji || '•' });
  const sumBadge = h('span', { class: 'badge badge-muted', text: 'Esgotado', hidden: !item.soldOut });
  const li = h('li', { class: 'item' + (isOpen ? ' is-open' : '') + (item.soldOut ? ' is-soldout' : '') });

  const refreshSummary = () => {
    sumName.textContent = itemSummaryText(item);
    sumPrice.textContent = (item.from ? 'a partir de ' : '') + formatBRL(item.price);
    sumEmoji.textContent = item.emoji || '•';
    sumBadge.hidden = !item.soldOut;
    li.classList.toggle('is-soldout', item.soldOut);
  };

  const panel = h('div', { class: 'item-panel', id: `${uid}-panel`, hidden: !isOpen });
  const toggle = h('button', {
    type: 'button', class: 'item-toggle', 'aria-expanded': String(isOpen), 'aria-controls': `${uid}-panel`,
    onclick: () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      li.classList.toggle('is-open', open);
      if (open) expanded.add(item);
      else expanded.delete(item);
    },
  }, sumEmoji, h('span', { class: 'item-sum-text' }, sumName, sumPrice), sumBadge, h('span', { class: 'chev', 'aria-hidden': 'true' }));

  const actions = h('div', { class: 'item-actions' },
    iconBtn(`Mover ${item.name || 'produto'} para cima`, '↑', () => { if (move(cat.items, ii, -1)) { changed({ structure: true }); focusAfter(`[data-ci="${ci}"] .item:nth-child(${ii}) .item-actions button`); } }, { disabled: ii === 0 }),
    iconBtn(`Mover ${item.name || 'produto'} para baixo`, '↓', () => { if (move(cat.items, ii, 1)) { changed({ structure: true }); focusAfter(`[data-ci="${ci}"] .item:nth-child(${ii + 2}) .item-actions button:nth-child(2)`); } }, { disabled: ii === cat.items.length - 1 }),
    iconBtn(`Excluir ${item.name || 'produto'}`, '🗑', () => deleteItem(cat, ii), { class: 'icon-btn icon-btn-sm icon-btn-danger' }),
  );

  // campos
  const f = (label, input, cls = '', hint) => h('div', { class: 'field ' + cls },
    h('label', { for: input.id, text: label }), input, hint ? h('p', { class: 'hint', text: hint }) : null);
  const nameI = h('input', { id: `${uid}-name`, class: 'item-name-input', type: 'text', maxlength: '70', value: item.name, placeholder: 'Ex.: Pão de queijo' });
  nameI.addEventListener('input', () => { item.name = nameI.value; refreshSummary(); changed(); });
  const priceI = h('input', { id: `${uid}-price`, type: 'text', inputmode: 'decimal', maxlength: '12', value: centsToInput(item.price), placeholder: '0,00' });
  const priceErr = h('p', { class: 'error', 'aria-live': 'polite' });
  priceI.addEventListener('input', () => {
    const v = parseBRL(priceI.value);
    priceI.toggleAttribute('aria-invalid', v === null);
    priceErr.textContent = v === null ? 'Use só números, ex.: 12,50' : '';
    if (v !== null) { item.price = v; refreshSummary(); changed(); }
  });
  priceI.addEventListener('blur', () => { if (parseBRL(priceI.value) !== null) priceI.value = centsToInput(item.price); });
  const emojiI = h('input', { id: `${uid}-emoji`, class: 'input-emoji', type: 'text', maxlength: '8', value: item.emoji, placeholder: '🍞' });
  emojiI.addEventListener('input', () => { item.emoji = emojiI.value; refreshSummary(); changed(); });
  const descI = h('textarea', { id: `${uid}-desc`, rows: '2', maxlength: '200', placeholder: 'Ingredientes, tamanho, sabores…' });
  descI.value = item.description;
  descI.addEventListener('input', () => { item.description = descI.value; changed(); });
  const imgI = h('input', { id: `${uid}-img`, type: 'url', inputmode: 'url', maxlength: '500', value: item.image, placeholder: 'https://… (opcional)' });
  const imgErr = h('p', { class: 'error', 'aria-live': 'polite' });
  imgI.addEventListener('input', () => {
    const v = imgI.value.trim();
    const ok = !v || /^https?:\/\/\S+$/i.test(v);
    imgI.toggleAttribute('aria-invalid', !ok);
    imgErr.textContent = ok ? '' : 'Cole um endereço que comece com https://';
    item.image = ok ? v : '';
    changed();
  });
  const fromI = h('input', { id: `${uid}-from`, type: 'checkbox', checked: item.from });
  fromI.addEventListener('change', () => { item.from = fromI.checked; refreshSummary(); changed(); });
  const soldI = h('input', { id: `${uid}-sold`, type: 'checkbox', role: 'switch', checked: item.soldOut });
  soldI.addEventListener('change', () => { item.soldOut = soldI.checked; refreshSummary(); changed(); });

  panel.append(h('div', { class: 'grid-item' },
    f('Nome do produto', nameI, 'span-2'),
    h('div', { class: 'field' }, h('label', { for: priceI.id, text: 'Preço' }), h('div', { class: 'money' }, h('span', { 'aria-hidden': 'true', text: 'R$' }), priceI), priceErr),
    f('Emoji', emojiI),
    f('Descrição (opcional)', descI, 'span-2'),
    h('div', { class: 'field span-2' }, h('label', { for: imgI.id, text: 'Foto — link da imagem (opcional)' }), imgI,
      h('p', { class: 'hint', text: 'Use um link público de imagem (https). Fotos deixam o link maior; se a imagem não carregar, o emoji aparece no lugar.' }), imgErr),
    h('div', { class: 'item-flags span-2' },
      h('label', { class: 'check-row' }, fromI, h('span', { text: 'Mostrar “a partir de”' })),
      h('label', { class: 'switch-row' }, soldI, h('span', { class: 'switch', 'aria-hidden': 'true' }), h('span', { text: 'Esgotado' })),
    ),
  ));

  li.append(h('div', { class: 'item-row' }, toggle, actions), panel);
  return li;
}

function deleteItem(cat, ii) {
  const [removed] = cat.items.splice(ii, 1);
  changed({ structure: true });
  undoToast(`“${removed.name || 'Produto'}” excluído.`, () => {
    cat.items.splice(ii, 0, removed);
    changed({ structure: true });
  });
}

function deleteCategory(ci) {
  const cat = state.categories[ci];
  if (cat.items.length && !confirm(`Excluir a categoria “${cat.name || 'sem nome'}” e seus ${cat.items.length} produto(s)?`)) return;
  state.categories.splice(ci, 1);
  changed({ structure: true });
  undoToast(`Categoria “${cat.name || 'sem nome'}” excluída.`, () => {
    state.categories.splice(ci, 0, cat);
    changed({ structure: true });
  });
}

$('#btn-add-cat').addEventListener('click', () => {
  state.categories.push({ name: '', items: [] });
  changed({ structure: true });
  focusAfter('.cat:last-child .cat-name');
});

function updateCatalogCount() {
  const n = state.categories.reduce((s, c) => s + c.items.length, 0);
  $('#catalog-count').textContent = `${state.categories.length} ${state.categories.length === 1 ? 'categoria' : 'categorias'} · ${n} ${n === 1 ? 'produto' : 'produtos'}`;
}

function undoToast(message, onUndo) {
  let region = document.querySelector('body > .toast-region');
  if (!region) {
    region = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  const t = h('div', { class: 'toast' }, h('span', { text: message }),
    h('button', { type: 'button', class: 'toast-action', text: 'Desfazer', onclick: () => { onUndo(); t.remove(); } }));
  region.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 6000);
}

/* ---------------- ações da barra ---------------- */

function replaceState(next, message) {
  state = normalizeStore(next);
  fillForm();
  changed();
  if (message) toast(message);
}

$('#btn-example').addEventListener('click', () => {
  if (!confirm('Carregar a loja de exemplo? O catálogo atual do editor será substituído.')) return;
  replaceState(exampleStore(), 'Exemplo carregado.');
});
$('#hero-demo').addEventListener('click', () => {
  if (state.whatsapp !== EXAMPLE_PHONE && state.name && !confirm('Carregar a loja de exemplo? O catálogo atual do editor será substituído.')) return;
  if (state.whatsapp !== EXAMPLE_PHONE) replaceState(exampleStore(), 'Exemplo carregado.');
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Começar do zero? Todo o catálogo do editor será apagado. (Dica: exporte um backup antes.)')) return;
  replaceState(emptyStore(), 'Catálogo limpo. Vamos começar!');
  hidePublish();
  $('#f-name').focus();
});

function slugify(s) {
  return (s || 'minha-loja').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'minha-loja';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

$('#btn-export').addEventListener('click', () => {
  const data = { app: 'vitrine-rapida', version: 1, exportedAt: new Date().toISOString(), store: state };
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `vitrine-${slugify(state.name)}-${date}.json`);
  toast('Backup baixado. Guarde o arquivo em local seguro.');
});

const importDialog = $('#import-dialog');
const importFile = $('#import-file');
$('#btn-import').addEventListener('click', () => openDialog(importDialog));
$('#btn-import-file').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Arquivo grande demais');
    const json = JSON.parse(await file.text());
    const store = json && json.store ? json.store : json;
    if (!store || !Array.isArray(store.categories)) throw new Error('Não parece um backup da Vitrine Rápida');
    replaceState(store, 'Backup importado com sucesso!');
    hidePublish();
    importDialog.close();
  } catch (err) {
    toast(`Não foi possível importar: ${err.message}.`);
  }
});
$('#btn-import-link').addEventListener('click', async () => {
  const raw = $('#import-link').value.trim();
  const err = $('#import-link-err');
  err.textContent = '';
  try {
    const hash = raw.includes('#') ? raw.slice(raw.indexOf('#')) : '';
    const payload = payloadFromHash(hash);
    if (!payload) throw new Error('O link não contém um catálogo (#d=...)');
    replaceState(await decodeStore(payload), 'Catálogo carregado do link. Pode editar!');
    hidePublish();
    importDialog.close();
  } catch (e) {
    err.textContent = e.message;
  }
});

/* ---------------- dialogs ---------------- */

function openDialog(d) {
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');
}
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-close]')) d.close();
  });
});

/* ---------------- publicar ---------------- */

function validateForPublish() {
  let first = null;
  if (!state.name.trim()) {
    showError('f-name', 'Dê um nome para a sua loja.');
    first = first || $('#f-name');
  }
  const r = normalizePhone(phoneInput.value);
  if (!r.ok) {
    showError('f-phone', r.error);
    first = first || phoneInput;
  }
  if (!state.pickup && !state.delivery) {
    showError('f-modes', 'Marque ao menos uma opção.');
    first = first || $('#f-pickup');
  }
  const count = state.categories.reduce((s, c) => s + c.items.filter((i) => i.name.trim()).length, 0);
  if (!count && !first) {
    toast('Adicione pelo menos um produto com nome.');
    first = $('#btn-add-cat');
  }
  if (first) {
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    first.focus({ preventScroll: true });
    return false;
  }
  return true;
}

function hidePublish() {
  linkShown = false;
  currentLink = '';
  $('#publish-result').hidden = true;
}

async function generateLink({ silent = false } = {}) {
  if (!silent && !validateForPublish()) return;
  if (silent) {
    const r = normalizePhone(phoneInput.value);
    if (!state.name.trim() || !r.ok) return;
  }
  const payload = await encodeStore(state);
  const link = buildStoreUrl(payload);
  const isUpdate = linkShown && link !== currentLink;
  currentLink = link;
  linkShown = true;

  $('#publish-result').hidden = false;
  $('#out-link').value = link;
  $('#btn-open').href = link;
  $('#btn-share').href = `https://wa.me/?text=${encodeURIComponent(`Confira o catálogo de ${state.name} e faça seu pedido pelo WhatsApp: ${link}`)}`;
  const len = link.length;
  $('#link-length').textContent = `${len.toLocaleString('pt-BR')} caracteres`;

  const badge = $('#link-badge');
  const warn = $('#link-warning');
  const fit = qrFits(link);
  warn.hidden = true;
  if (len > LONG_LINK) {
    badge.textContent = 'Link muito longo';
    badge.className = 'badge badge-danger';
    warn.hidden = false;
    warn.textContent = 'Este link está muito longo e alguns aplicativos podem cortá-lo. Reduza descrições, remova links de fotos ou divida o catálogo em menos itens.';
  } else if (fit.level === 'ok') {
    badge.textContent = 'Ótimo para QR code';
    badge.className = 'badge badge-ok';
  } else if (fit.level === 'dense') {
    badge.textContent = 'QR denso — imprima grande';
    badge.className = 'badge badge-warn';
  } else {
    badge.textContent = fit.level === 'none' ? 'Longo demais para QR' : 'QR muito denso';
    badge.className = 'badge badge-warn';
    warn.hidden = false;
    warn.textContent = fit.level === 'none'
      ? 'O link funciona normalmente, mas não cabe em um QR code. Para o cartaz, encurte o link e cole o link curto na janela do QR code.'
      : 'O link funciona, mas o QR code fica muito denso e pode falhar em celulares simples. Recomendado: use um link encurtado no QR code.';
  }
  $('#link-stale').hidden = !isUpdate;
  if (!silent) {
    toast('Link gerado! Copie e compartilhe.');
    $('#publish-result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

$('#btn-generate').addEventListener('click', () => generateLink());
$('#btn-copy-link').addEventListener('click', async () => {
  const ok = await copyText(currentLink);
  if (!ok) $('#out-link').select();
  toast(ok ? 'Link copiado!' : 'Selecione o link e copie manualmente.');
});

/* QR code */
const qrDialog = $('#qr-dialog');
const shortInput = $('#short-link');
shortInput.value = sessionStorage.getItem(SHORT_KEY) || '';

function qrTarget() {
  const s = shortInput.value.trim();
  if (s && /^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) return { url: s, short: true };
  return { url: currentLink, short: false };
}

function renderQRDialog() {
  const err = $('#short-link-err');
  const s = shortInput.value.trim();
  err.textContent = s && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(s) ? 'Cole um link completo, começando com https://' : '';
  const { url, short } = qrTarget();
  const canvas = $('#qr-canvas');
  const fit = qrFits(url);
  const info = $('#qr-info');
  const badge = $('#qr-badge');
  const ok = drawQR(canvas, url, { size: 600 });
  $('#btn-qr-download').disabled = !ok;
  $('#btn-qr-poster').disabled = !ok;
  if (!ok) {
    badge.className = 'badge badge-danger';
    badge.textContent = 'Não cabe em um QR code';
    info.textContent = `O link tem ${url.length.toLocaleString('pt-BR')} caracteres; o limite de um QR code é cerca de ${QR_LIMITS.max.toLocaleString('pt-BR')}. Encurte o link e cole abaixo.`;
    return;
  }
  const levels = {
    ok: ['badge badge-ok', 'Fácil de ler'],
    dense: ['badge badge-warn', 'Denso — imprima grande'],
    heavy: ['badge badge-warn', 'Muito denso'],
  };
  [badge.className, badge.textContent] = levels[fit.level] || levels.heavy;
  info.textContent = short
    ? 'QR do link encurtado: leitura rápida mesmo impresso pequeno.'
    : fit.level === 'ok'
      ? 'Este QR abre a loja diretamente, com o catálogo completo.'
      : `O QR contém o catálogo inteiro (${url.length.toLocaleString('pt-BR')} caracteres), por isso fica cheio de quadradinhos. Funciona em cartaz grande, mas um link encurtado deixa a leitura muito mais confiável.`;
}

$('#btn-qr').addEventListener('click', () => { renderQRDialog(); openDialog(qrDialog); });
shortInput.addEventListener('input', () => {
  sessionStorage.setItem(SHORT_KEY, shortInput.value.trim());
  renderQRDialog();
});
$('#btn-qr-download').addEventListener('click', () => {
  const big = document.createElement('canvas');
  drawQR(big, qrTarget().url, { size: 1200 });
  big.toBlob((b) => downloadBlob(b, `qr-${slugify(state.name)}.png`), 'image/png');
});

/* Cartaz */
const posterDialog = $('#poster-dialog');
let posterBlob = null;
async function openPoster() {
  const { url, short } = qrTarget();
  const canvas = document.createElement('canvas');
  const ok = await renderPoster(canvas, state, url);
  const warn = $('#poster-warning');
  if (!ok) {
    toast('O link é longo demais para o QR. Cole um link encurtado na janela do QR code.');
    renderQRDialog();
    openDialog(qrDialog);
    return;
  }
  const fit = qrFits(url);
  warn.hidden = short || fit.level === 'ok';
  warn.textContent = 'O QR deste cartaz é denso. Teste a leitura antes de imprimir vários — ou use um link encurtado (botão QR code).';
  posterBlob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const dataUrl = canvas.toDataURL('image/png');
  $('#poster-img').src = dataUrl;
  $('#print-img').src = dataUrl;
  if (qrDialog.open) qrDialog.close();
  openDialog(posterDialog);
}
$('#btn-poster').addEventListener('click', openPoster);
$('#btn-qr-poster').addEventListener('click', openPoster);
$('#btn-poster-download').addEventListener('click', () => {
  if (posterBlob) downloadBlob(posterBlob, `cartaz-${slugify(state.name)}.png`);
});
$('#btn-poster-print').addEventListener('click', () => {
  posterDialog.close();
  document.body.classList.add('printing-poster');
  setTimeout(() => window.print(), 50);
});
window.addEventListener('afterprint', () => document.body.classList.remove('printing-poster'));

/* botão flutuante de prévia (mobile) */
const fab = $('#fab-preview');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(([e]) => fab.classList.toggle('is-hidden', e.isIntersecting), { threshold: 0.2 });
  io.observe($('#preview'));
  const io2 = new IntersectionObserver(([e]) => fab.classList.toggle('is-away', !e.isIntersecting), { threshold: 0 });
  io2.observe(form);
}

/* ---------------- inicialização ---------------- */

// Permite abrir o editor já com uma loja: index.html#d=...
(async () => {
  const payload = payloadFromHash(location.hash);
  if (payload) {
    try {
      state = await decodeStore(payload);
      history.replaceState(null, '', location.pathname + location.search + '#editor');
      toast('Catálogo carregado do link.');
    } catch {
      toast('Não foi possível ler o catálogo do link.');
    }
  }
  fillForm();
  changed();
})();
