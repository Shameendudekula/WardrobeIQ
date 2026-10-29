/* WardrobeIQ — AI stylist rendering (pure functions returning HTML strings; unit-tested in Node) */
(function (root) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  // Only render image URLs the app itself serves (never model-supplied or external URLs)
  const safeImg = (url) => (typeof url === 'string' && /^\/(api\/images\/[a-f0-9]{24}|uploads\/[\w .()-]+)$/i.test(url) ? url : '');

  const FEEDBACK_TAGS = [
    ['love-it', '😍 Love it'], ['great-colors', '🎨 Great colours'], ['too-formal', '👔 Too formal'],
    ['too-casual', '🩴 Too casual'], ['uncomfortable', '😣 Uncomfortable'], ['wrong-weather', '🌧️ Wrong for weather'],
    ['not-my-style', '🙅 Not my style'],
  ];
  const QUICK_CHANGES = ['Make it more formal', 'Make it more casual', 'Use different shoes', 'Make it warmer', 'Use fewer colours'];
  const WEATHER_LABEL = { suitable: '☀️ Weather-ready', 'partly-suitable': '⛅ Partly weather-ready', unsuitable: '⚠️ Not ideal for the weather', unknown: '❔ Weather not considered' };
  const RETRYABLE = new Set(['AI_TIMEOUT', 'AI_RATE_LIMITED', 'AI_UNAVAILABLE', 'AI_BAD_OUTPUT', 'NETWORK_ERROR', 'INTERNAL_ERROR']);

  function renderLoading(stage) {
    return `<div class="st-loading" role="status" aria-live="polite" aria-busy="true">
      <div class="st-orb" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="st-stage">${esc(stage || 'Styling your outfits…')}</p>
      <div class="st-skeletons" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
    </div>`;
  }

  function renderError(err) {
    const code = err?.code || 'NETWORK_ERROR';
    const retry = RETRYABLE.has(code);
    return `<div class="st-error" role="alert">
      <span class="st-error-ico" aria-hidden="true">${code === 'AI_NOT_CONFIGURED' ? '🔌' : code === 'RATE_LIMITED' ? '⏳' : '⚠️'}</span>
      <div><strong>${code === 'AI_NOT_CONFIGURED' ? 'AI stylist unavailable' : "Couldn't style that"}</strong>
      <p>${esc(err?.message || 'Something went wrong. Please try again.')}</p></div>
      ${retry ? '<button type="button" class="btn btn-ghost btn-sm" data-action="retry">Try again</button>' : ''}
    </div>`;
  }

  function renderWeather(w) {
    if (!w) return '';
    if (!w.available) return `<span class="chip">❔ Weather not used: ${esc(w.reason || 'unavailable')}</span>`;
    const temp = w.kind === 'forecast' ? `${Math.round(w.minTemperature)}–${Math.round(w.maxTemperature)}°C` : `${Math.round(w.temperature)}°C`;
    const rain = typeof w.precipitationProbability === 'number' ? ` · ${w.precipitationProbability}% rain` : '';
    return `<span class="chip">🌤️ ${esc(w.city || '')} ${esc(w.kind === 'forecast' ? w.date : 'now')} · ${esc(temp)} · ${esc(w.description || '')}${esc(rain)}</span>`;
  }

  function renderResultHeader(result) {
    const src = result.source;
    const missing = result.missingItems || [];
    return `<div class="st-result-head">
      ${result.message ? `<p class="st-ai-message"><span class="st-ai-avatar" aria-hidden="true">✦</span>${esc(result.message)}</p>` : ''}
      <div class="st-meta">
        ${renderWeather(result.weather)}
        ${src ? `<span class="chip ${src.isMock ? 'chip-warn' : ''}">${src.isMock ? '🧪 Mock provider — not AI-generated' : `🤖 ${esc(src.model || src.provider)}`}</span>` : ''}
        ${result.rejected ? `<span class="chip" title="Suggestions that referenced items not in your wardrobe were discarded">🛡️ ${Number(result.rejected)} invalid suggestion${result.rejected > 1 ? 's' : ''} filtered</span>` : ''}
      </div>
      ${missing.length ? `<div class="st-missing"><strong>Missing from your wardrobe</strong><ul>${missing.map((m) => `<li><b>${esc(m.category)}</b> — ${esc(m.reason)}</li>`).join('')}</ul><small class="muted">Optional — you don't need to buy anything to get suggestions.</small></div>` : ''}
    </div>`;
  }

  function renderItem(entry, i) {
    const it = entry.item;
    const img = safeImg(it.imageUrl);
    return `<li class="st-item" style="--i:${i}">
      <div class="st-item-img">${img ? `<img src="${esc(img)}" alt="${esc(it.itemName)}" loading="lazy">` : '<span aria-hidden="true">👕</span>'}
        <span class="st-role">${esc(entry.role || 'item')}</span></div>
      <div class="st-item-body"><strong>${esc(it.itemName)}</strong><small>${esc(it.category)}</small>
        ${entry.reason ? `<p>${esc(entry.reason)}</p>` : ''}</div>
      <label class="st-keep" hidden><input type="checkbox" name="keep" value="${esc(it.id)}"> Keep</label>
    </li>`;
  }

  function renderOutfitCard(o, opts = {}) {
    const fb = o.feedback || {};
    const tags = new Set(fb.tags || []);
    const badges = [o.formality, o.occasion, o.style].filter(Boolean).map((b) => `<span class="st-badge">${esc(b)}</span>`).join('');
    const why = [['🎨 Colours', o.colorNotes], ['🌦️ Weather', o.weatherNotes], ['💛 Your preferences', o.preferenceNotes]].filter(([, v]) => v);
    return `<article class="st-card glass" data-outfit-id="${esc(o.id)}" style="--i:${opts.index || 0}">
      <header class="st-card-head">
        <div><h3>${esc(o.title)}</h3>${o.description ? `<p class="muted">${esc(o.description)}</p>` : ''}</div>
        <button type="button" class="st-save${o.saved ? ' on' : ''}" data-action="save" aria-pressed="${o.saved ? 'true' : 'false'}" aria-label="${o.saved ? 'Unsave outfit' : 'Save outfit'}">${o.saved ? '★' : '☆'}</button>
      </header>
      <div class="st-badges">${badges}<span class="st-badge st-weather-${esc(o.weatherSuitability || 'unknown')}">${WEATHER_LABEL[o.weatherSuitability] || WEATHER_LABEL.unknown}</span></div>
      ${o.incomplete ? '<p class="st-note">Some items in this outfit were deleted from your wardrobe.</p>' : ''}
      <ul class="st-items">${(o.items || []).map((e, i) => renderItem(e, i)).join('')}</ul>
      ${o.explanation ? `<p class="st-explain">${esc(o.explanation)}</p>` : ''}
      ${why.length || (o.tips || []).length ? `<details class="st-why"><summary>Why this works</summary>
        <dl>${why.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${(o.tips || []).length ? `<p class="st-tips-title">Styling tips</p><ul class="st-tips">${o.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      </details>` : ''}
      <div class="st-actions">
        <div class="st-rate" role="group" aria-label="Rate this outfit">
          <button type="button" class="st-thumb${fb.rating === 'like' ? ' on' : ''}" data-action="rate" data-rating="like" aria-pressed="${fb.rating === 'like'}" aria-label="Like">👍</button>
          <button type="button" class="st-thumb${fb.rating === 'dislike' ? ' on' : ''}" data-action="rate" data-rating="dislike" aria-pressed="${fb.rating === 'dislike'}" aria-label="Dislike">👎</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-modify">✏️ Modify</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="wear">✓ Wear today</button>
        ${opts.deletable ? '<button type="button" class="btn btn-ghost btn-sm st-del" data-action="delete" aria-label="Delete outfit">🗑</button>' : ''}
      </div>
      <div class="st-tags" role="group" aria-label="Feedback">${FEEDBACK_TAGS.map(([v, l]) =>
        `<button type="button" class="fchip${tags.has(v) ? ' active' : ''}" data-action="tag" data-tag="${v}" aria-pressed="${tags.has(v)}">${l}</button>`).join('')}</div>
      <form class="st-modify" data-action="modify" hidden>
        <p class="muted">Tick items to keep, then describe the change.</p>
        <div class="st-quick">${QUICK_CHANGES.map((q) => `<button type="button" class="fchip" data-action="quick" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="st-modify-row">
          <label class="sr-only" for="mod-${esc(o.id)}">What should change?</label>
          <input id="mod-${esc(o.id)}" name="instruction" maxlength="300" required placeholder="e.g. keep the trousers, change everything else">
          <button type="submit" class="btn btn-primary btn-sm">Regenerate</button>
        </div>
      </form>
    </article>`;
  }

  function renderEmpty(kind) {
    const copy = {
      saved: ['⭐', 'No saved outfits yet', 'Tap the star on any outfit to save it here.'],
      history: ['🕘', 'No outfits yet', 'Ask the stylist for an outfit to get started.'],
      results: ['🪄', 'No outfits this time', 'Try rephrasing, or add more items to your wardrobe.'],
    }[kind];
    return `<div class="empty"><span class="e-ico">${copy[0]}</span><strong>${copy[1]}</strong>${copy[2]}</div>`;
  }

  root.StylistRender = { esc, safeImg, renderLoading, renderError, renderResultHeader, renderOutfitCard, renderEmpty, FEEDBACK_TAGS };
})(typeof window !== 'undefined' ? window : globalThis);
