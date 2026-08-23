// Cache in-memory + chống dịch trùng (in-flight dedup).
// Render free spin-down sẽ xóa cache -> chấp nhận được (dịch lại khi cần).

const TTL = 24 * 60 * 60 * 1000; // 24 giờ
const store = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise

export function get(key) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (hit) store.delete(key);
  return null;
}

export function set(key, value) {
  store.set(key, { value, expires: Date.now() + TTL });
}

// Chạy producer() 1 lần duy nhất cho mỗi key kể cả khi nhiều request tới cùng lúc.
export async function once(key, producer) {
  const cached = get(key);
  if (cached != null) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await producer();
      if (value != null) set(key, value);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
