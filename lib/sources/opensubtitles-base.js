import { fetchJson, fetchText } from "../http.js";
import { rankSubs } from "../release-match.js";

// Nguồn sub gốc = addon OpenSubtitles v3 chính chủ của Stremio (không cần key).
const BASE = "https://opensubtitles-v3.strem.io";

// Ngôn ngữ nguồn để dịch: lấy tiếng Anh; không có mới lùi sang thứ tiếng khác
const SRC_LANG_PREF = ["eng", "spa", "por", "fre", "ger", "ita"];

const LIST_TTL = 60 * 60 * 1000; // 1 giờ
const listCache = new Map(); // url -> { value, expires }

// Danh sách sub gốc cho 1 phim/tập, đã xếp hạng theo độ khớp với bản phim đang xem.
// Mỗi phần tử: { id, url, lang, subtitleFileName, m }
export async function listBaseSubs(type, id, extra = {}) {
  const ex = [];
  if (extra.videoHash) ex.push(`videoHash=${extra.videoHash}`);
  if (extra.videoSize) ex.push(`videoSize=${extra.videoSize}`);
  const url = `${BASE}/subtitles/${type}/${id}${ex.length ? "/" + ex.join("&") : ""}.json`;

  const hit = listCache.get(url);
  let subs;
  if (hit && hit.expires > Date.now()) subs = hit.value;
  else {
    const data = await fetchJson(url);
    subs = (data?.subtitles || []).filter((s) => s.url && s.id);
    listCache.set(url, { value: subs, expires: Date.now() + LIST_TTL });
  }

  for (const lang of SRC_LANG_PREF) {
    const sameLang = subs.filter((s) => s.lang === lang);
    if (sameLang.length) return rankSubs(sameLang, extra.filename);
  }
  return rankSubs(subs, extra.filename);
}

export function fetchSubText(url) {
  return fetchText(url);
}
