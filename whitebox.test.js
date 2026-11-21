// White-box test HitungUsaha â€” menguji logika internal app.js secara langsung.
// Fungsi murni diekstrak dari source asli (brace-matching) lalu diuji per-cabang.
// Jalankan: node whitebox.test.js

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

// --- Ekstrak definisi fungsi dari source asli ---
function extract(name) {
  const needle = 'function ' + name + '(';
  const idx = src.indexOf(needle);
  if (idx < 0) throw new Error('Fungsi tidak ditemukan: ' + name);
  let i = src.indexOf('{', idx), depth = 0, start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(idx, i);
}

const NEED = ['pad','today','monthOf','uid','num','esc','rp','pct','findBy','prodName','sumTx','paid','remain','txSorted','monthLabel','monthShift','csvCell','applyStock','load','save'];
const funcs = NEED.map(extract).join('\n');

const PRELUDE = `
var KEY = 'hitungusaha_v1';
var MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
var Q = String.fromCharCode(34);
var db = { settings:{name:''}, products:[], tx:[], debts:[] };
function toast(){};
`;
const EXPORTS = '{pad,today,monthOf,uid,num,esc,rp,pct,findBy,prodName,sumTx,paid,remain,txSorted,monthLabel,monthShift,csvCell,applyStock,load,save,getDb:function(){return db;},setDb:function(x){db=x;}}';

function makeCtx(store) {
  const ls = {
    _s: store || {},
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem: function (k, v) { this._s[k] = String(v); },
    removeItem: function (k) { delete this._s[k]; }
  };
  const factory = new Function('localStorage', PRELUDE + '\n' + funcs + '\nreturn ' + EXPORTS + ';');
  return factory(ls);
}

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + ' -> got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
}
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' -> ' + extra : '')); }
}

// ============ 1. num(): setiap cabang ============
(function () {
  const c = makeCtx(), n = c.num;
  eq('num(null) = 0', n(null), 0);
  eq('num(undefined) = 0', n(undefined), 0);
  eq('num("") = 0', n(''), 0);
  eq('num("   ") = 0', n('   '), 0);
  eq('num("-5") = 0 (negatif ditolak)', n('-5'), 0);
  eq('num("abc") = 0', n('abc'), 0);
  eq('num("50.000") = 50000', n('50.000'), 50000);
  eq('num("5.000") = 5000', n('5.000'), 5000);
  eq('num("1.500.000") = 1500000', n('1.500.000'), 1500000);
  eq('num("1.5") = 1.5', n('1.5'), 1.5);
  eq('num("12.34") = 12.34', n('12.34'), 12.34);
  eq('num("0.5") = 0.5 (bukan 5)', n('0.5'), 0.5);
  eq('num("1,5") = 1.5', n('1,5'), 1.5);
  eq('num("2.500,75") = 2500.75', n('2.500,75'), 2500.75);
  eq('num("1,500.75") = 1500.75', n('1,500.75'), 1500.75);
  eq('num("Rp 75.000") = 75000', n('Rp 75.000'), 75000);
  eq('num("0") = 0', n('0'), 0);
  eq('num("1000") = 1000', n('1000'), 1000);
  eq('num("Infinity") = 0', n('Infinity'), 0);
  eq('num("1.234") = 1234 (ribuan)', n('1.234'), 1234);
})();

// ============ 2. rp() & pct() ============
(function () {
  const c = makeCtx();
  eq('rp(0)', c.rp(0), 'Rp 0');
  eq('rp(-5000)', c.rp(-5000), '-Rp 5.000');
  eq('rp(1234567)', c.rp(1234567), 'Rp 1.234.567');
  eq('rp(99.6) dibulatkan', c.rp(99.6), 'Rp 100');
  eq('rp("abc")', c.rp('abc'), 'Rp 0');
  eq('pct(0)', c.pct(0), '0%');
  eq('pct(20)', c.pct(20), '20%');
  eq('pct(12.345) -> 12,3%', c.pct(12.345), '12,3%');
  eq('pct(20.04) -> 20%', c.pct(20.04), '20%');
})();

// ============ 3. sumTx / paid / remain ============
(function () {
  const c = makeCtx();
  const list = [{ type: 'in', amount: 100 }, { type: 'out', amount: 40 }, { type: 'in', amount: 60 }];
  eq('sumTx in', c.sumTx(list, 'in'), 160);
  eq('sumTx out', c.sumTx(list, 'out'), 40);
  eq('paid() tanpa payments', c.paid({ total: 100 }), 0);
  eq('paid() dengan payments', c.paid({ total: 100, payments: [{ amount: 30 }, { amount: 20 }] }), 50);
  eq('remain() = total - paid', c.remain({ total: 100, payments: [{ amount: 30 }] }), 70);
  eq('remain() tidak minus', c.remain({ total: 100, payments: [{ amount: 130 }] }), 0);
})();

// ============ 4. txSorted(): urutan tanggal lalu id ============
(function () {
  const c = makeCtx();
  c.setDb({ products: [], debts: [], tx: [
    { id: 'a', date: '2024-01-01' },
    { id: 'b', date: '2024-03-01' },
    { id: 'c', date: '2024-01-01' },
    { id: 'd', date: '2024-02-01' }
  ] });
  eq('txSorted terbaru dulu', c.txSorted().map(function (x) { return x.id; }), ['b', 'd', 'c', 'a']);
})();

// ============ 5. applyStock(): semua cabang ============
(function () {
  const c = makeCtx();
  c.setDb({ settings: { name: '' }, products: [
    { id: 'p1', name: 'Kopi', stock: 10, minStock: 2 },
    { id: 'p2', name: 'Teh', stock: 5, minStock: 1 }
  ], tx: [], debts: [] });
  c.applyStock({ productId: 'p1', qty: 3, type: 'in' }, 1);
  eq('stok p1 turun 10->7 (in)', c.getDb().products[0].stock, 7);
  c.applyStock({ productId: 'p1', qty: 3, type: 'in' }, -1);
  eq('stok p1 kembali 7->10 (dir -1)', c.getDb().products[0].stock, 10);
  c.applyStock({ productId: 'p2', qty: 4, type: 'out' }, 1);
  eq('stok p2 naik 5->9 (out/restock)', c.getDb().products[1].stock, 9);
  c.applyStock({ productId: '', qty: 3, type: 'in' }, 1);
  eq('tanpa productId = noop', c.getDb().products[0].stock, 10);
  c.applyStock({ productId: 'p1', qty: 0, type: 'in' }, 1);
  eq('qty 0 = noop', c.getDb().products[0].stock, 10);
  c.applyStock({ productId: 'zzz', qty: 3, type: 'in' }, 1);
  eq('produk tak ada = noop', c.getDb().products[0].stock, 10);
})();

// ============ 6. monthShift / monthLabel: batas tahun ============
(function () {
  const c = makeCtx();
  eq('monthShift(2024-01, 1) = 2023-12', c.monthShift('2024-01', 1), '2023-12');
  eq('monthShift(2024-03, 3) = 2023-12', c.monthShift('2024-03', 3), '2023-12');
  eq('monthShift(2024-06, 0) = 2024-06', c.monthShift('2024-06', 0), '2024-06');
  eq('monthLabel(2024-01) = Januari 2024', c.monthLabel('2024-01'), 'Januari 2024');
  eq('monthLabel(2024-12) = Desember 2024', c.monthLabel('2024-12'), 'Desember 2024');
  eq('monthOf memotong 7 char', c.monthOf('2024-05-17'), '2024-05');
})();

// ============ 7. esc / csvCell (keamanan) ============
(function () {
  const c = makeCtx();
  eq('esc(<b>)', c.esc('<b>'), '&lt;b&gt;');
  eq('esc("x")', c.esc('x"y'), 'x&quot;y');
  eq("esc(') ", c.esc("a'b"), 'a&#39;b');
  eq('csvCell kutip ganda', c.csvCell('a"b'), '"a""b"');
  eq('csvCell null', c.csvCell(null), '""');
})();

// ============ 8. load()/save(): roundtrip + bentuk rusak ============
(function () {
  const c = makeCtx();
  eq('load() kosong -> struktur default', c.load(), { settings: { name: '' }, products: [], tx: [], debts: [] });
  c.setDb({ settings: { name: 'Toko' }, products: [{ id: 'x' }], tx: [], debts: [] });
  c.save();
  const d2 = c.load();
  eq('save->load roundtrip nama', d2.settings.name, 'Toko');
  eq('save->load roundtrip produk', d2.products.length, 1);

  const c2 = makeCtx({ hitungusaha_v1: JSON.stringify({ products: [{ id: 'q' }] }) });
  const d3 = c2.load();
  ok('load() menormalkan field hilang', Array.isArray(d3.tx) && Array.isArray(d3.debts) && d3.settings && d3.settings.name === '', JSON.stringify(d3));

  const c3 = makeCtx({ hitungusaha_v1: '{bukan json' });
  eq('load() JSON rusak -> default', c3.load(), { settings: { name: '' }, products: [], tx: [], debts: [] });
})();

// ============ 9. computeCalc(): cabang error via jsdom ============
(function () {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://example.test/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.confirm = function () { return true; };
  w.localStorage.clear();
  w.eval(src);
  function set(id, v) { const e = w.document.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); }
  function out() { return (w.document.getElementById('calcOut').textContent || '').replace(/\s+/g, ' '); }
  function clickAct(act, v) {
    const sel = v ? '[data-act=' + act + '][data-v=' + v + ']' : '[data-act=' + act + ']';
    const el = w.document.querySelector(sel);
    el.dispatchEvent(new w.Event('click', { bubbles: true }));
  }
  w.location.hash = '#/kalkulator'; w.dispatchEvent(new w.Event('hashchange'));

  // cabang: HPP margin >= 100
  set('c_bahan', '1000'); set('c_jumlah', '1'); set('c_margin', '100');
  ok('computeCalc: margin >= 100 ditolak', /Target margin harus di bawah 100%/.test(out()), out());

  // cabang: BEP kontribusi <= 0
  clickAct('calc-tab', 'bep');
  set('c_fixed', '1000'); set('c_jual', '1000'); set('c_var', '2000');
  ok('computeCalc: BEP cm<=0 ditolak', /Harga jual harus lebih besar dari biaya variabel/.test(out()), out());

  // cabang: ideal den <= 0
  clickAct('calc-tab', 'ideal');
  set('c_modal', '10000'); set('c_margin', '80'); set('c_fee', '30');
  ok('computeCalc: ideal den<=0 ditolak', /Margin dan potongan terlalu besar/.test(out()), out());

  // cabang: diskon dengan modal -> sisa margin
  clickAct('calc-tab', 'diskon');
  set('c_normal', '100000'); set('c_disc', '20'); set('c_modal_d', '50000');
  const o = out();
  ok('computeCalc: diskon net Rp 80.000', /Harga setelah diskon\s*Rp 80\.000/.test(o), o);
  ok('computeCalc: laba diskon Rp 30.000', /Laba\/rugi per unit\s*Rp 30\.000/.test(o), o);
  ok('computeCalc: margin diskon 37,5%', /Margin setelah diskon\s*37,5%/.test(o), o);
})();

console.log('\n========================================');
console.log('HASIL WHITE-BOX: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('========================================');
process.exit(fail ? 1 : 0);
