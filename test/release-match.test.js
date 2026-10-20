import { test } from "node:test";
import assert from "node:assert/strict";
import { rankSubs, sourceFamily, releaseGroup } from "../lib/release-match.js";

// Dữ liệu thật từ OpenSubtitles v3 cho Spider-Man No Way Home (tt10872600)
const subs = [
  { id: "hdtc-hi", m: "i", subtitleFileName: "Spider.Man.No.Way.Home.2021.HDTC.850MB.c1nem4.x264-SUNSCREEN-HI.srt" },
  { id: "hdtc", m: "i", subtitleFileName: "Spider.Man.No.Way.Home.2021.HDTC.850MB.c1nem4.x264-SUNSCREEN.srt" },
  { id: "evo-hi", m: "i", subtitleFileName: "Spider-Man_No_Way_Home.2022.1080p.Bluray.DTS-HD.MA.5.1.X264-EVO-HI.srt" },
  { id: "evo", m: "i", subtitleFileName: "Spider-Man_No_Way_Home.2022.1080p.Bluray.DTS-HD.MA.5.1.X264-EVO.srt" },
];
const film = "Spider-Man.No.Way.Home.2021.2160p.4K.BluRay.x265.10bit.AAC5.1-LAMA.mkv";

test("bản BluRay đứng trước bản quay rạp HDTC", () => {
  assert.deepEqual(rankSubs(subs, film).map((s) => s.id), ["evo", "evo-hi", "hdtc", "hdtc-hi"]);
});

test("không có tên file vẫn đẩy bản quay rạp xuống cuối", () => {
  assert.deepEqual(rankSubs(subs, undefined).slice(0, 2).map((s) => s.id), ["evo", "evo-hi"]);
});

test("khớp hash luôn thắng", () => {
  const withHash = [...subs, { id: "hash", m: "h", subtitleFileName: "x.HDTC-ABC.srt" }];
  assert.equal(rankSubs(withHash, film)[0].id, "hash");
});

test("cùng nhóm phát hành được ưu tiên", () => {
  const two = [
    { id: "other", m: "i", subtitleFileName: "Movie.2024.1080p.WEB-DL-FLUX.srt" },
    { id: "same", m: "i", subtitleFileName: "Movie.2024.720p.WEBRip-YTS.srt" },
  ];
  assert.equal(rankSubs(two, "Movie.2024.1080p.WEBRip.x264-YTS.mp4")[0].id, "same");
});

test("nhận diện nguồn và nhóm", () => {
  assert.equal(sourceFamily(film), "bluray");
  assert.equal(sourceFamily("a.HDTC.x264.srt"), "cam");
  assert.equal(releaseGroup("x.X264-EVO-HI.srt"), "evo");
  assert.equal(releaseGroup(film), "lama");
});
