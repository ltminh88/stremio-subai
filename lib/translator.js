import { listBaseSubs, fetchSubText } from "./sources/opensubtitles-base.js";
import { parseSrt, cueTexts, toVtt, chunk } from "./srt.js";
import { resolveModelChain, translateBatch } from "./gemini.js";
import * as cache from "./cache.js";

const BATCH_SIZE = 80; // số cue mỗi lần gọi Gemini (giữ dưới output token limit)

// Với model lite nhanh, nghẽn chuyển sang RPM -> concurrency theo số key.
// Mỗi key ~4 luồng (burst rồi 429 sẽ backoff). Tối thiểu 4, tối đa 16.
function concurrencyFor(keyCount) {
  return Math.min(16, Math.max(4, keyCount * 4));
}

// Chạy các task (thunk) với giới hạn song song, giữ nguyên thứ tự kết quả.
async function pool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// Lấy phụ đề tiếng Việt (VTT) dịch từ 1 bản sub gốc cụ thể.
// baseId: id bản sub gốc (OpenSubtitles) hoặc "auto" = bản khớp bản phim nhất.
// Cache theo id bản sub gốc -> mỗi bản phát hành có bản dịch riêng, không dùng lẫn nhau.
export async function getVietVtt(type, id, extra, keys, wantModel, baseId = "auto") {
  const subs = await listBaseSubs(type, id, extra);
  const base = baseId === "auto" ? subs[0] : subs.find((s) => String(s.id) === String(baseId));
  if (!base) {
    console.warn(`Không tìm thấy sub gốc ${baseId} cho ${type}/${id}`);
    return null;
  }
  return cache.once(`vi:${base.id}`, async () => {
    const srt = await fetchSubText(base.url);
    const cues = parseSrt(srt);
    if (!cues.length) return null;

    const texts = cueTexts(cues);
    const chain = await resolveModelChain(keys, wantModel);
    console.log(`Dịch ${cues.length} cue từ "${base.subtitleFileName}" (${base.lang}->vi), model: ${chain[0]}`);

    const batches = chunk(
      texts.map((t, i) => ({ t, i })),
      BATCH_SIZE
    );

    const tasks = batches.map((b, bi) => async () => {
      const lines = b.map((x) => x.t);
      const out = await translateBatch(lines, keys, chain, bi % keys.length);
      return { b, out };
    });

    const done = await pool(tasks, concurrencyFor(keys.length));

    const translated = new Array(texts.length);
    for (const { b, out } of done) {
      b.forEach((x, j) => {
        // Fallback: batch lỗi -> giữ nguyên câu gốc (vẫn có phụ đề để xem)
        translated[x.i] = out && out[j] != null ? out[j] : x.t;
      });
    }
    return toVtt(cues, translated);
  });
}
