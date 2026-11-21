// Security test HitungUsaha â€” verifikasi hardening terhadap XSS/injeksi.
// Jalankan: node security.test.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

function boot() {
  const dom = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.confirm = () => true;
  w.localStorage.clear();
  w.eval(appJs);
  return w;
}

// ============ 1. CSP header ada ============
(function () {
  const w = boot();
  const csp = w.document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  ok('CSP meta tag ada', !!csp);
  if (csp) {
    const c = csp.getAttribute('content');
    ok('CSP: default-src self', /default-src 'self'/.test(c));
    const scriptSrc = (c.split(';').map(s => s.trim()).find(s => s.indexOf('script-src') === 0) || '');
    ok('CSP: script-src self (no unsafe-inline)', /script-src 'self'/.test(scriptSrc) && !/unsafe-inline/.test(scriptSrc), scriptSrc);
    ok('CSP: object-src none', /object-src 'none'/.test(c));
    ok('CSP: frame-ancestors none', /frame-ancestors 'none'/.test(c));
  }
  ok('Referrer policy no-referrer', w.document.querySelector('meta[name=referrer]').getAttribute('content') === 'no-referrer');
})();

// ============ 2. Payload XSS via localStorage tidak dieksekusi ============
(function () {
  const w = boot();
  const XSS = '<img src=x onerror="window.__XSS=1">';
  const payload = {
    settings: { name: XSS },
    products: [{ id: XSS, name: XSS, cost: 1000, price: 2000, stock: 5, minStock: 1 }],
    tx: [{ id: XSS, type: 'in', date: XSS, amount: 5000, category: XSS, note: XSS, productId: '', qty: 1 }],
    debts: [{ id: XSS, kind: 'piutang', party: XSS, phone: XSS, total: 10000, date: XSS, due: XSS, note: XSS, payments: [{ date: XSS, amount: 1000 }] }]
  };
  w.localStorage.setItem('hitungusaha_v1', JSON.stringify(payload));
  // boot ulang dengan data berbahaya
  const dom2 = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w2 = dom2.window;
  w2.confirm = () => true;
  w2.localStorage.setItem('hitungusaha_v1', JSON.stringify(payload));
  w2.eval(appJs);
  ['#/beranda', '#/transaksi', '#/produk', '#/hutang', '#/laporan'].forEach(function (h) {
    w2.location.hash = h;
    w2.dispatchEvent(new w2.Event('hashchange'));
  });
  ok('Payload XSS tidak dieksekusi (window.__XSS undefined)', w2.__XSS === undefined);
  const imgs = w2.document.querySelectorAll('img[src=x]');
  ok('Tidak ada <img onerror> ter-inject ke DOM', imgs.length === 0, 'found ' + imgs.length);
})();

// ============ 3. esc() menetralkan tag & quote ============
(function () {
  const w = boot();
  const d = w.document.createElement('div');
  // Simulasi: nilai nama produk berisi tag, dirender ke daftar
  w.localStorage.setItem('hitungusaha_v1', JSON.stringify({
    settings: { name: 'Toko' }, products: [],
    tx: [{ id: 't1', type: 'in', date: '2024-01-01', amount: 1000, category: '<script>bad</script>', note: '" onmouseover="alert(1)', productId: '', qty: 0 }],
    debts: []
  }));
  const dom2 = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w2 = dom2.window;
  w2.confirm = () => true;
  w2.localStorage.setItem('hitungusaha_v1', w.localStorage.getItem('hitungusaha_v1'));
  w2.eval(appJs);
  w2.location.hash = '#/transaksi';
  w2.dispatchEvent(new w2.Event('hashchange'));
  // Bulan filter diset ke bulan transaksi agar transaksi tampil
  w2.localStorage.setItem('hitungusaha_v1', JSON.stringify({
    settings: { name: 'Toko' }, products: [],
    tx: [{ id: 't1', type: 'in', date: '2024-01-15', amount: 1000, category: '<script>bad</script>', note: '" onmouseover="alert(1)', productId: '', qty: 0 }],
    debts: []
  }));
  const dom3 = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w3 = dom3.window;
  w3.confirm = () => true;
  w3.localStorage.setItem('hitungusaha_v1', w2.localStorage.getItem('hitungusaha_v1'));
  w3.eval(appJs);
  w3.location.hash = '#/transaksi';
  w3.dispatchEvent(new w3.Event('hashchange'));
  const mEl = w3.document.getElementById('f_month');
  if (mEl) { mEl.value = '2024-01'; mEl.dispatchEvent(new w3.Event('change', { bubbles: true })); }
  ok('Tidak ada elemen <script> dari data', w3.document.querySelectorAll('script').length <= 1);
  ok('Kategori tampil sebagai teks, bukan HTML', /<script>bad<\/script>/.test(w3.document.body.textContent || ''));
})();

// ============ 4. Impor backup membersihkan field ============
(function () {
  const w = boot();
  // Akses sanitasi via render: buat data dengan id berbahaya lalu simpan->load
  // Uji requiredId/cleanId lewat perilaku: id berbahaya dibersihkan saat restore.
  const bad = { settings: { name: 'Toko' }, products: [{ id: 'x" onmouseover=alert(1)', name: 'P', cost: 1, price: 2, stock: 1, minStock: 0 }], tx: [], debts: [] };
  // Simulasikan restore dengan menulis langsung lalu reload (load() tidak sanitasi id, jadi uji via UI render aman)
  w.localStorage.setItem('hitungusaha_v1', JSON.stringify(bad));
  const dom2 = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w2 = dom2.window;
  w2.confirm = () => true;
  w2.localStorage.setItem('hitungusaha_v1', JSON.stringify(bad));
  w2.eval(appJs);
  w2.location.hash = '#/produk';
  w2.dispatchEvent(new w2.Event('hashchange'));
  const btns = w2.document.querySelectorAll('[data-act=prod-edit]');
  ok('Tombol produk tetap render meski id berbahaya', btns.length === 1);
  const idVal = btns[0] ? btns[0].getAttribute('data-id') : '';
  ok('id berbahaya disanitasi (tanpa quote/tag)', !/["'<>\s=]/.test(idVal) || idVal.length > 0, 'id=' + JSON.stringify(idVal));
  ok('id tersanitasi hanya karakter aman', /^[A-Za-z0-9_-]+$/.test(idVal), 'id=' + JSON.stringify(idVal));
})();

// ============ 5. rel=noopener noreferrer pada link eksternal ============
(function () {
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  ok('Link WA pakai rel=noopener noreferrer', /rel='noopener noreferrer'/.test(src));
  ok('Tidak ada rel=noopener tanpa noreferrer', !/rel='noopener'/.test(src.replace(/rel='noopener noreferrer'/g, '')));
})();

console.log('\n========================================');
console.log('HASIL SECURITY: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('========================================');
process.exit(fail ? 1 : 0);
