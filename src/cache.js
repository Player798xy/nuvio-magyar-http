/**
 * Bounded LRU/TTL in-memory cache with concurrent in-flight deduplication.
 * Prevents duplicate upstream API/scraper calls ("thundering herd") while bounding RAM usage.
 */

function createBoundedCache({ maxEntries = 300, ttlMs = 60 * 60 * 1000 } = {}) {
  const store = new Map();
  const inflight = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    // Refresh insertion order for true LRU retention of hot entries
    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  function has(key) {
    return get(key) !== undefined;
  }

  function set(key, value, customTtlMs = ttlMs) {
    const ttl = Math.max(0, Number(customTtlMs) || 0);
    if (ttl === 0) return value;

    if (store.has(key)) {
      store.delete(key);
    } else if (store.size >= maxEntries) {
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) store.delete(oldestKey);
    }

    store.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
    return value;
  }

  function del(key) {
    return store.delete(key);
  }

  async function getOrLoad(key, loaderFn, options = {}) {
    const cached = get(key);
    if (cached !== undefined) return cached;

    if (inflight.has(key)) {
      return inflight.get(key);
    }

    const {
      ttlMs: resolveTtl = ttlMs,
      shouldCache = (val) => val !== undefined
    } = options;

    const promise = (async () => {
      const result = await loaderFn();
      if (shouldCache(result)) {
        const computedTtl = typeof resolveTtl === 'function' ? resolveTtl(result) : resolveTtl;
        if (computedTtl > 0) {
          set(key, result, computedTtl);
        }
      }
      return result;
    })();

    inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(key);
    }
  }

  return {
    get,
    has,
    set,
    delete: del,
    getOrLoad,
    size: () => store.size
  };
}

/**
 * Drop-in bounded Map with oldest-entry eviction to prevent unbounded heap growth.
 */
class BoundedMap extends Map {
  constructor(maxEntries = 300) {
    super();
    this.maxEntries = Math.max(1, Number(maxEntries) || 300);
  }

  set(key, value) {
    if (super.has(key)) {
      super.delete(key);
    } else if (this.size >= this.maxEntries) {
      const oldestKey = this.keys().next().value;
      if (oldestKey !== undefined) super.delete(oldestKey);
    }
    return super.set(key, value);
  }
}

function createBoundedMap(maxEntries = 300) {
  return new BoundedMap(maxEntries);
}

module.exports = {
  createBoundedCache,
  createBoundedMap
};
