import AbortError from '../error/AbortError'
import TimeoutError from '../error/TimeoutError'
import type { AbortSignalLike } from './types'

const invokeAndClear = <ThisArg>(listeners: Set<(this: ThisArg) => void>, thisArg: ThisArg) => {
  for (const listener of listeners) {
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
  private _abortListeners = new Set<(this: this) => void>()

  public addEventListener(type: string, listener: (this: this) => void) {
    if (type === 'abort') this._abortListeners.add(listener)
  }

  public removeEventListener(type: string, listener: (this: this) => void) {
    if (type === 'abort') this._abortListeners.delete(listener)
  }

  /** @internal */
  private _reason: unknown = undefined

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

    const dependentsToAbort: AbortSignalLite[] = []
    for (const dependent of this._dependents) {
      if (!dependent.aborted) {
        dependent._reason = reason
        dependentsToAbort.push(dependent)
      }
    }

    this._dependents.clear()

    invokeAndClear(this._abortListeners, this)

    for (const dependent of dependentsToAbort) {
      invokeAndClear(dependent._abortListeners, dependent)
      dependent._sources = undefined
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
        resultSignal._reason = signal.reason
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
