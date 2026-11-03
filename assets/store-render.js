/**
 * Vitrine Rápida — renderização da vitrine (compartilhada).
 *
 * Usada pela página pública (loja.html) e, através dela, pela pré-visualização
 * ao vivo dentro do celular no editor. Todo texto vindo do catálogo é inserido
 * com textContent (nunca innerHTML), então o conteúdo do link não executa código.
 */
import { formatBRL, parseBRL, brandVars, fold, formatPhone, EXAMPLE_PHONE, PAYMENT_LABELS } from './model.js';

/* ---------------- helpers de DOM ---------------- */

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v; // somente para SVGs internos e constantes
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const svg = (path, extra = '') =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;

export const ICONS = {
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  bike: svg('<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h2l3 11.5M5.5 17.5 9 9h6l-3 8.5M9 9 7.5 6H5"/>'),
  store: svg('<path d="M4 10v10h16V10M3 4h18l-1.5 6h-15zM9 20v-6h6v6"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  bag: svg('<path d="M6 7h12l1 14H5zM9 7a3 3 0 0 1 6 0"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  alert: svg('<path d="M12 3 2 21h20zM12 10v5M12 18h.01"/>'),
  receipt: svg('<path d="M12 8v4M8 12h8"/><rect x="4" y="3" width="16" height="18" rx="2"/>'),
  whatsapp:
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>',
};

const icon = (name, cls = 'ico') => h('span', { class: cls, html: ICONS[name] });

/* ---------------- toast e área de transferência ---------------- */

export function toast(message, { root = document.body, timeout = 2600 } = {}) {
  let region = root.querySelector(':scope > .toast-region');
  if (!region) {
    region = h('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    root.append(region);
  }
  const t = h('div', { class: 'toast', text: message });
  region.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, timeout);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* usa o método antigo */
  }
  const ta = h('textarea', { style: { position: 'fixed', top: '-1000px', opacity: '0' }, readonly: true });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export function applyBrand(el, color) {
  for (const [k, v] of Object.entries(brandVars(color))) el.style.setProperty(k, v);
}

/* ---------------- pedido ---------------- */

/**
 * Monta o texto do pedido com formatação do WhatsApp (*negrito*, _itálico_).
 * @param store loja normalizada
 * @param lines [{ name, qty, price, from }]
 * @param form  { name, mode: 'retirada'|'entrega', address, payment, change, notes }
 */
export function buildOrderMessage(store, lines, form) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const isDelivery = form.mode === 'entrega';
  const fee = isDelivery ? store.deliveryFee : 0;
  const total = subtotal + fee;
  const hasFrom = lines.some((l) => l.from);
  const out = [];
  out.push(`*Novo pedido — ${store.name}*`, '');
  out.push('*Itens*');
  for (const l of lines) {
    const unit = l.qty > 1 ? ` (${formatBRL(l.price)} cada)` : '';
    out.push(`• ${l.qty}x ${l.name}${l.from ? ' (a partir de)' : ''} — ${formatBRL(l.qty * l.price)}${unit}`);
  }
  out.push('');
  out.push(`Subtotal: ${formatBRL(subtotal)}`);
  if (isDelivery) out.push(`Entrega: ${fee ? formatBRL(fee) : 'grátis'}`);
  out.push(`*Total: ${formatBRL(total)}*`);
  if (hasFrom) out.push('_Itens "a partir de": valor final a confirmar com a loja._');
  out.push('');
  out.push(`*Cliente:* ${form.name}`);
  out.push(`*Recebimento:* ${isDelivery ? 'Entrega' : 'Retirada na loja'}`);
  if (isDelivery) out.push(`*Endereço:* ${form.address}`);
  let pay = PAYMENT_LABELS[form.payment] || form.payment || '';
  if (form.payment === 'dinheiro') {
    const c = parseBRL(form.change);
    pay += c ? ` — troco para ${formatBRL(c)}` : ' — sem troco';
  }
  if (pay) out.push(`*Pagamento:* ${pay}`);
  if (form.notes && form.notes.trim()) out.push(`*Observações:* ${form.notes.trim()}`);
  out.push('', '_Pedido feito pelo catálogo digital (Vitrine Rápida)_');
  return out.join('\n');
}

export function buildWhatsAppUrl(phone, message) {
  return `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

/* ---------------- vitrine ---------------- */

/**
 * Cria a vitrine dentro de `root`.
 * options.storageKey: chave para guardar a sacola no sessionStorage (ou null)
 * options.preview: true quando exibida dentro do editor
 * options.editorUrl: link para "Crie sua vitrine"
 */
export function createStorefront(root, initialStore, options = {}) {
  const opts = { storageKey: null, preview: false, editorUrl: 'index.html', ...options };
  let store = initialStore;
  let items = new Map(); // id -> { id, cat, name, price, ... }
  const cart = new Map(); // id -> qty
  const checkout = { name: '', mode: '', address: '', payment: '', change: '', notes: '' };
  const cardEls = new Map();
  let query = '';
  let sheetOpen = false;
  let lastFocus = null;
  let observer = null;

  /* ---- persistência da sacola ---- */
  function loadCart() {
    if (!opts.storageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(opts.storageKey) || 'null');
      if (!saved) return;
      for (const [id, [qty, name]] of Object.entries(saved.cart || {})) {
        const it = items.get(id);
        if (it && it.name === name && !it.soldOut && qty > 0) cart.set(id, Math.min(99, qty | 0));
      }
      Object.assign(checkout, saved.checkout || {});
    } catch {
      /* ignora dados antigos inválidos */
    }
  }
  function saveCart() {
    if (!opts.storageKey) return;
    try {
      const c = {};
      for (const [id, qty] of cart) c[id] = [qty, items.get(id).name];
      sessionStorage.setItem(opts.storageKey, JSON.stringify({ cart: c, checkout }));
    } catch {
      /* armazenamento indisponível (modo privado) */
    }
  }

  function indexItems() {
    items = new Map();
    store.categories.forEach((cat, ci) =>
      cat.items.forEach((it, ii) => {
        if (!it.name) return;
        items.set(`${ci}-${ii}`, { ...it, id: `${ci}-${ii}`, cat: ci });
      }),
    );
    for (const [id, qty] of [...cart]) {
      const it = items.get(id);
      if (!it || it.soldOut || qty <= 0) cart.delete(id);
    }
  }

  const totals = () => {
    let count = 0;
    let subtotal = 0;
    for (const [id, qty] of cart) {
      count += qty;
      subtotal += qty * items.get(id).price;
    }
    return { count, subtotal };
  };

  function setQty(id, qty) {
    const it = items.get(id);
    if (!it || it.soldOut) return;
    qty = Math.max(0, Math.min(99, qty));
    if (qty) cart.set(id, qty);
    else cart.delete(id);
    saveCart();
    refreshCard(id);
    refreshCartBar();
    if (sheetOpen) refreshSheet();
  }

  /* ---- estrutura ---- */
  const el = {};

  function render() {
    root.textContent = '';
    cardEls.clear();
    if (observer) observer.disconnect();
    root.classList.add('sf');
    root.classList.toggle('sf--preview', !!opts.preview);
    applyBrand(root, store.color);

    if (store.whatsapp === EXAMPLE_PHONE) {
      root.append(
        h('div', { class: 'sf-demo', role: 'note' },
          icon('alert'),
          h('span', null, opts.preview
            ? 'Número de exemplo — troque pelo seu WhatsApp no editor.'
            : 'Loja de demonstração: os pedidos vão para um número fictício.'),
        ),
      );
    }

    root.append(renderHero());

    el.search = h('input', {
      class: 'sf-search-input', type: 'search', placeholder: 'Buscar no cardápio…',
      'aria-label': 'Buscar produtos', autocomplete: 'off', value: query,
      oninput: (e) => { query = e.target.value; applySearch(); },
    });
    el.chips = h('nav', { class: 'sf-chips', 'aria-label': 'Categorias' });
    const visibleCats = store.categories
      .map((c, ci) => ({ ...c, ci }))
      .filter((c) => c.items.some((i) => i.name));
    visibleCats.forEach((c) => {
      el.chips.append(h('button', {
        class: 'sf-chip', type: 'button', 'data-cat': c.ci, text: c.name || 'Sem nome',
        onclick: () => {
          const sec = root.querySelector(`#sf-cat-${c.ci}`);
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveChip(c.ci);
        },
      }));
    });
    root.append(h('div', { class: 'sf-sticky' },
      h('label', { class: 'sf-search' }, icon('search'), el.search),
      visibleCats.length > 1 ? el.chips : null,
    ));

    el.list = h('main', { class: 'sf-list', id: 'sf-main' });
    if (!visibleCats.length) {
      el.list.append(h('div', { class: 'sf-empty' },
        h('div', { class: 'sf-empty-emoji', text: '🧺' }),
        h('p', { text: 'Nenhum produto cadastrado ainda.' }),
      ));
    }
    for (const c of visibleCats) {
      const grid = h('div', { class: 'sf-grid' });
      c.items.forEach((_, ii) => {
        const it = items.get(`${c.ci}-${ii}`);
        if (!it) return;
        const card = renderCard(it);
        cardEls.set(it.id, card);
        grid.append(card);
      });
      el.list.append(h('section', { class: 'sf-section', id: `sf-cat-${c.ci}`, 'data-cat': c.ci, 'aria-labelledby': `sf-cat-title-${c.ci}` },
        h('h2', { class: 'sf-section-title', id: `sf-cat-title-${c.ci}`, text: c.name || 'Produtos' }),
        grid,
      ));
    }
    el.noResults = h('p', { class: 'sf-noresults', hidden: true });
    el.list.append(el.noResults);
    root.append(el.list);

    root.append(h('footer', { class: 'sf-footer' },
      h('p', null, 'Catálogo criado grátis com ',
        h('a', { href: opts.editorUrl, target: opts.preview ? '_blank' : null, rel: 'noopener', text: 'Vitrine Rápida' })),
    ));

    // barra flutuante da sacola
    el.barCount = h('span', { class: 'sf-bar-count' });
    el.barTotal = h('span', { class: 'sf-bar-total' });
    el.bar = h('button', {
      class: 'sf-bar', type: 'button', 'aria-haspopup': 'dialog', onclick: openSheet,
    }, h('span', { class: 'sf-bar-bag' }, icon('bag'), el.barCount), h('span', { class: 'sf-bar-label', text: 'Ver sacola' }), el.barTotal);
    el.barWrap = h('div', { class: 'sf-bar-wrap' }, el.bar);
    root.append(el.barWrap);

    renderSheetShell();
    refreshCartBar();
    applySearch();
    observeSections();
  }

  function renderHero() {
    const logoText = store.emoji || (store.name ? store.name.trim()[0].toUpperCase() : '?');
    const meta = h('ul', { class: 'sf-meta' });
    if (store.hours) meta.append(h('li', null, icon('clock'), h('span', { text: store.hours })));
    if (store.address) meta.append(h('li', null, icon('pin'), h('span', { text: store.address })));
    const tags = h('div', { class: 'sf-tags' });
    if (store.delivery) tags.append(h('span', { class: 'sf-tag' }, icon('bike'), store.deliveryFee ? `Entrega ${formatBRL(store.deliveryFee)}` : 'Entrega grátis'));
    if (store.pickup) tags.append(h('span', { class: 'sf-tag' }, icon('store'), 'Retirada no local'));
    if (store.minOrder) tags.append(h('span', { class: 'sf-tag' }, icon('receipt'), `Mínimo ${formatBRL(store.minOrder)}`));
    const pays = Object.entries(store.payments).filter(([, v]) => v).map(([k]) => PAYMENT_LABELS[k]);
    return h('header', { class: 'sf-hero' },
      h('div', { class: 'sf-hero-bg', 'aria-hidden': 'true' }),
      h('div', { class: 'sf-hero-inner' },
        h('div', { class: 'sf-logo', 'aria-hidden': 'true', text: logoText }),
        h('div', { class: 'sf-hero-text' },
          h('h1', { class: 'sf-name', text: store.name || 'Minha loja' }),
          store.slogan ? h('p', { class: 'sf-slogan', text: store.slogan }) : null,
        ),
      ),
      h('div', { class: 'sf-hero-card' },
        meta.children.length ? meta : null,
        tags,
        pays.length ? h('p', { class: 'sf-pays', text: `Pagamento: ${pays.join(' · ')}` }) : null,
      ),
    );
  }

  function renderThumb(it) {
    const fallback = () => h('div', { class: 'sf-thumb sf-thumb--emoji', 'aria-hidden': 'true', text: it.emoji || (it.name[0] || '?').toUpperCase() });
    if (!it.image) return fallback();
    const img = h('img', { src: it.image, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
    const wrap = h('div', { class: 'sf-thumb sf-thumb--img' }, img);
    img.addEventListener('error', () => wrap.replaceWith(fallback()), { once: true });
    return wrap;
  }

  function renderCard(it) {
    const priceText = (it.from ? 'a partir de ' : '') + formatBRL(it.price);
    const card = h('article', { class: 'sf-card' + (it.soldOut ? ' is-soldout' : ''), 'data-id': it.id },
      h('div', { class: 'sf-card-body' },
        h('h3', { class: 'sf-card-title', text: it.name }),
        it.description ? h('p', { class: 'sf-card-desc', text: it.description }) : null,
        h('p', { class: 'sf-card-price' },
          it.from ? h('small', { text: 'a partir de ' }) : null,
          formatBRL(it.price)),
      ),
      h('div', { class: 'sf-card-side' },
        renderThumb(it),
        h('div', { class: 'sf-stepper-slot' }),
      ),
    );
    card.setAttribute('aria-label', `${it.name}, ${priceText}${it.soldOut ? ', esgotado' : ''}`);
    fillStepper(card.querySelector('.sf-stepper-slot'), it);
    return card;
  }

  function fillStepper(slot, it) {
    slot.textContent = '';
    if (it.soldOut) {
      slot.append(h('span', { class: 'sf-soldout', text: 'Esgotado' }));
      return;
    }
    const qty = cart.get(it.id) || 0;
    if (!qty) {
      slot.append(h('button', {
        class: 'sf-add', type: 'button', 'aria-label': `Adicionar ${it.name}`,
        onclick: () => { setQty(it.id, 1); slot.querySelector('.sf-step-plus')?.focus(); },
      }, icon('plus'), h('span', { text: 'Adicionar' })));
      return;
    }
    slot.append(h('div', { class: 'sf-stepper', role: 'group', 'aria-label': `Quantidade de ${it.name}` },
      h('button', {
        class: 'sf-step sf-step-minus', type: 'button', 'aria-label': `Remover um ${it.name}`,
        onclick: () => {
          setQty(it.id, qty - 1);
          (slot.querySelector('.sf-step-minus') || slot.querySelector('.sf-add'))?.focus();
        },
      }, icon(qty === 1 ? 'trash' : 'minus')),
      h('output', { class: 'sf-qty', 'aria-live': 'polite', text: String(qty) }),
      h('button', {
        class: 'sf-step sf-step-plus', type: 'button', 'aria-label': `Adicionar mais um ${it.name}`,
        onclick: () => { setQty(it.id, qty + 1); slot.querySelector('.sf-step-plus')?.focus(); },
      }, icon('plus')),
    ));
  }

  function refreshCard(id) {
    const card = cardEls.get(id);
    if (!card) return;
    const qty = cart.get(id) || 0;
    card.classList.toggle('in-cart', qty > 0);
    fillStepper(card.querySelector('.sf-stepper-slot'), items.get(id));
  }

  function refreshCartBar() {
    const { count, subtotal } = totals();
    el.barCount.textContent = String(count);
    el.barTotal.textContent = formatBRL(subtotal);
    el.bar.setAttribute('aria-label', `Ver sacola: ${count} ${count === 1 ? 'item' : 'itens'}, ${formatBRL(subtotal)}`);
    el.barWrap.classList.toggle('is-visible', count > 0);
    root.classList.toggle('has-cart', count > 0);
    for (const id of cardEls.keys()) cardEls.get(id).classList.toggle('in-cart', cart.has(id));
  }

  /* ---- busca e categorias ---- */
  function applySearch() {
    const q = fold(query.trim());
    let shown = 0;
    for (const [id, card] of cardEls) {
      const it = items.get(id);
      const match = !q || fold(it.name + ' ' + it.description).includes(q);
      card.hidden = !match;
      if (match) shown++;
    }
    root.querySelectorAll('.sf-section').forEach((sec) => {
      sec.hidden = !sec.querySelector('.sf-card:not([hidden])');
    });
    el.noResults.hidden = !(q && !shown);
    el.noResults.textContent = q && !shown ? `Nada encontrado para “${query.trim()}”.` : '';
    if (el.chips) el.chips.hidden = !!q;
  }

  function setActiveChip(ci) {
    el.chips.querySelectorAll('.sf-chip').forEach((c) => {
      const on = c.dataset.cat === String(ci);
      c.classList.toggle('is-active', on);
      if (on) {
        c.setAttribute('aria-current', 'true');
        const nav = el.chips;
        const left = c.offsetLeft - nav.clientWidth / 2 + c.clientWidth / 2;
        nav.scrollTo({ left, behavior: 'smooth' });
      } else c.removeAttribute('aria-current');
    });
  }

  function observeSections() {
    if (!('IntersectionObserver' in window)) return;
    const first = root.querySelector('.sf-section');
    if (first) setActiveChip(first.dataset.cat);
    observer = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActiveChip(vis[0].target.dataset.cat);
    }, { rootMargin: '-140px 0px -60% 0px' });
    root.querySelectorAll('.sf-section').forEach((s) => observer.observe(s));
  }

  /* ---- sacola / checkout ---- */
  function renderSheetShell() {
    el.sheetItems = h('ul', { class: 'sf-cart-list' });
    el.sheetSummary = h('div', { class: 'sf-summary' });
    el.form = h('form', { class: 'sf-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); sendOrder(); } });
    el.sendBtn = h('button', { class: 'sf-send', type: 'submit', form: 'sf-checkout' }, h('span', { html: ICONS.whatsapp }), h('span', { text: 'Enviar pedido pelo WhatsApp' }));
    el.form.id = 'sf-checkout';
    el.sendHint = h('p', { class: 'sf-send-hint', 'aria-live': 'polite' });
    el.sheetPanel = h('div', {
      class: 'sf-sheet-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sf-sheet-title', tabindex: '-1',
    },
      h('div', { class: 'sf-sheet-head' },
        h('span', { class: 'sf-grabber', 'aria-hidden': 'true' }),
        h('h2', { id: 'sf-sheet-title', text: 'Sua sacola' }),
        h('button', { class: 'sf-icon-btn', type: 'button', 'aria-label': 'Fechar sacola', onclick: closeSheet, html: ICONS.close }),
      ),
      h('div', { class: 'sf-sheet-body' }, el.sheetItems, el.sheetSummary, el.form),
      h('div', { class: 'sf-sheet-foot' }, el.sendHint, el.sendBtn),
    );
    el.sheet = h('div', { class: 'sf-sheet', hidden: true },
      h('div', { class: 'sf-backdrop', onclick: closeSheet }),
      el.sheetPanel,
    );
    el.sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSheet();
      if (e.key === 'Tab') trapFocus(e);
    });
    root.append(el.sheet);
  }

  function trapFocus(e) {
    const f = [...el.sheetPanel.querySelectorAll('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openSheet() {
    if (!cart.size) return;
    lastFocus = document.activeElement;
    sheetOpen = true;
    buildForm();
    refreshSheet();
    el.sheet.hidden = false;
    root.classList.add('sheet-open');
    document.documentElement.classList.add('sf-lock');
    [...root.children].forEach((c) => { if (c !== el.sheet && !c.classList.contains('toast-region')) c.inert = true; });
    requestAnimationFrame(() => {
      el.sheet.classList.add('is-open');
      el.sheetPanel.focus();
    });
  }

  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    el.sheet.classList.remove('is-open');
    root.classList.remove('sheet-open');
    document.documentElement.classList.remove('sf-lock');
    [...root.children].forEach((c) => { c.inert = false; });
    setTimeout(() => { if (!sheetOpen) el.sheet.hidden = true; }, 250);
    (lastFocus && lastFocus.isConnected ? lastFocus : el.bar).focus?.();
  }

  const enabledModes = () => [store.pickup && 'retirada', store.delivery && 'entrega'].filter(Boolean);
  const enabledPays = () => Object.entries(store.payments).filter(([, v]) => v).map(([k]) => k);

  function field(label, input, hint) {
    const id = input.id;
    return h('div', { class: 'sf-field' },
      h('label', { for: id, class: 'sf-label', text: label }),
      input,
      hint ? h('p', { class: 'sf-hint', id: id + '-hint', text: hint }) : null,
      h('p', { class: 'sf-error', id: id + '-err', 'aria-live': 'polite' }),
    );
  }

  function buildForm() {
    const f = el.form;
    f.textContent = '';
    const modes = enabledModes();
    if (!modes.includes(checkout.mode)) checkout.mode = modes[0] || 'retirada';
    const pays = enabledPays();
    if (!pays.includes(checkout.payment)) checkout.payment = pays.length === 1 ? pays[0] : '';

    const bind = (input, key) => {
      input.value = checkout[key] || '';
      input.addEventListener('input', () => {
        checkout[key] = input.value;
        input.removeAttribute('aria-invalid');
        const err = f.querySelector(`#${input.id}-err`);
        if (err) err.textContent = '';
        saveCart();
        refreshSummary();
      });
      return input;
    };

    f.append(h('h3', { class: 'sf-form-title', text: 'Seus dados' }));
    f.append(field('Seu nome', bind(h('input', { id: 'sf-name', type: 'text', autocomplete: 'name', maxlength: '60', required: true, placeholder: 'Como podemos te chamar?' }), 'name')));

    // recebimento
    if (modes.length > 1) {
      f.append(radioGroup('Como prefere receber?', 'mode', modes.map((m) => ({
        value: m,
        label: m === 'entrega' ? 'Entrega' : 'Retirar na loja',
        sub: m === 'entrega' ? (store.deliveryFee ? `+ ${formatBRL(store.deliveryFee)}` : 'Grátis') : 'Sem taxa',
      }))));
    } else {
      f.append(h('p', { class: 'sf-note' }, icon(checkout.mode === 'entrega' ? 'bike' : 'store'),
        checkout.mode === 'entrega'
          ? `Somente entrega${store.deliveryFee ? ` (taxa de ${formatBRL(store.deliveryFee)})` : ' (grátis)'}.`
          : 'Pedido para retirar na loja.'));
    }
    el.addressField = field('Endereço de entrega', bind(h('textarea', {
      id: 'sf-address', rows: '2', autocomplete: 'street-address', maxlength: '200', placeholder: 'Rua, número, bairro e ponto de referência',
    }), 'address'));
    f.append(el.addressField);

    // pagamento
    if (pays.length) {
      f.append(radioGroup('Forma de pagamento', 'payment', pays.map((p) => ({ value: p, label: PAYMENT_LABELS[p] }))));
    }
    el.changeField = field('Troco para quanto?', bind(h('input', {
      id: 'sf-change', type: 'text', inputmode: 'decimal', placeholder: 'Ex.: 50,00 (deixe vazio se não precisar)', maxlength: '12',
    }), 'change'));
    f.append(el.changeField);
    el.pixBox = store.pixKey
      ? h('div', { class: 'sf-pix' },
          h('div', null,
            h('p', { class: 'sf-pix-label', text: 'Chave Pix da loja' }),
            h('p', { class: 'sf-pix-key', text: store.pixKey }),
          ),
          h('button', {
            class: 'sf-pix-copy', type: 'button', onclick: async () => {
              const ok = await copyText(store.pixKey);
              toast(ok ? 'Chave Pix copiada!' : 'Não foi possível copiar. Selecione e copie manualmente.', { root });
            },
          }, icon('copy'), 'Copiar'),
        )
      : h('p', { class: 'sf-note', text: 'A loja enviará os dados do Pix pelo WhatsApp.' });
    f.append(el.pixBox);

    f.append(field('Observações (opcional)', bind(h('textarea', {
      id: 'sf-notes', rows: '2', maxlength: '300', placeholder: 'Ex.: pão bem assadinho, sem cebola, troco em moedas…',
    }), 'notes')));
    toggleConditional();
  }

  function radioGroup(legend, key, options) {
    const fs = h('fieldset', { class: 'sf-radios', id: `sf-${key}` }, h('legend', { class: 'sf-label', text: legend }));
    const wrap = h('div', { class: 'sf-radio-row' });
    for (const o of options) {
      const input = h('input', { type: 'radio', name: `sf-${key}`, value: o.value, checked: checkout[key] === o.value });
      input.addEventListener('change', () => {
        checkout[key] = o.value;
        const err = fs.querySelector('.sf-error');
        if (err) err.textContent = '';
        saveCart();
        toggleConditional();
        refreshSummary();
      });
      wrap.append(h('label', { class: 'sf-radio' }, input,
        h('span', { class: 'sf-radio-box' },
          h('span', { class: 'sf-radio-label', text: o.label }),
          o.sub ? h('span', { class: 'sf-radio-sub', text: o.sub }) : null)));
    }
    fs.append(wrap, h('p', { class: 'sf-error', id: `sf-${key}-err`, 'aria-live': 'polite' }));
    return fs;
  }

  function toggleConditional() {
    el.addressField.hidden = checkout.mode !== 'entrega';
    el.changeField.hidden = checkout.payment !== 'dinheiro';
    const pays = enabledPays();
    el.pixBox.hidden = !(checkout.payment === 'pix' || (pays.length === 1 && pays[0] === 'pix'));
  }

  function refreshSheet() {
    el.sheetItems.textContent = '';
    for (const [id, qty] of cart) {
      const it = items.get(id);
      el.sheetItems.append(h('li', { class: 'sf-cart-item' },
        h('span', { class: 'sf-cart-emoji', 'aria-hidden': 'true', text: it.emoji || '•' }),
        h('div', { class: 'sf-cart-info' },
          h('p', { class: 'sf-cart-name', text: it.name }),
          h('p', { class: 'sf-cart-unit', text: `${it.from ? 'a partir de ' : ''}${formatBRL(it.price)} cada` }),
        ),
        h('div', { class: 'sf-stepper sf-stepper--sm', role: 'group', 'aria-label': `Quantidade de ${it.name}` },
          h('button', { class: 'sf-step', type: 'button', 'aria-label': `Remover um ${it.name}`, html: ICONS[qty === 1 ? 'trash' : 'minus'], onclick: () => setQty(id, qty - 1) }),
          h('output', { class: 'sf-qty', text: String(qty) }),
          h('button', { class: 'sf-step', type: 'button', 'aria-label': `Adicionar mais um ${it.name}`, html: ICONS.plus, onclick: () => setQty(id, qty + 1) }),
        ),
        h('span', { class: 'sf-cart-line', text: formatBRL(qty * it.price) }),
      ));
    }
    if (!cart.size) {
      closeSheet();
      return;
    }
    refreshSummary();
  }

  function refreshSummary() {
    const { subtotal } = totals();
    const isDelivery = checkout.mode === 'entrega';
    const fee = isDelivery ? store.deliveryFee : 0;
    el.sheetSummary.textContent = '';
    const row = (label, value, cls = '') => h('div', { class: 'sf-sum-row ' + cls }, h('span', { text: label }), h('span', { text: value }));
    el.sheetSummary.append(row('Subtotal', formatBRL(subtotal)));
    if (isDelivery) el.sheetSummary.append(row('Entrega', fee ? formatBRL(fee) : 'Grátis'));
    el.sheetSummary.append(row('Total', formatBRL(subtotal + fee), 'is-total'));
    if ([...cart.keys()].some((id) => items.get(id).from)) {
      el.sheetSummary.append(h('p', { class: 'sf-hint', text: 'Itens “a partir de” têm valor final confirmado pela loja.' }));
    }
    const missing = store.minOrder - subtotal;
    if (store.minOrder && missing > 0) {
      el.sendBtn.disabled = true;
      el.sendHint.textContent = `Pedido mínimo de ${formatBRL(store.minOrder)} — faltam ${formatBRL(missing)}.`;
      el.sendHint.classList.add('is-warn');
    } else {
      el.sendBtn.disabled = false;
      el.sendHint.textContent = '';
      el.sendHint.classList.remove('is-warn');
    }
  }

  function setError(id, msg) {
    const err = el.form.querySelector(`#${id}-err`);
    if (err) err.textContent = msg;
    const input = el.form.querySelector(`#${id}`);
    if (input && input.tagName !== 'FIELDSET') input.setAttribute('aria-invalid', 'true');
    return input;
  }

  function validate() {
    const errors = [];
    if (!checkout.name.trim()) errors.push(setError('sf-name', 'Informe seu nome.'));
    if (checkout.mode === 'entrega' && checkout.address.trim().length < 6) errors.push(setError('sf-address', 'Informe o endereço completo para entrega.'));
    if (enabledPays().length && !checkout.payment) errors.push(setError('sf-payment', 'Escolha a forma de pagamento.'));
    if (checkout.payment === 'dinheiro' && checkout.change.trim()) {
      const c = parseBRL(checkout.change);
      const { subtotal } = totals();
      const total = subtotal + (checkout.mode === 'entrega' ? store.deliveryFee : 0);
      if (c === null) errors.push(setError('sf-change', 'Valor inválido. Ex.: 50,00'));
      else if (c < total) errors.push(setError('sf-change', `O troco deve ser para um valor maior que ${formatBRL(total)}.`));
    }
    return errors;
  }

  function currentLines() {
    return [...cart].map(([id, qty]) => {
      const it = items.get(id);
      return { name: it.name, qty, price: it.price, from: it.from };
    });
  }

  function sendOrder() {
    const errors = validate();
    if (errors.length) {
      const first = errors[0];
      if (first) {
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        (first.tagName === 'FIELDSET' ? first.querySelector('input') : first).focus({ preventScroll: true });
      }
      return;
    }
    const message = buildOrderMessage(store, currentLines(), checkout);
    const url = buildWhatsAppUrl(store.whatsapp, message);
    const win = window.open(url, '_blank');
    if (win) {
      try { win.opener = null; } catch { /* ignora */ }
    } else if (!opts.preview) {
      location.href = url; // pop-up bloqueado: abre na mesma aba
    }
    toast('Abrindo o WhatsApp… é só tocar em enviar!', { root });
  }

  /* ---- API ---- */
  indexItems();
  loadCart();
  render();

  return {
    update(next) {
      const wasOpen = sheetOpen;
      if (wasOpen) closeSheet();
      store = next;
      indexItems();
      render();
    },
    getCart: () => currentLines(),
    openSheet,
    closeSheet,
  };
}

/** Página amigável para link inválido. */
export function renderInvalid(root, { title, message, editorUrl = 'index.html' }) {
  root.textContent = '';
  root.className = 'sf-invalid';
  root.append(h('div', { class: 'sf-invalid-card' },
    h('div', { class: 'sf-invalid-emoji', 'aria-hidden': 'true', text: '🧺' }),
    h('h1', { text: title }),
    h('p', { text: message }),
    h('a', { class: 'btn btn-primary', href: editorUrl, text: 'Criar minha vitrine grátis' }),
    h('p', { class: 'sf-invalid-small', text: 'Se você recebeu este link de uma loja, peça para ela enviar o link novamente.' }),
  ));
}

export { formatPhone };
