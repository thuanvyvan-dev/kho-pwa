// Vỏ app cài đặt (PWA) cho Web App Kho / Cân — chạy trên GitHub Pages, không banner Google.
// - Lấy giao diện từ Web App (/exec?p=ui&app=kho|can), lưu Cache Storage → lần sau mở tức thì, bản mới tải ngầm.
// - Hiện giao diện trong iframe srcdoc (cùng origin), thay google.script.run bằng gọi API POST {type:'rpc'} (không PIN).
// - Link /exec chỉ lưu trên máy (localStorage), KHÔNG nằm trong repo công khai này.
(function () {
  var APP = window.APP || 'kho';
  // Gốc site (thư mục chứa shell.js) → link giữa các app: Hoá chất /kho/, Gia công /gc/, Cân /can/, Kho phế /can/kho/ (trong app Cân)
  var ROOT = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : new URL('../', location.href).href;
  var URLS = { hc: ROOT + 'kho/', gc: ROOT + 'gc/', can: ROOT + 'can/', phe: ROOT + 'can/kho/' };
  var LS = 'KHO_PWA_CFG';
  // Nhận mọi dạng link Web App có /macros/s/<id>/ (dán cả link dài cũng được)
  function execOf_(v) { var m = String(v || '').match(/macros\/s\/([\w-]{20,})/); return m ? 'https://script.google.com/macros/s/' + m[1] + '/exec' : ''; }
  var cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { cfg = {}; }
  // Link cài lần đầu: .../kho/#u=<link /exec>  (phần sau # không gửi lên máy chủ nào)
  var h = location.hash.replace(/^#/, '');
  if (h) {
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i < 0) return;
      var k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1));
      if (k === 'u') { var ex = execOf_(v); if (ex) cfg.exec = ex; }
    });
    try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.search);
  }
  cfg.pin = '-';   // không PIN (người dùng chốt 25/11)
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
    $('sGo').onclick = function () {
      var u = execOf_($('sUrl').value);
      if (!u) { $('sMsg').textContent = 'Dán link Web App Kho vào ô trên'; $('sUrlBox').style.display = 'block'; return; }
      cfg.exec = u; $('sMsg').textContent = '⏳ Đang thử…';
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

  function syncFrameViewport_() {
    var f = $('app');
    if (!f || !window.visualViewport) return;
    f.style.height = Math.round(window.visualViewport.height) + 'px';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncFrameViewport_);
    window.visualViewport.addEventListener('scroll', syncFrameViewport_);
  }

  function mount(html) {
    if (!/interactive-widget=resizes-content/i.test(html)) {
      if (/<meta[^>]+name=["']viewport["']/i.test(html)) {
        html = html.replace(/(<meta[^>]+name=["']viewport["'][^>]*content=["'][^"']*)(["'])/i, '$1, interactive-widget=resizes-content$2');
      } else {
        html = html.replace(/<head[^>]*>/i, function (m) { return m + '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content, viewport-fit=cover">'; });
      }
    }
    var pre = '<script>window.KHO_PWA=' + JSON.stringify({ app: APP, urls: URLS, khoUrl: APP === 'can' ? URLS.phe : URLS.hc, canUrl: URLS.can }) + ';' + SHIM + '<\/script>';
    var i = html.search(/<head[^>]*>/i);
    html = i >= 0 ? html.replace(/<head[^>]*>/i, function (m) { return m + pre; }) : pre + html;
    var f = $('app');
    if (!f) {
      f = document.createElement('iframe'); f.id = 'app';
      f.setAttribute('allow', 'clipboard-write; clipboard-read');
      document.body.appendChild(f);
    }
    f.srcdoc = html;
    syncFrameViewport_();
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
        else if (old !== t) {
          var stuck = false;
          try {
            var f = $('app'), il = f && f.contentDocument && f.contentDocument.getElementById('itemList');
            if (il && /Đang mở dữ liệu kho/i.test(il.textContent || '')) stuck = true;
          } catch (e) {}
          if (stuck) mount(t);
          else $('upd').style.display = 'block';   // bản mới: lần mở sau tự dùng, hoặc chạm để dùng ngay
        }
      }, function (e) {
        if (!old) { $('boot').textContent = '❌ Không tải được giao diện: ' + e.message + ' — kiểm tra mạng rồi mở lại.'; }
      });
    });
  }

  // Trang Cân đứng riêng (không nằm trong Kho): "← Kho" → mở app Kho
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.khoMsg === 'show-kho' && APP === 'can' && window.top === window) location.href = URLS.phe;
  });
  $('upd').onclick = function () { location.reload(); };
  // Nút cài app (Chrome Android/máy tính): Chrome báo được phép cài → hiện nút to; đã cài/đang chạy dạng app thì không hiện
  var instEv = null;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); instEv = e; if (!standalone && $('inst')) $('inst').style.display = 'block'; });
  window.addEventListener('appinstalled', function () { instEv = null; if ($('inst')) $('inst').style.display = 'none'; });
  if ($('inst')) $('inst').onclick = function () { if (!instEv) return; instEv.prompt(); instEv.userChoice.then(function () { instEv = null; $('inst').style.display = 'none'; }); };

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (!cfg.exec) setup('');
  else start();
})();
