import { fetchJson, fetchText } from "../http.js";

// Nguồn sub gốc = addon OpenSubtitles v3 chính chủ của Stremio.
// imdb-only (không cần videoHash, không key). videoHash nếu có -> khớp bản phim tốt hơn.
const BASE = "https://opensubtitles-v3.strem.io";

// Thứ tự ưu tiên ngôn ngữ nguồn để dịch (Anh trước, rồi các thứ tiếng phổ biến)
const SRC_LANG_PREF = ["eng", "spa", "por", "fre", "ger", "ita"];

function pickSub(subs) {
  for (const lang of SRC_LANG_PREF) {
    const found = subs.find((s) => s.lang === lang && s.url);
    if (found) return found;
  }
  return subs.find((s) => s.url) || null;
}

// Lấy SRT gốc (text) cho 1 phim/tập. Trả { srt, lang } hoặc null.
export async function getBaseSrt(type, id, extra = {}) {
  const parts = [`${BASE}/subtitles/${type}/${id}`];
  const ex = [];
  if (extra.videoHash) ex.push(`videoHash=${extra.videoHash}`);
  if (extra.videoSize) ex.push(`videoSize=${extra.videoSize}`);
  const url = `${parts[0]}${ex.length ? "/" + ex.join("&") : ""}.json`;

  const data = await fetchJson(url);
  const subs = data?.subtitles || [];
  const pick = pickSub(subs);
  if (!pick) return null;

  const srt = await fetchText(pick.url);
  return { srt, lang: pick.lang };
}
