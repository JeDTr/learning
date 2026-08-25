const $ = (id) => document.getElementById(id);

let ws = null;
let wsReconnectTimer = null;
let wsReconnectAttempt = 0;
let wsClosedByUser = false;
let typingHideTimer = null;
let users = [];

fetch('/api/instance')
  .then((r) => r.json())
  .then(({ instanceId, variant }) => {
    $('instanceBadge').textContent = `instance: ${instanceId} · variant: ${variant}`;
  })
  .catch(() => {
    $('instanceBadge').textContent = 'không lấy được thông tin instance';
  });

async function loadUsers() {
  users = await fetch('/api/users').then((r) => r.json());
  $('youAre').innerHTML = users.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');
  refreshChatWithOptions();
}

function refreshChatWithOptions() {
  const you = $('youAre').value;
  const prev = $('chatWith').value;
  const options = users.filter((u) => u.id !== you);
  $('chatWith').innerHTML = options.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');
  if (options.some((u) => u.id === prev)) $('chatWith').value = prev;
}

function bubble(msg, mine) {
  const el = document.createElement('div');
  el.className = 'bubble ' + (mine ? 'mine' : 'theirs');

  const body = document.createElement('div');
  body.textContent = msg.body;
  el.appendChild(body);

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = new Date(msg.createdAt).toLocaleTimeString();
  el.appendChild(time);

  $('messages').appendChild(el);
  $('messages').scrollTop = $('messages').scrollHeight;
}

function currentConversationId() {
  return [$('youAre').value, $('chatWith').value].sort().join(':');
}

async function loadHistory() {
  $('messages').innerHTML = '';
  const me = $('youAre').value;
  const withUser = $('chatWith').value;
  if (!withUser) return;
  const history = await fetch(`/api/messages?me=${encodeURIComponent(me)}&with=${encodeURIComponent(withUser)}`).then((r) => r.json());
  for (const m of history) bubble(m, m.senderId === me);
}

function setPresence(online) {
  $('peerDot').classList.toggle('on', online);
  $('peerStatus').textContent = online ? 'đang hoạt động' : 'offline';
}

async function refreshPresenceDot() {
  const withUser = $('chatWith').value;
  if (!withUser) return;
  const { online } = await fetch(`/api/presence?userId=${encodeURIComponent(withUser)}`).then((r) => r.json());
  setPresence(online);
}

function showTyping() {
  $('typingIndicator').style.visibility = 'visible';
  clearTimeout(typingHideTimer);
  typingHideTimer = setTimeout(() => {
    $('typingIndicator').style.visibility = 'hidden';
  }, 2000);
}

function connectWS() {
  disconnectWS();
  wsClosedByUser = false;
  wsReconnectAttempt = 0;
  openWS();
}

function openWS() {
  const me = $('youAre').value;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${location.host}/ws/chat?userId=${encodeURIComponent(me)}`);
  ws = socket;

  socket.onopen = () => {
    wsReconnectAttempt = 0;
    $('wsStatus').textContent = 'connected';
  };

  socket.onmessage = (evt) => {
    const data = JSON.parse(evt.data);
    if (data.event === 'welcome') return;

    if (data.event === 'message') {
      const me2 = $('youAre').value;
      if (data.message.conversationId === currentConversationId()) {
        bubble(data.message, data.message.senderId === me2);
      }
      return;
    }
    if (data.event === 'typing') {
      if (data.from === $('chatWith').value) showTyping();
      return;
    }
    if (data.event === 'presence') {
      if (data.userId === $('chatWith').value) setPresence(data.online);
    }
  };

  socket.onclose = () => {
    if (socket !== ws) return;
    $('wsStatus').textContent = 'disconnected';
    if (wsClosedByUser) return;
    wsReconnectAttempt += 1;
    const delay = Math.min(1000 * 2 ** wsReconnectAttempt, 10000);
    wsReconnectTimer = setTimeout(openWS, delay);
  };

  socket.onerror = () => socket.close();
}

function disconnectWS() {
  wsClosedByUser = true;
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  if (ws) {
    ws.close();
    ws = null;
  }
  $('wsStatus').textContent = 'disconnected';
}

async function sendMessage() {
  const body = $('messageInput').value.trim();
  if (!body) return;
  const me = $('youAre').value;
  const to = $('chatWith').value;
  $('messageInput').value = '';
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ me, to, body }),
  });
  const msg = await res.json();
  bubble(msg, true);
}

$('youAre').addEventListener('change', async () => {
  refreshChatWithOptions();
  connectWS();
  await loadHistory();
  refreshPresenceDot();
});

$('chatWith').addEventListener('change', async () => {
  await loadHistory();
  refreshPresenceDot();
});

$('messageInput').addEventListener('input', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const to = $('chatWith').value;
  if (!to) return;
  ws.send(JSON.stringify({ type: 'typing', to }));
});

$('sendBtn').addEventListener('click', sendMessage);
$('messageInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

(async function init() {
  await loadUsers();
  connectWS();
  await loadHistory();
  refreshPresenceDot();
  setInterval(refreshPresenceDot, 5000);
})();
