import AbortControllerLite from './AbortControllerLite'

describe('AbortControllerLite', () => {
  test('signal.aborted should be false initially', () => {
    const controller = new AbortControllerLite()
    expect(controller.signal.aborted).toBe(false)
  })

  test('abort() should set aborted to true', () => {
    const controller = new AbortControllerLite()
    controller.abort()
    expect(controller.signal.aborted).toBe(true)
  })

  test('signal.reason should be set when aborted', () => {
    const controller = new AbortControllerLite()
    const reason = new Error('Abort reason')
    controller.abort(reason)
    expect(controller.signal.reason).toBe(reason)
  })

  test('listeners should be called in order on abort', () => {
    const controller = new AbortControllerLite()
    const calls: number[] = []

    controller.signal.addEventListener('abort', () => {
      calls.push(1)
    })
    controller.signal.addEventListener('abort', () => {
      calls.push(2)
    })

    controller.abort()

    expect(calls).toEqual([1, 2])
  })

  test('listeners should have "this" set to the signal', () => {
    const controller = new AbortControllerLite()
    let thisValue: unknown = null

    controller.signal.addEventListener('abort', function () {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      thisValue = this
    })

    controller.abort()

    expect(thisValue).toBe(controller.signal)
  })

  test('listeners removed before abort should not be called', () => {
    const controller = new AbortControllerLite()
    const calls: number[] = []

    const listener1 = () => {
      calls.push(1)
    }
    const listener2 = () => {
      calls.push(2)
    }

    controller.signal.addEventListener('abort', listener1)
    controller.signal.addEventListener('abort', listener2)
    controller.signal.removeEventListener('abort', listener1)

    controller.abort()

    expect(calls).toEqual([2])
  })

  test('listeners removed during abort should not be called', () => {
    const controller = new AbortControllerLite()
    const calls: number[] = []

    const listener1 = () => {
      calls.push(1)
      controller.signal.removeEventListener('abort', listener2)
    }
    const listener2 = () => {
      calls.push(2)
    }

    controller.signal.addEventListener('abort', listener1)
    controller.signal.addEventListener('abort', listener2)

    controller.abort()

    expect(calls).toEqual([1])
  })

  test('listeners added during abort should not be called', () => {
    const controller = new AbortControllerLite()
    const calls: number[] = []

    const listener1 = () => {
      calls.push(1)
      controller.signal.addEventListener('abort', listener2)
    }
    const listener2 = () => {
      calls.push(2)
    }

    controller.signal.addEventListener('abort', listener1)

    controller.abort()

    expect(calls).toEqual([1])
  })

  test('abort() multiple times should have no effect after first', () => {
    const controller = new AbortControllerLite()
    const calls: number[] = []

    controller.signal.addEventListener('abort', () => {
      calls.push(1)
    })

    controller.abort()
    controller.abort() // second call should have no effect

    expect(calls).toEqual([1])
  })

  test('throwIfAborted should throw the reason if aborted', () => {
    const controller = new AbortControllerLite()
    const reason = new Error('Abort reason')
    controller.abort(reason)

    expect(() => {
      controller.signal.throwIfAborted()
    }).toThrow(reason)
  })

  describe('listener throwing', () => {
    beforeEach(() => {
      expect(process.hasUncaughtExceptionCaptureCallback()).toBe(false)
    })

    afterEach(() => {
      process.setUncaughtExceptionCaptureCallback(null)
    })

    test('listener throwing should be uncaught while calling others', async () => {
      const controller = new AbortControllerLite()
      const calls: number[] = []

      const listenerError = new Error('Listener error')
      const { promise: uncaught, resolve: resolveUncaught } = Promise.withResolvers<unknown>()
      process.setUncaughtExceptionCaptureCallback((error) => {
        resolveUncaught(error)
      })

      controller.signal.addEventListener('abort', () => {
        calls.push(1)
      })
      controller.signal.addEventListener('abort', () => {
        throw listenerError
      })
      controller.signal.addEventListener('abort', () => {
        calls.push(2)
      })

      expect(() => {
        controller.abort()
      }).not.toThrow()

      await expect(uncaught).resolves.toBe(listenerError)

      expect(calls).toEqual([1, 2])
    })
  })
})
