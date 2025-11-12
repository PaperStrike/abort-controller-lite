import AbortError from '../error/AbortError'
import TimeoutError from '../error/TimeoutError'
import type { AbortSignalLike } from './types'

const invokeAndClear = <ThisArg>(listeners: Set<(this: ThisArg) => void>, thisArg: ThisArg) => {
  // The standard algorithm respects listener removal but not listener addition during dispatch.
  // We use a snapshot to achieve this.
  const snapshot = new WeakSet(listeners)
  for (const listener of listeners) {
    if (!snapshot.has(listener)) continue

    try {
      listener.call(thisArg)
    }
    catch (error) {
      // async throw to avoid breaking the other listeners
      setTimeout(() => {
        throw error
      }, 0)
    }
  }

  // we don't want to support the rare case of manually dispatching abort events to retrigger listeners like the standard does.
  // just release the memory.
  listeners.clear()
}

export default class AbortSignalLite implements AbortSignalLike {
  private constructor() {
    // ts only check to prevent external construction
  }

  /** @internal */
  private _listeners = new Set<(this: this) => void>()

  public addEventListener(type: string, listener: (this: this) => void) {
    if (type === 'abort') this._listeners.add(listener)
  }

  public removeEventListener(type: string, listener: (this: this) => void) {
    if (type === 'abort') this._listeners.delete(listener)
  }

  /** @internal */
  private _reason: unknown

  /** @internal */
  private _dependents = new Set<AbortSignalLite>()

  /** @internal */
  private _sources: Set<AbortSignalLite> | undefined

  public get aborted() {
    return this._reason !== undefined
  }

  public get reason() {
    return this._reason
  }

  public throwIfAborted() {
    if (this.aborted) {
      throw this._reason
    }
  }

  /** @internal */
  public _abort(reason: unknown = new AbortError('signal is aborted without reason')) {
    if (this.aborted) return

    this._reason = reason

    // Note: This intentionally differs from the standard.
    // The spec checks each dependent’s aborted state and caches the non-aborted set for later invocation.
    // Here we can safely assume all dependents are not aborted, because once a dependent aborts,
    // we immediately remove it from every source’s dependents set.
    // The spec models relationships with conceptual “weak” sets and relies on GC to clean them up.
    // In plain JS we cannot iterate WeakSet, so we use strong Sets and maintain them explicitly.
    // https://dom.spec.whatwg.org/#abortsignal-signal-abort
    const dependents = [...this._dependents]
    this._dependents.clear()

    // Update dependents' aborted state before invoking any listeners
    for (const dependent of dependents) {
      dependent._reason = reason

      // Eagerly remove the dependent from its sources
      for (const source of dependent._sources!) {
        source._dependents.delete(dependent)
      }

      dependent._sources = undefined
    }

    invokeAndClear(this._listeners, this)

    for (const dependent of dependents) {
      invokeAndClear(dependent._listeners, dependent)
    }
  }

  public static abort(reason?: unknown): AbortSignalLike {
    const signal = new AbortSignalLite()
    signal._abort(reason)
    return signal
  }

  public static any(signalsIterable: Iterable<AbortSignalLike>): AbortSignalLike {
    const signals = [...signalsIterable] as AbortSignalLite[]
    const resultSignal = new AbortSignalLite()

    for (const signal of signals) {
      if (signal.aborted) {
        resultSignal._reason = signal._reason
        return resultSignal
      }
    }

    resultSignal._sources = new Set<AbortSignalLite>()

    for (const signal of signals) {
      if (!signal._sources) {
        resultSignal._sources.add(signal)
        signal._dependents.add(resultSignal)
      }
      else {
        for (const sourceSignal of signal._sources) {
          resultSignal._sources.add(sourceSignal)
          sourceSignal._dependents.add(resultSignal)
        }
      }
    }

    return resultSignal
  }

  public static timeout(ms: number): AbortSignalLike {
    const signal = new AbortSignalLite()

    setTimeout(() => {
      signal._abort(new TimeoutError('signal timed out'))
    }, ms)

    return signal
  }
};
