# abort-controller-lite

[![npm Package](https://img.shields.io/npm/v/abort-controller-lite?logo=npm)](https://www.npmjs.com/package/abort-controller-lite "abort-controller-lite")
[![Compressed Minified Size](https://img.shields.io/bundlejs/size/abort-controller-lite?label=minzipped&color=008080)](#abort-controller-lite "Gzipped bundle size")

Ultra‑small (no globals, no heavy polyfill machinery) subset of AbortController / AbortSignal for runtimes missing the standard.

Targets:
- QuickJS / embed engines
- WeChat Mini Programs
- Older Node (<14.17) or minimal sandboxes

## Differences & Caveats

Not a drop‑in polyfill. It’s intentionally smaller and simpler. Key differences from the web standard:

- No global patching: this library never defines or mutates global AbortController/AbortSignal; import what you need.
  - `AbortController` → `AbortControllerLite` (interface `AbortControllerLike`).
  - `AbortSignal` → `AbortSignalLite` (interface `AbortSignalLike`).

- Event model
  - No EventTarget. Listeners are plain functions, invoked as `listener.call(signal)` with no Event object.
  - No `onabort` property, no options (`once`, `signal`, `capture`, etc.) to `addEventListener`, no `dispatchEvent`.
  - After the first abort we clear listeners to save memory; manual re‑dispatch isn’t supported. Effectively behaves like `{ once: true }` because an abort happens at most once and listeners are removed.
  - Listeners removed during an abort are not invoked; this matches the behavior of DOM event dispatch. But listeners added during an abort may be invoked if added before we finish invoking existing listeners, this differs from DOM behavior.

- Errors and `reason`
  - We use lightweight `Error` subclasses (`AbortError`, `TimeoutError`), not `DOMException`.
  - `throwIfAborted()` throws the stored `reason` as‑is; avoid relying on `instanceof DOMException`. Prefer checking by name (e.g., `err instanceof Error && err.name === 'AbortError'`).

- `AbortSignalLite.any(iterable)` memory semantics
  - Immediate: if any input is already aborted, the result aborts immediately with that `reason`.
  - Native engines maintain internal weak source/dependent lists so combined signals don’t keep inputs alive and vice‑versa.
  - In pure JS we can’t mirror that precisely: we must keep strong references to each source and close over the combined signal. We intentionally avoid `WeakRef`/`FinalizationRegistry` to keep size/complexity low.
  - Consequence: if you drop all references to the combined signal before any source aborts, the source signals still hold internal references that keep the combined signal (and its captured arrays) alive. Those references are only cleared when one of the sources aborts.
  - Practical guidance: use `any()` for short‑lived operations; avoid creating many long‑lived combined signals.

- `AbortSignalLite.timeout(ms)`
  - Uses a regular `setTimeout`; in Node it is not unref’d, so it can keep the event loop alive until it fires. If you need `unref`, prefer native `AbortSignal.timeout` (Node 18+) or roll your own per‑env helper.

- Listener error handling
  - If a listener throws, we rethrow it asynchronously (`setTimeout`) to avoid breaking other listeners.
  - Contrast: DOM event dispatch continues other listeners and reports the error (it does not throw to the `dispatchEvent` call site). Our rethrow is also non‑blocking for peers but surfaces as an async uncaught error; timing/visibility differs from browsers.

- Types and modules
  - ESM‑only package. Use import syntax; `require()` isn’t supported.
  - Public types are `AbortControllerLike` and `AbortSignalLike` — lightweight subsets of the standard API. A parameter typed `AbortSignalLike` is type‑compatible with the native `AbortSignal`; this is compile‑time only and does not guarantee identical runtime behavior or capabilities.
  - TypeScript flags direct construction (`new AbortSignalLite()`) as a type error, but nothing prevents it at runtime. The web standard throws here; we rely on discipline — stick to signals from the controller or the static helpers for the intended lifecycle.

If you need exact spec behavior (DOMException types, EventTarget, GC semantics of `any`, timer unref, etc.), use the platform’s built‑ins where available.

## License
MIT
