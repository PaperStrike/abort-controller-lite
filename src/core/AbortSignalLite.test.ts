import AbortSignalLite from './AbortSignalLite'

const createActiveSignal = () => new (AbortSignalLite as unknown as new () => AbortSignalLite)()

describe('AbortSignalLite', () => {
  describe('static abort()', () => {
    test('should create an already aborted signal', () => {
      const signal = AbortSignalLite.abort()

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBeInstanceOf(Error)
      expect((signal.reason as Error).name).toBe('AbortError')
    })

    test('should create an already aborted signal with provided reason', () => {
      const reason = new Error('Custom abort reason')
      const signal = AbortSignalLite.abort(reason)

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBe(reason)
    })
  })

  describe('static any()', () => {
    test('should accept an empty array and return a non-aborted signal', () => {
      const signal = AbortSignalLite.any([])
      expect(signal.aborted).toBe(false)
    })

    test('should accept plain Iterable as input', () => {
      const signal1 = createActiveSignal()
      const signal2 = createActiveSignal()

      const signal = AbortSignalLite.any({
        * [Symbol.iterator]() {
          yield signal1
          yield signal2
        },
      })

      expect(signal.aborted).toBe(false)

      const reason = new Error('Signal 1 aborted')
      signal1._abort(reason)

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBe(reason)
    })

    test('should be aborted if any input signal is already aborted', () => {
      const abortedSignal = AbortSignalLite.abort(new Error('Already aborted'))
      const activeSignal = createActiveSignal()
      const signal = AbortSignalLite.any([activeSignal, abortedSignal])

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBe(abortedSignal.reason)
    })

    test('should abort when any input signal aborts later', () => {
      const signal1 = createActiveSignal()
      const signal2 = createActiveSignal()
      const signal = AbortSignalLite.any([signal1, signal2])

      expect(signal.aborted).toBe(false)

      const reason = new Error('Signal 2 aborted')
      signal2._abort(reason)

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBe(reason)
    })

    test('should abort with the reason of the first signal that aborts', () => {
      const signal1 = createActiveSignal()
      const signal2 = createActiveSignal()
      const signal = AbortSignalLite.any([signal1, signal2])

      const reason1 = new Error('Signal 1 aborted')
      const reason2 = new Error('Signal 2 aborted')

      signal2._abort(reason2)
      signal1._abort(reason1)

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBe(reason2)
    })
  })

  describe('static timeout()', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('should create a signal that aborts after the specified timeout', () => {
      const timeout = 1000
      const signal = AbortSignalLite.timeout(timeout)

      expect(signal.aborted).toBe(false)

      jest.advanceTimersByTime(timeout)

      expect(signal.aborted).toBe(true)
      expect(signal.reason).toBeInstanceOf(Error)
      expect((signal.reason as Error).name).toBe('TimeoutError')
    })
  })
})
