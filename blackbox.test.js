// Black-box test HitungUsaha â€” memuat index.html + app.js di jsdom,
// lalu mensimulasikan interaksi pengguna dan memverifikasi output DOM.
// Jalankan: node blackbox.test.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

function boot() {
  const dom = new JSDOM(html, {
    url: 'https://example.test/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.confirm = () => true;
  window.alert = () => {};
  // localStorage bersih per boot
  window.localStorage.clear();
  // Eksekusi app.js di dalam window
  window.eval(appJs);
  return window;
}

function $(w, id) { return w.document.getElementById(id); }
function click(w, el) { el.dispatchEvent(new w.Event('click', { bubbles: true })); }
function setVal(w, el, v) { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); }
function txt(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }

// ---------- 1. Boot & routing ----------
(function () {
  const w = boot();
  check('Aplikasi boot tanpa error', !!$(w, 'view'));
  check('Halaman default = Beranda', /Beranda/.test(txt($(w, 'pageTitle'))), txt($(w, 'pageTitle')));
  check('Tab Beranda aktif', w.document.querySelector('#tabbar a[data-tab=beranda]').classList.contains('active'));
  check('Empty-state sambutan tampil', /Selamat datang/.test(txt($(w, 'view'))));
})();

// ---------- 2. Navigasi via hash ----------
(function () {
  const w = boot();
  w.location.hash = '#/produk';
  w.dispatchEvent(new w.Event('hashchange'));
  check('Navigasi ke Produk', /Produk dan Stok/.test(txt($(w, 'pageTitle'))), txt($(w, 'pageTitle')));
  w.location.hash = '#/laporan';
  w.dispatchEvent(new w.Event('hashchange'));
  check('Navigasi ke Laporan', /Laporan/.test(txt($(w, 'pageTitle'))));
  w.location.hash = '#/tidakada';
  w.dispatchEvent(new w.Event('hashchange'));
  check('Route tidak dikenal -> fallback Beranda', /Beranda/.test(txt($(w, 'pageTitle'))));
})();

// ---------- 3. Tambah produk (happy path) ----------
(function () {
  const w = boot();
  w.location.hash = '#/produk'; w.dispatchEvent(new w.Event('hashchange'));
  const addBtn = w.document.querySelector('[data-act=prod-new]');
  click(w, addBtn);
  check('Modal tambah produk terbuka', !$(w, 'modal').hidden);
  setVal(w, $(w, 'p_name'), 'Paket Sayur');
  setVal(w, $(w, 'p_cost'), '8.000');   // uji parsing format Indonesia
  setVal(w, $(w, 'p_price'), '10.000');
  setVal(w, $(w, 'p_stock'), '20');
  setVal(w, $(w, 'p_min'), '5');
  click(w, w.document.querySelector('[data-act=prod-save]'));
  check('Modal tertutup setelah simpan', $(w, 'modal').hidden);
  const v = txt($(w, 'view'));
  check('Produk muncul di daftar', /Paket Sayur/.test(v));
  check('Harga modal 8.000 terbaca benar (bukan 8)', /Modal Rp 8\.000/.test(v), v.slice(0, 200));
  check('Margin 20% terhitung', /Margin 20%/.test(v), v.slice(0, 200));
  const db = JSON.parse(w.localStorage.getItem('hitungusaha_v1'));
  check('Tersimpan ke localStorage', db.products.length === 1 && db.products[0].cost === 8000 && db.products[0].price === 10000);
})();

// ---------- 4. Validasi form produk (negative) ----------
(function () {
  const w = boot();
  w.location.hash = '#/produk'; w.dispatchEvent(new w.Event('hashchange'));
  click(w, w.document.querySelector('[data-act=prod-new]'));
  setVal(w, $(w, 'p_name'), '   '); // nama kosong
  click(w, w.document.querySelector('[data-act=prod-save]'));
  check('Nama kosong ditolak (modal tetap terbuka)', !$(w, 'modal').hidden);
  const db = JSON.parse(w.localStorage.getItem('hitungusaha_v1') || '{"products":[]}');
  check('Tidak ada produk tersimpan saat invalid', db.products.length === 0);
})();

// ---------- 5. Catat transaksi pemasukan + efek stok ----------
(function () {
  const w = boot();
  // Seed produk lewat UI
  w.location.hash = '#/produk'; w.dispatchEvent(new w.Event('hashchange'));
  click(w, w.document.querySelector('[data-act=prod-new]'));
  setVal(w, $(w, 'p_name'), 'Kopi'); setVal(w, $(w, 'p_cost'), '3.000');
  setVal(w, $(w, 'p_price'), '5.000'); setVal(w, $(w, 'p_stock'), '10'); setVal(w, $(w, 'p_min'), '2');
  click(w, w.document.querySelector('[data-act=prod-save]'));
  const pid = JSON.parse(w.localStorage.getItem('hitungusaha_v1')).products[0].id;

  click(w, $(w, 'btnQuick')); // tombol + Catat
  check('Modal transaksi terbuka', !$(w, 'modal').hidden);
  const prodSel = $(w, 'f_prod');
  check('Dropdown produk tersedia', !!prodSel);
  prodSel.value = pid; prodSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  setVal(w, $(w, 'f_qty'), '2');
  setVal(w, $(w, 'f_amount'), '10.000');
  click(w, w.document.querySelector('[data-act=tx-save]'));
  check('Transaksi tersimpan (modal tutup)', $(w, 'modal').hidden);
  const db = JSON.parse(w.localStorage.getItem('hitungusaha_v1'));
  check('1 transaksi tercatat', db.tx.length === 1);
  check('Nominal 10.000 benar', db.tx[0].amount === 10000, String(db.tx[0].amount));
  check('Stok berkurang 10 -> 8', db.products[0].stock === 8, String(db.products[0].stock));
})();

// ---------- 6. Kalkulator HPP (pure compute via DOM) ----------
(function () {
  const w = boot();
  w.location.hash = '#/kalkulator'; w.dispatchEvent(new w.Event('hashchange'));
  setVal(w, $(w, 'c_bahan'), '60.000');
  setVal(w, $(w, 'c_tenaga'), '30.000');
  setVal(w, $(w, 'c_over'), '10.000');
  setVal(w, $(w, 'c_jumlah'), '10');
  setVal(w, $(w, 'c_margin'), '30');
  const out = txt($(w, 'calcOut'));
  check('HPP per unit = Rp 10.000', /HPP per unit\s*Rp 10\.000/.test(out), out);
  check('Harga jual sesuai margin muncul', /Harga jual sesuai margin/.test(out));
  check('HPP = total biaya / unit (100.000/10)', /HPP per unit\s*Rp 10\.000/.test(out) && /TotalbiayaRp100\.000/.test(out.replace(/\s+/g,'')), out.replace(/\s+/g,''));
})();

// ---------- 7. Piutang: catat + terima pembayaran ----------
(function () {
  const w = boot();
  w.location.hash = '#/hutang'; w.dispatchEvent(new w.Event('hashchange'));
  click(w, w.document.querySelector('[data-act=debt-new]'));
  setVal(w, $(w, 'd_kind'), 'piutang');
  setVal(w, $(w, 'd_party'), 'Bu Ani');
  setVal(w, $(w, 'd_total'), '50.000');
  click(w, w.document.querySelector('[data-act=debt-save]'));
  let db = JSON.parse(w.localStorage.getItem('hitungusaha_v1'));
  check('Piutang tercatat', db.debts.length === 1 && db.debts[0].total === 50000);

  // Terima pembayaran
  const payBtn = w.document.querySelector('[data-act=debt-pay]');
  check('Tombol Terima tersedia', !!payBtn);
  click(w, payBtn);
  setVal(w, $(w, 'y_amount'), '20.000');
  click(w, w.document.querySelector('[data-act=debt-paysave]'));
  db = JSON.parse(w.localStorage.getItem('hitungusaha_v1'));
  check('Pembayaran tercatat di payments', db.debts[0].payments.length === 1 && db.debts[0].payments[0].amount === 20000);
  check('Transaksi pelunasan dibuat & terhubung', db.tx.length === 1 && db.tx[0].debtId === db.debts[0].id);
  check('Sisa piutang Rp 30.000 tampil', /Sisa Rp 30\.000/.test(txt($(w, 'view'))));
})();

// ---------- 8. Persistensi antar-reload ----------
(function () {
  const w = boot();
  w.localStorage.setItem('hitungusaha_v1', JSON.stringify({ settings: { name: 'Toko Uji' }, products: [], tx: [], debts: [] }));
  const w2 = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  // salin storage
  w2.window.confirm = () => true;
  w2.window.localStorage.setItem('hitungusaha_v1', w.localStorage.getItem('hitungusaha_v1'));
  w2.window.eval(appJs);
  check('Nama usaha dari storage dimuat', txt($(w2.window, 'bizName')) === 'Toko Uji', txt($(w2.window, 'bizName')));
})();

// ---------- 9. Tombol akurasi: format ribuan di banyak field ----------
(function () {
  const w = boot();
  w.location.hash = '#/produk'; w.dispatchEvent(new w.Event('hashchange'));
  click(w, w.document.querySelector('[data-act=prod-new]'));
  setVal(w, $(w, 'p_name'), 'Beras'); setVal(w, $(w, 'p_cost'), '1.500.000');
  setVal(w, $(w, 'p_price'), '1.750.000'); setVal(w, $(w, 'p_stock'), '100'); setVal(w, $(w, 'p_min'), '10');
  click(w, w.document.querySelector('[data-act=prod-save]'));
  const db = JSON.parse(w.localStorage.getItem('hitungusaha_v1'));
  check('Harga 1.500.000 tidak jadi 1', db.products[0].cost === 1500000, String(db.products[0].cost));
})();

console.log('\n========================================');
console.log('HASIL: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('========================================');
process.exit(fail ? 1 : 0);
