/* WardrobeIQ — AI stylist page controller */
document.addEventListener('DOMContentLoaded', () => {
  const { toast, api, currentUser, observeReveals } = window.WIQ;
  const R = window.StylistRender;
  const $ = (id) => document.getElementById(id);
  const results = $('results');
  const outfits = new Map(); // id -> outfit currently on screen
  let lastRequest = null;
  let tab = 'results';
  let lastResultHtml = results.innerHTML;

  /* ---------- User ---------- */
  const user = currentUser();
  if (!user) { localStorage.removeItem('token'); location.replace('/login'); return; }
  $('avatar').textContent = (user.name || '?').charAt(0).toUpperCase();
  $('avatar').title = user.email || '';
  $('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* token is cleared regardless */ }
    localStorage.removeItem('token');
    location.href = '/login';
  });

  /* ---------- AI status ---------- */
  api('/api/stylist/status').then((s) => {
    const banner = $('aiStatus');
    if (!s.configured) {
      banner.className = 'st-banner warn';
      banner.innerHTML = '🔌 <span><b>The AI stylist isn\'t configured on this server.</b> The site owner needs to add an AI provider API key. Your wardrobe still works normally.</span>';
      banner.hidden = false;
      $('generateBtn').disabled = true;
    } else if (s.isMock) {
      banner.className = 'st-banner info';
      banner.innerHTML = '🧪 <span><b>Development mode:</b> the mock provider is active, so suggestions are placeholders and are <b>not AI-generated</b>.</span>';
      banner.hidden = false;
    }
  }).catch(() => {});

  /* ---------- Composer ---------- */
  const promptEl = $('prompt');
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    promptEl.value = b.dataset.preset;
    promptEl.focus();
    if (/three outfits/i.test(b.dataset.preset)) $('count').value = '3';
  }));
  $('when').addEventListener('change', (e) => { $('dateWrap').hidden = e.target.value !== 'date'; });
  $('locMode').addEventListener('change', (e) => { $('cityWrap').hidden = e.target.value !== 'city'; });
  const today = new Date();
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('date').min = iso(today);
  $('date').max = iso(new Date(today.getTime() + 13 * 86400000));

  function getPosition() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 600000 }
      );
    });
  }

  async function buildRequest() {
    const body = { prompt: promptEl.value.trim(), count: Number($('count').value) };
    if ($('occasion').value) body.occasion = $('occasion').value;
    const when = $('when').value;
    if (when === 'tomorrow') body.date = iso(new Date(Date.now() + 86400000));
    else if (when === 'date' && $('date').value) body.date = $('date').value;
    else body.date = iso(new Date());
    const mode = $('locMode').value;
    if (mode === 'city' && $('city').value.trim()) body.city = $('city').value.trim();
    if (mode === 'geo') Object.assign(body, (await getPosition()) || {});
    return body;
  }

  const STAGES = ['Reading your wardrobe…', 'Checking the weather…', 'Styling outfits…', 'Checking every item is really yours…'];
  async function runRecommend(body) {
    lastRequest = body;
    switchTab('results', { keep: true });
    let stage = 0;
    results.innerHTML = R.renderLoading(STAGES[0]);
    const timer = setInterval(() => {
      stage = Math.min(stage + 1, STAGES.length - 1);
      const el = results.querySelector('.st-stage');
      if (el) el.textContent = STAGES[stage];
    }, 2200);
    const btn = $('generateBtn');
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      const result = await api('/api/stylist/recommend', { method: 'POST', body });
      renderResult(result);
    } catch (err) {
      results.innerHTML = R.renderError(err);
    } finally {
      clearInterval(timer);
      btn.classList.remove('loading');
      btn.disabled = false;
      lastResultHtml = results.innerHTML;
    }
  }

  function renderResult(result) {
    outfits.clear();
    (result.outfits || []).forEach((o) => outfits.set(o.id, o));
    results.innerHTML = R.renderResultHeader(result) +
      (result.outfits?.length
        ? `<div class="st-grid">${result.outfits.map((o, i) => R.renderOutfitCard(o, { index: i })).join('')}</div>`
        : R.renderEmpty('results'));
  }

  $('composer').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (promptEl.value.trim().length < 3) {
      toast('Tell the stylist what you need first', 'error');
      promptEl.focus();
      return;
    }
    runRecommend(await buildRequest());
  });
  promptEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('composer').requestSubmit();
  });

  // Deep link from the dashboard: /stylist?q=...&auto=1
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    promptEl.value = params.get('q').slice(0, 500);
    history.replaceState(null, '', '/stylist');
    if (params.get('auto') === '1' && !$('generateBtn').disabled) setTimeout(() => $('composer').requestSubmit(), 300);
  }

  /* ---------- Tabs: suggestions / saved / history ---------- */
  document.querySelectorAll('.st-tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  async function switchTab(name, { keep = false } = {}) {
    if (tab === 'results' && name !== 'results') lastResultHtml = results.innerHTML;
    tab = name;
    document.querySelectorAll('.st-tab').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    if (name === 'results') {
      if (!keep) { results.innerHTML = lastResultHtml; }
      return;
    }
    results.innerHTML = R.renderLoading(name === 'saved' ? 'Loading saved outfits…' : 'Loading history…');
    try {
      const { outfits: list } = await api(`/api/stylist/outfits?limit=30${name === 'saved' ? '&saved=true' : ''}`);
      if (tab !== name) return;
      list.forEach((o) => outfits.set(o.id, o));
      results.innerHTML = list.length
        ? `<div class="st-grid">${list.map((o, i) => R.renderOutfitCard(o, { index: i, deletable: true })).join('')}</div>`
        : R.renderEmpty(name);
    } catch (err) {
      results.innerHTML = R.renderError(err);
    }
  }

  /* ---------- Outfit card actions ---------- */
  function replaceCard(card, outfit) {
    outfits.set(outfit.id, outfit);
    const tmp = document.createElement('div');
    tmp.innerHTML = R.renderOutfitCard(outfit, { deletable: tab !== 'results' });
    const fresh = tmp.firstElementChild;
    fresh.style.animation = 'none';
    card.replaceWith(fresh);
    return fresh;
  }

  async function patchOutfit(card, body) {
    const updated = await api(`/api/stylist/outfits/${card.dataset.outfitId}`, { method: 'PATCH', body });
    return replaceCard(card, updated);
  }

  results.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'retry') { if (lastRequest) runRecommend(lastRequest); return; }
    const card = btn.closest('[data-outfit-id]');
    if (!card) return;
    const outfit = outfits.get(card.dataset.outfitId);
    const fb = outfit?.feedback || {};

    try {
      if (action === 'save') {
        const next = !outfit.saved;
        await patchOutfit(card, { saved: next });
        toast(next ? 'Outfit saved ⭐' : 'Removed from saved', 'success');
      } else if (action === 'rate') {
        const rating = fb.rating === btn.dataset.rating ? null : btn.dataset.rating;
        await patchOutfit(card, { feedback: { rating, tags: fb.tags || [] } });
        if (rating) toast('Thanks — the stylist will remember this', 'success');
      } else if (action === 'tag') {
        const tags = new Set(fb.tags || []);
        tags.has(btn.dataset.tag) ? tags.delete(btn.dataset.tag) : tags.add(btn.dataset.tag);
        await patchOutfit(card, { feedback: { rating: fb.rating ?? null, tags: [...tags] } });
      } else if (action === 'toggle-modify') {
        const form = card.querySelector('.st-modify');
        form.hidden = !form.hidden;
        card.querySelectorAll('.st-keep').forEach((k) => { k.hidden = form.hidden; });
        if (!form.hidden) form.querySelector('input[name="instruction"]').focus();
      } else if (action === 'quick') {
        const input = card.querySelector('input[name="instruction"]');
        input.value = btn.dataset.text;
        input.focus();
      } else if (action === 'wear') {
        btn.classList.add('loading');
        await Promise.all(outfit.items.map((i) => api(`/api/wardrobe/${i.item.id}/wear`, { method: 'POST' })));
        btn.classList.remove('loading');
        toast(`Logged ${outfit.items.length} items as worn today`, 'success');
      } else if (action === 'delete') {
        if (!confirm(`Delete "${outfit.title}" from your outfit history?`)) return;
        await api(`/api/stylist/outfits/${outfit.id}`, { method: 'DELETE' });
        outfits.delete(outfit.id);
        card.classList.add('removing');
        setTimeout(() => { card.remove(); if (!results.querySelector('.st-card')) results.innerHTML = R.renderEmpty(tab); }, 400);
        toast('Outfit deleted', 'success');
      }
    } catch (err) {
      btn.classList.remove('loading');
      toast(err.message, 'error');
    }
  });

  results.addEventListener('submit', async (e) => {
    const form = e.target.closest('.st-modify');
    if (!form) return;
    e.preventDefault();
    const card = form.closest('[data-outfit-id]');
    const instruction = form.instruction.value.trim();
    if (instruction.length < 2) { toast('Describe what to change', 'error'); return; }
    const keepItemIds = [...card.querySelectorAll('input[name="keep"]:checked')].map((c) => c.value);
    const submit = form.querySelector('[type="submit"]');
    submit.classList.add('loading');
    submit.disabled = true;
    try {
      const res = await api(`/api/stylist/outfits/${card.dataset.outfitId}/regenerate`, { method: 'POST', body: { instruction, keepItemIds } });
      if (!res.outfits.length) {
        toast(res.message || 'The stylist could not find a suitable variation', 'info', 5000);
        return;
      }
      const tmp = document.createElement('div');
      tmp.innerHTML = res.outfits.map((o) => { outfits.set(o.id, o); return R.renderOutfitCard(o, { deletable: tab !== 'results' }); }).join('');
      const fresh = [...tmp.children];
      card.after(...fresh);
      fresh[0].classList.add('st-new');
      fresh[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast(res.message || 'Here is a new variation', 'success');
      form.reset();
    } catch (err) {
      toast(err.message, 'error', 5000);
    } finally {
      submit.classList.remove('loading');
      submit.disabled = false;
    }
  });

  /* ---------- Style profile modal ---------- */
  const modal = $('profileModal');
  const LIST_FIELDS = ['preferredStyles', 'favoriteColors', 'dislikedColors', 'typicalOccasions'];
  const TEXT_FIELDS = ['fit', 'formality', 'comfort', 'goals'];
  let lastFocus = null;

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('input')?.focus(), 50);
  }
  function closeModal() {
    modal.classList.add('closing');
    setTimeout(() => { modal.hidden = true; modal.classList.remove('closing'); document.body.style.overflow = ''; lastFocus?.focus?.(); }, 240);
  }
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  $('profileBtn').addEventListener('click', async () => {
    openModal();
    try {
      const { profile } = await api('/api/stylist/profile');
      LIST_FIELDS.forEach((f) => { $(`pf-${f}`).value = (profile?.[f] || []).join(', '); });
      TEXT_FIELDS.forEach((f) => { $(`pf-${f}`).value = profile?.[f] || ''; });
    } catch (err) { toast(err.message, 'error'); }
  });

  $('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    LIST_FIELDS.forEach((f) => { body[f] = $(`pf-${f}`).value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10); });
    TEXT_FIELDS.forEach((f) => { body[f] = $(`pf-${f}`).value.trim(); });
    const btn = e.target.querySelector('[type="submit"]');
    btn.classList.add('loading');
    try {
      await api('/api/stylist/profile', { method: 'PUT', body });
      toast('Style profile saved', 'success');
      closeModal();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.classList.remove('loading');
    }
  });

  $('profileDelete').addEventListener('click', async () => {
    if (!confirm('Delete your style profile? The stylist will stop using these preferences.')) return;
    try {
      await api('/api/stylist/profile', { method: 'DELETE' });
      $('profileForm').reset();
      toast('Style profile deleted', 'success');
      closeModal();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Deep link to a tab: /stylist#saved or /stylist#history
  if (['saved', 'history'].includes(location.hash.slice(1))) switchTab(location.hash.slice(1));

  observeReveals();
});
