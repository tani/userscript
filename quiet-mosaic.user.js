// ==UserScript==
// @name         Quiet Mosaic — no-flash thumbnail suppression
// @namespace    quiet-web.local
// @version      2.0.2
// @description  Suppress thumbnail-like images before they can flash on screen, and collapse the space they leave.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * Consecutive similarly sized sibling branches containing media form a feed.
 * Media in matching branches is collapsed; other media is left visible.
 *
 * Alt+Shift+Q toggles the script; Alt+Shift+D toggles debug outlines.
 */
(() => {
  'use strict';

  const CONFIG = {
    // Maximum ancestor depth for repeated-card detection.
    maxAncestors: 12,
    maxMedia: 1200,
    // Wrapper collapsing: levels to climb, and how far (px) a badge may
    // stick out of the image and still count as drawn on top of it.
    maxBoxDepth: 10,
    overlayTolerance: 6,
    // Also kills flashes from CSS-class backgrounds, but removes ALL CSS
    // background images (gradients, UI icons…).
    suppressAllBackgrounds: false,
  };

  // ------------------------------------------------------------ vocabulary

  const ATTR = {
    root: 'data-quiet-mosaic', // on | off | debug | measure
    allow: 'data-qm-allow',
    allowBg: 'data-qm-allow-bg',
    feed: 'data-qm-feed',
    hide: 'data-qm-hide',
    box: 'data-qm-box',
    why: 'data-qm-why',
  };
  const marked = name => `[${ATTR[name]}="1"]`;

  const SEL = {
    media: 'img, video, [role="img"]',
    inlineBg: '[style*="background-image"]',
    clickable: 'a[href], [role="link"], button',
    // Page chrome. <aside> is deliberately absent: sidebars are where
    // ranking and "recommended" lists live.
    chrome: 'header, nav, footer, dialog, [role="navigation"], [role="dialog"], [role="banner"], [role="contentinfo"]',
    // A wrapper containing any of these is a player, never a thumbnail.
    playerUi: 'video[controls], input[type="range"], [role="slider"]',
    // Things that, outside the image, mean a wrapper holds more than it.
    solid: 'img, video, [role="img"], svg, button, input, select, textarea, canvas, iframe, [role="button"]',
  };
  SEL.scan = `${SEL.media}, ${SEL.inlineBg}`;

  const SOURCE_ATTRS = ['src', 'srcset', 'poster'];
  const WATCHED_ATTRS = [...SOURCE_ATTRS, 'style', 'class', 'width', 'height'];

  // ------------------------------------------------------------ state

  const state = {
    mode: 'on',
    url: location.href,
    feeds: new Set(),
    boxes: new WeakMap(), // hidden element → collapsed wrapper
    dirty: false,         // DOM structure changed since the last scan
  };
  let root;
  let frame = 0;
  let range;

  const enabled = () => state.mode !== 'off';

  // ------------------------------------------------------------ helpers

  const flag = (el, name, on) =>
    on ? el.setAttribute(ATTR[name], '1') : el.removeAttribute(ATTR[name]);

  const unflag = (el, ...names) => names.forEach(name => el.removeAttribute(ATTR[name]));

  const setWhy = (el, why) => {
    if (el.getAttribute(ATTR.why) !== why) el.setAttribute(ATTR.why, why);
  };

  const hasInlineBg = el => !!el.style?.backgroundImage && el.style.backgroundImage !== 'none';
  const hasText = el => el.textContent.trim() !== '';
  const hasArea = r => r.width > 0 && r.height > 0;

  const within = (r, frame, t = CONFIG.overlayTolerance) =>
    r.left >= frame.left - t && r.top >= frame.top - t &&
    r.right <= frame.right + t && r.bottom <= frame.bottom + t;

  function* ancestors(el, limit = Infinity) {
    for (let p = el.parentElement, depth = 0; p && depth < limit; p = p.parentElement, depth++) {
      if (p === document.body || p === document.documentElement) return;
      yield p;
    }
  }

  const getOrInit = (map, key, make) => {
    if (!map.has(key)) map.set(key, make());
    return map.get(key);
  };

  // ------------------------------------------------------------ styles

  const ON = `html[${ATTR.root}="on"]`;
  const DEBUG = `html[${ATTR.root}="debug"]`;
  const outline = (selector, line, offset) =>
    `${DEBUG} ${selector} { outline: ${line} !important; outline-offset: ${offset} !important; }`;

  const CSS = `
    ${ON} :is(${SEL.media}):not(${marked('allow')}) {
      opacity: 0 !important;
      filter: none !important;
    }
    ${ON} :is(${marked('hide')}, ${marked('box')}),
    ${ON} ${marked('feed')} :is(${SEL.media}) {
      display: none !important;
    }
    ${ON} ${SEL.inlineBg}:not(${marked('allowBg')}),
    ${ON} ${marked('feed')},
    ${ON} ${marked('feed')} * {
      background-image: none !important;
    }
    ${CONFIG.suppressAllBackgrounds ? `${ON} * { background-image: none !important; }` : ''}

    ${outline(`[${ATTR.why}^="allow"]`, '3px solid #1a7f37', '-3px')}
    ${outline(`[${ATTR.why}^="hide"]`, '3px solid #d1242f', '-3px')}
    ${outline(`[${ATTR.why}^="bg-only"]`, '3px solid #8c959f', '-3px')}
    ${outline(marked('box'), '2px dotted #d1242f', '0')}
    ${outline(marked('feed'), '3px dashed #bf8700', '2px')}
  `;

  // ------------------------------------------------------------ inspection

  function inspect(el) {
    const isMedia = el.matches(SEL.media);
    if (!isMedia && !hasInlineBg(el)) return null;
    if (!document.body.contains(el)) return null;

    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const candidate = rect.width >= 2 && rect.height >= 2 &&
      style.display !== 'none' && style.visibility !== 'hidden' &&
      style.contentVisibility !== 'hidden';
    return { el, isMedia, candidate };
  }

  function verdict(item, inFeed) {
    if (!inFeed) return 'allow:outside-feed';
    // Keep text in background-image cards while suppressing the background.
    return item.isMedia || !hasText(item.el) ? 'hide:feed' : 'bg-only:feed';
  }

  // ------------------------------------------------------------ feeds

  // Index candidate media by their ancestor and the direct child branch
  // containing them. Multiple images in one card count as one branch.
  function buildMediaTree(items) {
    const tree = new Map(); // ancestor -> child branches containing media
    for (const item of items) {
      if (!item.candidate) continue;
      let branch = item.el;
      for (const parent of ancestors(item.el, CONFIG.maxAncestors)) {
        getOrInit(tree, parent, () => new Set()).add(branch);
        branch = parent;
      }
    }
    return tree;
  }

  // Similar computed card dimensions are evidence of a repeated layout.
  // Eight-pixel buckets tolerate small layout rounding differences.
  function cardSize(el) {
    const { width, height } = el.getBoundingClientRect();
    if (width < 2 || height < 2) return '';
    return `${Math.round(width / 8)}:${Math.round(height / 8)}`;
  }

  function detectFeeds(tree) {
    const found = new Set();
    for (const [parent, branches] of tree) {
      let previous;
      let previousSize = '';
      for (const branch of parent.children) {
        const size = branches.has(branch) ? cardSize(branch) : '';
        if (size && size === previousSize) {
          found.add(previous);
          found.add(branch);
        }
        previous = branch;
        previousSize = size;
      }
    }
    // Prefer inner matching branches so unrelated siblings stay visible.
    const matches = [...found];
    return matches.filter(el => !matches.some(other => other !== el && el.contains(other)));
  }

  // Retain feed decisions until the DOM changes or navigation resets them.
  function updateFeeds(tree) {
    for (const el of state.feeds) {
      if (!el.isConnected) {
        unflag(el, 'feed');
        state.feeds.delete(el);
      }
    }
    for (const el of detectFeeds(tree)) {
      flag(el, 'feed', true);
      state.feeds.add(el);
    }
  }

  function clearFeeds() {
    state.feeds.forEach(el => unflag(el, 'feed'));
    state.feeds.clear();
  }

  // ------------------------------------------------------------ collapsing

  // Runs fn with all of our CSS switched off so every element has its
  // natural geometry. Synchronous, so nothing is painted in between and no
  // image can flash; the cost is one extra layout.
  function withNaturalLayout(fn) {
    const previous = root.getAttribute(ATTR.root);
    root.setAttribute(ATTR.root, 'measure');
    try {
      return fn();
    } finally {
      root.setAttribute(ATTR.root, previous);
    }
  }

  const isText = node => node.nodeType === Node.TEXT_NODE;

  function rectOf(node) {
    if (!isText(node)) return node.getBoundingClientRect();
    range ??= document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect();
  }

  // Non-blank text and solid elements in p, other than el itself.
  function* contentsOf(p, el, selector) {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let t; (t = walker.nextNode());) if (t.data.trim()) yield t;
    for (const m of p.querySelectorAll(selector)) {
      if (m !== el && !m.contains(el) && !el.contains(m)) yield m;
    }
  }

  // Fallback layering test for images with no natural size: 'hidden',
  // 'overlay' (in an absolute/fixed layer) or 'flow'.
  function layerOf(node, stop) {
    let overlay = false;
    for (let e = node; e && e !== stop; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 'hidden';
      if (cs.position === 'absolute' || cs.position === 'fixed') overlay = true;
    }
    return overlay ? 'overlay' : 'flow';
  }

  // Is everything else in p merely drawn on top of el? With a frame, judged
  // by geometry (works however badges are layered); without, by layering.
  function onlyDecorates(p, el, frame) {
    for (const node of contentsOf(p, el, frame ? SEL.solid : SEL.media)) {
      if (frame) {
        const r = rectOf(node);
        if (hasArea(r) && !within(r, frame)) return false;
      } else if (layerOf(isText(node) ? node.parentElement : node, p) === 'flow') {
        return false;
      }
    }
    return true;
  }

  // The largest ancestor that holds nothing but el: aspect-ratio wrappers,
  // placeholders, badges, progress bars and an image-only link. Titles,
  // feed boundaries, page chrome and player controls stop the climb.
  function fitBox(el) {
    const rect = el.getBoundingClientRect();
    const frame = hasArea(rect) ? rect : null;
    let box = el;
    for (const p of ancestors(el, CONFIG.maxBoxDepth)) {
      if (p.hasAttribute(ATTR.feed) || p.matches(SEL.chrome) || p.querySelector(SEL.playerUi)) break;
      if (!onlyDecorates(p, el, frame)) break;
      box = p;
    }
    return box;
  }

  function setBox(el, box) {
    const old = state.boxes.get(el);
    if (old === box) return;
    if (old) unflag(old, 'box');
    if (box === el) {
      state.boxes.delete(el);
    } else {
      flag(box, 'box', true);
      state.boxes.set(el, box);
    }
  }

  function hide(els) {
    if (!els.length) return;
    const fits = withNaturalLayout(() => els.map(el => [el, fitBox(el)]));
    for (const [el, box] of fits) {
      flag(el, 'hide', true);
      setBox(el, box);
    }
  }

  function unhide(el) {
    unflag(el, 'hide');
    setBox(el, el);
  }

  function resetDecisions() {
    document.querySelectorAll(`[${ATTR.hide}]`).forEach(unhide);
    for (const el of document.querySelectorAll(`[${ATTR.allow}], [${ATTR.allowBg}], [${ATTR.box}]`)) {
      unflag(el, 'allow', 'allowBg', 'box');
    }
  }

  // ------------------------------------------------------------ scanning

  function collect() {
    const items = [];
    let budget = CONFIG.maxMedia;
    for (const el of document.querySelectorAll(SEL.scan)) {
      if (el.hasAttribute(ATTR.hide)) continue; // already collapsed, no size left
      if (budget-- <= 0) break;
      const item = inspect(el);
      if (item) items.push(item);
    }
    return items;
  }

  // Applies a verdict; returns true if the element should be collapsed.
  function apply(item) {
    const { el } = item;
    const why = verdict(item, !!el.closest(marked('feed')));
    setWhy(el, why);
    if (why.startsWith('hide')) {
      unflag(el, 'allow', 'allowBg');
      return true;
    }
    const permit = why.startsWith('allow');
    if (item.isMedia) flag(el, 'allow', permit);
    if (hasInlineBg(el) || el.hasAttribute(ATTR.allowBg)) flag(el, 'allowBg', permit);
    return false;
  }

  function scan() {
    if (!enabled() || !document.body) return;
    if (state.dirty || location.href !== state.url) {
      state.url = location.href;
      // New cards can change the sibling sequence, so rebuild decisions.
      state.dirty = false;
      clearFeeds();
      resetDecisions();
    }
    const items = collect();
    const tree = buildMediaTree(items);
    updateFeeds(tree);
    hide(items.filter(apply).map(item => item.el));
  }

  // One scan per frame. requestAnimationFrame runs before the next paint,
  // and anything not yet judged stays hidden by CSS until then.
  function schedule() {
    if (!enabled() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      scan();
    });
  }

  function onMutations(records) {
    if (!enabled()) return;
    for (const { type, target: el, attributeName } of records) {
      if (type === 'childList') {
        state.dirty = true;
        continue;
      }
      // Virtualized lists reuse nodes: revoke permission before the new
      // source can paint. Outside a feed, a new source earns a fresh verdict.
      unflag(el, 'allow', 'allowBg');
      if (SOURCE_ATTRS.includes(attributeName) && el.hasAttribute(ATTR.hide) && !el.closest(marked('feed'))) {
        unhide(el);
      }
    }
    schedule();
  }

  // ------------------------------------------------------------ modes

  function report() {
    const rows = [...document.querySelectorAll(`[${ATTR.why}]`)].map(el => {
      const r = el.getBoundingClientRect();
      return {
        why: el.getAttribute(ATTR.why),
        w: Math.round(r.width),
        h: Math.round(r.height),
        tag: el.tagName.toLowerCase(),
        link: !!el.closest(SEL.clickable),
        src: String(el.currentSrc || el.src || el.style?.backgroundImage || '').slice(0, 100),
      };
    });
    console.log(`[Quiet Mosaic] ${rows.length} media, ${state.feeds.size} feed(s)`);
    console.table(rows);
  }

  function setMode(next) {
    const wasOff = state.mode === 'off';
    state.mode = next;
    root.setAttribute(ATTR.root, next);
    if (wasOff && enabled()) {
      resetDecisions();
      schedule();
    }
    if (next === 'debug') requestAnimationFrame(() => requestAnimationFrame(report));
  }

  const SHORTCUTS = {
    KeyQ: mode => (mode === 'off' ? 'on' : 'off'),
    KeyD: mode => (mode === 'debug' ? 'on' : 'debug'),
  };

  function onKey(event) {
    const toggle = event.altKey && event.shiftKey && !event.repeat && SHORTCUTS[event.code];
    if (toggle) setMode(toggle(state.mode));
  }

  // ------------------------------------------------------------ start

  function start() {
    root = document.documentElement;
    root.setAttribute(ATTR.root, state.mode);
    const style = Object.assign(document.createElement('style'), {
      id: 'quiet-mosaic-style',
      textContent: CSS,
    });
    (document.head || root).appendChild(style);

    new MutationObserver(onMutations).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: WATCHED_ATTRS,
    });
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    addEventListener('load', schedule, true);
    addEventListener('pageshow', schedule);
    addEventListener('keydown', onKey);
    schedule();
  }

  if (document.documentElement) {
    start();
  } else {
    const early = new MutationObserver(() => {
      if (!document.documentElement) return;
      early.disconnect();
      start();
    });
    early.observe(document, { childList: true });
  }
})();
