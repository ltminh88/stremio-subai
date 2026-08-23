const UA = "Mozilla/5.0 (Stremio SubAI addon)";

// Lõi fetch dùng chung: timeout + retry
async function request(url, init, timeoutMs, retries) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": UA, ...(init?.headers || {}) },
      });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.status = res.status;
        throw err;
      }
      return res;
    } catch (err) {
      lastErr = err;
      // Không retry lỗi 4xx (client) trừ 429
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) throw err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

export async function fetchJson(url, timeoutMs = 12000, retries = 1) {
  const res = await request(url, undefined, timeoutMs, retries);
  return res.json();
}

export async function fetchText(url, timeoutMs = 20000, retries = 1) {
  const res = await request(url, undefined, timeoutMs, retries);
  return res.text();
}

export async function postJson(url, body, timeoutMs = 60000, retries = 0) {
  const res = await request(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
    retries
  );
  return res.json();
}
