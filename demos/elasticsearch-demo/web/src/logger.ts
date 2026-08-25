// Gửi log frontend về backend (path same-origin "/api/frontend-logs"), backend
// ghi thẳng vào Elasticsearch bằng client/API key đã có sẵn — browser không
// cần biết gì về Elasticsearch. Xem log trong Kibana Discover trên index
// "demo_frontend_logs".

type LogLevel = "error" | "warn" | "info";

function send(level: LogLevel, message: string, stack?: string) {
  const body = JSON.stringify({
    level,
    message,
    url: window.location.href,
    stack,
    user_agent: navigator.userAgent,
  });

  // sendBeacon gửi được cả khi trang đang unload (vd: lỗi xảy ra ngay lúc user
  // đóng tab) — fetch thường bị trình duyệt huỷ giữa chừng trong tình huống đó.
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/frontend-logs", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/frontend-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  }
}

export function logError(message: string, error?: unknown) {
  send("error", message, error instanceof Error ? error.stack : undefined);
}

export function logInfo(message: string) {
  send("info", message);
}

/** Tự bắt lỗi JS chưa được catch (throw ngoài try/catch) và Promise reject
 * chưa được xử lý — 2 nguồn lỗi phổ biến nhất mà app không chủ động log. */
export function setupFrontendLogging() {
  window.addEventListener("error", (event) => {
    logError(event.message, event.error);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logError(reason instanceof Error ? reason.message : String(reason), reason);
  });
}
