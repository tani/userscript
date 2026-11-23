import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../quiet-mosaic.user.js', import.meta.url), 'utf8')
  .replace('  if (document.documentElement) {',
    '  globalThis.classifier = { buildMediaTree, detectFeeds, verdict };\n  if (document.documentElement) {');
const body = { children: [] };
const context = {
  document: { body, documentElement: null },
  location: { href: 'https://example.test/' },
  MutationObserver: class { observe() {} },
};
runInNewContext(source, context);
const { buildMediaTree, detectFeeds, verdict } = context.classifier;

function element(parent, width, height, tag = 'DIV') {
  const node = {
    parentElement: parent, children: [], tagName: tag, textContent: '',
    matches: selector => selector === 'img' && tag === 'IMG',
    closest: () => null,
    getBoundingClientRect: () => ({ width, height }),
    contains(other) {
      for (let node = other; node; node = node.parentElement) if (node === this) return true;
      return false;
    },
  };
  if (parent) parent.children.push(node);
  return node;
}

function item(el, width = 160, height = 90) {
  return { el, rect: { width, height }, candidate: true, isMedia: true, safeWhy: '' };
}

test('groups sibling cards by their computed sizes, even if images differ', () => {
  const feed = element(body, 800, 600);
  const items = Array.from({ length: 4 }, (_, index) => {
    const card = element(feed, 200, 250, 'ARTICLE');
    return item(element(card, 100 + index * 30, 90, 'IMG'));
  });
  assert.equal(detectFeeds(buildMediaTree(items)).length, 4);
});

test('multiple images in one card do not count as multiple sibling cards', () => {
  const feed = element(body, 800, 600);
  const card = element(feed, 200, 250, 'ARTICLE');
  const items = Array.from({ length: 4 }, () => item(element(card, 160, 90, 'IMG')));
  const tree = buildMediaTree(items);
  assert.equal(tree.get(feed).size, 1);
});

test('different sized sibling cards do not form a feed', () => {
  const feed = element(body, 800, 600);
  const items = Array.from({ length: 4 }, (_, index) => {
    const card = element(feed, 150 + index * 40, 250, 'ARTICLE');
    return item(element(card, 160, 90, 'IMG'));
  });
  assert.equal(detectFeeds(buildMediaTree(items)).length, 0);
});

test('only adjacent equal-size cards are selected in mixed image results', () => {
  const gallery = element(body, 1200, 6000);
  const heights = [280.31, 224.25, 177.53, 205.56, 280.31, 205.56,
    224.25, 280.31, 205.56, 205.56, 149.5, 126.14, 280.31,
    135.48, 280.31, 233.59, 252.28, 280.31, 130.81, 280.31];
  const items = heights.map(height => {
    const card = element(gallery, 234.5, height);
    return item(element(card, 225, height - 40, 'IMG'));
  });
  const matches = detectFeeds(buildMediaTree(items));
  assert.deepEqual(Array.from(matches), Array.from(gallery.children).slice(8, 10));
});

test('two consecutive equal-size cards form a match', () => {
  const feed = element(body, 800, 600);
  const items = Array.from({ length: 2 }, () => {
    const card = element(feed, 200, 250);
    return item(element(card, 160, 90, 'IMG'));
  });
  assert.deepEqual(Array.from(detectFeeds(buildMediaTree(items))), Array.from(feed.children));
});

test('four consecutive equal-size cards form a feed among different cards', () => {
  const feed = element(body, 1200, 600);
  const heights = [180, 280, 280, 280, 280, 220];
  const items = heights.map(height => {
    const card = element(feed, 234, height);
    return item(element(card, 200, 120, 'IMG'));
  });
  const matches = detectFeeds(buildMediaTree(items));
  assert.equal(matches.length, 4);
  assert.deepEqual(Array.from(matches), Array.from(feed.children).slice(1, 5));
});

test('a sibling without media interrupts a run', () => {
  const feed = element(body, 1200, 600);
  const items = [];
  for (let index = 0; index < 3; index++) {
    const card = element(feed, 200, 250);
    if (index !== 1) items.push(item(element(card, 160, 90, 'IMG')));
  }
  assert.equal(detectFeeds(buildMediaTree(items)).length, 0);
});

test('media outside a feed is allowed and the same media inside a feed is hidden', () => {
  const image = element(body, 180, 180, 'IMG');
  const media = item(image);
  assert.equal(verdict(media, false), 'allow:outside-feed');
  assert.equal(verdict(media, true), 'hide:feed');
});

test('background cards retain text while their background is suppressed', () => {
  const card = element(body, 180, 180);
  card.textContent = 'Article title';
  assert.equal(verdict({ el: card, isMedia: false }, true), 'bg-only:feed');
});
