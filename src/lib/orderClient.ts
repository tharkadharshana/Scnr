// The guest's ordering script for a Restaurant Kit page: add buttons -> cart sheet -> order code -> live status -> find an order again.
// One self-contained block (style + data + vanilla script) appended to the page by guestPage.ts only when the owner switched ordering on.
// Buttons it listens for (any design): [data-scnr="add"][data-ref="<section>.<item>"], [data-scnr="cart-bar"], [data-scnr="order"].
// Self-check: npx tsx src/lib/orderClient.ts
import type { Lang } from './guestPage.js';

const UI: Record<Lang, Record<string, string>> = {
  en: { menu: 'Order from the menu', add: 'Add', view: 'View order', title: 'Your order', dine: 'Dine in', take: 'Takeaway', table: 'Table number', pickup: 'Pickup time (optional)', name: 'Your name', phone: 'Phone number', note: 'Note for the kitchen (optional)', place: 'Place order', placing: 'Sending…', total: 'Total', code: 'Your order code', find: 'Find my order', findHelp: 'Enter your code and the phone number you ordered with.', go: 'Find', close: 'Close', more: 'Order more', empty: 'Your order is empty.', paid: 'Paid', pay: 'Pay at the counter', items: 'items', net: 'No connection. Please try again.', save: 'Keep this code. Your status updates here by itself.', new: 'Received', accepted: 'Accepted', cooking: 'Cooking', ready: 'Ready', delivered: 'Served', cancelled: 'Cancelled', rejected: 'Not accepted' },
  si: { menu: 'මෙනුවෙන් ඇණවුම් කරන්න', add: 'එක් කරන්න', view: 'ඇණවුම බලන්න', title: 'ඔබේ ඇණවුම', dine: 'මෙහි ආහාර ගැනීම', take: 'රැගෙන යාම', table: 'මේස අංකය', pickup: 'ගන්නා වේලාව (අවශ්‍ය නම්)', name: 'ඔබේ නම', phone: 'දුරකථන අංකය', note: 'මුළුතැන්ගෙයට සටහනක් (අවශ්‍ය නම්)', place: 'ඇණවුම කරන්න', placing: 'යවමින්…', total: 'මුළු එකතුව', code: 'ඔබේ ඇණවුම් කේතය', find: 'මගේ ඇණවුම සොයන්න', findHelp: 'ඔබේ කේතය සහ ඇණවුමට භාවිතා කළ දුරකථන අංකය ඇතුළත් කරන්න.', go: 'සොයන්න', close: 'වසන්න', more: 'තවත් ඇණවුම් කරන්න', empty: 'ඔබේ ඇණවුම හිස්ය.', paid: 'ගෙවා ඇත', pay: 'කවුන්ටරයේදී ගෙවන්න', items: 'අයිතම', net: 'සම්බන්ධතාවය නැත. නැවත උත්සාහ කරන්න.', save: 'මෙම කේතය තබාගන්න. තත්ත්වය මෙහි ස්වයංක්‍රීයව යාවත්කාලීන වේ.', new: 'ලැබුණා', accepted: 'පිළිගත්තා', cooking: 'සකසමින්', ready: 'සූදානම්', delivered: 'ලබා දුන්නා', cancelled: 'අවලංගුයි', rejected: 'පිළිගත්තේ නැත' },
  ta: { menu: 'மெனுவிலிருந்து ஆர்டர் செய்', add: 'சேர்', view: 'ஆர்டரைப் பார்', title: 'உங்கள் ஆர்டர்', dine: 'இங்கே சாப்பிட', take: 'எடுத்துச் செல்ல', table: 'மேசை எண்', pickup: 'எடுக்கும் நேரம் (விருப்பம்)', name: 'உங்கள் பெயர்', phone: 'தொலைபேசி எண்', note: 'சமையலறைக்கான குறிப்பு (விருப்பம்)', place: 'ஆர்டர் செய்', placing: 'அனுப்புகிறது…', total: 'மொத்தம்', code: 'உங்கள் ஆர்டர் குறியீடு', find: 'என் ஆர்டரைக் கண்டுபிடி', findHelp: 'உங்கள் குறியீடு மற்றும் ஆர்டருக்குப் பயன்படுத்திய தொலைபேசி எண்ணை உள்ளிடவும்.', go: 'தேடு', close: 'மூடு', more: 'மேலும் ஆர்டர் செய்', empty: 'உங்கள் ஆர்டர் காலியாக உள்ளது.', paid: 'செலுத்தப்பட்டது', pay: 'கவுண்டரில் செலுத்தவும்', items: 'பொருட்கள்', net: 'இணைப்பு இல்லை. மீண்டும் முயற்சிக்கவும்.', save: 'இந்தக் குறியீட்டை வைத்திருங்கள். நிலை இங்கே தானாக மாறும்.', new: 'பெறப்பட்டது', accepted: 'ஏற்கப்பட்டது', cooking: 'சமைக்கப்படுகிறது', ready: 'தயார்', delivered: 'வழங்கப்பட்டது', cancelled: 'ரத்து', rejected: 'ஏற்கப்படவில்லை' },
};

const CSS = `[data-scnr=cart-bar]:not(#sc-bar){display:none!important}
.ad{width:32px;height:32px;border-radius:50%!important;padding:0!important;font-size:20px;line-height:1;flex-shrink:0}
#sc-bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:9998;max-width:456px;margin:0 auto;display:none;align-items:center;justify-content:space-between;gap:10px;background:#16171b;color:#fff;border:0;border-radius:14px;padding:13px 16px;font:600 15px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);cursor:pointer;width:calc(100% - 24px)}
#sc-bar.on{display:flex} #sc-bar small{font-weight:500;opacity:.8}
#sc-sheet{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center} #sc-sheet.on{display:flex}
#sc-sheet .p{background:#fff;color:#16171b;width:100%;max-width:480px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px 16px 22px;font:15px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Sinhala','Noto Sans Tamil',sans-serif;box-sizing:border-box}
#sc-sheet h3{margin:0 0 10px;font-size:18px;display:flex;justify-content:space-between;align-items:center} #sc-sheet h3 button{background:none;color:#555;font-size:22px;padding:0 4px}
#sc-sheet button{font:inherit;border:0;border-radius:10px;cursor:pointer} #sc-sheet .pri{width:100%;background:#16171b;color:#fff;padding:13px;font-weight:600;margin-top:12px} #sc-sheet .pri[disabled]{opacity:.5}
#sc-sheet .ln{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee} #sc-sheet .ln b{flex:1;font-weight:600} #sc-sheet .q{display:flex;align-items:center;gap:8px} #sc-sheet .q button{width:30px;height:30px;background:#f1f1f3;color:#16171b;font-size:18px;line-height:1}
#sc-sheet .tot{display:flex;justify-content:space-between;font-weight:700;padding:10px 0;font-size:16px}
#sc-sheet label{display:block;font-size:13px;color:#555;margin-top:10px} #sc-sheet input,#sc-sheet textarea{display:block;width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #d8d8dc;border-radius:10px;margin-top:4px}
#sc-sheet .seg{display:flex;gap:8px;margin-top:6px} #sc-sheet .seg button{flex:1;padding:10px;background:#f1f1f3;color:#16171b} #sc-sheet .seg button.on{background:#16171b;color:#fff}
#sc-sheet .err{color:#b42318;font-size:13px;margin-top:8px} #sc-sheet .code{font:700 40px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-align:center;margin:8px 0} #sc-sheet .muted{color:#666;font-size:13px;text-align:center}
#sc-sheet .steps{display:flex;gap:4px;margin:12px 0} #sc-sheet .steps i{flex:1;height:6px;border-radius:3px;background:#e4e4e8} #sc-sheet .steps i.on{background:#16a34a} #sc-sheet .st{text-align:center;font-weight:700;font-size:18px}
#sc-sheet .lnk{background:none;color:#555;text-decoration:underline;display:block;margin:12px auto 0;padding:6px}`;

// The script runs in the guest's browser. Menu data: M.c currency, M.s[section][item] = { k: base name (the server checks it), n: shown name, v: unit price }.
const CLIENT = `(function(){
var E=document.getElementById('sc-ord'),M=JSON.parse(E.textContent),L=M.L,SLUG=M.slug,KEY='scnr-order:'+SLUG,GK='scnr-guest';
function ls(k,v){try{var s=k===GK?sessionStorage:localStorage;if(v===undefined)return JSON.parse(s.getItem(k)||'null');if(v===null)s.removeItem(k);else s.setItem(k,JSON.stringify(v))}catch(e){return null}}
function x(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function $(i){return document.getElementById(i)}
function money(n){var t=(Math.round(n*100)/100).toString();return(M.c==='USD'?'$':M.c?M.c+' ':'')+t}
var hasAdd=!!document.querySelector('[data-scnr=add][data-ref]:not([data-ref=""])');
var cart={},idem=null,view='cart',ord=ls(KEY),st=null,timer=null,err='',busy=false,type='dine_in',g=ls(GK)||{};
function lines(){var o=[];for(var r in cart){var p=r.split('.'),it=M.s[p[0]]&&M.s[p[0]][p[1]];if(it)o.push({r:r,s:+p[0],i:+p[1],it:it,q:cart[r]})}return o}
function count(){var n=0;for(var r in cart)n+=cart[r];return n}
function sum(){return lines().reduce(function(a,l){return a+l.it.v*l.q},0)}
var bar=document.createElement('button'),sheet=document.createElement('div');bar.id='sc-bar';bar.type='button';bar.setAttribute('data-scnr','cart-bar');sheet.id='sc-sheet';
document.body.appendChild(bar);document.body.appendChild(sheet);
function open(v){view=v||view;if(view==='cart'&&!count()&&!ord&&!hasAdd)view='menu';sheet.className='on';draw()}
function close(){sheet.className='';poll()}
function chip(){
  var n=count();
  if(n){bar.className='on';bar.innerHTML='<span>'+x(L.view)+' · '+n+' '+x(L.items)+'</span><span>'+(M.priced?x(money(sum())):'')+'</span>'}
  else if(ord&&st&&st.status!=='delivered'&&st.status!=='cancelled'&&st.status!=='rejected'){bar.className='on';bar.innerHTML='<span>#'+x(ord.code)+' · '+x(L[st.status]||st.status)+'</span><small>'+x(L.view)+'</small>'}
  else if(!hasAdd){bar.className='on';bar.innerHTML='<span>'+x(L.menu)+'</span>'}
  else bar.className='';
}
function draw(){
  var h='<div class="p"><h3><span>'+x(view==='find'?L.find:L.title)+'</span><button type="button" data-a="close" aria-label="'+x(L.close)+'">×</button></h3>';
  if(view==='menu'){
    M.s.forEach(function(sec,a){sec.forEach(function(it,b){var r=a+'.'+b;h+='<div class="ln"><b>'+x(it.n)+'</b><span>'+(M.priced&&it.v?x(money(it.v)):'')+'</span><span class="q"><button type="button" data-a="add" data-r="'+r+'" aria-label="'+x(L.add)+'">+</button>'+(cart[r]?'<span>'+cart[r]+'</span>':'')+'</span></div>'})});
    if(count())h+='<button type="button" class="pri" data-a="tocart">'+x(L.view)+' · '+count()+' '+x(L.items)+'</button>';
  }else if(view==='status'&&ord){
    var flow=['new','accepted','cooking','ready','delivered'],s=st?st.status:'new',k=flow.indexOf(s);
    h+='<div class="muted">'+x(L.code)+'</div><div class="code">'+x(ord.code)+'</div><div class="steps">'+flow.map(function(f,j){return'<i class="'+(j<=k?'on':'')+'"></i>'}).join('')+'</div><div class="st">'+x(L[s]||s)+'</div>';
    if(st){h+=st.items.map(function(l){return'<div class="ln"><b>'+x(l.qty)+' × '+x(l.name)+'</b></div>'}).join('')+'<div class="tot"><span>'+x(L.total)+'</span><span>'+x(st.total?money(+st.total):'')+(st.paid?' · '+x(L.paid):'')+'</span></div>'}
    h+='<div class="muted">'+x(L.save)+'</div><button type="button" class="pri" data-a="more">'+x(L.more)+'</button>';
  }else if(view==='find'){
    h+='<div class="muted">'+x(L.findHelp)+'</div><label>'+x(L.code)+'<input id="f-code" maxlength="4" autocapitalize="characters" autocomplete="off"></label><label>'+x(L.phone)+'<input id="f-phone" type="tel" inputmode="tel" autocomplete="tel"></label>'+(err?'<div class="err" role="alert">'+x(err)+'</div>':'')+'<button type="button" class="pri" data-a="dofind"'+(busy?' disabled':'')+'>'+x(L.go)+'</button>';
  }else{
    var ls_=lines();
    if(!ls_.length)h+='<div class="muted">'+x(L.empty)+'</div>';
    else{
      h+=ls_.map(function(l){return'<div class="ln"><b>'+x(l.it.n)+'</b><span>'+(M.priced&&l.it.v?x(money(l.it.v*l.q)):'')+'</span><span class="q"><button type="button" data-a="dec" data-r="'+l.r+'">−</button>'+l.q+'<button type="button" data-a="inc" data-r="'+l.r+'">+</button></span></div>'}).join('');
      if(M.priced)h+='<div class="tot"><span>'+x(L.total)+'</span><span>'+x(money(sum()))+'</span></div>';
      h+='<div class="seg"><button type="button" data-a="type" data-t="dine_in" class="'+(type==='dine_in'?'on':'')+'">'+x(L.dine)+'</button><button type="button" data-a="type" data-t="takeaway" class="'+(type==='takeaway'?'on':'')+'">'+x(L.take)+'</button></div>';
      h+=type==='dine_in'?'<label>'+x(L.table)+'<input id="o-table" maxlength="10" value="'+x(g.table||'')+'"></label>':'<label>'+x(L.pickup)+'<input id="o-pickup" maxlength="20"></label>';
      h+='<label>'+x(L.name)+'<input id="o-name" maxlength="60" autocomplete="name" value="'+x(g.name||'')+'"></label><label>'+x(L.phone)+'<input id="o-phone" type="tel" inputmode="tel" pattern="[0-9+\\\\(\\\\)\\\\s\\\\-]*" autocomplete="tel" value="'+x(g.phone||'')+'"></label><label>'+x(L.note)+'<textarea id="o-note" maxlength="200" rows="2">'+x(g.note||'')+'</textarea></label><div style="position:absolute;left:-9999px" aria-hidden="true"><input id="o-hp" tabindex="-1" autocomplete="off"></div>'+(err?'<div class="err" role="alert">'+x(err)+'</div>':'')+'<button type="button" class="pri" data-a="place"'+(busy?' disabled':'')+'>'+x(busy?L.placing:L.place)+'</button>';
    }
    h+='<button type="button" class="lnk" data-a="gofind">'+x(L.find)+'</button>';
  }
  sheet.innerHTML=h+'</div>';
}
function val(i){var e=$(i);return e?e.value:''}
function keep(){if(!$('o-name'))return;g={name:val('o-name'),phone:val('o-phone'),table:val('o-table')||g.table,note:val('o-note')};ls(GK,{name:g.name,phone:g.phone,table:g.table})}
function post(path,body){return fetch('/'+SLUG+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){return{ok:r.ok,j:j}})})}
function place(){
  keep();err='';busy=true;draw();idem=idem||(self.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2));
  post('/order',{items:lines().map(function(l){return{s:l.s,i:l.i,k:l.it.k,q:l.q}}),type:type,table:val('o-table'),pickup:val('o-pickup'),name:val('o-name'),phone:val('o-phone'),note:val('o-note'),idem:idem,_hp:val('o-hp')})
  .then(function(r){busy=false;if(!r.ok){err=r.j.error||L.net;draw();return}
    ord={token:r.j.token,code:r.j.code};ls(KEY,ord);st=r.j;cart={};idem=null;view='status';draw();chip();schedule()})
  .catch(function(){busy=false;err=L.net;draw()});
}
function dofind(){
  err='';busy=true;draw();
  post('/order/find',{code:val('f-code'),phone:val('f-phone')}).then(function(r){busy=false;
    if(!r.ok||!r.j.token){err=r.j.error||L.net;draw();return}
    ord={token:r.j.token,code:val('f-code').toUpperCase()};ls(KEY,ord);view='status';poll()}).catch(function(){busy=false;err=L.net;draw()});
}
function poll(){
  if(!ord)return;
  fetch('/'+SLUG+'/order/'+ord.token).then(function(r){if(r.status===404){ls(KEY,null);ord=null;st=null;chip();return null}return r.ok?r.json():null}).then(function(j){
    if(!j){schedule();return}st=j;ord.code=j.code;chip();if(sheet.className==='on'&&view==='status')draw();schedule()}).catch(function(){schedule()});
}
function schedule(){
  clearTimeout(timer);
  if(!ord||!st||['delivered','cancelled','rejected'].indexOf(st.status)>-1)return;
  timer=setTimeout(function(){document.hidden?schedule():poll()},st.status==='ready'?60000:15000);
}
function add(r){cart[r]=Math.min(20,(cart[r]||0)+1);idem=null;chip()}
document.addEventListener('click',function(e){
  var el=e.target.closest&&e.target.closest('[data-scnr],[data-a]');if(!el)return;
  var a=el.getAttribute('data-a'),s=el.getAttribute('data-scnr');
  if(s==='add'){e.preventDefault();var r=el.getAttribute('data-ref');if(r&&M.s[r.split('.')[0]]&&M.s[r.split('.')[0]][r.split('.')[1]])add(r);return}
  if(s==='cart-bar'||s==='order'){e.preventDefault();open(count()||!ord?'cart':'status');return}
  var r2=el.getAttribute('data-r');
  if(a==='close')close();
  else if(a==='add'){add(r2);draw()}
  else if(a==='tocart'){view='cart';draw()}
  else if(a==='inc'){keep();cart[r2]=Math.min(20,cart[r2]+1);idem=null;draw();chip()}
  else if(a==='dec'){keep();cart[r2]--;if(cart[r2]<=0)delete cart[r2];idem=null;draw();chip()}
  else if(a==='type'){keep();type=el.getAttribute('data-t');draw()}
  else if(a==='place')place();
  else if(a==='gofind'){view='find';err='';draw()}
  else if(a==='dofind')dofind();
  else if(a==='more'){if(st&&['delivered','cancelled','rejected'].indexOf(st.status)>-1){ls(KEY,null);ord=null;st=null}view='cart';draw();chip()}
});
sheet.addEventListener('click',function(e){if(e.target===sheet)close()});
sheet.addEventListener('input',function(e){var t=e.target;if(t.type==='tel')t.value=t.value.replace(/[^\\d+()\\s-]/g,'').slice(0,20);if(t.id==='f-code')t.value=t.value.toUpperCase()});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&ord&&st&&['delivered','cancelled','rejected'].indexOf(st.status)<0)poll()});
chip();poll();
})();`;

export const addLabel = (lang: Lang) => UI[lang].add;

/** The block appended to a page that takes orders. menu: the first menu block, base language names in `base`, shown names in `shown`. */
export function orderBlock(o: { slug: string; lang: Lang; currency: string; priced: boolean; base: { name: string; price?: number }[][]; shown: string[][] }): string {
  const data = { slug: o.slug, c: o.currency, priced: o.priced, L: UI[o.lang],
    s: o.base.map((sec, a) => sec.map((it, b) => ({ k: it.name, n: o.shown[a]?.[b] || it.name, v: o.priced ? it.price || 0 : 0 }))) };
  return `<style>${CSS}</style><script type="application/json" id="sc-ord">${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script>${CLIENT}</script>`;
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('orderClient.ts')) {
  const assert = (c: unknown, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const b = orderBlock({ slug: 'abc', lang: 'en', currency: 'LKR', priced: true, base: [[{ name: '</script><b>', price: 5 }]], shown: [['x']] });
  assert(!b.slice(b.indexOf('id="sc-ord"'), b.indexOf('</script>')).includes('<b>'), 'the data blob cannot close its own script tag');
  assert(new Function(CLIENT) instanceof Function, 'client script parses');
  for (const l of ['en', 'si', 'ta'] as Lang[]) assert(Object.keys(UI[l]).length === Object.keys(UI.en).length, `${l} has every label`);
  console.log('orderClient self-check ok');
}
