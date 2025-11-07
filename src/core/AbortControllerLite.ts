import AbortSignalLite from './AbortSignalLite'
import type { AbortControllerLike, AbortSignalLike } from './types'

export default class AbortControllerLite implements AbortControllerLike {
  /**
   * type hack to allow constructing AbortSignalLite here while preventing external construction
   * @internal
   */
  private _signal = new (AbortSignalLite as unknown as new () => AbortSignalLite)()

  public get signal(): AbortSignalLike {
    return this._signal
  }

  public abort(reason?: unknown) {
    this._signal._abort(reason)
  }
}
