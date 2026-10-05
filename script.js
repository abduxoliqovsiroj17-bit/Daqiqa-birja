(function () {
  var START = 10000;
  var HIST = 60;
  var assets = [
    { id: 'btc',  name: 'Bitcoin',      price: 67250, vol: 0.004 },
    { id: 'eth',  name: 'Ethereum',     price: 3480,  vol: 0.005 },
    { id: 'xau',  name: 'Oltin',        price: 2385,  vol: 0.0015 },
    { id: 'oil',  name: 'Neft (Brent)', price: 82.4,  vol: 0.003 },
    { id: 'tsla', name: 'Tesla',        price: 248.5, vol: 0.006 }
  ];
  var state = { balance: START, positions: [], nextId: 1 };
  var selected = 'btc';
  var fast = false;
  var remaining = 60;
  var STORE = 'daqiqa-birja-v1';

  function step(vol) { return (Math.random() + Math.random() + Math.random() - 1.5) * vol * 2; }

  function initHistory() {
    assets.forEach(function (a) {
      var arr = [a.price], p = a.price;
      for (var i = 1; i < HIST; i++) { p = p / (1 + step(a.vol)); arr.unshift(p); }
      a.hist = arr;
      a.price = arr[arr.length - 1];
    });
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && typeof s.balance === 'number' && Array.isArray(s.positions)) { state = s; }
    } catch (e) {}
  }

  function get(id) { return assets.filter(function (a) { return a.id === id; })[0]; }
  function num(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ');
  }
  function usd(n) { return '$' + num(Math.abs(n)); }
  function signed(n) { return (n >= 0 ? '+' : '−') + usd(n); }
  function pct(n) { return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%'; }
  function cls(n) { return n >= 0 ? 'plus' : 'minus'; }
  function pl(p) {
    var a = get(p.assetId);
    var dir = p.side === 'long' ? 1 : -1;
    var v = p.amount * (a.price / p.entry - 1) * dir;
    return { v: v, pct: v / p.amount * 100 };
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function renderAssets() {
    var box = document.getElementById('assets');
    box.innerHTML = '';
    assets.forEach(function (a) {
      var prev = a.hist[a.hist.length - 2];
      var c = (a.price / prev - 1) * 100;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'asset';
      b.setAttribute('aria-pressed', a.id === selected ? 'true' : 'false');
      b.innerHTML = '<div class="n">' + a.name + '</div><div class="p">$' + num(a.price) + '</div><div class="c ' + cls(c) + '">' + pct(c) + '</div>';
      b.addEventListener('click', function () { selected = a.id; renderAll(); });
      box.appendChild(b);
    });
  }

  function renderMain() {
    var a = get(selected);
    var prev = a.hist[a.hist.length - 2];
    var c = (a.price / prev - 1) * 100;
    document.getElementById('price').textContent = '$' + num(a.price);
    var ch = document.getElementById('chg');
    ch.textContent = pct(c) + ' (oxirgi yangilanish)';
    ch.className = 'chg ' + cls(c);
    drawChart(a);
  }

  function drawChart(a) {
    var W = 600, H = 220, pad = 10;
    var h = a.hist;
    var mn = Math.min.apply(null, h), mx = Math.max.apply(null, h);
    var span = (mx - mn) || 1;
    var lo = mn - span * 0.1, hi = mx + span * 0.1;
    function X(i) { return (i / (h.length - 1)) * W; }
    function Y(v) { return H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2); }
    var up = h[h.length - 1] >= h[0];
    var color = up ? 'var(--up)' : 'var(--down)';
    var pts = h.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); });
    var s = '';
    for (var g = 0; g <= 4; g++) {
      var gy = pad + g * (H - pad * 2) / 4;
      s += '<line x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--chart-grid)" stroke-width="1"/>';
    }
    s += '<polygon points="0,' + H + ' ' + pts.join(' ') + ' ' + W + ',' + H + '" fill="' + color + '" opacity="0.10"/>';
    s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    state.positions.forEach(function (p) {
      if (p.assetId !== a.id) return;
      if (p.entry < lo || p.entry > hi) return;
      var y = Y(p.entry);
      s += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 5"/>';
      s += '<text x="6" y="' + (y - 5) + '" font-size="12" fill="var(--accent)" font-family="Onest, sans-serif">kirish narxi</text>';
    });
    s += '<circle cx="' + X(h.length - 1) + '" cy="' + Y(h[h.length - 1]) + '" r="5" fill="' + color + '"/>';
    document.getElementById('chart').innerHTML = s;
    document.getElementById('axl').textContent = fast ? 'oldingi narxlar' : (HIST + ' daqiqa oldin');
  }

  function renderPositions() {
    var box = document.getElementById('posbox');
    if (!state.positions.length) {
      box.innerHTML = '<div class="empty">Hali pozitsiya yo\'q. Summani kiriting va yo\'nalishni tanlang.</div>';
      return;
    }
    var rows = state.positions.map(function (p) {
      var a = get(p.assetId), r = pl(p);
      return '<tr>' +
        '<td><b>' + a.name + '</b></td>' +
        '<td><span class="tag ' + (p.side === 'long' ? 'up' : 'down') + '">' + (p.side === 'long' ? 'Oshadi' : 'Tushadi') + '</span></td>' +
        '<td class="r">' + usd(p.amount) + '</td>' +
        '<td class="r">$' + num(p.entry) + '</td>' +
        '<td class="r">$' + num(a.price) + '</td>' +
        '<td class="r ' + cls(r.v) + '"><b>' + signed(r.v) + '</b> <span>(' + pct(r.pct) + ')</span></td>' +
        '<td class="r"><button class="close" type="button" data-id="' + p.id + '">Yopish</button></td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>Aktiv</th><th>Yo\'nalish</th><th class="r">Summa</th><th class="r">Kirish narxi</th><th class="r">Hozirgi narx</th><th class="r">Foyda / zarar</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    Array.prototype.forEach.call(box.querySelectorAll('.close'), function (b) {
      b.addEventListener('click', function () { closePos(Number(b.getAttribute('data-id')), false); });
    });
  }

  function renderStats() {
    var open = 0, plSum = 0;
    state.positions.forEach(function (p) { var r = pl(p); open += p.amount + r.v; plSum += r.v; });
    var eq = state.balance + open;
    document.getElementById('bal').textContent = '$' + num(state.balance);
    document.getElementById('eq').textContent = '$' + num(eq);
    var t = document.getElementById('tot');
    t.textContent = signed(eq - START);
    t.className = 'v ' + cls(eq - START);
  }

  function renderHint() {
    var v = parseFloat(document.getElementById('amt').value);
    var el = document.getElementById('hint');
    if (!(v > 0)) {
      el.innerHTML = 'Summani kiriting — narx 1% o\'zgarsa qancha foyda yoki zarar bo\'lishini ko\'rasiz.';
      return;
    }
    var a = get(selected), d = v * 0.01;
    el.innerHTML = a.name + ' narxi <b>$' + num(a.price) + '</b> dan kirasiz.<br>' +
      'Narx 1% o\'zgarsa: to\'g\'ri yo\'nalishda <b class="plus">+' + usd(d) + '</b>, teskarisida <b class="minus">−' + usd(d) + '</b>.';
  }

  function renderAll() { renderAssets(); renderMain(); renderPositions(); renderStats(); renderHint(); }

  function openPos(side) {
    var err = document.getElementById('err');
    err.textContent = '';
    var v = parseFloat(document.getElementById('amt').value);
    if (!(v > 0)) { err.textContent = 'Summani kiriting (0 dan katta).'; return; }
    if (v > state.balance + 1e-9) { err.textContent = 'Balans yetarli emas. Bo\'sh balans: $' + num(state.balance); return; }
    var a = get(selected);
    state.balance -= v;
    state.positions.push({ id: state.nextId++, assetId: a.id, side: side, amount: v, entry: a.price });
    save();
    toast(a.name + ': ' + usd(v) + ' bilan pozitsiya ochildi');
    renderAll();
  }

  function closePos(id, auto) {
    var idx = -1;
    state.positions.forEach(function (p, i) { if (p.id === id) idx = i; });
    if (idx < 0) return;
    var p = state.positions[idx], r = pl(p);
    var back = Math.max(0, p.amount + r.v);
    state.balance += back;
    state.positions.splice(idx, 1);
    save();
    if (auto) toast(get(p.assetId).name + ': zarar summadan oshdi, pozitsiya avtomatik yopildi');
    else toast('Yopildi: ' + signed(r.v));
    renderAll();
  }

  function tick() {
    assets.forEach(function (a) {
      a.price = a.price * (1 + step(a.vol));
      a.hist.push(a.price);
      if (a.hist.length > HIST) a.hist.shift();
    });
    state.positions.slice().forEach(function (p) {
      if (pl(p).v <= -p.amount) closePos(p.id, true);
    });
    renderAll();
  }

  function period() { return fast ? 5 : 60; }
  function tickTimer() {
    remaining -= 1;
    if (remaining <= 0) { tick(); remaining = period(); }
    paintTimer();
  }
  function paintTimer() {
    document.getElementById('count').textContent = remaining;
    document.getElementById('bar').style.width = (100 - (remaining / period()) * 100) + '%';
  }

  function build() {
    var q = document.getElementById('quick');
    [100, 500, 1000, 5000].forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = '$' + n;
      b.addEventListener('click', function () { document.getElementById('amt').value = n; renderHint(); });
      q.appendChild(b);
    });
    document.getElementById('amt').addEventListener('input', function () { document.getElementById('err').textContent = ''; renderHint(); });
    document.getElementById('buy').addEventListener('click', function () { openPos('long'); });
    document.getElementById('sell').addEventListener('click', function () { openPos('short'); });
    document.getElementById('speed').addEventListener('click', function (e) {
      fast = !fast;
      e.currentTarget.setAttribute('aria-pressed', fast ? 'true' : 'false');
      e.currentTarget.textContent = 'Tezkor rejim: ' + (fast ? 'yoqilgan (5 soniya)' : 'o\'chiq');
      remaining = period(); paintTimer(); renderMain();
    });
    document.getElementById('reset').addEventListener('click', function () {
      state = { balance: START, positions: [], nextId: 1 };
      save(); initHistory(); remaining = period(); paintTimer(); renderAll();
      toast('Boshidan boshlandi: balans $' + num(START));
    });
  }

  load();
  initHistory();
  build();
  renderAll();
  paintTimer();
  setInterval(tickTimer, 1000);
})();