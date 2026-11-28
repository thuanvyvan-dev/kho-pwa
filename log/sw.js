var C='kholog-202611280157',F=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(F.map(function(x){return new Request(x,{cache:'reload'})}))}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf('kholog-')===0&&k!==C}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){var q=e.request,u=new URL(q.url);if(q.method!=='GET'||u.origin!==location.origin)return;
var page=q.mode==='navigate'||/\/(index\.html)?$/.test(u.pathname);
e.respondWith(caches.open(C).then(function(c){
var net=fetch(q,{cache:'no-cache'}).then(function(r){if(r&&r.ok)c.put(q,r.clone());return r});
return c.match(q,{ignoreSearch:true}).then(function(hit){
if(!page){if(hit){net.catch(function(){});return hit}return net}
if(!hit)return net;
return new Promise(function(ok){var t=setTimeout(function(){ok(hit)},4000);net.then(function(r){clearTimeout(t);ok(r&&r.ok?r:hit)},function(){clearTimeout(t);ok(hit)})})})}))});
