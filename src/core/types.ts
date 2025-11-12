export interface AbortSignalLike {
  readonly aborted: boolean
  readonly reason: unknown
  throwIfAborted(): void
  addEventListener(type: 'abort' | (string & {}), listener: (this: this) => void): void
  removeEventListener(type: 'abort' | (string & {}), listener: (this: this) => void): void
}

export interface AbortControllerLike {
  readonly signal: AbortSignalLike
  abort(reason?: unknown): void
}
