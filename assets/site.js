'use strict';

/* ===========================================================================
   Lyra - landing page behaviour
   Scrolling tells the story: each section rises in once, the laptop grows
   into view, and the clusters section steps through how clusters work.
   Everything holds still for people who ask for reduced motion.
   =========================================================================== */

(() => {
  const RELEASE = {
    version: '0.1.0',
    download: 'https://github.com/andrewchampagne/lyra/releases/download/v0.1.0/Lyra-Setup-0.1.0.exe',
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // -------------------------------------------------------------------------
  // Download links and the platform note
  // -------------------------------------------------------------------------

  for (const a of $$('.js-download')) a.href = RELEASE.download;

  const ua = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent;
  if (!/win/i.test(ua)) {
    const note = $('#os-note');
    if (note) note.hidden = false;
  }

  // -------------------------------------------------------------------------
  // Fit each product shot to its frame. The windows are drawn at the app's
  // real CSS pixel size and scaled with zoom, so text stays crisp. The
  // clusters window also has to fit the sticky stage's height, with room
  // for the headline and the caption.
  // -------------------------------------------------------------------------

  const fits = [
    { box: '#stage', win: '#stage > .ly-window', base: 1100, max: 2 },
    { box: '#cl-demo', win: '#cl-window', base: 880, max: 1.2, height: 516, room: 330 },
  ];

  function fit() {
    for (const f of fits) {
      const box = $(f.box);
      const win = $(f.win);
      if (!box || !win) continue;
      const cs = getComputedStyle(box);
      const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      let z = Math.min(f.max, w / f.base);
      if (f.height) z = Math.min(z, Math.max(0.3, (innerHeight - f.room) / f.height));
      win.style.setProperty('--z', z.toFixed(4));
    }
  }

  // -------------------------------------------------------------------------
  // Hero: the window loads the way Lyra does
  // -------------------------------------------------------------------------

  const stage = $('#stage');
  if (stage) {
    const settle = () => stage.classList.remove('boot');
    if (reduced.matches) settle();
    else setTimeout(settle, 1400);
  }

  // -------------------------------------------------------------------------
  // Reveals: each marked element fades and rises in once
  // -------------------------------------------------------------------------

  const revealer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              e.target.classList.add('in');
              revealer.unobserve(e.target);
            }
          },
          { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
        )
      : null;
  for (const el of $$('[data-reveal]')) {
    if (revealer) revealer.observe(el);
    else el.classList.add('in');
  }

  // -------------------------------------------------------------------------
  // Clusters, in three steps:
  //   0. loose tabs wait along the floor,
  //   1. two clusters appear and the tabs drop onto them, on tethers,
  //   2. you go to the other cluster: its window, its tabs.
  // Positions are on the plane's own 880 x 440 grid; the window is zoomed.
  // -------------------------------------------------------------------------

  const SVG_USE = (id) => `<svg viewBox="0 0 16 16"><use href="#${id}" /></svg>`;

  const SITES = {
    trains: { title: 'Departures, Central', host: 'trains.example', fav: '#8CBF9C', letter: 'T', secure: true },
    weather: { title: 'Rain after four', host: 'weather.example', fav: '#7FA9DF', letter: 'W', secure: true },
    parcel: { title: 'Return a parcel', host: 'post.example', fav: '#E47C6A', letter: 'P', secure: true },
    docs: { title: 'Array.prototype.at()', host: 'docs.example', fav: '#B49FE0', letter: 'D', secure: true },
    pasta: { title: 'Lemon pasta', host: 'recipes.example', fav: '#F0CF8E', letter: 'R', secure: true },
    dev: { title: 'Orders', host: 'localhost:3000', fav: null, letter: 'L', secure: false },
  };

  const favHtml = (s) =>
    s.fav ? `<span class="ly-fav" style="background:${s.fav}">${s.letter}</span>` : `<span class="ly-fav letter">${s.letter}</span>`;

  const clTrack = $('#cl-track');
  const clPlane = $('#cl-plane');
  const clTethers = $('#cl-tethers');
  const clWindow = $('#cl-window');
  const clSteps = $$('#cl-steps li');
  let setClusterStep = () => {};

  if (clTrack && clPlane && clTethers && clWindow) {
    const FLOOR_Y = 388;
    const masters = [
      { id: 'errands', name: 'Errands', x: 250, y: 168, active: 'trains' },
      { id: 'reading', name: 'Reading', x: 632, y: 158, active: 'docs' },
    ];
    const tabs = [
      { site: 'trains', cluster: 'errands', at: [118, 92] },
      { site: 'weather', cluster: 'errands', at: [392, 98] },
      { site: 'parcel', cluster: 'errands', at: [352, 300] },
      { site: 'docs', cluster: 'reading', at: [770, 262] },
      { site: 'pasta', cluster: 'reading', at: [512, 290] },
      { site: 'dev', cluster: 'reading', at: [758, 66] },
    ];
    // Along the floor, after the + circle, in the order they were opened.
    tabs.forEach((t, i) => {
      t.floor = [132 + i * 116, FLOOR_Y];
      [t.x, t.y] = t.floor;
    });
    const byId = (id) => masters.find((m) => m.id === id);
    let here = 'errands';
    let step = -1;

    for (const m of masters) {
      m.el = document.createElement('div');
      m.el.className = 'ly-node gone';
      m.el.tabIndex = -1;
      m.el.setAttribute('role', 'button');
      m.el.innerHTML = `<span class="ly-master">${m.name}</span><span class="ly-count"></span>`;
      m.el.style.transform = `translate(${m.x}px, ${m.y}px)`;
      m.el.addEventListener('click', () => step > 0 && goTo(m.id));
      m.el.addEventListener('keydown', (e) => {
        if (step > 0 && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          goTo(m.id);
        }
      });
      clPlane.appendChild(m.el);
    }
    for (const t of tabs) {
      const s = SITES[t.site];
      t.el = document.createElement('div');
      t.el.className = 'ly-node';
      t.el.innerHTML = `<span class="ly-tab">${favHtml(s)}</span><span class="ly-label">${s.title}</span>`;
      t.line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      t.line.setAttribute('class', 'tether');
      t.line.style.opacity = '0';
      clTethers.appendChild(t.line);
      clPlane.appendChild(t.el);
    }

    function draw() {
      for (const t of tabs) {
        t.el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px)`;
        const m = byId(t.cluster);
        const dx = t.x - m.x;
        const dy = t.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        t.line.setAttribute('x1', (m.x + (dx / d) * 42).toFixed(1));
        t.line.setAttribute('y1', (m.y + (dy / d) * 42).toFixed(1));
        t.line.setAttribute('x2', (t.x - (dx / d) * 20).toFixed(1));
        t.line.setAttribute('y2', (t.y - (dy / d) * 20).toFixed(1));
      }
    }

    // The window's own chrome: its title, the tab you're on, its other tabs.
    const bar = $('.ly-bar', clWindow);
    let chromeKey = '';
    function renderChrome(inCluster) {
      const m = byId(here);
      const activeKey = inCluster ? m.active : 'trains';
      const key = `${inCluster}:${here}:${activeKey}`;
      if (key === chromeKey) return;
      const first = !chromeKey;
      chromeKey = key;
      const paint = () => {
        const active = SITES[activeKey];
        const others = tabs.filter((t) => (inCluster ? t.cluster === here : true) && t.site !== activeKey).map((t) => SITES[t.site]);
        $('#cl-title').textContent = inCluster ? `${m.name} - Lyra` : 'Lyra';
        const icon = $('.ly-field-icon', bar);
        icon.className = 'ly-field-icon' + (active.secure ? ' secure' : '');
        icon.innerHTML = SVG_USE(active.secure ? 'i-lock' : 'i-globe');
        $('.ly-field-line', bar).innerHTML = `<span class="ly-host">${active.host}</span><span class="ly-title">${active.title}</span>`;
        $('.ly-chips', bar).innerHTML = others.map((s) => `<span class="ly-chip">${favHtml(s)}<span>${s.title}</span></span>`).join('');
        bar.classList.remove('swapping');
      };
      if (first || reduced.matches) return paint();
      bar.classList.add('swapping');
      setTimeout(paint, 220);
    }

    function renderState() {
      const inCluster = step > 0;
      for (const m of masters) {
        const n = tabs.filter((t) => t.cluster === m.id).length;
        m.el.classList.toggle('gone', !inCluster);
        m.el.classList.toggle('here', inCluster && m.id === here);
        m.el.classList.toggle('live', inCluster && m.id !== here);
        m.el.tabIndex = inCluster ? 0 : -1;
        $('.ly-count', m.el).textContent = `${n} tabs`;
        m.el.setAttribute('aria-label', `${m.name}, ${n} tabs${m.id === here ? ', you are here' : ''}`);
      }
      for (const t of tabs) {
        const on = inCluster ? t.cluster === here && byId(here).active === t.site : t.site === 'trains';
        t.el.classList.toggle('here', on);
        t.line.style.opacity = inCluster ? '1' : '0';
      }
      renderChrome(inCluster);
    }

    function goTo(id) {
      if (here === id) return;
      here = id;
      renderState();
    }

    // Tabs glide between the floor and their clusters, a beat apart.
    let raf = 0;
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
    function glide(toCluster) {
      cancelAnimationFrame(raf);
      const from = tabs.map((t) => [t.x, t.y]);
      const to = tabs.map((t) => (toCluster ? t.at : t.floor));
      if (reduced.matches) {
        tabs.forEach((t, i) => ([t.x, t.y] = to[i]));
        return draw();
      }
      const start = performance.now();
      const DUR = 820;
      const GAP = 55;
      const frame = (now) => {
        let done = true;
        tabs.forEach((t, i) => {
          const p = clamp01((now - start - i * GAP) / DUR);
          if (p < 1) done = false;
          const k = ease(p);
          t.x = from[i][0] + (to[i][0] - from[i][0]) * k;
          // A little lift on the way, as if picked up and dropped.
          t.y = from[i][1] + (to[i][1] - from[i][1]) * k - Math.sin(Math.PI * k) * 26;
        });
        draw();
        if (!done) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    const dots = document.createElement('div');
    dots.className = 'step-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = clSteps.map(() => '<span></span>').join('');
    $('#cl-steps').after(dots);

    setClusterStep = (n) => {
      if (n === step) return;
      const wasIn = step > 0;
      step = n;
      clSteps.forEach((li, i) => li.classList.toggle('on', i === n));
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === n));
      // Step 2 is the other cluster; scrolling back up returns to the first.
      here = n === 2 ? 'reading' : 'errands';
      if (wasIn !== n > 0) glide(n > 0);
      renderState();
    };

    draw();
    setClusterStep(0);
  }

  // -------------------------------------------------------------------------
  // Scroll: nav state, the growing laptop, the clusters step, the far orbs
  // -------------------------------------------------------------------------

  const nav = $('#nav');
  const nights = $$('.night');
  const device = $('#device');
  const orbs = $('#night-orbs');
  const orbsSection = $('#legible');
  let ticking = false;

  function update() {
    ticking = false;
    const vh = innerHeight;
    nav.classList.toggle('scrolled', scrollY > 4);
    const y = nav.offsetHeight / 2;
    nav.classList.toggle(
      'over-night',
      nights.some((n) => {
        const r = n.getBoundingClientRect();
        return r.top <= y && r.bottom >= y;
      }),
    );

    if (!reduced.matches) {
      if (device) device.style.setProperty('--s', (0.9 + 0.1 * clamp01(scrollY / (vh * 0.75))).toFixed(4));
      if (orbs && orbsSection) {
        const r = orbsSection.getBoundingClientRect();
        orbs.style.setProperty('--parallax', `${(r.top * -0.14).toFixed(1)}px`);
      }
    }

    if (clTrack && clSteps.length) {
      const r = clTrack.getBoundingClientRect();
      const span = r.height - vh;
      const p = span > 0 ? clamp01(-r.top / span) : 0;
      setClusterStep(Math.min(clSteps.length - 1, Math.floor(p * clSteps.length)));
    }
  }

  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  addEventListener('resize', () => {
    fit();
    update();
  });
  if (document.fonts?.ready) document.fonts.ready.then(fit);
  fit();
  update();
})();
