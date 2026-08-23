// Cấu hình từ biến môi trường (Render). KHÔNG hardcode key/model trong code.

// Nhiều key phân tách bằng dấu phẩy/xuống dòng -> mảng, để xoay vòng khi hết quota.
export function getKeys() {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return raw
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

// "auto" = tự dò model còn mở qua ListModels; hoặc chỉ định tên model cụ thể.
export function getModel() {
  return (process.env.MODEL || "auto").trim();
}

// URL công khai của addon (Render tự cấp RENDER_EXTERNAL_URL). Dùng dựng link .vtt.
export function getBaseUrl(port) {
  return (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BASE_URL ||
    `http://127.0.0.1:${port}`
  ).replace(/\/$/, "");
}
