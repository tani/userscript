---
name: javascript
description: Write, review, refactor, and test modern JavaScript using ES2026, native ESM, strict JSDoc type checking, Node.js 26 built-ins, and node:test. Use whenever authoring JavaScript unless project requirements explicitly override these conventions.
---

# JavaScript

## Core principles

- **Write JavaScript, not TypeScript.** Write executable `.js` files and express types through TypeScript-compatible JSDoc. Do not introduce `.ts` source files, transpilers, or a build step solely for type checking.
- **Target ES2026** as the language baseline. Prefer modern standard syntax and APIs; do not transpile or polyfill without a concrete compatibility requirement.
- **Use native ECMAScript modules exclusively.** Set `"type": "module"` in `package.json`; use `import`/`export`, explicit `.js` extensions in relative imports, and `node:` prefixes for Node.js built-ins. Do not use CommonJS (`require`, `module.exports`, `__dirname`).
- **Allow top-level `await`** when it improves initialization and entry-point clarity. Avoid unnecessary async IIFEs. Do not introduce top-level awaits that can indefinitely stall importing modules.
- **Prefer `for await...of` for asynchronous iteration** over streams, asynchronous generators, and other async iterables; consume data incrementally rather than buffering it by default.
- **Prefer the Temporal API for date/time modeling and arithmetic.** On Node.js 26, use the built-in global `Temporal` directly; do not add a polyfill by default. Use `Intl` for localized presentation.
- **Use built-in `Intl` for locale-sensitive operations** such as formatting, collation, segmentation, and pluralization; do not hand-roll locale rules or add formatting dependencies without a concrete need.
- **Prefer `const`; use `let` only for reassignment.** Never use `var`.
- **Run in strict mode.** ESM is inherently strict; do not insert redundant `'use strict'` directives into ESM files. Enable strict TypeScript checking separately.
- **Prefer platform capabilities to dependencies.** Before installing a package, check whether the standard JavaScript or Node.js 26 API adequately covers the requirement.
- **Avoid incidental complexity.** Favor small focused functions, direct control flow, explicit errors, and minimal configuration. Do not introduce a framework or abstraction without demonstrated need.

## Resource management

- Prefer `using` for resources implementing `Symbol.dispose` and `await using` for resources implementing `Symbol.asyncDispose`.
- Prefer lexical lifetime and automatic cleanup to manually repeated `try/finally`, when the relevant disposable protocol is implemented.
- Keep resource scopes narrow. Resources are disposed in reverse declaration order on scope exit, including exceptional exits.
- For resources lacking the disposable protocol, use `try/finally` or a small adapter; never assume any object is automatically disposable.
- Do not use `using` on ordinary objects or asynchronous resources with only a synchronous disposer that returns a Promise.

```js
import { open } from 'node:fs/promises';

export async function readConfig(path) {
  await using file = await open(path, 'r');
  return file.readFile({ encoding: 'utf8' });
}
```

## Asynchronous iteration

- Use `for await (const value of source)` to consume `AsyncIterable` sources, including Node.js readable streams, filesystem glob iterators, and async generators.
- Prefer `for await...of` over manual `.next()` loops, `data` event handlers, and collecting an entire stream into memory when sequential incremental processing is sufficient.
- Use `async function*` when exposing a lazy asynchronous sequence. In JSDoc, annotate exported iterator interfaces as `AsyncIterable<T>` or `AsyncGenerator<T, TReturn, TNext>` as appropriate.
- Preserve backpressure: await asynchronous work in the loop body when processing order and bounded concurrency matter. Use explicit bounded concurrency for throughput-critical workloads; do not accidentally create unbounded arrays of promises.
- Use ordinary `for...of` for synchronous iterables; `for await...of` adds asynchronous iteration overhead even for synchronous inputs.
- An early `break`, `return`, or thrown error invokes an iterator's `return()` method (if present) and awaits its result. For Node.js readable streams, early termination may destroy the stream; for Web `ReadableStream` iteration, it normally cancels the stream. Verify and control cancellation semantics when the source must remain usable.
- Combine `for await...of` with `using` / `await using` where a resource implements the corresponding disposal protocol; neither mechanism replaces correct error and cancellation handling.

```js
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * @param {string} filename
 * @returns {AsyncGenerator<string, void, unknown>}
 */
export async function* matchingLines(filename) {
  const stream = createReadStream(filename);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (line.includes('TODO')) yield line;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}
```

## Internationalization and locale-aware behavior

- Prefer the **standard global `Intl` namespace**; `Intl` is not an npm dependency or a Node.js `node:` module and requires no import.
- Use `Intl.DateTimeFormat` for dates and times, `Intl.NumberFormat` for numbers, currencies, percentages and units, `Intl.RelativeTimeFormat` for relative times, and `Intl.ListFormat` for localized lists.
- Use `Intl.Collator` for locale-aware comparisons and sorting, `Intl.Segmenter` for grapheme/word/sentence boundaries, `Intl.PluralRules` for plural categories, `Intl.DisplayNames` for localized names, and `Intl.Locale` for locale metadata.
- Never assume `.length`, `split('')`, or a regular-expression word boundary corresponds to user-perceived characters or linguistically valid word segmentation. Prefer `Intl.Segmenter` where those distinctions matter.
- Pass an explicit locale and, where relevant, `timeZone`, `currency`, `unit`, and other options when output must be reproducible or meet product requirements. Do not rely on the host's default locale/time zone for tests or stable machine-readable data.
- Use locale-independent formats such as ISO 8601 for machine interchange. Reserve `Intl` for human-facing presentation and language-sensitive comparison.
- Reuse formatter/collator/segmenter instances inside repeated operations when practical. Check supported locales and options when deploying to a constrained Node.js build.

```js
const locale = 'ja-JP';
const dateFormatter = new Intl.DateTimeFormat(locale, {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Tokyo',
});
const numberFormatter = new Intl.NumberFormat(locale);
const collator = new Intl.Collator(locale, { numeric: true });
const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });

console.log(dateFormatter.format(new Date('2026-11-22T01:00:00Z')));
console.log(numberFormatter.format(1234567));
console.log(['file10', 'file2'].sort(collator.compare));
console.log([...segmenter.segment('👩‍💻日本語')].map(({ segment }) => segment));
```

## Date and time: Temporal API

- **Prefer `Temporal` over legacy `Date` for new date/time domain logic.** Use explicit domain types instead of representing every temporal value as an epoch-millisecond timestamp or a loosely parsed string.
- Select the type according to semantics:
  - `Temporal.Instant`: an exact point on the UTC timeline (timestamps, event instants, logs).
  - `Temporal.PlainDate`: a calendar date without a time or time zone (birthdays, date-only fields).
  - `Temporal.PlainTime`: a wall-clock time without a date or zone.
  - `Temporal.PlainDateTime`: a local date and time **without** a time zone; it is not a unique instant.
  - `Temporal.ZonedDateTime`: an instant plus an IANA time zone and calendar; use for zone-aware scheduling and calendar calculations.
  - `Temporal.Duration`: elapsed or calendar-relative quantities; select appropriate relative context for variable-length units.
  - `Temporal.PlainYearMonth` and `Temporal.PlainMonthDay`: calendar-oriented partial dates when appropriate.
- **Node.js 26 enables native `Temporal` by default.** Use the global `Temporal` namespace without imports, runtime flags, or `temporal-polyfill-lite`. Only introduce a polyfill when a separately specified older target requires it.
- Use native `Temporal` consistently throughout the project. Do not add a date library such as `moment`, `dayjs`, or `date-fns` for functionality adequately handled by Temporal.
- **Always distinguish instants from local calendar representations.** Supply an explicit IANA time zone (for example, `Asia/Tokyo`) for reproducible scheduled events. Do not assume the machine's local time zone, nor implicitly treat a `PlainDateTime` as UTC.
- Explicitly handle ambiguous and nonexistent local times caused by daylight-saving transitions, using the appropriate `disambiguation` behavior. Decide whether arithmetic is calendar-relative (e.g., one day) or elapsed-time based (e.g., 24 hours).
- Prefer Temporal's immutable `.with()`, `.add()`, `.subtract()`, `.since()`, `.until()`, `.equals()`, and type-specific static `.compare()` operations. Do not use relational operators on Temporal objects or assume JavaScript `Date`'s mutable setter behavior.
- Prefer ISO 8601 / RFC 3339-compatible serialization with explicit offsets or zones as required by the data contract. Use `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` for localized human-facing display, not ad hoc string concatenation.
- Convert to/from `Date` only at interoperability boundaries. Use `Temporal.Instant.fromEpochMilliseconds(date.getTime())` for a legacy `Date`; use `new Date(instant.epochMilliseconds)` only when the API needs `Date` and the instant is within its supported range.
- In JSDoc, use native global Temporal types (for example, `@param {Temporal.Instant} instant`) when supported by the installed TypeScript and `@types/node` versions. Update the checker/type definitions if the native types are missing; do not introduce a runtime polyfill solely for typings.
- Test boundary conditions: time-zone transitions, leap days, calendar-month overflow, offset handling, and dates around midnight. Fix the clock or inject it in tests rather than relying on `Temporal.Now` for deterministic assertions.

```js
// Node.js 26: global Temporal is available natively.
const date = Temporal.PlainDate.from('2026-11-22');
const nextMonth = date.add({ months: 1 });
const instant = Temporal.Instant.from('2026-11-22T01:00:00Z');
const tokyoTime = instant.toZonedDateTimeISO('Asia/Tokyo');
const formatted = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Asia/Tokyo',
}).format(new Date(instant.epochMilliseconds));

console.log(nextMonth.toString(), tokyoTime.toString(), formatted);
```

## Types: JavaScript + JSDoc

- Enable project-wide JavaScript checking with TypeScript (`allowJs`, `checkJs`, `strict`, `noEmit`). Use TypeScript **as a checker, not as the source language or compiler output**.
- Use `@param`, `@returns`, `@type`, `@typedef`, `@property`, `@template`, `@implements`, and `@satisfies` where they improve static checking.
- Use `import('...').TypeName` in JSDoc for imported types; use JavaScript `import` statements for runtime values.
- Prefer inference for obvious local variables; annotate public interfaces, object shapes, callback boundaries, generics, and types the compiler cannot reliably infer.
- Model uncertain inputs with `unknown`, then narrow or validate. Avoid `any` unless justified, and never silence errors with `@ts-ignore` or `@ts-nocheck` as a default.
- Document intentional exceptional suppressions with `@ts-expect-error` and a reason, if truly necessary.
- Keep JSDoc consistent with runtime behavior; type checking is not runtime input validation.

```js
/**
 * @typedef {{ id: string, score: number }} Result
 */

/**
 * @template T
 * @param {readonly T[]} items
 * @param {(item: T) => boolean} predicate
 * @returns {T | undefined}
 */
export function findFirst(items, predicate) {
  return items.find(predicate);
}

/** @type {Result} */
const result = { id: 'example', score: 1 };
```

### Recommended `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ESNext"],
    "allowJs": true,
    "checkJs": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"],
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.js"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

`ESNext` is intentionally used for TypeScript's type-library/feature tracking, while ES2026 remains the runtime language baseline. Confirm that any emitted JavaScript syntax and standard library API actually work in Node.js 26. Install matching `typescript` and `@types/node` as development dependencies. For browser-only projects, adapt `lib`, `types`, and `moduleResolution` to the actual runtime rather than assuming Node.js.

## Node.js 26 conventions

When targeting Node.js, assume **Node.js 26** unless the project explicitly sets a different runtime. Prefer stable built-in APIs. Do not treat experimental APIs as ordinary stable dependencies; verify their availability and stability in the supported Node.js 26 minor version.

| Requirement | Prefer | Avoid installing by default |
| --- | --- | --- |
| Tests | `node:test`, `node:assert/strict` | Jest, Mocha, Chai |
| Date/time modeling and arithmetic | global `Temporal` (native in Node.js 26) | `moment`, `dayjs`, `date-fns` for ordinary date/time operations |
| Locale-aware formatting and text processing | global `Intl` (`DateTimeFormat`, `NumberFormat`, `Collator`, `Segmenter`, etc.) | `moment`, `numeral`, locale-sorting and segmentation packages for simple cases |
| Async stream/iterator consumption | `for await...of`, `async function*` | event-driven or buffered iteration boilerplate for simple cases |
| ANSI text styling | `styleText` from `node:util` | `chalk`, `picocolors` |
| Strip ANSI codes | `stripVTControlCharacters` from `node:util` | `strip-ansi` |
| CLI argument parsing | `parseArgs` from `node:util` | `minimist`, `yargs` |
| Glob matching / traversal | `glob` from `node:fs/promises` | `glob`, `fast-glob` |
| Grep-like file search | `glob` + `readFile` + `RegExp` or line matching | `grep` packages for simple cases |
| Filesystem operations | `node:fs/promises` (`cp`, `rm`, `mkdir`, etc.) | `fs-extra` |
| HTTP client | global `fetch` | `node-fetch`, `axios` for simple requests |
| Cryptographic UUIDs | `randomUUID` from `node:crypto` | `uuid` |
| Deep cloning | `structuredClone` | `lodash.clonedeep` |
| Timeouts and delays | `node:timers/promises` | dedicated sleep packages |
| Environment files | `node --env-file=.env` | `dotenv` for simple CLI usage |
| URL and path operations | `URL`, `import.meta.url`, `node:url`, `node:path` | custom parsing |

A generic `grep`-compatible command is **not** assumed to be a Node.js 26 built-in API. Implement simple searches with standard primitives; retain a specialized package when its capabilities are genuinely required. Do not reproduce mature third-party tools without a reason.

```js
import { glob, readFile } from 'node:fs/promises';
import { styleText } from 'node:util';

for await (const path of glob('src/**/*.js')) {
  const source = await readFile(path, 'utf8');
  if (source.includes('TODO')) console.log(styleText('yellow', path));
}
```

## Testing

- Use `node:test` and `node:assert/strict` by default.
- Use built-in test lifecycle hooks and mock facilities (`mock`, `t.mock`, etc.) where appropriate; avoid an external test runner unless there is a specific requirement.
- Write tests for externally observable behavior, boundaries, errors, resource cleanup, and async paths.
- Prefer deterministic tests using temporary directories, controlled clocks, and explicit fixtures. Clean up test resources, using disposal where supported.
- Run the test suite and type checker after modifications. Report failures rather than claiming tests passed without executing them.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { findFirst } from './result.js';

test('findFirst returns the matching element', () => {
  assert.equal(findFirst([1, 2, 3], value => value > 1), 2);
});
```

## Suggested project setup

```json
{
  "type": "module",
  "engines": { "node": ">=26 <27" },
  "scripts": {
    "test": "node --test",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && npm test"
  },
  "devDependencies": {
    "@types/node": "^26",
    "typescript": "^5.9"
  }
}
```

Treat the version entries as examples: use versions available and compatible with the project, preferably lockfile-pinned. The Node.js 26 baseline does not automatically mean that every future ES2026 or `ESNext` feature is supported by that particular runtime build.

## Final review checklist

1. Source is native JavaScript ESM, aligned with the ES2026 baseline; relative imports include `.js`.
2. Strict mode semantics hold; TypeScript's `strict` and `checkJs` are active.
3. Public or non-obvious types are expressed through TypeScript-compatible JSDoc.
4. `using` / `await using` is used correctly for resources with supported disposal protocols.
5. Asynchronous iterables use `for await...of` or `async function*` where appropriate, with cancellation and backpressure considered.
6. Date/time logic uses appropriately typed `Temporal` values, with native Node.js 26 `Temporal` and explicit time zones where required; localized presentation uses `Intl`.
7. Node.js 26 stable built-ins are preferred over unnecessary packages.
8. Tests use `node:test` and `node:assert/strict`.
9. `npm run check` (or equivalent) passes, or any unverified checks are explicitly disclosed.
