/**
 * BigInt-Safe Storage Utilities
 *
 * Zustand's createJSONStorage calls JSON.stringify BEFORE passing to setItem,
 * which fails with BigInt values. These utilities handle BigInt serialization
 * properly for localStorage persistence.
 */

// Marker prefix for BigInt values to distinguish from regular strings
const BIGINT_MARKER = "__bigint__:";

/**
 * Serialize BigInt values with a marker prefix.
 * This ensures ALL BigInt values are properly restored, regardless of size.
 */
export function serializeWithBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return `${BIGINT_MARKER}${obj.toString()}`;
  if (Array.isArray(obj)) return obj.map(serializeWithBigInt);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeWithBigInt(value);
    }
    return result;
  }
  return obj;
}

/**
 * Deserialize values with BigInt marker back to BigInt.
 */
export function deserializeWithBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string" && obj.startsWith(BIGINT_MARKER)) {
    return BigInt(obj.slice(BIGINT_MARKER.length));
  }
  if (Array.isArray(obj)) return obj.map(deserializeWithBigInt);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = deserializeWithBigInt(value);
    }
    return result;
  }
  return obj;
}

/**
 * Create a BigInt-safe storage adapter for Zustand persist middleware.
 *
 * Usage:
 * ```ts
 * import { persist } from "zustand/middleware";
 * import { createBigIntStorage } from "./utils/bigint-storage";
 *
 * export const useMyStore = create(
 *   persist(
 *     (set, get) => ({ ... }),
 *     {
 *       name: "my-store",
 *       storage: createBigIntStorage(),
 *     }
 *   )
 * );
 * ```
 */
export function createBigIntStorage() {
  return {
    getItem: (name: string) => {
      const value = localStorage.getItem(name);
      if (!value) return null;

      try {
        const parsed = JSON.parse(value);
        return deserializeWithBigInt(parsed);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: unknown): void => {
      try {
        const serialized = serializeWithBigInt(value);
        localStorage.setItem(name, JSON.stringify(serialized));
      } catch (e) {
        console.error(`[BigIntStorage] Failed to save ${name}:`, e);
      }
    },
    removeItem: (name: string): void => {
      localStorage.removeItem(name);
    },
  };
}
