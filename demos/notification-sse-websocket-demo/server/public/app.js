const $ = (id) => document.getElementById(id);

let eventSource = null;
let socket = null;
let wsReconnectAttempt = 0;
let wsReconnectTimer = null;
let wsClosedByUser = false;

fetch('/api/instance')
  .then((r) => r.json())
  .then(({ instanceId }) => {
    $('instanceBadge').textContent = `Trang này đang phục vụ bởi server instance: ${instanceId}`;
  })
  .catch(() => {
    $('instanceBadge').textContent = 'Không lấy được thông tin instance';
  });

function currentUserId() {
  return $('userId').value.trim() || 'anonymous';
}

function appendEntry(logEl, { title, message, badge, createdAt, latencyMs, system, replayed }) {
  const el = document.createElement('div');
  el.className = 'entry' + (system ? ' system' : '');

  const top = document.createElement('div');
  top.textContent = system ? message : `${replayed ? '📥 ' : ''}${badgeIcon(badge)} ${title}`;
  el.appendChild(top);

  if (!system) {
    const body = document.createElement('div');
    body.textContent = message;
    body.style.color = '#cbd5e1';
    body.style.marginTop = '2px';
    el.appendChild(body);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = createdAt ? new Date(createdAt).toLocaleTimeString() : '';
    const latencyLabel = latencyMs == null
      ? ''
      : replayed
        ? `trễ ${(latencyMs / 1000).toFixed(1)}s — gửi lại từ inbox`
        : `latency: ${latencyMs}ms`;
    meta.innerHTML = `<span>${time}</span><span>${latencyLabel}</span>`;
    el.appendChild(meta);
  }

  logEl.appendChild(el);
  while (logEl.children.length > 50) logEl.removeChild(logEl.firstChild);
}

function badgeIcon(type) {
  return { info: 'ℹ️', success: '✅', warning: '⚠️', error: '⛔' }[type] || '🔔';
}

function setStatus(kind, connected) {
  $(`${kind}Status`).textContent = connected ? 'connected' : 'disconnected';
  $(`${kind}Dot`).classList.toggle('on', connected);
}

// ---------------- SSE ----------------

function connectSSE() {
  disconnectSSE();
  const userId = currentUserId();
  eventSource = new EventSource(`/sse/notifications?userId=${encodeURIComponent(userId)}`);

  eventSource.onopen = () => {
    setStatus('sse', true);
    appendEntry($('sseLog'), { system: true, message: `Đã kết nối SSE (userId=${userId})` });
  };

  eventSource.addEventListener('notification', (evt) => {
    const data = JSON.parse(evt.data);
    const latencyMs = Date.now() - new Date(data.createdAt).getTime();
    appendEntry($('sseLog'), { ...data, badge: data.type, latencyMs });
  });

  eventSource.onerror = () => {
    setStatus('sse', false);
    appendEntry($('sseLog'), { system: true, message: 'Mất kết nối — EventSource sẽ tự reconnect...' });
  };
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  setStatus('sse', false);
}

// ---------------- WebSocket ----------------

function connectWS() {
  disconnectWS();
  wsClosedByUser = false;
  wsReconnectAttempt = 0;
  openWS();
}

function openWS() {
  const userId = currentUserId();
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws/notifications?userId=${encodeURIComponent(userId)}`);
  socket = ws;

  ws.onopen = () => {
    wsReconnectAttempt = 0;
    setStatus('ws', true);
  };

  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data);
    if (data.event === 'welcome') {
      appendEntry($('wsLog'), { system: true, message: data.message });
      return;
    }
    if (data.event === 'notification') {
      const n = data.notification;
      const latencyMs = Date.now() - new Date(n.createdAt).getTime();
      appendEntry($('wsLog'), { ...n, badge: n.type, latencyMs });
    }
  };

  ws.onclose = () => {
    // socket cu (da bi thay bang mot ket noi moi hon, vd sau khi doi userId)
    // thi bo qua, tranh log "reconnect" ao va mo 2 ket noi song song
    if (ws !== socket) return;
    setStatus('ws', false);
    if (wsClosedByUser) return;
    wsReconnectAttempt += 1;
    const delay = Math.min(1000 * 2 ** wsReconnectAttempt, 10000);
    appendEntry($('wsLog'), { system: true, message: `Mất kết nối — reconnect sau ${delay}ms (lần ${wsReconnectAttempt})` });
    wsReconnectTimer = setTimeout(openWS, delay);
  };

  ws.onerror = () => {
    ws.close();
  };
}

function disconnectWS() {
  wsClosedByUser = true;
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  if (socket) {
    socket.close();
    socket = null;
  }
  setStatus('ws', false);
}

// ---------------- UI wiring ----------------

$('connectBtn').addEventListener('click', () => {
  connectSSE();
  connectWS();
});

$('disconnectBtn').addEventListener('click', () => {
  disconnectSSE();
  disconnectWS();
});

$('sendBtn').addEventListener('click', async () => {
  const body = {
    userId: currentUserId(),
    title: $('title').value || 'Notification',
    message: $('message').value || '',
    type: $('type').value,
  };
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
});

// auto-connect khi mở trang cho tiện demo
connectSSE();
connectWS();
