import sdk from "stremio-addon-sdk";
import { getBaseUrl } from "./lib/config.js";

const { addonBuilder } = sdk;

const manifest = {
  id: "community.subai.vi",
  version: "1.0.0",
  name: "SubAI Vietnamese (Gemini)",
  description:
    "Tự dịch phụ đề sang tiếng Việt bằng AI (Google Gemini). Lấy sub gốc từ OpenSubtitles v3, dịch on-the-fly. Tự dò model Gemini còn khả dụng (không hardcode) + xoay vòng nhiều API key.",
  resources: ["subtitles"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [],
  behaviorHints: { configurable: false },
};

const builder = new addonBuilder(manifest);

// Deferred: trả URL .vtt của chính addon NGAY (không dịch ở đây) -> Stremio không timeout.
// Việc dịch xảy ra khi player tải file .vtt (route /sub/... trong server.js).
builder.defineSubtitlesHandler(async ({ type, id, extra }) => {
  const base = getBaseUrl(process.env.PORT || 7700);
  const qs = [];
  if (extra?.videoHash) qs.push(`videoHash=${encodeURIComponent(extra.videoHash)}`);
  if (extra?.videoSize) qs.push(`videoSize=${encodeURIComponent(extra.videoSize)}`);
  const query = qs.length ? `?${qs.join("&")}` : "";

  // id: "tt123" (movie) hoặc "tt123:1:2" (series) -> nhét vào path an toàn
  const encId = encodeURIComponent(id);
  const url = `${base}/sub/${type}/${encId}/vi.vtt${query}`;

  return {
    subtitles: [{ id: "subai-vi", url, lang: "vie" }],
    // cache list 1 ngày phía Stremio
    cacheMaxAge: 24 * 60 * 60,
  };
});

export default builder.getInterface();
