import { useState, useEffect, useRef } from "react";

/**
 * useThrottledValue - Throttle a rapidly changing value
 *
 * Returns a throttled version of the input value that only updates
 * at most once per `delay` milliseconds. Useful for:
 * - Mining hashrate displays
 * - Real-time counters
 * - Any rapidly updating values that cause performance issues
 *
 * @param value - The value to throttle
 * @param delay - Minimum time between updates in milliseconds
 * @returns The throttled value
 *
 * @example
 * const hashrate = useMining().hashrate; // Updates every 100ms
 * const displayHashrate = useThrottledValue(hashrate, 500); // Updates max 2x/sec
 */
export function useThrottledValue<T>(value: T, delay: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdate = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdate.current >= delay) {
      // Defer to avoid cascading renders
      queueMicrotask(() => {
        setThrottled(value);
        lastUpdate.current = Date.now();
      });
    } else {
      const timeout = setTimeout(
        () => {
          setThrottled(value);
          lastUpdate.current = Date.now();
        },
        delay - (now - lastUpdate.current),
      );
      return () => clearTimeout(timeout);
    }
  }, [value, delay]);

  return throttled;
}

export default useThrottledValue;
