import { createHash } from "node:crypto";

/** Tiny in-memory LRU cache with TTL. Identical requests come back instantly
 * and don't burn free-tier quota. */
export class LruCache {
  constructor({ max = 300, ttlMs = 6 * 60 * 60 * 1000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  static key(...parts) {
    return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      this.map.delete(this.map.keys().next().value);
    }
  }
}
