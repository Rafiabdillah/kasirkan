// Jelajah Nusantara - klien (browser)
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var screens = ['lobby', 'waiting', 'play', 'end'];
  var session = null;      // { room, pid, slot, name }
  var es = null;           // EventSource
  var lastView = null;
  var collected = [];      // artefak yang sudah didapat (sisi klien)
  var lastChatCount = -1;

  function show(name) {
    screens.forEach(function (s) { $(s).hidden = (s !== name); });
  }

  function saveSession() {
    try { sessionStorage.setItem('jn_session', JSON.stringify(session)); } catch (e) {}
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem('jn_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearSession() {
    session = null;
    collected = [];
    lastChatCount = -1;
    try { sessionStorage.removeItem('jn_session'); } catch (e) {}
  }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || 'Terjadi kesalahan');
        return data;
      });
    });
  }

  function authBody(extra) {
    var b = { room: session.room, pid: session.pid };
    for (var k in extra) b[k] = extra[k];
    return b;
  }

  function lobbyError(msg) {
    var el = $('lobbyError');
    el.textContent = msg;
    el.hidden = !msg;
  }

  // ---------- Lobi ----------

  $('name').value = (function () {
    try { return localStorage.getItem('jn_name') || ''; } catch (e) { return ''; }
  })();

  function rememberName() {
    try { localStorage.setItem('jn_name', $('name').value.trim()); } catch (e) {}
  }

  $('btnCreate').addEventListener('click', function () {
    lobbyError('');
    rememberName();
    post('/api/create', { name: $('name').value }).then(function (d) {
      session = { room: d.room, pid: d.pid, slot: d.slot, name: $('name').value };
      saveSession();
      connect();
    }).catch(function (e) { lobbyError(e.message); });
  });

  $('btnJoin').addEventListener('click', function () {
    lobbyError('');
    rememberName();
    var code = $('code').value.trim().toUpperCase();
    if (code.length !== 4) { lobbyError('Kode ruangan terdiri dari 4 karakter.'); return; }
    post('/api/join', { room: code, name: $('name').value }).then(function (d) {
      session = { room: d.room, pid: d.pid, slot: d.slot, name: $('name').value };
      saveSession();
      connect();
    }).catch(function (e) { lobbyError(e.message); });
  });

  $('code').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  $('btnCopy').addEventListener('click', function () {
    var code = session ? session.room : '';
    var btn = this;
    function done() {
      btn.textContent = 'Tersalin!';
      setTimeout(function () { btn.textContent = 'Salin kode'; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      done();
    }
  });

  // ---------- Koneksi real-time ----------

  function connect() {
    if (es) { es.close(); es = null; }
    var url = '/api/events?room=' + encodeURIComponent(session.room) +
      '&pid=' + encodeURIComponent(session.pid);
    es = new EventSource(url);
    es.onmessage = function (ev) {
      $('conn').textContent = '';
      var view;
      try { view = JSON.parse(ev.data); } catch (e) { return; }
      render(view);
    };
    es.onerror = function () {
      $('conn').textContent = 'Koneksi terputus, mencoba menyambung lagi...';
      if (es && es.readyState === 2) {
        // server menolak (ruangan sudah hilang)
        es.close();
        es = null;
        clearSession();
        lobbyError('Ruangan sudah tidak ada. Buat ruangan baru atau gabung lagi.');
        show('lobby');
      }
    };
  }

  // ---------- Render ----------

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderHearts(v) {
    var box = $('hearts');
    clear(box);
    for (var i = 0; i < v.maxHearts; i++) {
      var h = document.createElement('span');
      h.className = 'heart' + (i < v.hearts ? '' : ' lost');
      box.appendChild(h);
    }
  }

  function renderResult(v) {
    var box = $('result');
    var r = v.lastResult;
    if (!r) { box.hidden = true; return; }
    clear(box);
    box.className = 'result ' + r.kind;
    var strong = document.createElement('strong');
    strong.textContent = r.text;
    box.appendChild(strong);
    if (r.artefak) {
      var a = document.createElement('span');
      a.textContent = 'Artefak didapat: ' + r.artefak;
      box.appendChild(a);
    }
    if (r.fakta) {
      var f = document.createElement('span');
      f.className = 'fakta';
      f.textContent = r.fakta;
      box.appendChild(f);
    }
    box.hidden = false;
  }

  function renderOptions(v) {
    var box = $('options');
    clear(box);
    v.stage.opsi.forEach(function (text, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt' + (v.myPick === i ? ' chosen' : '');
      b.textContent = text;
      b.addEventListener('click', function () {
        if (v.myPick === i) {
          post('/api/unpick', authBody({})).catch(function () {});
        } else {
          post('/api/pick', authBody({ choice: i })).catch(function (e) {
            $('conn').textContent = e.message;
          });
        }
      });
      box.appendChild(b);
    });

    var status = '';
    if (v.myPick !== null && !v.partnerPicked) {
      status = 'Pilihanmu terkunci. Menunggu ' + (v.partnerName || 'temanmu') + ' memilih. Tekan pilihan lagi untuk membatalkan.';
    } else if (v.myPick === null && v.partnerPicked) {
      status = (v.partnerName || 'Temanmu') + ' sudah memilih. Sekarang giliranmu.';
    } else if (v.myPick === null) {
      status = 'Kalian berdua harus memilih jawaban yang sama.';
    }
    $('pickStatus').textContent = status;
  }

  function renderChat(v) {
    var log = $('chatLog');
    if (v.chat.length === lastChatCount) return;
    lastChatCount = v.chat.length;
    clear(log);
    v.chat.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'msg ' + (m.slot === v.slot ? 'me' : 'them');
      var who = document.createElement('small');
      who.textContent = m.name;
      var txt = document.createElement('span');
      txt.textContent = m.text;
      d.appendChild(who);
      d.appendChild(txt);
      log.appendChild(d);
    });
    log.scrollTop = log.scrollHeight;
  }

  function trackCollection(v) {
    if (v.lastResult && v.lastResult.ok && v.lastResult.artefak) {
      if (collected.indexOf(v.lastResult.artefak) === -1) collected.push(v.lastResult.artefak);
    }
  }

  function renderEnd(v) {
    var won = v.status === 'won';
    $('endIcon').innerHTML = won ? '&#127942;' : '&#128547;';
    $('endTitle').textContent = won ? 'Misi Selesai!' : 'Perjalanan Berakhir';
    $('endText').textContent = won
      ? 'Kalian berhasil mengumpulkan semua artefak dan menyatukan Nusantara. Kerja sama yang hebat!'
      : 'Nyawa kalian habis. Tidak apa-apa, ulangi lagi dan ingat petunjuk tiap pulau.';

    var box = $('collection');
    clear(box);
    if (collected.length === 0) {
      var e = document.createElement('span');
      e.className = 'chip empty';
      e.textContent = 'Belum ada artefak tercatat';
      box.appendChild(e);
    }
    collected.forEach(function (name) {
      var c = document.createElement('span');
      c.className = 'chip';
      c.textContent = name;
      box.appendChild(c);
    });
  }

  function render(v) {
    lastView = v;
    if (session) { session.slot = v.slot; }
    trackCollection(v);

    if (v.status === 'waiting') {
      $('roomCode').textContent = v.code;
      show('waiting');
      return;
    }

    if (v.status === 'won' || v.status === 'lost') {
      renderEnd(v);
      show('end');
      return;
    }

    // playing
    var st = v.stage;
    $('stageLabel').textContent = 'Pulau ' + (v.stageIndex + 1) + '/' + v.total;
    $('barFill').style.width = Math.round((v.stageIndex / v.total) * 100) + '%';
    renderHearts(v);
    $('pulau').textContent = st.pulau;
    $('stageName').textContent = st.nama;
    $('intro').textContent = st.intro;
    $('role').textContent = 'Peranmu: ' + st.peran;
    $('clue').textContent = st.clue;
    $('question').textContent = st.pertanyaan;
    renderResult(v);
    renderOptions(v);
    renderChat(v);
    show('play');
  }

  // ---------- Chat dan restart ----------

  $('chatForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var input = $('chatInput');
    var text = input.value.trim();
    if (!text || !session) return;
    input.value = '';
    post('/api/chat', authBody({ text: text })).catch(function () {});
  });

  $('btnRestart').addEventListener('click', function () {
    if (!session) return;
    collected = [];
    lastChatCount = -1;
    post('/api/restart', authBody({})).catch(function () {});
  });

  // ---------- Mulai ----------

  var saved = loadSession();
  if (saved && saved.room && saved.pid) {
    session = saved;
    connect();
  } else {
    show('lobby');
  }
})();
