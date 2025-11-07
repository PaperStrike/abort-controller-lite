import AbortError from '../error/AbortError'
import TimeoutError from '../error/TimeoutError'
import type { AbortSignalLike } from './types'

export default class AbortSignalLite implements AbortSignalLike {
  private constructor() {
    // ts only check to prevent external construction
  }

  /** @internal */
  private _abortListeners = new Set<(this: this) => void>()

  public addEventListener(type: string, listener: (this: this) => void) {
    if (type === 'abort') this._abortListeners.add(listener)
  }

  public removeEventListener(type: string, listener: (this: this) => void) {
    if (type === 'abort') this._abortListeners.delete(listener)
  }

  /** @internal */
  private _aborted = false

  /** @internal */
  private _reason: unknown = undefined

  public get aborted() {
    return this._aborted
  }

  public get reason() {
    return this._reason
  }

  public throwIfAborted() {
    if (this._aborted) {
      throw this._reason
    }
  }

  /** @internal */
  public _abort(reason: unknown = new AbortError()) {
    if (this._aborted) return

    this._aborted = true
    this._reason = reason

    this._abortListeners.forEach((listener) => {
      try {
        listener.call(this)
      }
      catch (error) {
        // async throw to avoid breaking the other listeners
        setTimeout(() => {
          throw error
        }, 0)
      }
    })

    // we don't want to support the rare case of manually dispatching abort events to retrigger listeners like the standard does.
    // just release the memory.
    this._abortListeners.clear()
  }

  public static abort(reason?: unknown): AbortSignalLike {
    const signal = new AbortSignalLite()
    signal._abort(reason)
    return signal
  }

  public static any(signalsIterable: Iterable<AbortSignalLike>): AbortSignalLike {
    const signals = Array.from(signalsIterable)
    const resultSignal = new AbortSignalLite()

    for (const signal of signals) {
      if (signal.aborted) {
        resultSignal._abort(signal.reason)
        return resultSignal
      }
    }

    function onAbort(this: AbortSignalLike) {
      resultSignal._abort(this.reason)
      for (const signal of signals) {
        signal.removeEventListener('abort', onAbort)
      }
    }

    for (const signal of signals) {
      signal.addEventListener('abort', onAbort)
    }

    return resultSignal
  }

  public static timeout(ms: number): AbortSignalLike {
    const signal = new AbortSignalLite()

    setTimeout(() => {
      signal._abort(new TimeoutError())
    }, ms)

    return signal
  }
};
