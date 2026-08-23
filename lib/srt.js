// Parse/rebuild phụ đề. Giữ index + timestamp gốc, chỉ thay text (đã dịch).

// Chuẩn hóa timestamp: SRT dùng dấu phẩy (00:00:01,000), VTT dùng chấm.
function toVttTime(t) {
  return t.replace(",", ".").trim();
}

// Parse SRT -> [{ time: "start --> end", lines: [..] }]
export function parseSrt(srt) {
  const text = srt.replace(/\r+/g, "");
  const blocks = text.split(/\n\n+/);
  const cues = [];
  for (const block of blocks) {
    const rows = block.split("\n").filter((r) => r.length > 0);
    if (rows.length < 2) continue;
    // rows[0] = index (bỏ qua), rows[1] = timecode, còn lại = text
    const timeIdx = rows.findIndex((r) => r.includes("-->"));
    if (timeIdx === -1) continue;
    const time = rows[timeIdx];
    const lines = rows.slice(timeIdx + 1);
    if (lines.length === 0) continue;
    cues.push({ time, lines });
  }
  return cues;
}

// Text thuần của mỗi cue (nối nhiều dòng bằng khoảng trắng) -> để dịch
export function cueTexts(cues) {
  return cues.map((c) => c.lines.join(" "));
}

// Ghép text đã dịch trở lại cue theo index, xuất VTT
export function toVtt(cues, translated) {
  const out = ["WEBVTT", ""];
  cues.forEach((c, i) => {
    const [start, end] = c.time.split("-->");
    out.push(`${toVttTime(start)} --> ${toVttTime(end)}`);
    out.push(translated[i] != null ? translated[i] : c.lines.join("\n"));
    out.push("");
  });
  return out.join("\n");
}

// Chia cue thành các batch nhỏ để dịch (tránh vượt output token limit)
export function chunk(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}
