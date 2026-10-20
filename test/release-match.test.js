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

test("sub 25 fps (PAL) xếp sau sub 23.976 fps", () => {
  const two = [
    { id: "pal", m: "i", fpsMilli: 25000, subtitleFileName: "Movie.1999.BluRay-X.srt" },
    { id: "film", m: "i", fpsMilli: 23976, subtitleFileName: "Movie.1999.BluRay-X.srt" },
  ];
  assert.equal(rankSubs(two, "Movie.1999.1080p.BluRay.x264-Y.mkv")[0].id, "film");
});

// Dữ liệu thật Interstellar (tt0816692): sub Anh chỉ có bản quay rạp/screener 25 fps
const interstellar = [
  { id: "en-ts", lang: "eng", m: "i", fpsMilli: 25000, subtitleFileName: "Interstellar.2014.TS.XViD.AC3.MrSeeN-SiMPLE.srt" },
  { id: "en-scr", lang: "eng", m: "i", fpsMilli: 25000, subtitleFileName: "Interstellar.2014.DVDSCR.XviD-EVO.srt" },
  { id: "hu-bd", lang: "hun", m: "i", fpsMilli: 23976, subtitleFileName: "Interstellar.2014.2014.1080p.BluRay.x264.YIFY.srt" },
];

test("sub Anh toàn bản quay rạp -> chọn bản BluRay thứ tiếng khác", () => {
  assert.equal(rankSubs(interstellar, "Interstellar.2014.1080p.BluRay.x264-SPARKS.mkv")[0].id, "hu-bd");
});

test("cùng chất lượng thì tiếng Anh vẫn được ưu tiên", () => {
  const two = [
    { id: "hu", lang: "hun", m: "i", subtitleFileName: "Movie.2020.BluRay-AAA.srt" },
    { id: "en", lang: "eng", m: "i", subtitleFileName: "Movie.2020.BluRay-AAA.srt" },
  ];
  assert.equal(rankSubs(two, "Movie.2020.1080p.BluRay-AAA.mkv")[0].id, "en");
});

test("screener DVDSCR xếp sau bản chính thức", () => {
  assert.equal(sourceFamily("Interstellar.2014.DVDSCR.XviD-EVO.srt"), "screener");
});

test("sub chia đĩa CD1/CD2 và file không phải .srt bị xếp sau", () => {
  const subs = [
    { id: "cd1", lang: "eng", m: "i", fpsMilli: 23976, subtitleFileName: "Sixth Sense CD1.sub" },
    { id: "part", lang: "eng", m: "i", subtitleFileName: "Movie.1999.Part.1.of.2.srt" },
    { id: "full", lang: "eng", m: "i", subtitleFileName: "The Sixth Sense (ENG).srt" },
  ];
  assert.equal(rankSubs(subs, "The Sixth Sense 1999 BluRay 1080p x265-SM737.mkv")[0].id, "full");
});
