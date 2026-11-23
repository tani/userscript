// ==UserScript==
// @name         Quiet Mosaic — no-flash thumbnail suppression
// @namespace    quiet-web.local
// @version      0.8.0
// @description  Suppress thumbnail-like images before they can flash on screen, and collapse the space they leave.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * How it works
 *   1. CSS installed at document-start hides every image until it is judged
 *      (opacity 0, so it keeps its size and can still be measured).
 *   2. Once per animation frame, each image is inspected and gets a verdict:
 *        allow  – clearly not a thumbnail (icon, article photo, player…)
 *        hide   – a thumbnail: removed with display:none, together with the
 *                 wrapper that holds nothing but it (badges, placeholders)
 *        wait   – cannot be judged yet; stays invisible
 *   3. Repeating thumbnails reveal "feeds"; everything that later appears in
 *      a feed is collapsed by CSS immediately, before any script runs.
 *
 * Keys
 *   Alt+Shift+Q  on / off
 *   Alt+Shift+D  debug view: nothing hidden, every verdict outlined
 *                (green allow, red hide, gray wait, red dotted wrapper,
 *                amber dashed feed) and a table printed to the console.
 */
(() => {
  'use strict';

  const CONFIG = {
    // Size floor for images outside links to count as thumbnails.
    minWidth: 92,
    minHeight: 56,
    minArea: 6500,
    // Size floor for images inside links. Ranking-list thumbnails are small
    // squares; icons and logos below this stay visible.
    minClickableSide: 40,
    // Feed detection: at least this many same-shaped thumbnails under one
    // ancestor, searched this many levels up.
    minCluster: 4,
    maxAncestors: 12,
    maxMedia: 1200,
    // Wrapper collapsing: levels to climb, and how far (px) a badge may
    // stick out of the image and still count as drawn on top of it.
    maxBoxDepth: 10,
    overlayTolerance: 6,
    // Minimum interval between wrapper re-fits on busy pages (ms).
    refitInterval: 300,
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
    article: 'article, [role="article"]',
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
    dirty: false,         // DOM structure changed since the last re-fit
    lastRefit: 0,
  };
  let root;
  let frame = 0;
  let refitTimer = 0;
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

  const viewport = () => ({
    w: Math.max(document.documentElement.clientWidth, innerWidth || 0),
    h: Math.max(document.documentElement.clientHeight, innerHeight || 0),
  });

  function* ancestors(el, limit = Infinity) {
    for (let p = el.parentElement, depth = 0; p && depth < limit; p = p.parentElement, depth++) {
      if (p === document.body || p === document.documentElement) return;
      yield p;
    }
  }

  const childOf = (parent, el) => {
    while (el && el.parentElement !== parent) el = el.parentElement;
    return el;
  };

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
    ${outline(`:is([${ATTR.why}^="wait"], [${ATTR.why}^="bg-only"])`, '3px solid #8c959f', '-3px')}
    ${outline(marked('box'), '2px dotted #d1242f', '0')}
    ${outline(marked('feed'), '3px dashed #bf8700', '2px')}
  `;

  // ------------------------------------------------------------ inspection

  const isArticleBody = article =>
    !!article?.querySelector('h1') && article.textContent.length > 700;

  // Safe because of where it sits. Linked images inside an article are not
  // protected: related-article lists often share the story's <article>.
  function placeReason(el, rect, clickable) {
    if (el.closest(SEL.chrome)) return 'chrome';
    const article = el.closest(SEL.article);
    if (isArticleBody(article)) {
      if (!clickable) return 'article';
      // Click-to-enlarge photo: an image-only link at least half as wide as the story.
      const width = article.getBoundingClientRect().width;
      if (!hasText(el.closest(SEL.clickable)) && width > 0 && rect.width >= width / 2) return 'article-photo';
    }
    if (!clickable && el.closest('figure')) return 'figure';
    return '';
  }

  // Safe because of its size.
  function sizeReason({ width: w, height: h }, view, clickable, measurable) {
    const small = clickable
      ? w < CONFIG.minClickableSide || h < CONFIG.minClickableSide
      : w < CONFIG.minWidth || h < CONFIG.minHeight || w * h < CONFIG.minArea;
    if (measurable && small) return 'small';
    if (w * h > view.w * view.h * 0.6) return 'big';
    return '';
  }

  // Safe because of what it is: a hero image or the main video player.
  // Sites like YouTube draw their own controls, so a large video outside
  // any link counts as a player; hover previews are far smaller.
  function roleReason(el, { width: w, height: h }, view, clickable) {
    if (!clickable && w > view.w * 0.72 && h > view.h * 0.22) return 'standalone';
    if (el.matches('video') &&
        (el.controls || (!clickable && (w >= Math.max(480, view.w * 0.4) || h >= view.h * 0.6)))) {
      return 'player';
    }
    return '';
  }

  function inspect(el) {
    const isMedia = el.matches(SEL.media);
    if (!isMedia && !hasInlineBg(el)) return null;
    if (!document.body.contains(el)) return null;

    const rect = el.getBoundingClientRect();
    const view = viewport();
    const clickable = !!el.closest(SEL.clickable);
    const measurable = rect.width >= 2 && rect.height >= 2;
    const offscreen = rect.right < 0 || rect.left > view.w ||
      rect.bottom < -view.h * 2 || rect.top > view.h * 5;
    const style = getComputedStyle(el);
    const unrendered = style.display === 'none' || style.visibility === 'hidden' ||
      style.contentVisibility === 'hidden';

    const locationOrSizeReason = placeReason(el, rect, clickable) ||
      sizeReason(rect, view, clickable, measurable);
    const candidate = measurable && !locationOrSizeReason && !offscreen && !unrendered;
    return {
      el,
      rect,
      isMedia,
      // Thumbnail-shaped and on screen: eligible for feed detection.
      candidate,
      safeWhy: locationOrSizeReason || roleReason(el, rect, view, clickable),
      waitWhy: !measurable ? 'unmeasured' : offscreen ? 'offscreen' : unrendered ? 'not-rendered' : 'unknown',
    };
  }

  function verdict(item, inFeed) {
    if (inFeed || (item.candidate && !item.safeWhy)) {
      const where = inFeed ? 'feed' : 'thumb';
      // An inline-background element carrying text (a banner) keeps its
      // text; only its background stays suppressed.
      return item.isMedia || !hasText(item.el) ? `hide:${where}` : `bg-only:${where}`;
    }
    return item.safeWhy ? `allow:${item.safeWhy}` : `wait:${item.waitWhy}`;
  }

  // ------------------------------------------------------------ feeds

  const shapeOf = ({ width: w, height: h }) =>
    `${Math.round(Math.log2(w / h) * 2)}:${Math.round(Math.log2(w * h) / 1.5)}`;

  function looksLikeFeed(parent, group) {
    if (group.length < CONFIG.minCluster) return false;
    const branches = new Set();
    const tags = new Map();
    const links = new Set();
    for (const { el } of group) {
      const branch = childOf(parent, el);
      if (branch) {
        branches.add(branch);
        tags.set(branch.tagName, (tags.get(branch.tagName) || 0) + 1);
      }
      const link = el.closest('a[href]');
      if (link) links.add(link.href);
    }
    return branches.size >= 3 && (Math.max(0, ...tags.values()) >= 3 || links.size >= 3);
  }

  // Ancestors under which several same-shaped thumbnails repeat; only the
  // innermost ones, so unrelated content nearby stays usable.
  function detectFeeds(items) {
    const groups = new Map(); // ancestor → shape → items
    for (const item of items) {
      if (!item.candidate) continue;
      const shape = shapeOf(item.rect);
      for (const p of ancestors(item.el, CONFIG.maxAncestors)) {
        if (p.matches(SEL.chrome)) break;
        getOrInit(getOrInit(groups, p, () => new Map()), shape, () => []).push(item);
      }
    }
    const found = [...groups]
      .filter(([parent, shapes]) => [...shapes.values()].some(group => looksLikeFeed(parent, group)))
      .map(([parent]) => parent);
    return found.filter(el => !found.some(other => other !== el && el.contains(other)));
  }

  // Feeds are sticky: their collapsed thumbnails can no longer be measured,
  // so re-detecting from scratch would make them flicker back. They end on
  // navigation or when removed from the page.
  function updateFeeds(items) {
    for (const el of state.feeds) {
      if (!el.isConnected) {
        unflag(el, 'feed');
        state.feeds.delete(el);
      }
    }
    for (const el of detectFeeds(items)) {
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

  // Badges and titles often arrive after the image, so wrappers are re-fitted
  // after DOM changes, at most once per refitInterval.
  function refitIfDirty() {
    if (!state.dirty) return;
    const wait = state.lastRefit + CONFIG.refitInterval - performance.now();
    if (wait > 0) {
      refitTimer ||= setTimeout(() => {
        refitTimer = 0;
        schedule();
      }, wait);
      return;
    }
    state.dirty = false;
    state.lastRefit = performance.now();
    hide([...document.querySelectorAll(`[${ATTR.hide}]`)]);
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
    if (location.href !== state.url) {
      // SPA navigation may reuse containers and nodes for a different page.
      state.url = location.href;
      clearFeeds();
      resetDecisions();
    }
    refitIfDirty();
    const items = collect();
    updateFeeds(items);
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
