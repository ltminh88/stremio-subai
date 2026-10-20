// Xếp hạng sub gốc theo độ khớp với BẢN PHIM đang xem (tên file Stremio gửi kèm).
// Lý do: cùng 1 phim nhưng bản BluRay / WEB / quay rạp (CAM, HDTC) có mốc thời gian khác nhau,
// lấy nhầm bản sub là phụ đề lệch cả phim.

const FAMILIES = [
  ["cam", /\b(cam|hdcam|camrip|hdtc|tc|telecine|ts|hdts|telesync)\b/],
  ["bluray", /\b(bluray|blu ray|bdrip|brrip|bdremux|remux|bd)\b/],
  ["web", /\b(web dl|webdl|webrip|web)\b/],
  ["hdtv", /\b(hdtv|pdtv)\b/],
  ["dvd", /\b(dvdrip|dvd)\b/],
];

const norm = (s = "") =>
  s.toLowerCase().replace(/\.(srt|mkv|mp4|avi|sub)$/, "").replace(/[^a-z0-9]+/g, " ").trim();

// Loại nguồn phát hành: bluray / web / cam / ...
export function sourceFamily(name) {
  const n = norm(name);
  for (const [fam, re] of FAMILIES) if (re.test(n)) return fam;
  return null;
}

// Nhóm phát hành: phần sau dấu "-" cuối (bỏ hậu tố -HI / -SDH của sub)
export function releaseGroup(name = "") {
  const base = name.replace(/\.(srt|mkv|mp4|avi|sub)$/i, "").replace(/[-.](hi|sdh)$/i, "");
  const m = base.match(/-([A-Za-z0-9]+)(\[[^\]]*\])?$/);
  return m ? m[1].toLowerCase() : null;
}

// Sub dành cho người khiếm thính có mô tả âm thanh [cửa kêu] -> dịch ra thành rác
const isHearingImpaired = (name = "") => /[-.\s_](hi|sdh)(\.srt)?$/i.test(name);

function score(sub, filename) {
  const name = sub.subtitleFileName || "";
  let s = 0;
  if (sub.m === "h") s += 1000; // OpenSubtitles khớp đúng hash file -> chắc chắn đồng bộ
  const subFam = sourceFamily(name);
  const vidFam = filename ? sourceFamily(filename) : null;
  if (subFam === "cam" && vidFam !== "cam") s -= 60; // sub quay rạp lệch hẳn bản chính thức
  if (vidFam && subFam === vidFam) s += 40;
  const vg = filename && releaseGroup(filename);
  if (vg && releaseGroup(name) === vg) s += 30;
  if (isHearingImpaired(name)) s -= 5;
  return s;
}

// Trả danh sách mới đã sắp xếp (giữ thứ tự gốc khi bằng điểm)
export function rankSubs(subs, filename) {
  return subs
    .map((sub, i) => ({ sub, i, s: score(sub, filename) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.sub);
}
