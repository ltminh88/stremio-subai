import express from "express";
import sdk from "stremio-addon-sdk";
import addonInterface from "./addon.js";
import { getVietVtt } from "./lib/translator.js";
import { getKeys, getModel } from "./lib/config.js";
import { waitWithDeadline } from "./lib/wait-with-deadline.js";

// Stremio chỉ chờ ~10s khi tải phụ đề -> trả lời trước hạn đó
const VTT_DEADLINE_MS = 9000;
const PENDING_VTT =
  "WEBVTT\n\n00:00:00.000 --> 10:00:00.000\n⏳ Đang dịch phụ đề tiếng Việt... chọn lại phụ đề này sau ~30 giây\n";

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

// Route dịch: player tải file này khi user chọn 1 bản "Tiếng Việt".
// Toàn bộ latency dịch nằm ở đây (deferred), cache theo bản sub gốc nên mỗi bản chỉ dịch 1 lần.
async function serveVtt(req, res) {
  const { type, id } = req.params; // id đã được express giải mã (tt123:1:2)
  const baseId = req.params.baseId || "auto"; // URL cũ (v1.0) không có baseId
  const extra = {
    videoHash: req.query.videoHash,
    videoSize: req.query.videoSize,
    filename: req.query.filename,
  };
  try {
    const keys = getKeys();
    if (!keys.length) {
      res.status(500).type("text/plain").send("Chưa cấu hình GEMINI_API_KEYS");
      return;
    }
    const job = getVietVtt(type, id, extra, keys, getModel(), baseId);
    job.catch((err) => console.error("Dịch nền lỗi:", err.message)); // tránh unhandled rejection
    const result = await waitWithDeadline(job, VTT_DEADLINE_MS);
    const ua = (req.get("user-agent") || "?").slice(0, 80);
    if (!result.done) {
      // Chưa dịch xong: báo trạng thái, KHÔNG cho cache để lần chọn lại tải bản thật
      console.log(`[vtt] ${baseId} -> CHỜ (placeholder) | ua=${ua}`);
      res.setHeader("Cache-Control", "no-store");
      res.type("text/vtt").send(PENDING_VTT);
      return;
    }
    const vtt = result.value;
    if (!vtt) {
      // Không có sub gốc / dịch thất bại -> trả VTT rỗng hợp lệ (Stremio không lỗi)
      res.type("text/vtt").send("WEBVTT\n\n");
      return;
    }
    console.log(`[vtt] ${baseId} -> BẢN THẬT ${vtt.length}B | ua=${ua}`);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("text/vtt").send(vtt);
  } catch (err) {
    console.error("VTT route error:", err.message);
    res.type("text/vtt").send("WEBVTT\n\n");
  }
}
app.get("/sub/:type/:id/:baseId/vi.vtt", serveVtt);
app.get("/sub/:type/:id/vi.vtt", serveVtt); // tương thích URL cũ Stremio còn cache

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
