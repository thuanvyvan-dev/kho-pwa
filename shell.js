// Vỏ app cài đặt (PWA) cho Web App Kho / Cân — chạy trên GitHub Pages, không banner Google.
// - Lấy giao diện từ Web App (/exec?p=ui&app=kho|can), lưu Cache Storage → lần sau mở tức thì, bản mới tải ngầm.
// - Hiện giao diện trong iframe srcdoc (cùng origin), thay google.script.run bằng gọi API POST {type:'rpc'} có PIN.
// - Link /exec + PIN chỉ lưu trên máy (localStorage), KHÔNG nằm trong repo công khai này.
(function () {
  var APP = window.APP || 'kho';
  var LS = 'KHO_PWA_CFG';
  var cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { cfg = {}; }
  // Link cài lần đầu: .../kho/#u=<link /exec>  (phần sau # không gửi lên máy chủ nào)
  var h = location.hash.replace(/^#/, '');
  if (h) {
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i < 0) return;
      var k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1));
      if (k === 'u' && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v)) cfg.exec = v;
    });
    try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.search);
  }
  var $ = function (id) { return document.getElementById(id); };
  var UI_CACHE = 'kho-ui-v1', UI_KEY = location.pathname.replace(/[^/]*$/, '') + '__ui_' + APP;

  function rpc(fn, args) {
    return fetch(cfg.exec, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'rpc', fn: fn, args: args || [], pin: cfg.pin }) })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Máy chủ trả lỗi: ' + String(t).slice(0, 120)); }
        if (!j.ok) {
          if (j.code === 'PIN' || j.code === 'NOPIN') setTimeout(function () { setup(j.e); }, 0);
          throw new Error(j.e || 'Lỗi');
        }
        return j.r;
      }, function (e) { throw new Error('Mất mạng / không gọi được máy chủ (' + (e && e.message || e) + ')'); });
  }
  window.KHO_RPC = rpc;

  function setup(msg) {
    var f = $('app'); if (f) f.remove();
    var s = $('setup'); s.style.display = 'block';
    $('sMsg').textContent = msg || '';
    $('sUrl').value = cfg.exec || '';
    $('sUrlBox').style.display = cfg.exec ? 'none' : 'block';
    $('sPin').value = '';
    $('sGo').onclick = function () {
      var u = $('sUrl').value.trim(), p = $('sPin').value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)) { $('sMsg').textContent = 'Link Web App phải dạng https://script.google.com/macros/s/…/exec'; $('sUrlBox').style.display = 'block'; return; }
      if (!p) { $('sMsg').textContent = 'Nhập PIN'; return; }
      cfg.exec = u; cfg.pin = p; $('sMsg').textContent = '⏳ Đang thử…';
      rpc('apiPing', []).then(function () {
        try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {}
        s.style.display = 'none'; start();
      }, function (e) { $('sMsg').textContent = '❌ ' + e.message; });
    };
  }

  // google.script.run giả: cùng cách gọi withSuccessHandler / withFailureHandler / withUserObject
  var SHIM = '(function(){var R=parent.KHO_RPC;function mk(s,f,u){return new Proxy({},{get:function(_,p){' +
    'if(p==="withSuccessHandler")return function(x){return mk(x,f,u)};if(p==="withFailureHandler")return function(x){return mk(s,x,u)};' +
    'if(p==="withUserObject")return function(x){return mk(s,f,x)};return function(){var a=[].slice.call(arguments);' +
    'R(p,a).then(function(r){if(s)s(r,u)},function(e){if(f)f(e,u);else console.error(e)})}}})}' +
    'window.google={script:{run:new Proxy({},{get:function(_,p){return mk()[p]}})}};})();';

  function mount(html) {
    var pre = '<script>window.KHO_PWA=' + JSON.stringify({ app: APP, khoUrl: '../kho/', canUrl: '../can/' }) + ';' + SHIM + '<\/script>';
    var i = html.search(/<head[^>]*>/i);
    html = i >= 0 ? html.replace(/<head[^>]*>/i, function (m) { return m + pre; }) : pre + html;
    var f = $('app');
    if (!f) {
      f = document.createElement('iframe'); f.id = 'app';
      f.setAttribute('allow', 'clipboard-write; clipboard-read');
      document.body.appendChild(f);
    }
    f.srcdoc = html;
    $('boot').style.display = 'none';
  }

  function fetchUi() {
    return fetch(cfg.exec + '?p=ui&app=' + APP, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      if (!/<html/i.test(t)) throw new Error('Giao diện tải về không đúng');
      return t;
    });
  }

  function start() {
    var hasCaches = 'caches' in window;
    var getCached = hasCaches ? caches.open(UI_CACHE).then(function (c) { return c.match(UI_KEY); }).then(function (r) { return r ? r.text() : null; }) : Promise.resolve(null);
    getCached.then(function (old) {
      if (old) mount(old);
      fetchUi().then(function (t) {
        if (hasCaches) caches.open(UI_CACHE).then(function (c) { c.put(UI_KEY, new Response(t, { headers: { 'Content-Type': 'text/html' } })); });
        if (!old) mount(t);
        else if (old !== t) $('upd').style.display = 'block';   // bản mới: lần mở sau tự dùng, hoặc chạm để dùng ngay
      }, function (e) {
        if (!old) { $('boot').textContent = '❌ Không tải được giao diện: ' + e.message + ' — kiểm tra mạng rồi mở lại.'; }
      });
    });
  }

  // Trang Cân đứng riêng (không nằm trong Kho): "← Kho" → mở app Kho
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.khoMsg === 'show-kho' && APP === 'can' && window.top === window) location.href = '../kho/';
  });
  $('upd').onclick = function () { location.reload(); };

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (!cfg.exec || !cfg.pin) setup(cfg.exec ? 'Nhập PIN (đặt PIN ở link Web App cũ thêm ?p=pin)' : '');
  else start();
})();
