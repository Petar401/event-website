/* Balkania — app wiring: rendering, i18n, filters, countdown, .ics, menu, rhythms. */
(function () {
  const { COUNTRIES, RHYTHMS, EVENTS, I18N, LOCALES } = window.BALKANIA;
  const COUNTRY_ORDER = ['bg', 'gr', 'tr', 'rs'];
  const $ = (sel, root = document) => root.querySelector(sel);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } }
  };

  const state = {
    lang: pickLang(),
    filter: null, // country code or null
    flagIndex: 0,
    lists: { upcoming: [], past: [] },
    selected: { upcoming: null, past: null }
  };

  function pickLang() {
    const saved = store.get('balkania-lang');
    if (saved && I18N[saved]) return saved;
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N[nav] ? nav : 'en';
  }

  function t(key, vars) {
    let s = (I18N[state.lang] && I18N[state.lang][key]) ?? I18N.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    return s;
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- images: always fit=max (resize only — never cropped) ---------- */
  const IMG = 'https://images.unsplash.com/';
  const imgUrl = (p, w) => `${IMG}${p.path}?auto=format&fit=max&q=72&w=${w}`;
  const srcset = (p) => [480, 800, 1200, 1600].map((w) => `${imgUrl(p, w)} ${w}w`).join(', ');
  const UTM = 'utm_source=balkania&utm_medium=referral';
  const authorUrl = (p) => `https://unsplash.com/@${p.username}?${UTM}`;

  /* ---------- dates ---------- */
  const locale = () => LOCALES[state.lang] || 'en-GB';
  function fmtDate(iso, opts) {
    const d = new Date(iso);
    try { return new Intl.DateTimeFormat(locale(), opts).format(d); }
    catch (_) { return new Intl.DateTimeFormat('en-GB', opts).format(d); }
  }
  function fmtRange(ev) {
    const s = new Date(ev.start); const e = new Date(ev.end);
    const day = { day: 'numeric', month: 'long', year: 'numeric' };
    const sameDay = (e - s) < 1000 * 60 * 60 * 20;
    if (sameDay) return `${fmtDate(ev.start, { weekday: 'short', ...day })} · ${fmtDate(ev.start, { hour: '2-digit', minute: '2-digit' })}`;
    try {
      return new Intl.DateTimeFormat(locale(), day).formatRange(s, e);
    } catch (_) {
      return `${fmtDate(ev.start, day)} – ${fmtDate(ev.end, day)}`;
    }
  }

  /* ---------- past / upcoming split (automatic, by date) ---------- */
  function splitEvents() {
    const now = Date.now();
    const pool = EVENTS.filter((e) => !state.filter || e.country === state.filter);
    state.lists.upcoming = pool.filter((e) => new Date(e.end) >= now).sort((a, b) => new Date(a.start) - new Date(b.start));
    state.lists.past = pool.filter((e) => new Date(e.end) < now).sort((a, b) => new Date(b.start) - new Date(a.start));
  }

  /* ---------- flags ring ---------- */
  const flagStage = $('#flag-stage');
  function renderFlags() {
    flagStage.innerHTML = COUNTRY_ORDER.map((c) => `
      <li class="ring__item flag-card" role="option" id="flag-${c}" data-country="${c}" data-label="${esc(t('c_' + c))}" style="--c:${COUNTRIES[c].accent}">
        <div class="flag-card__cloth">
          <img src="${COUNTRIES[c].flag}" alt="${esc(t('c_' + c))}" width="300" height="200">
        </div>
        <span class="flag-card__name">${esc(t('c_' + c))}</span>
      </li>`).join('');
  }

  function updateGreeting() {
    const c = COUNTRY_ORDER[state.flagIndex];
    const r = RHYTHMS[c];
    const hero = $('.hero');
    hero.style.setProperty('--accent', COUNTRIES[c].accent);
    document.documentElement.style.setProperty('--brand-accent', COUNTRIES[c].accent);
    const hello = $('#greeting-hello');
    hello.textContent = COUNTRIES[c].greeting;
    hello.lang = COUNTRIES[c].lang;
    hello.classList.remove('pop'); void hello.offsetWidth; hello.classList.add('pop');
    $('#greeting-meta').textContent = `${t('c_' + c)} · ${COUNTRIES[c].music} · ${r.name} ${r.meter}`;
    $('#show-country').textContent = t('show_country', { country: t('c_' + c) });
    syncHeroRhythmButton();
  }

  /* ---------- country filter chips ---------- */
  function renderChips() {
    const chips = [{ code: null, label: t('filter_all') }].concat(COUNTRY_ORDER.map((c) => ({ code: c, label: t('c_' + c) })));
    $('#chips').innerHTML = chips.map((ch) => `
      <button type="button" class="chip" data-country="${ch.code || ''}" aria-pressed="${state.filter === ch.code}">
        ${ch.code ? `<img src="${COUNTRIES[ch.code].flag}" alt="" width="21" height="14">` : '<span class="chip__all" aria-hidden="true">✦</span>'}
        <span>${esc(ch.label)}</span>
      </button>`).join('');
  }

  function setFilter(code) {
    state.filter = code || null;
    renderChips();
    renderEventRings();
  }

  /* ---------- event rings ---------- */
  function cardHTML(ev, kind) {
    const p = ev.photo;
    const dateShort = fmtDate(ev.start, { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <li class="ring__item event-card" role="option" id="${kind}-${ev.id}" data-id="${ev.id}" data-label="${esc(ev.title)}" style="--c:${COUNTRIES[ev.country].accent}">
        <figure class="photo-frame" data-country="${ev.country}">
          <img class="photo-frame__bg" src="${imgUrl(p, 120)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
          <img class="photo-frame__img" src="${imgUrl(p, 800)}" srcset="${srcset(p)}" sizes="(max-width: 600px) 70vw, 320px"
               width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" loading="lazy" decoding="async">
        </figure>
        <div class="event-card__body">
          <div class="event-card__meta">
            <img class="mini-flag" src="${COUNTRIES[ev.country].flag}" alt="${esc(t('c_' + ev.country))}" width="21" height="14">
            <time datetime="${ev.start}">${esc(dateShort)}</time>
            <span class="tag">${esc(t('k_' + ev.category))}</span>
          </div>
          <h3 class="event-card__title">${esc(ev.title)}</h3>
          <p class="event-card__local" lang="${COUNTRIES[ev.country].lang}">${esc(ev.local)}</p>
          <p class="event-card__city">${esc(ev.city)}</p>
        </div>
      </li>`;
  }

  const rings = {};

  function renderEventRings() {
    splitEvents();
    ['upcoming', 'past'].forEach((kind) => {
      const section = document.getElementById(kind);
      const ringEl = $(`#${kind}-ring`);
      const list = state.lists[kind];
      const stage = $('.ring__stage', ringEl);
      stage.innerHTML = list.map((ev) => cardHTML(ev, kind)).join('');
      const empty = list.length === 0;
      ringEl.hidden = empty;
      $('.empty', section).hidden = !empty;
      $('.ring-controls', section).hidden = empty;
      $(`#${kind}-detail`).hidden = empty;
      // keep the previously chosen event in front if it is still listed
      const keep = Math.max(0, list.findIndex((e) => e.id === (state.selected[kind] && state.selected[kind].id)));
      if (empty) state.selected[kind] = null;
      if (rings[kind]) rings[kind].refresh(keep);
    });
  }

  function renderDetail(kind) {
    const ev = state.selected[kind];
    const box = $(`#${kind}-detail`);
    if (!ev) { box.innerHTML = ''; return; }
    const p = ev.photo;
    const section = document.getElementById(kind);
    section.style.setProperty('--accent', COUNTRIES[ev.country].accent);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ev.venue}, ${ev.city}`)}`;
    const upcoming = kind === 'upcoming';
    box.innerHTML = `
      <figure class="detail__figure photo-frame" data-country="${ev.country}">
        <img class="photo-frame__bg" src="${imgUrl(p, 120)}" alt="" aria-hidden="true">
        <img class="detail__img" src="${imgUrl(p, 1200)}" srcset="${srcset(p)}" sizes="(max-width: 860px) 100vw, 600px"
             width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" decoding="async">
        <figcaption class="credit">
          <a href="${authorUrl(p)}" target="_blank" rel="noopener">${esc(t('photo_by', { name: p.author }))}</a>
        </figcaption>
      </figure>
      <div class="detail__body">
        <div class="detail__meta">
          <img class="mini-flag" src="${COUNTRIES[ev.country].flag}" alt="" width="27" height="18">
          <span>${esc(t('c_' + ev.country))}</span>
          <span class="tag">${esc(t('k_' + ev.category))}</span>
        </div>
        <h3 class="detail__title">${esc(ev.title)}</h3>
        <p class="detail__local" lang="${COUNTRIES[ev.country].lang}">${esc(ev.local)}</p>
        <p class="detail__when"><time datetime="${ev.start}">${esc(fmtRange(ev))}</time></p>
        <p class="detail__where">${esc(ev.venue)} · ${esc(ev.city)}</p>
        <p class="detail__blurb">${esc(ev.blurb)}</p>
        ${upcoming ? `<div class="countdown" id="countdown" aria-live="off"></div>` : `
          <p class="recap"><strong>${esc(t('recap'))}:</strong> ${esc(t('took_place', { date: fmtDate(ev.start, { day: 'numeric', month: 'long', year: 'numeric' }) }))}</p>`}
        <div class="detail__actions">
          ${upcoming ? `<button class="btn btn--primary" type="button" id="ics-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7Zm-2 8h14v10H5V10Zm6 2v3H8v2h3v3h2v-3h3v-2h-3v-3h-2Z"/></svg>
            ${esc(t('add_cal'))}</button>` : ''}
          <a class="btn btn--ghost" href="${mapUrl}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>
            ${esc(t('map'))}</a>
        </div>
      </div>`;
    if (upcoming) {
      $('#ics-btn', box).addEventListener('click', () => downloadICS(ev));
      updateCountdown();
    }
    box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
  }

  /* ---------- countdown ---------- */
  function updateCountdown() {
    const ev = state.selected.upcoming;
    const el = document.getElementById('countdown');
    if (!ev || !el) return;
    const now = Date.now();
    const start = new Date(ev.start).getTime();
    if (now >= start) {
      el.innerHTML = `<span class="live"><i></i>${esc(t('live_now'))}</span>`;
      return;
    }
    let s = Math.floor((start - now) / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const cell = (v, u) => `<span class="countdown__cell"><b>${String(v).padStart(2, '0')}</b><small>${esc(t(u))}</small></span>`;
    el.innerHTML = `<span class="countdown__label">${esc(t('starts_in'))}</span>${cell(d, 'u_d')}${cell(h, 'u_h')}${cell(m, 'u_m')}${cell(s, 'u_s')}`;
  }

  /* ---------- .ics ---------- */
  function downloadICS(ev) {
    const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escIcs = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Balkania//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ev.id}@balkania`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(ev.start)}`,
      `DTEND:${stamp(ev.end)}`,
      `SUMMARY:${escIcs(ev.title)}`,
      `LOCATION:${escIcs(`${ev.venue}, ${ev.city}`)}`,
      `DESCRIPTION:${escIcs(ev.blurb)}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${ev.id}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- rhythm engine (Web Audio, no files) ---------- */
  const rhythm = {
    ctx: null, playing: null, timer: 0, step: 0, nextTime: 0, listeners: [],
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    pattern(code) {
      // per eighth: 2 = downbeat, 1 = group start ("dum"), 0 = "tek"
      const out = [];
      RHYTHMS[code].groups.forEach((g, gi) => { for (let i = 0; i < g; i++) out.push(i === 0 ? (gi === 0 ? 2 : 1) : 0); });
      return out;
    },
    play(code) {
      const ctx = this.ensure();
      if (!ctx) return;
      this.stop(true);
      this.playing = code;
      this.pat = this.pattern(code);
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.06;
      this.timer = setInterval(() => this.schedule(), 25);
      this.emit();
    },
    stop(silent) {
      clearInterval(this.timer);
      this.timer = 0;
      const was = this.playing;
      this.playing = null;
      document.documentElement.classList.remove('is-playing');
      if (!silent && was) this.emit();
    },
    toggle(code) { if (this.playing === code) this.stop(); else this.play(code); },
    schedule() {
      const ctx = this.ctx;
      const dur = 60 / RHYTHMS[this.playing].bpm;
      while (this.nextTime < ctx.currentTime + 0.12) {
        const kind = this.pat[this.step];
        if (kind > 0) this.dum(this.nextTime, kind === 2 ? 1 : 0.7); else this.tek(this.nextTime);
        const step = this.step; const code = this.playing;
        const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
        setTimeout(() => this.onStep(code, step, kind), delay);
        this.nextTime += dur;
        this.step = (this.step + 1) % this.pat.length;
      }
    },
    dum(time, vol) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, time);
      o.frequency.exponentialRampToValueAtTime(48, time + 0.22);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.9 * vol, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
      o.connect(g).connect(ctx.destination);
      o.start(time); o.stop(time + 0.34);
    },
    tek(time) {
      const ctx = this.ctx;
      if (!this.noise) {
        const len = Math.floor(ctx.sampleRate * 0.06);
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(time);
    },
    onStep(code, step, kind) {
      if (this.playing !== code) return;
      document.documentElement.classList.add('is-playing');
      document.querySelectorAll(`[data-beats="${code}"] .beat`).forEach((b, i) => b.classList.toggle('on', i === step));
      if (kind > 0) {
        const eq = document.querySelector('.eq');
        eq.classList.remove('hit'); void eq.offsetWidth; eq.classList.add('hit');
      }
    },
    emit() { this.listeners.forEach((fn) => fn(this.playing)); }
  };

  function renderRhythms() {
    $('#rhythm-grid').innerHTML = COUNTRY_ORDER.map((c) => {
      const r = RHYTHMS[c];
      let beats = '';
      r.groups.forEach((g) => {
        beats += '<span class="beat-group">';
        for (let i = 0; i < g; i++) beats += `<span class="beat${i === 0 ? ' beat--strong' : ''}"></span>`;
        beats += '</span>';
      });
      return `
        <article class="rhythm-card" style="--accent:${COUNTRIES[c].accent}">
          <header class="rhythm-card__head">
            <img src="${COUNTRIES[c].flag}" alt="" width="45" height="30">
            <div>
              <h3>${esc(r.name)}</h3>
              <p>${esc(t('c_' + c))} · <span class="meter">${r.meter}</span> · ${r.groups.join('+')}</p>
            </div>
          </header>
          <div class="beats" data-beats="${c}" aria-hidden="true">${beats}</div>
          <button class="btn btn--ghost rhythm-btn" type="button" data-rhythm="${c}" aria-pressed="false">
            <svg class="i-play" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            <svg class="i-stop" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 7h10v10H7z"/></svg>
            <span>${esc(t('cta_rhythm'))}</span>
          </button>
        </article>`;
    }).join('');
    syncRhythmButtons(rhythm.playing);
  }

  function syncRhythmButtons(playing) {
    document.querySelectorAll('.rhythm-btn').forEach((b) => {
      const on = b.dataset.rhythm === playing;
      b.setAttribute('aria-pressed', String(on));
      $('span', b).textContent = on ? t('cta_stop') : t('cta_rhythm');
    });
    if (!playing) document.querySelectorAll('.beat.on').forEach((b) => b.classList.remove('on'));
    syncHeroRhythmButton();
  }

  function syncHeroRhythmButton() {
    const btn = $('#hero-rhythm');
    const on = rhythm.playing === COUNTRY_ORDER[state.flagIndex];
    btn.setAttribute('aria-pressed', String(on));
    $('span', btn).textContent = on ? t('cta_stop') : t('cta_rhythm');
  }

  /* ---------- i18n ---------- */
  function applyI18n() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $('#lang-select').value = state.lang;
    renderFlags();
    if (rings.flags) rings.flags.refresh(state.flagIndex);
    renderChips();
    renderEventRings();
    renderRhythms();
    updateGreeting();
    const thanks = $('#newsletter-thanks');
    if (!thanks.hidden) thanks.textContent = t('newsletter_thanks');
    updateMenuLabel();
  }

  /* ---------- hamburger menu ---------- */
  const burger = $('#hamburger');
  const nav = $('#primary-nav');
  const scrim = $('#nav-scrim');
  const mqMobile = window.matchMedia('(max-width: 860px)');

  function updateMenuLabel() {
    $('.visually-hidden', burger).textContent = t(burger.getAttribute('aria-expanded') === 'true' ? 'close' : 'menu');
  }
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
    scrim.hidden = !open;
    nav.toggleAttribute('inert', mqMobile.matches && !open);
    updateMenuLabel();
    if (open) { const first = nav.querySelector('a'); if (first) first.focus(); }
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  scrim.addEventListener('click', () => setMenu(false));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('nav-open')) return;
    if (e.key === 'Escape') { setMenu(false); burger.focus(); return; }
    if (e.key === 'Tab') { // focus trap: burger + nav items
      const focusables = [burger, ...nav.querySelectorAll('a, select')];
      const i = focusables.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
      else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    }
  });
  const syncNavMode = () => { if (!mqMobile.matches) setMenu(false); nav.toggleAttribute('inert', mqMobile.matches && !document.body.classList.contains('nav-open')); };
  mqMobile.addEventListener('change', syncNavMode);

  /* ---------- global arrow keys: drive the ring most in view ---------- */
  const visibility = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => visibility.set(en.target, en.intersectionRatio));
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  document.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag) || document.activeElement.closest('.ring')) return;
    let best = null; let bestRatio = 0.2;
    Object.values(rings).forEach((r) => {
      const ratio = visibility.get(r.root) || 0;
      if (!r.root.hidden && ratio > bestRatio) { best = r; bestRatio = ratio; }
    });
    if (!best) return;
    e.preventDefault();
    if (e.key === 'ArrowRight') best.next(); else best.prev();
  });

  /* ---------- broken image fallback ---------- */
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const frame = img.closest('.photo-frame');
    if (frame) frame.classList.add('is-broken');
  }, true);

  /* ---------- init ---------- */
  function init() {
    $('#year').textContent = new Date().getFullYear();
    $('#footer-flags').innerHTML = COUNTRY_ORDER.map((c) => `<img src="${COUNTRIES[c].flag}" alt="" width="24" height="16">`).join('');

    // credits
    const seen = new Set();
    $('#credits-list').innerHTML = EVENTS.filter((e) => !seen.has(e.photo.username) && seen.add(e.photo.username))
      .map((e) => `<li><a href="${authorUrl(e.photo)}" target="_blank" rel="noopener">${esc(e.photo.author)}</a> — ${esc(e.title)}</li>`).join('')
      + `<li><a href="https://unsplash.com/?${UTM}" target="_blank" rel="noopener">Unsplash</a></li>`;

    document.documentElement.lang = state.lang;
    renderFlags();
    rings.flags = new Ring3D($('#flag-ring'), {
      maxTheta: 46, lift: 50, activeScale: 1.12,
      idleDelay: 5000, autoInterval: 3800, firstAutoDelay: 3500,
      dots: $('#flag-dots'), prev: $('#flag-prev'), next: $('#flag-next'),
      onChange(i) { state.flagIndex = i; updateGreeting(); },
      onActivate(i) { setFilter(COUNTRY_ORDER[i]); document.getElementById('upcoming').scrollIntoView({ behavior: 'smooth' }); }
    });

    ['upcoming', 'past'].forEach((kind) => {
      rings[kind] = new Ring3D($(`#${kind}-ring`), {
        maxTheta: 38, lift: 80, activeScale: 1.06,
        idleDelay: 7000, autoInterval: 5000, firstAutoDelay: kind === 'upcoming' ? 6000 : 7500,
        dots: $(`#${kind}-dots`), prev: $(`#${kind}-prev`), next: $(`#${kind}-next`),
        onChange(i, el, meta) {
          state.selected[kind] = state.lists[kind][i] || null;
          if (meta && meta.drag) return; // update the panel once the drag settles
          renderDetail(kind);
        },
        onActivate() { $(`#${kind}-detail`).scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      });
    });
    Object.values(rings).forEach((r) => io.observe(r.root));

    applyI18n();
    syncNavMode();

    $('#lang-select').addEventListener('change', (e) => {
      state.lang = e.target.value;
      store.set('balkania-lang', state.lang);
      applyI18n();
    });
    $('#chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) setFilter(chip.dataset.country || null);
    });
    $('#show-country').addEventListener('click', () => {
      setFilter(COUNTRY_ORDER[state.flagIndex]);
      document.getElementById('upcoming').scrollIntoView({ behavior: 'smooth' });
    });
    $('#hero-rhythm').addEventListener('click', () => rhythm.toggle(COUNTRY_ORDER[state.flagIndex]));
    $('#rhythm-grid').addEventListener('click', (e) => {
      const b = e.target.closest('.rhythm-btn');
      if (b) rhythm.toggle(b.dataset.rhythm);
    });
    rhythm.listeners.push(syncRhythmButtons);

    $('#newsletter').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#email');
      if (!input.checkValidity()) { input.reportValidity(); return; }
      const thanks = $('#newsletter-thanks');
      thanks.textContent = t('newsletter_thanks');
      thanks.hidden = false;
      input.value = '';
    });

    // header shadow on scroll
    const header = $('#site-header');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // countdown tick + automatic move from "upcoming" to "past" when an event ends
    let lastSplitCheck = Date.now();
    setInterval(() => {
      updateCountdown();
      if (Date.now() - lastSplitCheck > 30000) {
        lastSplitCheck = Date.now();
        const ended = state.lists.upcoming.some((ev) => new Date(ev.end) < Date.now());
        if (ended) renderEventRings();
      }
    }, 1000);

    document.addEventListener('visibilitychange', () => { if (document.hidden) rhythm.stop(); });
  }

  init();
})();
