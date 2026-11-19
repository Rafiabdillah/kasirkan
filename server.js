// Jelajah Nusantara - server co-op 2 pemain (tanpa dependency, hanya Node.js)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const STAGES = require('./stages');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_HEARTS = 3;
const rooms = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function rid(n) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function newRoom() {
  let code;
  do { code = rid(4); } while (rooms.has(code));
  const room = {
    code,
    players: {},          // slot -> { id, name }
    clients: {},          // slot -> res (SSE)
    stage: 0,
    hearts: MAX_HEARTS,
    picks: { 1: null, 2: null },
    status: 'waiting',    // waiting | playing | won | lost
    lastResult: null,
    chat: [],
    created: Date.now()
  };
  rooms.set(code, room);
  return room;
}

function slotOf(room, pid) {
  for (const s of [1, 2]) if (room.players[s] && room.players[s].id === pid) return s;
  return null;
}

function viewFor(room, slot) {
  const other = slot === 1 ? 2 : 1;
  const st = STAGES[Math.min(room.stage, STAGES.length - 1)];
  const playing = room.status === 'playing';
  return {
    code: room.code,
    slot,
    status: room.status,
    stageIndex: room.stage,
    total: STAGES.length,
    hearts: room.hearts,
    maxHearts: MAX_HEARTS,
    myName: room.players[slot] ? room.players[slot].name : '',
    partnerName: room.players[other] ? room.players[other].name : '',
    partnerJoined: !!room.players[other],
    partnerOnline: !!room.clients[other],
    myPick: room.picks[slot],
    partnerPicked: room.picks[other] !== null,
    lastResult: room.lastResult,
    chat: room.chat.slice(-60),
    stage: playing ? {
      pulau: st.pulau,
      nama: st.nama,
      intro: st.intro,
      peran: st.peran[slot],
      clue: st.clue[slot],
      pertanyaan: st.pertanyaan,
      opsi: st.opsi
    } : null
  };
}

function push(room) {
  for (const s of [1, 2]) {
    const res = room.clients[s];
    if (res) {
      res.write('data: ' + JSON.stringify(viewFor(room, s)) + '\n\n');
    }
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
    });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function cleanName(n, fallback) {
  const s = String(n || '').trim().slice(0, 16);
  return s || fallback;
}

function resolvePicks(room) {
  if (room.picks[1] === null || room.picks[2] === null) return;
  const st = STAGES[room.stage];
  const a = room.picks[1];
  const b = room.picks[2];
  if (a !== b) {
    room.lastResult = {
      ok: false,
      kind: 'beda',
      text: 'Pilihan kalian berbeda. Diskusikan dulu petunjuk masing-masing, lalu pilih lagi.'
    };
    room.picks = { 1: null, 2: null };
    return;
  }
  if (a === st.jawaban) {
    room.lastResult = {
      ok: true,
      kind: 'benar',
      text: 'Benar! Artefak ditemukan.',
      artefak: st.artefak,
      fakta: st.fakta
    };
    room.picks = { 1: null, 2: null };
    room.stage += 1;
    if (room.stage >= STAGES.length) room.status = 'won';
  } else {
    room.hearts -= 1;
    room.lastResult = {
      ok: false,
      kind: 'salah',
      text: 'Kompak, tapi salah. Nyawa berkurang satu. Baca ulang petunjuk kalian.'
    };
    room.picks = { 1: null, 2: null };
    if (room.hearts <= 0) room.status = 'lost';
  }
}

async function api(req, res, url) {
  const p = url.pathname;

  if (p === '/api/events' && req.method === 'GET') {
    const room = rooms.get((url.searchParams.get('room') || '').toUpperCase());
    const pid = url.searchParams.get('pid');
    if (!room) return json(res, 404, { error: 'Ruangan tidak ditemukan' });
    const slot = slotOf(room, pid);
    if (!slot) return json(res, 403, { error: 'Pemain tidak dikenal' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 2000\n\n');
    if (room.clients[slot]) { try { room.clients[slot].end(); } catch (e) {} }
    room.clients[slot] = res;
    push(room);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 20000);
    req.on('close', () => {
      clearInterval(ping);
      if (room.clients[slot] === res) {
        delete room.clients[slot];
        push(room);
      }
    });
    return;
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak didukung' });
  const body = await readBody(req);

  if (p === '/api/create') {
    const room = newRoom();
    const pid = rid(16);
    room.players[1] = { id: pid, name: cleanName(body.name, 'Pemain 1') };
    return json(res, 200, { room: room.code, pid, slot: 1 });
  }

  if (p === '/api/join') {
    const room = rooms.get(String(body.room || '').toUpperCase());
    if (!room) return json(res, 404, { error: 'Kode ruangan tidak ditemukan' });
    if (room.players[2]) return json(res, 409, { error: 'Ruangan sudah penuh' });
    const pid = rid(16);
    room.players[2] = { id: pid, name: cleanName(body.name, 'Pemain 2') };
    room.status = 'playing';
    room.lastResult = null;
    push(room);
    return json(res, 200, { room: room.code, pid, slot: 2 });
  }

  const room = rooms.get(String(body.room || '').toUpperCase());
  if (!room) return json(res, 404, { error: 'Ruangan tidak ditemukan' });
  const slot = slotOf(room, body.pid);
  if (!slot) return json(res, 403, { error: 'Pemain tidak dikenal' });

  if (p === '/api/pick') {
    if (room.status !== 'playing') return json(res, 400, { error: 'Game belum berjalan' });
    const st = STAGES[room.stage];
    const choice = Number(body.choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= st.opsi.length) {
      return json(res, 400, { error: 'Pilihan tidak valid' });
    }
    room.picks[slot] = choice;
    resolvePicks(room);
    push(room);
    return json(res, 200, { ok: true });
  }

  if (p === '/api/unpick') {
    if (room.status === 'playing') {
      room.picks[slot] = null;
      push(room);
    }
    return json(res, 200, { ok: true });
  }

  if (p === '/api/chat') {
    const text = String(body.text || '').trim().slice(0, 200);
    if (text) {
      room.chat.push({ slot, name: room.players[slot].name, text, t: Date.now() });
      if (room.chat.length > 200) room.chat.shift();
      push(room);
    }
    return json(res, 200, { ok: true });
  }

  if (p === '/api/restart') {
    room.stage = 0;
    room.hearts = MAX_HEARTS;
    room.picks = { 1: null, 2: null };
    room.lastResult = null;
    room.status = room.players[2] ? 'playing' : 'waiting';
    push(room);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'Endpoint tidak ada' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Tidak ditemukan');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch(() => json(res, 500, { error: 'Kesalahan server' }));
  } else {
    serveStatic(req, res, url);
  }
});

// Bersihkan ruangan yang sudah lama tidak dipakai (3 jam)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.created > 3 * 60 * 60 * 1000 && !room.clients[1] && !room.clients[2]) rooms.delete(code);
  }
}, 10 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nJelajah Nusantara berjalan!');
  console.log('Di laptop ini : http://localhost:' + PORT);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) {
        console.log('Dari HP (satu WiFi): http://' + n.address + ':' + PORT);
      }
    }
  }
  console.log('');
});
