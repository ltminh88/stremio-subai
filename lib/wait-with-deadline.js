// Chờ promise tối đa `ms` mili-giây. Quá hạn thì trả { done: false } nhưng KHÔNG huỷ promise
// (việc dịch vẫn chạy tiếp ở nền và ghi vào cache cho lần tải sau).
export async function waitWithDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ done: false }), ms);
  });
  try {
    return await Promise.race([promise.then((value) => ({ done: true, value })), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
