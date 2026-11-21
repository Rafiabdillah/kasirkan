(function () {
'use strict';
var KEY = 'hitungusaha_v1';
var CAT_IN = ['Penjualan', 'Pelunasan piutang', 'Lainnya'];
var CAT_OUT = ['Bahan/Barang', 'Gaji', 'Sewa', 'Listrik/Air', 'Transport', 'Pemasaran', 'Bayar hutang', 'Lainnya'];
var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var TITLES = { beranda: 'Beranda', transaksi: 'Transaksi', produk: 'Produk dan Stok', hutang: 'Hutang dan Piutang', kalkulator: 'Kalkulator Bisnis', laporan: 'Laporan', pengaturan: 'Pengaturan' };
var Q = String.fromCharCode(34);
var db = load();
var current = 'beranda';
var filter = { type: 'all', month: today().slice(0, 7), kind: 'piutang', debtStatus: 'all', qTx: '', qProd: '', stockFilter: 'all' };
var calcTab = 'hpp';
var form = null;
var toastTimer = null;

// ---------- Data ----------
function load() {
  try {
    var r = localStorage.getItem(KEY);
    if (r) {
      var d = JSON.parse(r) || {};
      return {
        settings: (d.settings && typeof d.settings === 'object') ? { name: sanitizeStr(d.settings.name) } : { name: '' },
        products: Array.isArray(d.products) ? d.products.map(function (p) {
          return { id: requiredId(p && p.id), name: sanitizeStr(p && p.name), cost: num(p && p.cost), price: num(p && p.price), stock: num(p && p.stock), minStock: num(p && p.minStock) };
        }) : [],
        tx: Array.isArray(d.tx) ? d.tx.map(function (t) {
          return { id: requiredId(t && t.id), type: (t && t.type === 'out') ? 'out' : 'in', date: sanitizeDate(t && t.date, today()), amount: num(t && t.amount), category: sanitizeStr(t && t.category), note: sanitizeStr(t && t.note), productId: cleanId(t && t.productId), qty: num(t && t.qty), debtId: cleanId(t && t.debtId), debtKind: (t && t.debtKind === 'hutang') ? 'hutang' : 'piutang' };
        }) : [],
        debts: Array.isArray(d.debts) ? d.debts.map(function (dbItem) {
          var pays = Array.isArray(dbItem && dbItem.payments) ? dbItem.payments : [];
          return { id: requiredId(dbItem && dbItem.id), kind: (dbItem && dbItem.kind === 'hutang') ? 'hutang' : 'piutang', party: sanitizeStr(dbItem && dbItem.party), phone: sanitizeStr(dbItem && dbItem.phone), total: num(dbItem && dbItem.total), date: sanitizeDate(dbItem && dbItem.date, today()), due: sanitizeDate(dbItem && dbItem.due, ''), note: sanitizeStr(dbItem && dbItem.note), payments: pays.map(function (pm) { return { date: sanitizeDate(pm && pm.date, today()), amount: num(pm && pm.amount) }; }) };
        }) : []
      };
    }
  } catch (e) {}
  return { settings: { name: '' }, products: [], tx: [], debts: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Gagal menyimpan: penyimpanan penuh atau diblokir'); }
}

// ---------- Util ----------
function $(id) { return document.getElementById(id); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function monthOf(s) { return String(s).slice(0, 7); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function num(v) {
  if (v == null) return 0;
  var s = String(v).trim();
  if (!s) return 0;
  if (s.charAt(0) === '-') return 0;
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return 0;
  var hasDot = s.indexOf('.') !== -1, hasComma = s.indexOf(',') !== -1;
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.split('.').join('').replace(',', '.');
    else s = s.split(',').join('');
  } else if (hasComma) {
    var cp = s.split(',');
    s = cp.length > 2 ? cp.join('') : s.replace(',', '.');
  } else if (hasDot) {
    var dp = s.split('.');
    if (dp.length > 2) s = dp.join('');
    else if (dp[1] && dp[1].length === 3 && /^[1-9][0-9]{0,2}$/.test(dp[0])) s = dp.join('');
  }
  var n = parseFloat(s);
  return isNaN(n) || !isFinite(n) ? 0 : Math.max(0, n);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').split(Q).join('&quot;');
}
function sanitizeStr(v) { return String(v == null ? '' : v).slice(0, 500); }
function cleanId(v) { return String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64); }
function requiredId(v) { return cleanId(v) || uid(); }
function sanitizeDate(v, fallback) { var s = String(v == null ? '' : v); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : (fallback || ''); }
function rp(n) {
  n = Math.round(Number(n) || 0);
  return (n < 0 ? '-' : '') + 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.abs(n));
}
function pct(n) { return (Math.round((Number(n) || 0) * 10) / 10).toString().replace('.', ',') + '%'; }
function findBy(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; } return null; }
function prodName(id) { var p = findBy(db.products, id); return p ? p.name : ''; }
function sumTx(list, type) { return list.filter(function (t) { return t.type === type; }).reduce(function (a, t) { return a + t.amount; }, 0); }
function paid(d) { return (d.payments || []).reduce(function (a, p) { return a + p.amount; }, 0); }
function remain(d) { return Math.max(0, d.total - paid(d)); }
function txSorted() {
  return db.tx.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}
function monthLabel(m) { var p = m.split('-'); return MONTHS[Number(p[1]) - 1] + ' ' + p[0]; }
function monthShift(m, back) {
  var p = m.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1 - back, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}
function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
}
var lastFocus = null;
function openModal(title, html) {
  lastFocus = document.activeElement;
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = html;
  $('modal').hidden = false;
  setTimeout(function () {
    var first = $('modalBody').querySelector('input, select, textarea, button');
    if (first && first.focus) { try { first.focus(); } catch (e) {} }
  }, 30);
}
function closeModal() {
  $('modal').hidden = true;
  $('modalBody').innerHTML = '';
  form = null;
  if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  lastFocus = null;
}
function chipBtn(act, v, label, on) {
  return `<button type='button' class='chip${on ? ' on' : ''}' data-act='${act}' data-v='${v}'>${label}</button>`;
}
function stat(label, value, cls) {
  return `<div class='stat ${cls || ''}'><small>${label}</small><b>${value}</b></div>`;
}
function field(label, inner, hint) {
  return `<div class='field'><label>${label}</label>${inner}${hint ? `<p class='hint'>${hint}</p>` : ''}</div>`;
}
function numInput(id, val, ph) {
  return `<input id='${id}' type='text' inputmode='decimal' autocomplete='off' value='${esc(val)}' placeholder='${esc(ph || '0')}'>`;
}
function download(name, text, mime) {
  var blob = new Blob([text], { type: mime });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}
function copyText(text, okMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { toast(okMsg || 'Tersalin'); }).catch(function () { fallbackCopy(text, okMsg); });
  } else {
    fallbackCopy(text, okMsg);
  }
}
function fallbackCopy(text, okMsg) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast(okMsg || 'Tersalin'); } catch (e) { toast('Gagal menyalin'); }
  document.body.removeChild(ta);
}

// ---------- Stok ----------
function applyStock(t, dir) {
  if (!t.productId || !t.qty) return;
  var p = findBy(db.products, t.productId);
  if (!p) return;
  p.stock += (t.type === 'in' ? -1 : 1) * t.qty * dir;
}

// ---------- Beranda ----------
function viewBeranda() {
  var t = today(), m = monthOf(t);
  var td = db.tx.filter(function (x) { return x.date === t; });
  var mo = db.tx.filter(function (x) { return monthOf(x.date) === m; });
  var pi = 0, hu = 0, od = 0, dueToday = 0;
  db.debts.forEach(function (d) {
    var r = remain(d);
    if (d.kind === 'piutang') pi += r; else hu += r;
    if (r > 0 && d.due) {
      if (d.due < t) od++;
      else if (d.due === t) dueToday++;
    }
  });
  var low = db.products.filter(function (p) { return p.stock <= p.minStock; });
  var h = '';
  if (!db.tx.length && !db.products.length && !db.debts.length) {
    h += `<div class='card'><h3>Selamat datang</h3><p>Mulai dalam 3 langkah:</p><p>1. Tambah produk di tab <b>Produk</b><br>2. Catat penjualan dan pengeluaran lewat tombol <b>+ Catat</b><br>3. Lihat untung rugi di tab <b>Laporan</b></p></div>`;
  }
  h += `<div class='sectionhead'><h2>Hari ini</h2></div><div class='grid2'>${stat('Pemasukan', rp(sumTx(td, 'in')), 'good')}${stat('Pengeluaran', rp(sumTx(td, 'out')), 'bad')}</div>`;
  h += `<div class='sectionhead'><h2>${monthLabel(m)}</h2></div><div class='grid2'>${stat('Pemasukan', rp(sumTx(mo, 'in')), 'good')}${stat('Pengeluaran', rp(sumTx(mo, 'out')), 'bad')}${stat('Laba bersih', rp(sumTx(mo, 'in') - sumTx(mo, 'out')), sumTx(mo, 'in') - sumTx(mo, 'out') >= 0 ? 'good' : 'bad')}${stat('Jumlah transaksi', mo.length)}</div>`;
  h += `<div class='sectionhead'><h2>Piutang dan hutang</h2></div><div class='grid2'>${stat('Belum ditagih', rp(pi), 'warn')}${stat('Hutang kita', rp(hu), 'bad')}</div>`;
  if (od || dueToday) {
    var parts = [];
    if (od) parts.push(`<span class='badge bad'>${od} lewat tempo</span>`);
    if (dueToday) parts.push(`<span class='badge warn'>${dueToday} jatuh tempo hari ini</span>`);
    h += `<div class='card' style='margin-top:10px'>${parts.join(' ')} Cek tab Piutang untuk detail dan penagihan.</div>`;
  }
  if (low.length) {
    h += `<div class='sectionhead'><h2>Stok menipis</h2></div><div class='list'>` + low.map(function (p) {
      return `<div class='item'><div class='main'><b>${esc(p.name)}</b><small>Batas minimum ${esc(p.minStock)}</small></div><div class='side'><span class='badge ${p.stock <= 0 ? 'bad' : 'warn'}'>Stok ${esc(p.stock)}</span></div></div>`;
    }).join('') + `</div>`;
  }
  var recent = txSorted().slice(0, 5);
  h += `<div class='sectionhead'><h2>Transaksi terakhir</h2><a class='btn small' href='#/transaksi'>Semua</a></div>`;
  h += recent.length ? `<div class='list'>${recent.map(txItem).join('')}</div>` : `<div class='empty'>Belum ada transaksi.</div>`;
  return h;
}

// ---------- Transaksi ----------
function txItem(t) {
  var pn = prodName(t.productId);
  var tt = t.type === 'out' ? 'out' : 'in';
  var qn = num(t.qty);
  return `<div class='item'><div class='main'><b>${esc(t.category)}${pn ? ' - ' + esc(pn) : ''}</b><small>${esc(t.date)}${qn ? ' | ' + qn + ' pcs' : ''}${t.note ? ' | ' + esc(t.note) : ''}</small></div><div class='side'><b class='${tt}'>${tt === 'in' ? '+' : '-'}${rp(t.amount)}</b><div class='actions'><button class='btn small' data-act='tx-edit' data-id='${esc(t.id)}'>Ubah</button><button class='btn small danger' data-act='tx-del' data-id='${esc(t.id)}'>Hapus</button></div></div></div>`;
}
function viewTransaksi() {
  var q = String(filter.qTx || '').trim().toLowerCase();
  var list = txSorted().filter(function (t) {
    if (monthOf(t.date) !== filter.month) return false;
    if (filter.type !== 'all' && t.type !== filter.type) return false;
    if (!q) return true;
    var hay = [t.category, t.note, prodName(t.productId), t.date].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  var h = `<div class='grid2'>${field('Bulan', `<input id='f_month' type='month' value='${esc(filter.month)}'>`)}${field('Cari transaksi', `<input id='f_qtx' value='${esc(filter.qTx)}' placeholder='kategori, produk, catatan'>`)}</div>`;
  h += `<div class='chips'>${chipBtn('f-type', 'all', 'Semua', filter.type === 'all')}${chipBtn('f-type', 'in', 'Pemasukan', filter.type === 'in')}${chipBtn('f-type', 'out', 'Pengeluaran', filter.type === 'out')}</div>`;
  h += `<div class='grid2'>${stat('Pemasukan', rp(sumTx(list, 'in')), 'good')}${stat('Pengeluaran', rp(sumTx(list, 'out')), 'bad')}</div>`;
  h += `<div class='sectionhead'><h2>${list.length} transaksi</h2><button class='btn primary small' data-act='tx-new'>+ Tambah</button></div>`;
  h += list.length ? `<div class='list'>${list.map(txItem).join('')}</div>` : `<div class='empty'>Tidak ada transaksi yang cocok.</div>`;
  return h;
}
function openTx(id, pre) {
  var old = id ? findBy(db.tx, id) : null;
  form = old ? {
    id: old.id, type: old.type, date: old.date, productId: old.productId || '', qty: old.qty || '', amount: old.amount, category: old.category, note: old.note || ''
  } : {
    id: '', type: (pre && pre.type) || 'in', date: today(), productId: (pre && pre.productId) || '', qty: '', amount: '', category: '', note: ''
  };
  if (!form.category) form.category = form.type === 'in' ? 'Penjualan' : 'Bahan/Barang';
  var validCats = form.type === 'in' ? CAT_IN : CAT_OUT;
  if (validCats.indexOf(form.category) === -1) form.category = validCats[0];
  renderTxForm(old ? 'Ubah transaksi' : 'Catat transaksi');
}
function renderTxForm(title) {
  var f = form, cats = f.type === 'in' ? CAT_IN : CAT_OUT;
  var prods = `<option value=''>Tanpa produk</option>` + db.products.map(function (p) {
    return `<option value='${esc(p.id)}'${p.id === f.productId ? ' selected' : ''}>${esc(p.name)}</option>`;
  }).join('');
  var catOpts = cats.map(function (c) { return `<option${c === f.category ? ' selected' : ''}>${esc(c)}</option>`; }).join('');
  var h = `<div class='field'><div class='seg'><button type='button' class='${f.type === 'in' ? 'on in' : ''}' data-act='tx-type' data-v='in'>Pemasukan</button><button type='button' class='${f.type === 'out' ? 'on out' : ''}' data-act='tx-type' data-v='out'>Pengeluaran</button></div></div>`;
  h += field('Tanggal', `<input id='f_date' type='date' value='${esc(f.date)}'>`);
  if (db.products.length) {
    h += field('Produk (opsional)', `<select id='f_prod'>${prods}</select>`, f.type === 'in' ? 'Stok produk otomatis berkurang.' : 'Stok produk otomatis bertambah (restock).');
    h += field('Jumlah', numInput('f_qty', f.qty, 'contoh: 3'));
  }
  h += field('Nominal (Rp)', numInput('f_amount', f.amount, 'contoh: 50000'));
  h += field('Kategori', `<select id='f_cat'>${catOpts}</select>`);
  h += field('Catatan', `<input id='f_note' value='${esc(f.note)}' placeholder='opsional'>`);
  h += `<button class='btn primary wide' data-act='tx-save'>Simpan</button>`;
  openModal(title || 'Catat transaksi', h);
}
function readTx() {
  var g = function (id) { var e = $(id); return e ? e.value : ''; };
  form.date = g('f_date');
  form.productId = g('f_prod');
  form.qty = g('f_qty');
  form.amount = g('f_amount');
  form.category = g('f_cat') || form.category;
  form.note = g('f_note');
}
function saveTx() {
  readTx();
  var f = form, amount = num(f.amount), qty = num(f.qty);
  if (!f.date) { toast('Isi tanggal'); return; }
  if (amount <= 0) { toast('Isi nominal lebih dari 0'); return; }
  if (f.productId && qty <= 0) { toast('Isi jumlah produk'); return; }
  var rec = f.id ? findBy(db.tx, f.id) : null;
  if (rec) applyStock(rec, -1); else { rec = { id: uid() }; db.tx.push(rec); }
  rec.type = f.type; rec.date = f.date; rec.amount = amount; rec.category = f.category; rec.note = f.note.trim();
  rec.productId = f.productId || ''; rec.qty = f.productId ? qty : 0;
  applyStock(rec, 1);
  var warnProd = rec.productId ? findBy(db.products, rec.productId) : null;
  save(); closeModal(); route();
  toast(warnProd && warnProd.stock < 0 ? 'Transaksi tersimpan (stok ' + warnProd.name + ' minus: ' + warnProd.stock + ')' : 'Transaksi tersimpan');
}

// ---------- Produk ----------
function viewProduk() {
  var q = String(filter.qProd || '').trim().toLowerCase();
  var totalCostVal = db.products.reduce(function (a, p) { return a + (num(p.stock) * num(p.cost)); }, 0);
  var filtered = db.products.filter(function (p) {
    var isLow = p.stock <= p.minStock;
    if (filter.stockFilter === 'low' && !isLow) return false;
    if (filter.stockFilter === 'ok' && isLow) return false;
    if (!q) return true;
    return String(p.name || '').toLowerCase().indexOf(q) !== -1;
  });
  var h = `<div class='grid2'>${stat('Nilai modal stok', rp(totalCostVal))}${stat('Jumlah produk', db.products.length)}</div>`;
  h += `<div style='margin-top:10px'>${field('Cari produk', `<input id='f_qprod' value='${esc(filter.qProd)}' placeholder='nama produk'>`)}</div>`;
  h += `<div class='chips'>${chipBtn('f-stock', 'all', 'Semua', filter.stockFilter === 'all')}${chipBtn('f-stock', 'low', 'Menipis / Habis', filter.stockFilter === 'low')}${chipBtn('f-stock', 'ok', 'Aman', filter.stockFilter === 'ok')}</div>`;
  h += `<div class='sectionhead'><h2>${filtered.length} produk tampil</h2><button class='btn primary small' data-act='prod-new'>+ Produk</button></div>`;
  if (!db.products.length) return h + `<div class='empty'>Belum ada produk. Tambahkan produk untuk melacak stok dan margin.</div>`;
  if (!filtered.length) return h + `<div class='empty'>Tidak ada produk yang cocok dengan filter.</div>`;
  h += `<div class='list'>` + filtered.map(function (p) {
    var margin = p.price > 0 ? (p.price - p.cost) / p.price * 100 : 0;
    var badge = p.stock <= 0 ? `<span class='badge bad'>Habis</span>` : p.stock <= p.minStock ? `<span class='badge warn'>Menipis</span>` : `<span class='badge good'>Aman</span>`;
    return `<div class='item'><div class='main'><b>${esc(p.name)}</b><small>Modal ${rp(p.cost)} | Jual ${rp(p.price)} | Margin ${pct(margin)}</small></div><div class='side'><b>Stok ${esc(p.stock)}</b>${badge}<div class='actions'><button class='btn small' data-act='prod-restock' data-id='${esc(p.id)}'>Restock</button><button class='btn small' data-act='prod-edit' data-id='${esc(p.id)}'>Ubah</button><button class='btn small danger' data-act='prod-del' data-id='${esc(p.id)}'>Hapus</button></div></div></div>`;
  }).join('') + `</div>`;
  return h;
}
function openProd(id) {
  var p = id ? findBy(db.products, id) : null;
  var h = field('Nama produk', `<input id='p_name' value='${esc(p ? p.name : '')}' placeholder='contoh: Paket sayur sop'>`);
  h += `<div class='grid2'>${field('Harga modal (Rp)', numInput('p_cost', p ? p.cost : ''))}${field('Harga jual (Rp)', numInput('p_price', p ? p.price : ''))}</div>`;
  h += `<div class='grid2'>${field('Stok sekarang', numInput('p_stock', p ? p.stock : ''))}${field('Batas stok minimum', numInput('p_min', p ? p.minStock : '', '5'))}</div>`;
  h += `<button class='btn primary wide' data-act='prod-save' data-id='${esc(p ? p.id : '')}'>Simpan</button>`;
  openModal(p ? 'Ubah produk' : 'Tambah produk', h);
}
function saveProd(id) {
  var name = $('p_name').value.trim();
  if (!name) { toast('Isi nama produk'); return; }
  var p = id ? findBy(db.products, id) : null;
  if (!p) { p = { id: uid() }; db.products.push(p); }
  p.name = name; p.cost = num($('p_cost').value); p.price = num($('p_price').value);
  p.stock = num($('p_stock').value); p.minStock = num($('p_min').value);
  save(); closeModal(); route(); toast('Produk tersimpan');
}

// ---------- Hutang dan Piutang ----------
function viewHutang() {
  var k = filter.kind, st = filter.debtStatus, t = today();
  var byKind = db.debts.filter(function (d) { return d.kind === k; });
  var list = byKind.filter(function (d) {
    var r = remain(d);
    if (st === 'unpaid') return r > 0;
    if (st === 'overdue') return r > 0 && d.due && d.due < t;
    if (st === 'paid') return r === 0;
    return true;
  }).sort(function (a, b) { return remain(b) - remain(a); });
  var total = byKind.reduce(function (a, d) { return a + remain(d); }, 0);
  var h = `<div class='chips'>${chipBtn('f-kind', 'piutang', 'Piutang (orang berutang ke kita)', k === 'piutang')}${chipBtn('f-kind', 'hutang', 'Hutang (kita berutang)', k === 'hutang')}</div>`;
  h += `<div class='chips'>${chipBtn('f-dstatus', 'all', 'Semua', st === 'all')}${chipBtn('f-dstatus', 'unpaid', 'Belum lunas', st === 'unpaid')}${chipBtn('f-dstatus', 'overdue', 'Jatuh tempo', st === 'overdue')}${chipBtn('f-dstatus', 'paid', 'Lunas', st === 'paid')}</div>`;
  h += `<div class='grid2'>${stat(k === 'piutang' ? 'Total belum ditagih' : 'Total hutang kita', rp(total), k === 'piutang' ? 'warn' : 'bad')}${stat('Catatan tampil', list.length)}</div>`;
  h += `<div class='sectionhead'><h2>Daftar</h2><button class='btn primary small' data-act='debt-new'>+ Catat</button></div>`;
  if (!list.length) return h + `<div class='empty'>Belum ada catatan yang sesuai.</div>`;
  h += `<div class='list'>` + list.map(function (d) {
    var r = remain(d);
    var badge = r === 0 ? `<span class='badge good'>Lunas</span>` : (d.due && d.due < t) ? `<span class='badge bad'>Jatuh tempo</span>` : (d.due === t) ? `<span class='badge warn'>Tempo hari ini</span>` : `<span class='badge warn'>Belum lunas</span>`;
    var wa = '';
    var copyBtn = '';
    if (d.kind === 'piutang' && r > 0) {
      var msg = 'Halo ' + d.party + ', mengingatkan sisa pembayaran ' + rp(r) + (db.settings.name ? ' ke ' + db.settings.name : '') + '. Terima kasih.';
      copyBtn = `<button class='btn small' data-act='debt-copy' data-id='${esc(d.id)}'>Salin pesan</button>`;
      var ph = String(d.phone || '').replace(/[^0-9]/g, '');
      if (ph.charAt(0) === '0') ph = '62' + ph.slice(1);
      if (ph) {
        wa = `<a class='btn small' target='_blank' rel='noopener noreferrer' href='https://wa.me/${ph}?text=${encodeURIComponent(msg)}'>Tagih WA</a>`;
      }
    }
    var pays = (d.payments || []).length ? `<div class='subpay'>Riwayat bayar: ` + d.payments.map(function (pm) { return `<span>${esc(pm.date)}: ${rp(pm.amount)}</span>`; }).join('') + `</div>` : '';
    return `<div class='item'><div class='main'><b>${esc(d.party)}</b><small>Sisa ${rp(r)} dari ${rp(d.total)}${d.due ? ' | Tempo ' + esc(d.due) : ''}${d.note ? ' | ' + esc(d.note) : ''}</small>${pays}</div><div class='side'>${badge}<div class='actions'><button class='btn small' data-act='debt-edit' data-id='${esc(d.id)}'>Ubah</button>${r > 0 ? `<button class='btn small' data-act='debt-pay' data-id='${esc(d.id)}'>${d.kind === 'piutang' ? 'Terima' : 'Bayar'}</button>` : ''}${copyBtn}${wa}<button class='btn small danger' data-act='debt-del' data-id='${esc(d.id)}'>Hapus</button></div></div></div>`;
  }).join('') + `</div>`;
  return h;
}
function openDebt(id) {
  var d = id ? findBy(db.debts, id) : null;
  var kindVal = d ? d.kind : filter.kind;
  var h = field('Jenis', `<select id='d_kind'${d ? ' disabled' : ''}><option value='piutang'${kindVal === 'piutang' ? ' selected' : ''}>Piutang (orang berutang ke kita)</option><option value='hutang'${kindVal === 'hutang' ? ' selected' : ''}>Hutang (kita berutang)</option></select>`);
  h += field('Nama pihak', `<input id='d_party' value='${esc(d ? d.party : '')}' placeholder='contoh: Bu Ani'>`);
  h += field('Nomor WhatsApp', `<input id='d_phone' type='tel' value='${esc(d ? d.phone || '' : '')}' placeholder='08xxxxxxxxxx'>`, 'Opsional, dipakai untuk tombol Tagih WA.');
  h += field('Jumlah (Rp)', numInput('d_total', d ? d.total : ''));
  h += `<div class='grid2'>${field('Tanggal', `<input id='d_date' type='date' value='${esc(d ? d.date : today())}'>`)}${field('Jatuh tempo', `<input id='d_due' type='date' value='${esc(d ? d.due || '' : '')}'>`)}</div>`;
  h += field('Catatan', `<input id='d_note' value='${esc(d ? d.note || '' : '')}' placeholder='opsional'>`);
  h += `<button class='btn primary wide' data-act='debt-save' data-id='${esc(d ? d.id : '')}'>Simpan</button>`;
  openModal(d ? 'Ubah hutang / piutang' : 'Catat hutang / piutang', h);
}
function saveDebt(el) {
  var id = el && el.getAttribute ? el.getAttribute('data-id') : '';
  var party = $('d_party').value.trim(), total = num($('d_total').value);
  if (!party) { toast('Isi nama pihak'); return; }
  if (total <= 0) { toast('Isi jumlah lebih dari 0'); return; }
  if (id) {
    var old = findBy(db.debts, id);
    if (!old) return;
    var minPaid = paid(old);
    if (total < minPaid) { toast('Jumlah tidak boleh kurang dari yang sudah dibayar (' + rp(minPaid) + ')'); return; }
    old.party = party;
    old.phone = $('d_phone').value.trim();
    old.total = total;
    old.date = $('d_date').value || today();
    old.due = $('d_due').value;
    old.note = $('d_note').value.trim();
    save(); closeModal(); route(); toast('Catatan diperbarui');
    return;
  }
  db.debts.push({ id: uid(), kind: $('d_kind').value, party: party, phone: $('d_phone').value.trim(), total: total, date: $('d_date').value || today(), due: $('d_due').value, note: $('d_note').value.trim(), payments: [] });
  filter.kind = $('d_kind').value;
  save(); closeModal(); route(); toast('Tersimpan');
}
function openPay(id) {
  var d = findBy(db.debts, id);
  if (!d) return;
  var h = `<p>${esc(d.party)} | sisa <b>${rp(remain(d))}</b></p>`;
  h += field('Jumlah dibayar (Rp)', numInput('y_amount', remain(d)));
  h += field('Tanggal', `<input id='y_date' type='date' value='${today()}'>`);
  h += `<button class='btn primary wide' data-act='debt-paysave' data-id='${esc(d.id)}'>Simpan pembayaran</button>`;
  openModal(d.kind === 'piutang' ? 'Terima pembayaran' : 'Bayar hutang', h);
}
function savePay(id) {
  var d = findBy(db.debts, id);
  if (!d) return;
  var amount = Math.min(num($('y_amount').value), remain(d)), date = $('y_date').value || today();
  if (amount <= 0) { toast('Isi jumlah lebih dari 0'); return; }
  d.payments = d.payments || [];
  d.payments.push({ date: date, amount: amount });
  db.tx.push({ id: uid(), type: d.kind === 'piutang' ? 'in' : 'out', date: date, amount: amount, category: d.kind === 'piutang' ? 'Pelunasan piutang' : 'Bayar hutang', note: d.party, productId: '', qty: 0, debtId: d.id, debtKind: d.kind });
  save(); closeModal(); route(); toast('Pembayaran dicatat');
}

// ---------- Kalkulator ----------
function viewKalkulator() {
  var h = `<div class='chips'>${chipBtn('calc-tab', 'hpp', 'HPP', calcTab === 'hpp')}${chipBtn('calc-tab', 'margin', 'Margin', calcTab === 'margin')}${chipBtn('calc-tab', 'bep', 'Titik impas', calcTab === 'bep')}${chipBtn('calc-tab', 'ideal', 'Harga ideal', calcTab === 'ideal')}${chipBtn('calc-tab', 'diskon', 'Diskon', calcTab === 'diskon')}</div><div class='card'>`;
  if (calcTab === 'hpp') {
    h += `<h3>Hitung HPP (modal per unit)</h3>` + field('Total biaya bahan (Rp)', numInput('c_bahan', '')) + field('Biaya tenaga kerja (Rp)', numInput('c_tenaga', '')) + field('Biaya lain: listrik, kemasan, dll (Rp)', numInput('c_over', '')) + field('Jumlah unit yang dihasilkan', numInput('c_jumlah', '')) + field('Target margin (% dari harga jual)', numInput('c_margin', '30'));
  } else if (calcTab === 'margin') {
    h += `<h3>Hitung margin dan laba</h3>` + field('Harga modal per unit (Rp)', numInput('c_modal', '')) + field('Harga jual per unit (Rp)', numInput('c_jual', '')) + field('Jumlah terjual', numInput('c_qty', '1'));
  } else if (calcTab === 'bep') {
    h += `<h3>Titik impas (BEP)</h3>` + field('Biaya tetap per bulan (Rp)', numInput('c_fixed', ''), 'Sewa, gaji tetap, listrik, dan sejenisnya.') + field('Harga jual per unit (Rp)', numInput('c_jual', '')) + field('Biaya variabel per unit (Rp)', numInput('c_var', ''), 'Bahan dan kemasan per satu unit.') + field('Target laba per bulan (Rp, opsional)', numInput('c_target', ''));
  } else if (calcTab === 'ideal') {
    h += `<h3>Harga jual ideal</h3>` + field('Harga modal per unit (Rp)', numInput('c_modal', '')) + field('Target margin (% dari harga jual)', numInput('c_margin', '30')) + field('Potongan platform / biaya lain (%)', numInput('c_fee', '0'), 'Contoh: biaya marketplace atau ongkos admin.');
  } else {
    h += `<h3>Kalkulator harga diskon</h3>` + field('Harga normal per unit (Rp)', numInput('c_normal', '')) + field('Diskon (%)', numInput('c_disc', '10')) + field('Harga modal per unit (Rp, opsional)', numInput('c_modal_d', ''), 'Untuk cek sisa margin setelah diskon.');
  }
  h += `<div id='calcOut'></div></div>`;
  return h;
}
function cv(id) { var e = $(id); return e ? num(e.value) : 0; }
function row(l, v, total) { return `<div class='row${total ? ' total' : ''}'><span>${l}</span><span>${v}</span></div>`; }
function computeCalc() {
  var out = $('calcOut');
  if (!out) return;
  var h = '';
  if (calcTab === 'hpp') {
    var total = cv('c_bahan') + cv('c_tenaga') + cv('c_over'), n = cv('c_jumlah'), m = cv('c_margin');
    var hpp = n > 0 ? total / n : 0;
    if (m >= 100) {
      h = row('Total biaya', rp(total)) + row('HPP per unit', rp(hpp), true) + `<div class='row'><span>Target margin harus di bawah 100%.</span></div>`;
    } else {
      var price = hpp / (1 - m / 100);
      h = row('Total biaya', rp(total)) + row('HPP per unit', rp(hpp), true) + row('Harga jual sesuai margin', rp(price)) + row('Dibulatkan ke Rp 500', rp(Math.ceil(price / 500) * 500)) + row('Laba per unit', rp(price - hpp));
    }
  } else if (calcTab === 'margin') {
    var modal = cv('c_modal'), jual = cv('c_jual'), q = cv('c_qty') || 1, laba = jual - modal;
    h = row('Laba per unit', rp(laba)) + row('Margin (dari harga jual)', pct(jual > 0 ? laba / jual * 100 : 0), true) + row('Markup (dari modal)', pct(modal > 0 ? laba / modal * 100 : 0)) + row('Total omzet', rp(jual * q)) + row('Total laba', rp(laba * q));
  } else if (calcTab === 'bep') {
    var fixed = cv('c_fixed'), j = cv('c_jual'), vr = cv('c_var'), tg = cv('c_target'), cm = j - vr;
    if (cm <= 0) {
      h = `<div class='row'><span>Harga jual harus lebih besar dari biaya variabel.</span></div>`;
    } else {
      var bu = Math.ceil(fixed / cm);
      h = row('Laba per unit (kontribusi)', rp(cm)) + row('BEP (unit per bulan)', bu + ' unit', true) + row('BEP (omzet per bulan)', rp(bu * j)) + (tg > 0 ? row('Unit untuk capai target laba', Math.ceil((fixed + tg) / cm) + ' unit') : '');
    }
  } else if (calcTab === 'ideal') {
    var md = cv('c_modal'), mg = cv('c_margin'), fee = cv('c_fee'), den = 1 - mg / 100 - fee / 100;
    if (den <= 0) {
      h = `<div class='row'><span>Margin dan potongan terlalu besar (total harus di bawah 100%).</span></div>`;
    } else {
      var pr = md / den;
      h = row('Harga jual ideal', rp(pr), true) + row('Dibulatkan ke Rp 500', rp(Math.ceil(pr / 500) * 500)) + row('Potongan platform', rp(pr * fee / 100)) + row('Laba per unit', rp(pr * mg / 100));
    }
  } else {
    var norm = cv('c_normal'), disc = Math.min(100, cv('c_disc')), modD = cv('c_modal_d');
    var pot = norm * disc / 100, netPrice = Math.max(0, norm - pot);
    h = row('Potongan diskon', rp(pot)) + row('Harga setelah diskon', rp(netPrice), true);
    if (modD > 0) {
      var labaD = netPrice - modD;
      h += row('Laba/rugi per unit', rp(labaD)) + row('Margin setelah diskon', pct(netPrice > 0 ? labaD / netPrice * 100 : 0));
    }
  }
  out.innerHTML = `<div class='result'>${h}</div>`;
}

// ---------- Laporan ----------
function viewLaporan() {
  var m = filter.month;
  var list = db.tx.filter(function (t) { return monthOf(t.date) === m; });
  var inn = sumTx(list, 'in'), out = sumTx(list, 'out'), laba = inn - out;
  var h = `<div class='field noprint'><label>Bulan</label><input id='r_month' type='month' value='${esc(m)}'></div>`;
  h += `<div class='sectionhead'><h2>Laba rugi ${monthLabel(m)}</h2></div>`;
  h += `<div class='grid2'>${stat('Pemasukan', rp(inn), 'good')}${stat('Pengeluaran', rp(out), 'bad')}${stat(laba >= 0 ? 'Laba bersih' : 'Rugi bersih', rp(laba), laba >= 0 ? 'good' : 'bad')}${stat('Margin laba', inn > 0 ? pct(laba / inn * 100) : '-')}</div>`;
  var months = [];
  for (var i = 5; i >= 0; i--) months.push(monthShift(m, i));
  var series = months.map(function (mm) {
    var l = db.tx.filter(function (t) { return monthOf(t.date) === mm; });
    return { m: mm, i: sumTx(l, 'in'), o: sumTx(l, 'out') };
  });
  var max = Math.max(1, Math.max.apply(null, series.map(function (s) { return Math.max(s.i, s.o); })));
  h += `<div class='card' style='margin-top:12px'><h3>6 bulan terakhir</h3><div class='bars'>` + series.map(function (s) {
    return `<div class='col'><div class='pair'><div class='bar in' style='height:${Math.round(s.i / max * 100)}%'></div><div class='bar out' style='height:${Math.round(s.o / max * 100)}%'></div></div><small>${MONTHS[Number(s.m.split('-')[1]) - 1].slice(0, 3)}</small></div>`;
  }).join('') + `</div><div class='legend'><span><i style='background:var(--good)'></i>Pemasukan</span><span><i style='background:var(--bad)'></i>Pengeluaran</span></div></div>`;
  function breakdown(type, title) {
    var map = {};
    list.filter(function (t) { return t.type === type; }).forEach(function (t) { map[t.category] = (map[t.category] || 0) + t.amount; });
    var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    if (!keys.length) return '';
    var tot = type === 'in' ? inn : out;
    return `<div class='card'><h3>${title}</h3><div class='result' style='margin-top:0'>` + keys.map(function (k) { return row(esc(k) + ' (' + pct(map[k] / tot * 100) + ')', rp(map[k])); }).join('') + `</div></div>`;
  }
  h += breakdown('in', 'Sumber pemasukan') + breakdown('out', 'Rincian pengeluaran');
  var prodMap = {};
  list.filter(function (t) { return t.type === 'in' && t.productId; }).forEach(function (t) {
    var o = prodMap[t.productId] || (prodMap[t.productId] = { qty: 0, amt: 0 });
    o.qty += t.qty; o.amt += t.amount;
  });
  var pk = Object.keys(prodMap).sort(function (a, b) { return prodMap[b].amt - prodMap[a].amt; });
  if (pk.length) {
    h += `<div class='card'><h3>Produk terlaris</h3><div class='result' style='margin-top:0'>` + pk.map(function (k) { return row(esc(prodName(k) || 'Produk dihapus') + ' (' + prodMap[k].qty + ' pcs)', rp(prodMap[k].amt)); }).join('') + `</div></div>`;
  }
  var stkMap = {};
  list.filter(function (t) { return t.productId && t.qty; }).forEach(function (t) {
    var o = stkMap[t.productId] || (stkMap[t.productId] = { out: 0, inn: 0 });
    if (t.type === 'in') o.out += t.qty; else o.inn += t.qty;
  });
  var sk = Object.keys(stkMap);
  if (sk.length) {
    h += `<div class='card'><h3>Mutasi stok produk</h3><div class='result' style='margin-top:0'>` + sk.map(function (k) { return row(esc(prodName(k) || 'Produk dihapus'), 'Masuk +' + stkMap[k].inn + ' | Keluar -' + stkMap[k].out); }).join('') + `</div></div>`;
  }
  h += `<div class='grid2 noprint' style='grid-template-columns:repeat(3,1fr)'><button class='btn' data-act='rep-copy'>Salin ringkasan</button><button class='btn' data-act='rep-csv'>Ekspor CSV</button><button class='btn' data-act='rep-print'>Cetak laporan</button></div>`;
  return h;
}
function copyReportSummary() {
  var m = filter.month;
  var list = db.tx.filter(function (t) { return monthOf(t.date) === m; });
  var inn = sumTx(list, 'in'), out = sumTx(list, 'out'), laba = inn - out;
  var title = (db.settings.name ? db.settings.name + ' - ' : '') + 'Laporan ' + monthLabel(m);
  var lines = [title, 'Pemasukan: ' + rp(inn), 'Pengeluaran: ' + rp(out), 'Laba/Rugi bersih: ' + rp(laba), 'Jumlah transaksi: ' + list.length];
  copyText(lines.join(String.fromCharCode(10)), 'Ringkasan laporan tersalin');
}
function csvCell(v) { return Q + String(v == null ? '' : v).split(Q).join(Q + Q) + Q; }
function exportCsv() {
  var m = filter.month;
  var rows = [['Tanggal', 'Jenis', 'Kategori', 'Produk', 'Jumlah', 'Nominal', 'Catatan']];
  txSorted().filter(function (t) { return monthOf(t.date) === m; }).forEach(function (t) {
    rows.push([t.date, t.type === 'in' ? 'Pemasukan' : 'Pengeluaran', t.category, prodName(t.productId), t.qty || '', t.amount, t.note || '']);
  });
  var text = rows.map(function (r) { return r.map(csvCell).join(','); }).join(String.fromCharCode(10));
  download('laporan-' + m + '.csv', String.fromCharCode(65279) + text, 'text/csv;charset=utf-8');
}

// ---------- Pengaturan ----------
function viewPengaturan() {
  var h = `<div class='card'><h3>Nama usaha</h3>` + field('Tampil di judul aplikasi dan pesan tagihan', `<input id='s_name' value='${esc(db.settings.name)}' placeholder='contoh: Sayur Segar Batu'>`) + `<button class='btn primary wide' data-act='set-save'>Simpan</button></div>`;
  h += `<div class='card'><h3>Cadangan data</h3><p class='hint'>Data tersimpan di browser perangkat ini. Unduh cadangan secara berkala agar aman dan bisa dipindah ke perangkat lain.</p><button class='btn wide' data-act='set-backup' style='margin-bottom:8px'>Unduh cadangan (JSON)</button>${field('Pulihkan dari file cadangan', `<input id='s_file' type='file' accept='application/json,.json'>`)}</div>`;
  h += `<div class='card'><h3>Hapus semua data</h3><p class='hint'>Menghapus semua produk, transaksi, dan catatan hutang di perangkat ini.</p><button class='btn danger wide' data-act='set-reset'>Hapus semua data</button></div>`;
  return h;
}

// ---------- Router ----------
var VIEWS = { beranda: viewBeranda, transaksi: viewTransaksi, produk: viewProduk, hutang: viewHutang, kalkulator: viewKalkulator, laporan: viewLaporan, pengaturan: viewPengaturan };
function route() {
  var r = (location.hash || '#/beranda').replace('#/', '');
  if (!VIEWS[r]) r = 'beranda';
  current = r;
  $('view').innerHTML = VIEWS[r]();
  $('pageTitle').textContent = TITLES[r];
  $('bizName').textContent = db.settings.name || 'HitungUsaha';
  var tabs = document.querySelectorAll('#tabbar a');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === r);
  }
  if (r === 'kalkulator') computeCalc();
}

// ---------- Aksi ----------
var ACT = {
  'tx-new': function () { openTx(null, {}); },
  'tx-edit': function (el) { openTx(el.getAttribute('data-id')); },
  'tx-del': function (el) {
    var id = el.getAttribute('data-id'), t = findBy(db.tx, id);
    if (!t) return;
    var dd = t.debtId ? findBy(db.debts, t.debtId) : null;
    var msg = dd ? 'Transaksi ini pembayaran ' + (t.debtKind === 'piutang' ? 'piutang' : 'hutang') + ' ' + dd.party + '. Menghapusnya juga membatalkan catatan pembayaran terkait. Lanjut?' : 'Hapus transaksi ini?';
    if (!confirm(msg)) return;
    applyStock(t, -1);
    db.tx = db.tx.filter(function (x) { return x.id !== id; });
    if (dd && dd.payments) {
      for (var i = dd.payments.length - 1; i >= 0; i--) {
        if (dd.payments[i].date === t.date && dd.payments[i].amount === t.amount) { dd.payments.splice(i, 1); break; }
      }
    }
    save(); route(); toast('Transaksi dihapus');
  },
  'tx-type': function (el) {
    readTx();
    var prevCats = form.type === 'in' ? CAT_IN : CAT_OUT;
    var nextType = el.getAttribute('data-v');
    var nextCats = nextType === 'in' ? CAT_IN : CAT_OUT;
    var idx = prevCats.indexOf(form.category);
    form.type = nextType;
    form.category = (idx >= 0 && nextCats[idx]) ? nextCats[idx] : nextCats[0];
    renderTxForm(form.id ? 'Ubah transaksi' : 'Catat transaksi');
  },
  'tx-save': saveTx,
  'f-type': function (el) { filter.type = el.getAttribute('data-v'); route(); },
  'f-kind': function (el) { filter.kind = el.getAttribute('data-v'); route(); },
  'f-dstatus': function (el) { filter.debtStatus = el.getAttribute('data-v'); route(); },
  'f-stock': function (el) { filter.stockFilter = el.getAttribute('data-v'); route(); },
  'prod-new': function () { openProd(null); },
  'prod-edit': function (el) { openProd(el.getAttribute('data-id')); },
  'prod-save': function (el) { saveProd(el.getAttribute('data-id')); },
  'prod-del': function (el) {
    if (!confirm('Hapus produk ini? Riwayat transaksi tetap ada.')) return;
    var id = el.getAttribute('data-id');
    db.products = db.products.filter(function (p) { return p.id !== id; });
    save(); route(); toast('Produk dihapus');
  },
  'prod-restock': function (el) { openTx(null, { type: 'out', productId: el.getAttribute('data-id') }); },
  'debt-new': function () { openDebt(''); },
  'debt-edit': function (el) { openDebt(el.getAttribute('data-id')); },
  'debt-save': saveDebt,
  'debt-pay': function (el) { openPay(el.getAttribute('data-id')); },
  'debt-paysave': function (el) { savePay(el.getAttribute('data-id')); },
  'debt-copy': function (el) {
    var d = findBy(db.debts, el.getAttribute('data-id'));
    if (!d) return;
    var r = remain(d);
    var msg = 'Halo ' + d.party + ', mengingatkan sisa pembayaran ' + rp(r) + (db.settings.name ? ' ke ' + db.settings.name : '') + '. Terima kasih.';
    copyText(msg, 'Pesan tagihan tersalin');
  },
  'debt-del': function (el) {
    if (!confirm('Hapus catatan ini?')) return;
    var id = el.getAttribute('data-id');
    db.debts = db.debts.filter(function (d) { return d.id !== id; });
    save(); route(); toast('Catatan dihapus');
  },
  'calc-tab': function (el) { calcTab = el.getAttribute('data-v'); route(); },
  'rep-copy': copyReportSummary,
  'rep-csv': exportCsv,
  'rep-print': function () { window.print(); },
  'set-save': function () {
    db.settings.name = $('s_name').value.trim();
    save(); route(); toast('Nama usaha tersimpan');
  },
  'set-backup': function () {
    download('hitungusaha-cadangan-' + today() + '.json', JSON.stringify(db), 'application/json');
  },
  'set-reset': function () {
    if (!confirm('Yakin hapus SEMUA data? Tindakan ini tidak bisa dibatalkan.')) return;
    db = { settings: { name: '' }, products: [], tx: [], debts: [] };
    save(); route(); toast('Semua data dihapus');
  }
};

document.addEventListener('click', function (e) {
  if (e.target === $('modal')) { closeModal(); return; }
  var el = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!el) return;
  var a = el.getAttribute('data-act');
  if (ACT[a]) ACT[a](el, e);
});

document.addEventListener('input', function (e) {
  var id = e.target.id || '';
  if (id.indexOf('c_') === 0) computeCalc();
  else if (id === 'f_qtx') { filter.qTx = e.target.value; route(); restoreFocus('f_qtx'); }
  else if (id === 'f_qprod') { filter.qProd = e.target.value; route(); restoreFocus('f_qprod'); }
});
function restoreFocus(id) {
  var el = $(id);
  if (el) { el.focus(); var len = el.value.length; try { el.setSelectionRange(len, len); } catch (e) {} }
}

document.addEventListener('change', function (e) {
  var id = e.target.id || '';
  if (id === 'f_month' || id === 'r_month') {
    if (e.target.value) { filter.month = e.target.value; route(); }
  } else if (id === 'f_prod' || id === 'f_qty') {
    var p = findBy(db.products, $('f_prod') ? $('f_prod').value : '');
    var q = cv('f_qty');
    if (p && q > 0) $('f_amount').value = (form.type === 'in' ? p.price : p.cost) * q;
  } else if (id === 's_file') {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.products) || !Array.isArray(d.tx) || !Array.isArray(d.debts)) throw new Error('format');
        if (!confirm('Pulihkan data dari cadangan? Data saat ini akan diganti.')) return;
        d.settings = (d.settings && typeof d.settings === 'object') ? { name: sanitizeStr(d.settings.name) } : { name: '' };
        d.products = d.products.map(function (p) {
          return { id: requiredId(p && p.id), name: sanitizeStr(p && p.name), cost: num(p && p.cost), price: num(p && p.price), stock: num(p && p.stock), minStock: num(p && p.minStock) };
        });
        d.tx = d.tx.map(function (t) {
          return { id: requiredId(t && t.id), type: (t && t.type === 'out') ? 'out' : 'in', date: sanitizeDate(t && t.date, today()), amount: num(t && t.amount), category: sanitizeStr(t && t.category), note: sanitizeStr(t && t.note), productId: cleanId(t && t.productId), qty: num(t && t.qty), debtId: cleanId(t && t.debtId), debtKind: (t && t.debtKind === 'hutang') ? 'hutang' : 'piutang' };
        });
        d.debts = d.debts.map(function (dbItem) {
          var pays = Array.isArray(dbItem && dbItem.payments) ? dbItem.payments : [];
          return { id: requiredId(dbItem && dbItem.id), kind: (dbItem && dbItem.kind === 'hutang') ? 'hutang' : 'piutang', party: sanitizeStr(dbItem && dbItem.party), phone: sanitizeStr(dbItem && dbItem.phone), total: num(dbItem && dbItem.total), date: sanitizeDate(dbItem && dbItem.date, today()), due: sanitizeDate(dbItem && dbItem.due, ''), note: sanitizeStr(dbItem && dbItem.note), payments: pays.map(function (pm) { return { date: sanitizeDate(pm && pm.date, today()), amount: num(pm && pm.amount) }; }) };
        });
        db = d;
        save(); route(); toast('Data dipulihkan');
      } catch (err) { toast('File cadangan tidak valid'); }
    };
    rd.readAsText(file);
  }
});

$('modalClose').addEventListener('click', closeModal);
document.addEventListener('keydown', function (e) {
  if ($('modal').hidden) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Tab') return;
  var els = $('modal').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  var vis = [];
  for (var i = 0; i < els.length; i++) { if (els[i].offsetParent !== null) vis.push(els[i]); }
  if (!vis.length) return;
  var first = vis[0], last = vis[vis.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
$('btnQuick').addEventListener('click', function () { ACT['tx-new'](); });
window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
window.addEventListener('beforeunload', function (e) {
  if (!$('modal').hidden) { e.preventDefault(); e.returnValue = ''; }
});
try {
  if (typeof window !== 'undefined') window.HU = { num: num, rp: rp, pct: pct, monthShift: monthShift, monthLabel: monthLabel };
} catch (e) {}
route();
})();
