const $ = (id) => document.getElementById(id);

let socket = null;
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

function connectSocket() {
  if (socket) socket.disconnect();
  const me = $('youAre').value;
  socket = io({ path: '/socket.io', query: { userId: me } });

  socket.on('connect', () => {
    $('wsStatus').textContent = 'connected';
  });
  socket.on('disconnect', () => {
    $('wsStatus').textContent = 'disconnected';
  });

  socket.on('chat:message', (message) => {
    const me2 = $('youAre').value;
    if (message.conversationId === currentConversationId()) {
      bubble(message, message.senderId === me2);
    }
  });

  socket.on('typing', ({ from }) => {
    if (from === $('chatWith').value) showTyping();
  });

  socket.on('presence', ({ userId, online }) => {
    if (userId === $('chatWith').value) setPresence(online);
  });
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
  connectSocket();
  await loadHistory();
  refreshPresenceDot();
});

$('chatWith').addEventListener('change', async () => {
  await loadHistory();
  refreshPresenceDot();
});

$('messageInput').addEventListener('input', () => {
  const to = $('chatWith').value;
  if (socket && to) socket.emit('typing', { to });
});

$('sendBtn').addEventListener('click', sendMessage);
$('messageInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

(async function init() {
  await loadUsers();
  connectSocket();
  await loadHistory();
  refreshPresenceDot();
  setInterval(refreshPresenceDot, 5000);
})();
