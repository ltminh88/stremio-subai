import { test } from "node:test";
import assert from "node:assert/strict";
import { waitWithDeadline } from "../lib/wait-with-deadline.js";

const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

test("xong trước hạn -> trả kết quả", async () => {
  assert.deepEqual(await waitWithDeadline(later(10, "vtt"), 200), { done: true, value: "vtt" });
});

test("quá hạn -> done=false, promise gốc vẫn chạy tiếp", async () => {
  const work = later(150, "vtt");
  assert.deepEqual(await waitWithDeadline(work, 20), { done: false });
  assert.equal(await work, "vtt");
});

test("lỗi trong hạn -> ném lỗi ra ngoài", async () => {
  await assert.rejects(waitWithDeadline(Promise.reject(new Error("boom")), 200), /boom/);
});
