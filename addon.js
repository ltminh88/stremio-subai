import sdk from "stremio-addon-sdk";
import { getBaseUrl } from "./lib/config.js";
import { listBaseSubs } from "./lib/sources/opensubtitles-base.js";

const { addonBuilder } = sdk;

const manifest = {
  id: "community.subai.vi",
  version: "1.1.0",
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

const MAX_VARIANTS = 3; // số bản Tiếng Việt đưa ra, mỗi bản ứng với 1 bản sub gốc

// Deferred: chỉ trả URL .vtt (chưa dịch) -> Stremio không timeout, bản nào chưa bấm thì chưa tốn quota.
// Mỗi bản Tiếng Việt dịch từ 1 bản sub gốc khác nhau, xếp theo độ khớp với bản phim đang xem
// (giống cách Stremio liệt kê nhiều bản English) -> lệch thì đổi sang bản kế.
builder.defineSubtitlesHandler(async ({ type, id, extra }) => {
  const base = getBaseUrl(process.env.PORT || 7700);
  const qs = ["videoHash", "videoSize", "filename"]
    .filter((k) => extra?.[k])
    .map((k) => `${k}=${encodeURIComponent(extra[k])}`);
  const query = qs.length ? `?${qs.join("&")}` : "";
  const encId = encodeURIComponent(id); // "tt123" hoặc "tt123:1:2"

  let baseIds = ["auto"];
  try {
    const subs = await listBaseSubs(type, id, extra || {});
    if (subs.length) baseIds = subs.slice(0, MAX_VARIANTS).map((s) => s.id);
  } catch (err) {
    console.warn("listBaseSubs lỗi, dùng auto:", err.message);
  }

  return {
    subtitles: baseIds.map((bid, i) => ({
      id: `subai-vi-${i + 1}`,
      url: `${base}/sub/${type}/${encId}/${encodeURIComponent(bid)}/vi.vtt${query}`,
      lang: "vie",
    })),
    cacheMaxAge: 6 * 60 * 60,
  };
});

export default builder.getInterface();
