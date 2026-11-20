/**
 * Abort a stream when no event arrives for `idleMs`. Each `touch()` restarts the timer, so a long
 * stream that keeps sending events is never cut off. `signal` also follows the caller's cancel.
 */
export class IdleWatchdog {
  readonly signal: AbortSignal
  private readonly controller = new AbortController()
  private timer: ReturnType<typeof setTimeout> | undefined
  private expired = false

  constructor(private readonly idleMs: number, cancel?: AbortSignal) {
    this.signal = cancel === undefined ? this.controller.signal : AbortSignal.any([cancel, this.controller.signal])
    this.touch()
  }

  /** True only when the idle time ran out, not when the caller cancelled. */
  get timedOut(): boolean {
    return this.expired
  }

  touch(): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.expired = true
      this.controller.abort(new Error(`stream idle for ${this.idleMs} ms`))
    }, this.idleMs)
  }

  dispose(): void {
    clearTimeout(this.timer)
  }
}
