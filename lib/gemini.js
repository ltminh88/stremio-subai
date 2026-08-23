import { fetchJson, postJson } from "./http.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

// Thứ tự ưu tiên: dịch = context dài, cần rẻ/nhanh -> ưu tiên Flash, Pro để cuối.
const PREFERRED = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3.1-pro",
];

// Loại model không dùng để dịch text
const EXCLUDE = /embedding|tts|image|vision|aqa|imagen|veo/i;

const modelsCache = new Map(); // key -> { list, at }
const MODELS_TTL = 60 * 60 * 1000;

// Model KHẢ DỤNG với 1 key (hỗ trợ generateContent). Cache theo key.
export async function listModels(key) {
  const hit = modelsCache.get(key);
  if (hit && Date.now() - hit.at < MODELS_TTL) return hit.list;

  const data = await fetchJson(`${BASE}/models?key=${key}&pageSize=100`, 15000, 1);
  const list = (data?.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => !EXCLUDE.test(n));

  modelsCache.set(key, { list, at: Date.now() });
  return list;
}

// Chuỗi model để thử: model muốn -> ưu tiên (giao list thật) -> phần còn lại.
// Dùng key đầu tiên list được model để dựng chain.
export async function resolveModelChain(keys, want) {
  let available = [];
  for (const key of keys) {
    try {
      available = await listModels(key);
      if (available.length) break;
    } catch (e) {
      console.warn(`listModels lỗi với 1 key: ${e.message}`);
    }
  }
  if (!available.length) throw new Error("Không list được model từ bất kỳ key nào");

  const chain = [];
  const has = (n) => available.includes(n);
  if (want && want !== "auto" && has(want)) chain.push(want);
  for (const m of PREFERRED) if (has(m) && !chain.includes(m)) chain.push(m);
  for (const m of available) if (!chain.includes(m)) chain.push(m);
  return chain;
}

const SYS = `Bạn là dịch giả phụ đề phim chuyên nghiệp. Dịch từng dòng phụ đề sang tiếng Việt tự nhiên, đúng ngữ cảnh phim, giữ giọng điệu nhân vật. KHÔNG thêm giải thích, KHÔNG gộp hay tách dòng. Trả về DUY NHẤT một mảng JSON gồm các chuỗi đã dịch, ĐÚNG SỐ LƯỢNG và ĐÚNG THỨ TỰ với mảng đầu vào.`;

// Gọi Gemini dịch 1 batch với 1 key + 1 model. Lỗi mang .status để phân loại.
async function callGemini(lines, key, model) {
  const body = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ parts: [{ text: JSON.stringify(lines) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: { type: "STRING" } },
      temperature: 0.3,
    },
  };
  const data = await postJson(
    `${BASE}/models/${model}:generateContent?key=${key}`,
    body,
    90000,
    0
  );
  const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!txt) throw new Error("Gemini trả rỗng");
  const arr = JSON.parse(txt);
  if (!Array.isArray(arr) || arr.length !== lines.length)
    throw new Error(`Số dòng lệch: ${arr?.length} vs ${lines.length}`);
  return arr;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_MODELS = 4; // chỉ thử tối đa 4 model đầu chain (tránh cascade khi lỗi)
const RETRY_429 = 1; // 1 lần backoff-retry khi TẤT CẢ key đều 429 cho 1 model (giảm độ trễ)

// Dịch 1 batch, ĐỘC LẬP (an toàn khi chạy song song). Tự rotate key + model:
//  - 404 (model đóng) -> sang model kế
//  - 429/503 (rate limit) -> xoay key; hết key -> backoff rồi thử lại; vẫn dính -> model kế
//    (các model free tier có bucket RPM riêng nên đổi model thường gỡ được rate limit)
//  - 403 (key suspended) / lỗi khác -> xoay key kế
// startKey: điểm bắt đầu xoay key (rải tải đều giữa các batch song song).
export async function translateBatch(lines, keys, chain, startKey = 0) {
  let lastErr;
  const models = chain.slice(0, MAX_MODELS);
  for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_429; attempt++) {
      let sawRateLimit = false;
      let modelClosed = false;
      for (let k = 0; k < keys.length; k++) {
        const key = keys[(startKey + k) % keys.length];
        try {
          return await callGemini(lines, key, model);
        } catch (err) {
          lastErr = err;
          if (err.status === 404) { modelClosed = true; break; }
          if (err.status === 429 || err.status === 503) sawRateLimit = true;
        }
      }
      if (modelClosed) break; // sang model kế
      if (sawRateLimit && attempt < RETRY_429) {
        await sleep(1000); // backoff ngắn rồi thử lại model này
        continue;
      }
      break; // sang model kế
    }
  }
  console.error(`Batch cạn key/model: ${lastErr?.status} ${lastErr?.message}`);
  return null;
}
