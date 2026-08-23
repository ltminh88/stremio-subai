import express from "express";
import sdk from "stremio-addon-sdk";
import addonInterface from "./addon.js";
import { getVietVtt } from "./lib/translator.js";
import { getKeys, getModel } from "./lib/config.js";

const { getRouter } = sdk;
const port = Number(process.env.PORT) || 7700;

const app = express();

// Log mọi request (chẩn đoán: xem Stremio có gọi /subtitles không)
app.use((req, _res, next) => {
  console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// CORS bắt buộc cho Stremio (route .vtt tự add vì không đi qua SDK router)
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Route dịch: player tải file này khi user chọn track "Vietnamese".
// Toàn bộ latency dịch nằm ở đây (deferred), có cache nên chỉ tốn 1 lần/phim.
app.get("/sub/:type/:id/vi.vtt", async (req, res) => {
  const { type, id } = req.params; // id đã được express giải mã (tt123:1:2)
  const extra = {
    videoHash: req.query.videoHash,
    videoSize: req.query.videoSize,
  };
  try {
    const keys = getKeys();
    if (!keys.length) {
      res.status(500).type("text/plain").send("Chưa cấu hình GEMINI_API_KEYS");
      return;
    }
    const vtt = await getVietVtt(type, id, extra, keys, getModel());
    if (!vtt) {
      // Không có sub gốc / dịch thất bại -> trả VTT rỗng hợp lệ (Stremio không lỗi)
      res.type("text/vtt").send("WEBVTT\n\n");
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("text/vtt").send(vtt);
  } catch (err) {
    console.error("VTT route error:", err.message);
    res.type("text/vtt").send("WEBVTT\n\n");
  }
});

// SDK router: /manifest.json + /subtitles/...
app.use(getRouter(addonInterface));

// Landing đơn giản
app.get("/", (_, res) => {
  res.type("text/html").send(
    `<h2>SubAI Vietnamese (Gemini)</h2><p>Cài vào Stremio: <code>/manifest.json</code></p>`
  );
});

app.listen(port, () => {
  console.log(`SubAI addon chạy tại http://127.0.0.1:${port}/manifest.json`);
  console.log(`Số Gemini key nạp: ${getKeys().length} | model: ${getModel()}`);
});
