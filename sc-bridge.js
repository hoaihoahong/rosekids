/* RoseKids ← SC: chạy trên trang sc.edu.vn khi cô bấm nút trên thanh dấu trang (nút chỉ nạp file này).
   Xem giải thích ở index.html, mục “Tải thẳng sổ thu từ SC”. */
(function(){var C=window.__rkSCcfg||{};
/* mỗi lần bấm nút RoseKids ← SC: trang Khẩu phần (/foodkid) hiện bảng Khẩu phần, trang khác hiện bảng Học phí (SC đổi trang không tải lại nên phải chọn lại mỗi lần) */
var P={};window.__rkSC={show:function(){var c=window.__rkSCcfg||C,k=/^\/foodkid/i.test(location.pathname)?'kp':'hp';for(var x in P)if(x!==k)P[x].hide();
  if(P[k])P[k].show();else if(k==='kp')kpBridge(c.rk);else scBridge(c.rk,c.want)}};
function scBridge(RK,WANT){
  var RKO=new URL(RK).origin,files=[],seen={},on=true,waitFn=null,busy=false;
  var norm=function(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u0111\u0110]/g,'d').toLowerCase().replace(/\s+/g,' ').trim()};
  var lopKey=function(t){return norm(t).replace(/^lop\s+/,'')};WANT=(WANT||[]).map(lopKey);
  var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
  var box=document.createElement('div'),DOC=document;
  box.style.cssText='position:fixed;z-index:2147483647;right:16px;bottom:16px;width:340px;max-height:80vh;overflow:auto;background:#fff;border:2px solid #d63d6b;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);font:14px/1.45 Arial,sans-serif;color:#222;padding:12px';
  document.body.appendChild(box);
  P.hp={show:function(){box.style.display='block';on=true;draw()},hide:function(){box.style.display='none';on=false}};
  var note='',newP='';
  function msg(t){note=t;newP='';draw()}
  function bt(id,t,pri){return '<button data-rk="'+id+'" style="margin:4px 4px 0 0;padding:6px 10px;border-radius:8px;border:1px solid #d63d6b;cursor:pointer;font:inherit;'+(pri?'background:#d63d6b;color:#fff':'background:#fff;color:#d63d6b')+'">'+t+'</button>'}
  function fileList(){var g={};files.forEach(function(f){(g[f.th||'']=g[f.th||'']||[]).push(f.lop||f.name)});
    return Object.keys(g).sort(function(a,b){return mKey(a)-mKey(b)}).map(function(k){return(k?'<b>'+esc(k)+'</b>: ':'')+g[k].map(esc).join(', ')}).join('; ')}
  function mKey(t){var m=String(t||'').match(/(\d{1,2})\s*\/\s*(\d{4})/);return m?+m[2]*12+ +m[1]:0}
  function mPrev(t){var m=String(t||'').match(/(\d{1,2})\s*\/\s*(\d{4})/);if(!m)return'';var a=+m[1]-1,y=+m[2];if(!a){a=12;y--}return(a<10?'0':'')+a+'/'+y}
  var m2a='',m2b='';
  /* “10” hoặc “10/2026” → “10/2026” (năm lấy theo tháng đang chọn trên SC) */
  function mFix(t,cur){var m=String(t||'').match(/^\s*(\d{1,2})\s*(?:[\/\-.]\s*(\d{4}))?\s*$/);if(!m||+m[1]<1||+m[1]>12)return'';var y=m[2]||(String(cur).match(/\d{4}/)||[''])[0];return y?(m[1].length<2?'0':'')+m[1]+'/'+y:''}
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function draw(){
    var m=fText(fld('thang hoc'));
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#d63d6b">RoseKids ← SC</b>'+bt('x','Đóng')+'</div>'+
      '<div style="margin:6px 0">Tháng học: <b>'+esc(m||'?')+'</b> (cô đổi ở ô Tháng học của SC nếu cần).</div>'+
      '<div>Đã lấy <b>'+files.length+'</b> file'+(files.length?': '+fileList():'')+'</div>'+
      (note?'<div style="margin-top:6px;color:#a3214a;white-space:pre-line">'+esc(note)+'</div>'+(newP?'<div>'+bt('new','Mở tab RoseKids mới')+'</div>':''):'')+
      '<div style="margin-top:6px">'+(busy?bt('stop','Dừng'):bt('auto','Tự lấy tất cả lớp',!files.length))+'</div>'+
      (busy?'':'<div style="margin-top:6px">Hai tháng: <input id="rk-m1" value="'+esc(m2a||mPrev(m))+'" style="width:68px"> và <input id="rk-m2" value="'+esc(m2b||m)+'" style="width:68px"> '+bt('auto2','Tự lấy 2 tháng')+'</div>')+'<div>'+
      (files.length&&!busy?bt('st','Gửi sang RoseKids (sổ thu)',true)+bt('clr','Xóa danh sách'):'')+'</div>'+
      (/theo-doi-phieu-thu/.test(location.pathname)?'<div style="margin-top:8px;border-top:1px solid #eee;padding-top:6px">'+(busy?'':bt('how','Gửi hình thức thu sang RoseKids',true))+'<div style="font-size:12px;color:#666">Đọc cột Hình thức thu (Tiền mặt, Chuyển khoản) của mọi lớp trong tháng đang chọn, gửi sang RoseKids theo số biên lai.</div></div>':'')+
      '<div style="margin-top:8px;border-top:1px solid #eee;padding-top:6px">'+bt('hs','Gửi DSHS sang RoseKids',true)+'<div style="font-size:12px;color:#666">Lấy danh sách học sinh mọi lớp của năm học đang chọn trên SC, RoseKids so sánh rồi cô duyệt mới ghi.</div></div>'+
      '<div>'+bt('dg','Chép thông tin trang')+'</div>'+
      '<div style="margin-top:6px;font-size:12px;color:#666">Cô cũng có thể tự chọn lớp rồi bấm nút Xuất Excel của SC: em giữ file lại ở đây, không lưu xuống máy.</div>'}
  box.addEventListener('click',function(e){e.stopPropagation();var b=e.target.closest('[data-rk]');if(!b)return;var a=b.getAttribute('data-rk');
    if(a==='x'){box.style.display='none';on=false}else if(a==='auto')setTimeout(auto,50);else if(a==='auto2'){m2a=(box.querySelector('#rk-m1')||{}).value||'';m2b=(box.querySelector('#rk-m2')||{}).value||'';var cur=fText(fld('thang hoc')),ms=[m2a,m2b].map(function(t){return mFix(t,cur)}).filter(Boolean);if(ms.length<2||ms[0]===ms[1]){msg('Cô ghi 2 tháng khác nhau, dạng 10/2026 và 11/2026.');return}setTimeout(function(){auto(ms)},50)}else if(a==='stop'){busy=false;msg('Đã dừng.')}
    else if(a==='st'||a==='kt')send('sothu');else if(a==='clr'){files=[];howBy={};msg('')}else if(a==='dg')diag();else if(a==='hs')setTimeout(sendHs,50);else if(a==='how')setTimeout(sendHow,50);else if(a==='new')openNew(newP)});
  /* ô chọn theo nhãn (Khối học/độ tuổi, Lớp học, Tháng học): ô select thường hoặc ô tự làm của SC */
  function vis(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(e.ownerDocument.defaultView||window).getComputedStyle(e).visibility!=='hidden'}
  function fld(label){var ns=[].concat(label).map(norm),els=[].slice.call(DOC.querySelectorAll('h6,label,span,div,p,b,strong,h5,td,th')).filter(function(e){return !box.contains(e)&&e.children.length<=2});
    /* ưu tiên ô nhãn đúng nguyên chữ (vd <h6>Tháng học</h6>), rồi mới tới ô bắt đầu bằng chữ đó */
    var cand=[];[function(t,n){return t===n},function(t,n){return t.indexOf(n)===0&&t.length<=n.length+12}].forEach(function(ok){ns.forEach(function(n){els.forEach(function(e){if(cand.indexOf(e)<0&&ok(norm(e.textContent),n))cand.push(e)})})});
    for(var i=0;i<cand.length;i++){var e=cand[i],p=e.parentElement;for(var u=0;u<4&&p;u++){var s=p.querySelector('select');
        var c=[].slice.call(p.children).filter(function(x){return x!==e&&!x.contains(e)&&vis(x)});
        if(s||c.length){var ctlEl=c[0]||s;return{lab:e,sel:s&&(!c.length||c[0].contains(s)||c[0]===s)?s:null,el:ctlEl}}p=p.parentElement}}return null}
  function fText(f){if(!f)return'';if(f.sel){var o=f.sel.options[f.sel.selectedIndex];if(o)return o.text.trim()}
    var inp=f.el.querySelector('input');var t=(f.el.innerText||'').split('\n').map(function(x){return x.trim()}).filter(Boolean)[0]||'';return t||(inp&&inp.value)||''}
  var OPT='[class*="-select-item-option"],[role=option],li,.dropdown-item,.select2-results__option,.ant-select-item,.el-select-dropdown__item,.vs__dropdown-option,.ng-option,.multiselect__option,.v-list-item,.item,.option';
  function press(el){['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t){var E=/^pointer/.test(t)?(window.PointerEvent||MouseEvent):MouseEvent;el.dispatchEvent(new E(t,{bubbles:true,cancelable:true,view:window}))})}
  async function fOpen(f){var before=new Set([].slice.call(DOC.querySelectorAll(OPT)).filter(vis));
    var tgt=f.el.querySelector('[role=combobox],.select2-selection,.ant-select-selector,.el-input__inner,.vs__dropdown-toggle,.ng-select-container,.multiselect,input,button')||f.el;press(tgt);if(tgt.focus)tgt.focus();await sleep(500);
    var r0=f.el.getBoundingClientRect();
    var os=[].slice.call(DOC.querySelectorAll(OPT)).filter(function(o){if(box.contains(o)||!vis(o)||before.has(o)&&!f.el.contains(o)&&!o.closest('[role=listbox]'))return false;if(o.querySelector(OPT))return false;var t=(o.innerText||'').trim();return t&&t.length<80});
    if(!os.length)os=[].slice.call(DOC.querySelectorAll(OPT)).filter(function(o){var r=o.getBoundingClientRect();return vis(o)&&!box.contains(o)&&!o.querySelector(OPT)&&Math.abs(r.left-r0.left)<60&&r.top>=r0.top-400&&r.top<r0.bottom+600&&(o.innerText||'').trim()});
    return os}
  function fClose(){DOC.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true}));press(DOC.body)}
  function okOpt(t){t=norm(t);return t&&!/^(tat ca|chon|-|khong co)/.test(t)}
  /* danh sách xổ xuống kiểu Ant Design chỉ vẽ các dòng đang thấy: kéo dần xuống để thấy hết */
  function holderOf(os){for(var i=0;i<os.length;i++){var h=os[i].closest('.rc-virtual-list-holder')||os[i].closest('[role=listbox]');if(h&&h.scrollHeight>h.clientHeight+2)return h}
    var d=os[0]&&os[0].parentElement;while(d&&d!==DOC.body){if(d.scrollHeight>d.clientHeight+2&&/auto|scroll/.test((d.ownerDocument.defaultView||window).getComputedStyle(d).overflowY))return d;d=d.parentElement}return null}
  async function toTop(h){for(var k=0;k<30&&h.scrollTop>0;k++){h.dispatchEvent(new WheelEvent('wheel',{deltaY:-1000,bubbles:true,cancelable:true}));await sleep(60);if(h.scrollTop>0){h.scrollTop=0;h.dispatchEvent(new Event('scroll'))}await sleep(60)}}
  async function scan(f,want){var os=await fOpen(f),out=[],h=holderOf(os),guard=0;
    if(h&&h.scrollTop>0){await toTop(h);await sleep(200);os=[].slice.call(DOC.querySelectorAll(OPT)).filter(function(o){return vis(o)&&!box.contains(o)&&!o.querySelector(OPT)&&h.contains(o)})}
    while(true){var hit=null;os.forEach(function(o){var t=(o.innerText||'').trim();if(want&&norm(t)===norm(want))hit=o;if(t&&out.indexOf(t)<0)out.push(t)});
      if(hit)return{hit:hit,out:out};if(!h||guard++>40)break;var top=h.scrollTop,dy=Math.max(40,h.clientHeight*0.7);h.dispatchEvent(new WheelEvent('wheel',{deltaY:dy,bubbles:true,cancelable:true}));await sleep(150);if(h.scrollTop===top){h.scrollTop=top+dy;h.dispatchEvent(new Event('scroll'))}await sleep(200);if(h.scrollTop===top)break;
      os=[].slice.call(DOC.querySelectorAll(OPT)).filter(function(o){return vis(o)&&!box.contains(o)&&!o.querySelector(OPT)&&h.contains(o)})}
    if(h)await toTop(h);return{hit:null,out:out}}
  async function fOpts(f){if(f.sel)return [].slice.call(f.sel.options).filter(function(o){return o.value!==''&&okOpt(o.text)}).map(function(o){return o.text.trim()});
    var r=await scan(f,null);fClose();await sleep(200);return r.out.filter(okOpt)}
  async function fSet(f,text){if(norm(fText(f))===norm(text))return true;
    if(f.sel){var o=[].slice.call(f.sel.options).find(function(x){return norm(x.text)===norm(text)});if(!o)return false;f.sel.value=o.value;
      f.sel.dispatchEvent(new Event('input',{bubbles:true}));f.sel.dispatchEvent(new Event('change',{bubbles:true}));try{if(window.jQuery)window.jQuery(f.sel).trigger('change')}catch(e){}return true}
    var r=await scan(f,text),hit=r.hit;if(!hit){fClose();return false}
    hit.scrollIntoView&&hit.scrollIntoView({block:'nearest'});press(hit);await sleep(300);return true}
  function cmdBtns(){var l=null,els=DOC.querySelectorAll('label,span,div,p');for(var i=0;i<els.length;i++)if(norm(els[i].textContent)==='cac nut lenh'){l=els[i];break}
    var p=l&&l.parentElement;for(var u=0;u<4&&p;u++){var b=p.querySelectorAll('button,a,[role=button]');if(b.length>=2)return [].slice.call(b);p=p.parentElement}return []}
  function findBtn(re,idx){var c=cmdBtns(),hay=function(b){return (b.title||'')+' '+(b.getAttribute('aria-label')||'')+' '+b.className+' '+b.innerHTML+' '+b.textContent};
    for(var i=0;i<c.length;i++)if(re.test(hay(c[i])))return c[i];if(c.length>=3)return c[idx]||null;
    var all=[].slice.call(DOC.querySelectorAll('button,a,[role=button]'));for(i=0;i<all.length;i++)if(!box.contains(all[i])&&re.test(hay(all[i])))return all[i];return null}
  function curLop(){return fText(fld('lop hoc'))}
  function diag(){var l=fld('lop hoc'),root=l?l.lab.closest('form')||l.lab.parentElement.parentElement.parentElement.parentElement:document.body;
    var h=(root?root.outerHTML:'').replace(/\s+/g,' ').slice(0,30000);var F=['khoi hoc','lop hoc','thang hoc'].map(function(k){var f=fld(k);return k+': '+(f?(f.sel?'select ':'')+f.el.tagName+'.'+f.el.className+' = '+fText(f):'không thấy')}).join('\n');navigator.clipboard.writeText('RKDIAG '+location.href+'\n'+F+'\nNUT: '+cmdBtns().map(function(b){return b.tagName+'.'+b.className+' '+(b.title||'')}).join(' | ')+'\nMANG:\n'+netlog.join('\n')+'\nHTML:\n'+h).then(function(){msg('Đã chép thông tin trang SC. Cô dán (Ctrl+V) vào tin nhắn gửi em.')},function(e){msg('Chưa chép được: '+e.message)})}
  /* giữ lại file Excel SC tạo ra */
  function isX(type){return !type||/sheet|excel|octet|zip|xls/i.test(type)}
  function take(blob,name){var lop=curLop(),th=fText(fld('thang hoc'));return blob.slice(0,4).arrayBuffer().then(function(h){var b=new Uint8Array(h),zip=b[0]===0x50&&b[1]===0x4b,ole=b[0]===0xd0&&b[1]===0xcf;
    if(!zip&&!ole){nl('BO blob '+blob.type+' '+blob.size);return}return blob.arrayBuffer().then(function(buf){if(files.some(function(f){return f.lop===lop&&f.th===th&&f.buf.byteLength===buf.byteLength&&Date.now()-f.at<4000}))return;files=files.filter(function(f){return !lop||f.lop!==lop||f.th!==th});
      files.push({name:name||('SC_'+(lop||files.length+1)+(th?'_T'+th.replace(/\D+/g,'-'):'')+(ole?'.xls':'.xlsx')),lop:lop,th:th,buf:buf,at:Date.now()});nl('LAY '+lop+' '+buf.byteLength);draw();if(waitFn){var w=waitFn;waitFn=null;w()}})})}
  function grab(url,opt){nl('GRAB '+url);return oF(url,Object.assign({credentials:'include'},opt||{})).then(function(r){return r.blob()}).then(function(b){return take(b,'')}).catch(function(e){msg('Không lấy được file: '+e.message)})}
  var looksExport=function(u){return /xls|excel|export|xuat|download/i.test(u)};
  var oCOU=URL.createObjectURL;
  URL.createObjectURL=function(o){var u=oCOU.apply(this,arguments);try{if(on&&o instanceof Blob&&isX(o.type)){seen[u]=1;take(o,'')}}catch(e){}return u};
  function aHit(a){if(!on||!a||!a.href)return false;if(seen[a.href])return true;
    if(/^data:/.test(a.href)&&isX(a.href.slice(5,a.href.indexOf(';')))){fetch(a.href).then(function(r){return r.blob()}).then(function(b){take(b,a.download||'')});return true}
    if(a.origin===location.origin&&looksExport(a.href)&&!/^javascript:/i.test(a.href)&&(a.download!==undefined&&a.hasAttribute('download')||/\.xlsx?(\?|$)/i.test(a.pathname))){grab(a.href);return true}return false}
  var oClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){if(aHit(this))return;return oClick.apply(this,arguments)};
  var oDisp=EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent=function(ev){if(ev&&ev.type==='click'&&this instanceof HTMLAnchorElement&&aHit(this))return true;return oDisp.apply(this,arguments)};
  document.addEventListener('click',function(ev){var a=ev.target&&ev.target.closest&&ev.target.closest('a[href]');if(a&&!box.contains(a)&&aHit(a))ev.preventDefault()},true);
  var oOpen=window.open;
  window.open=function(u){if(on&&typeof u==='string'&&u.indexOf(RKO)!==0&&!/^(blob:|about:|javascript:)/i.test(u)&&looksExport(u)){grab(new URL(u,location.href).href);return null}return oOpen.apply(window,arguments)};
  var oSub=HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit=function(){if(on&&looksExport(this.action||'')){var m=(this.method||'get').toUpperCase(),fd=new FormData(this);
      if(m==='GET'){var q=new URLSearchParams(fd).toString();grab(this.action+(this.action.indexOf('?')<0?'?':'&')+q)}else grab(this.action,{method:m,body:fd});return}
    return oSub.apply(this,arguments)};
  /* SC tải file qua XHR/fetch/iframe: bắt cả các đường này, ghi lại để chẩn đoán */
  var netlog=[],apiDone=0;function nl(x){netlog.push(x);if(netlog.length>40)netlog.shift()}
  var XO=XMLHttpRequest.prototype.open,XS=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){this.__rk=m+' '+u;return XO.apply(this,arguments)};
  XMLHttpRequest.prototype.send=function(){var x=this;x.addEventListener('loadend',function(){if(/sothu|baocao/i.test(x.__rk||''))apiDone++});x.addEventListener('load',function(){try{var ct=x.getResponseHeader('content-type')||'',cd=x.getResponseHeader('content-disposition')||'';nl('XHR '+x.__rk+' → '+x.status+' '+ct+' '+cd+' rt='+x.responseType);
      if(on&&/sheet|excel|octet|xls/i.test(ct+cd)&&(x.responseType==='blob'||x.responseType==='arraybuffer'))take(x.responseType==='blob'?x.response:new Blob([x.response]),'')}catch(e){}});return XS.apply(this,arguments)};
  var oF=window.fetch;window.fetch=function(i,o){var u=typeof i==='string'?i:i&&i.url;return oF.apply(this,arguments).then(function(r){if(/sothu|baocao/i.test(u||''))apiDone++;try{var ct=r.headers.get('content-type')||'',cd=r.headers.get('content-disposition')||'';nl('FETCH '+((o&&o.method)||'GET')+' '+u+' → '+r.status+' '+ct+' '+cd);
      if(on&&/sheet|excel|octet|xls/i.test(ct+cd)&&!/^data:|^blob:/.test(u||''))r.clone().blob().then(function(b){take(b,'')})}catch(e){}return r})};
  new MutationObserver(function(ms){ms.forEach(function(m){[].slice.call(m.addedNodes||[]).concat(m.type==='attributes'?[m.target]:[]).forEach(function(n){
      if(n.tagName==='IFRAME'&&n.src&&!/^(about:|javascript:)/.test(n.src)){nl('IFRAME '+n.src);if(on&&looksExport(n.src)){var s=n.src;n.src='about:blank';grab(s)}}
      if(n.tagName==='FORM')nl('FORM '+n.method+' '+n.action)})})}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  window.addEventListener('beforeunload',function(){nl('ROI TRANG')});
  function waitFile(ms){return new Promise(function(res){var t=setTimeout(function(){waitFn=null;res(false)},ms);waitFn=function(){clearTimeout(t);res(true)}})}
  /* tự chọn từng khối, từng lớp, xuất Excel */
  var howBy={};
  async function auto(ms){try{await auto1(ms)}catch(e){busy=false;msg('Lỗi: '+(e&&e.message||e)+'. Cô bấm “Chép thông tin trang” rồi dán gửi em.');return}
    /* lấy luôn hình thức thu (Tiền mặt, Chuyển khoản) của các tháng vừa lấy sổ thu, để gửi chung một lần */
    if(!files.length||/theo-doi-phieu-thu/.test(location.pathname))return;var keep=note,mths=[];files.forEach(function(f){if(f.th&&mths.indexOf(f.th)<0)mths.push(f.th)});
    busy=true;try{var R=await howViaFrame(mths);R.forEach(function(x){if(x.rows.length)howBy[x.month]=x.rows});busy=false;
      msg(keep+(Object.keys(howBy).length?'\nĐã lấy kèm hình thức thu tháng '+Object.keys(howBy).join(', ')+'.':''))}
    catch(e){busy=false;msg(keep+'\nChưa lấy được hình thức thu ('+(e.message||e)+'). Sổ thu vẫn gửi được.')}}
  /* chờ SC tải xong: đợi đến khi điều kiện đúng (tối đa ms) */
  async function until(fn,ms){var t=Date.now();while(Date.now()-t<ms){try{if(fn())return true}catch(e){}await sleep(250)}return false}
  function disabled(b){return !b||b.disabled||b.getAttribute('disabled')!==null||/disabled/.test(b.className)}
  /* đóng hộp thông báo của SC (vd “Bạn chưa chọn tháng học!”): bấm Đồng ý; trả về true nếu có hộp */
  function closeAlerts(){var hit=false;[].slice.call(DOC.querySelectorAll('button,a')).forEach(function(b){if(box.contains(b)||!vis(b))return;var t=norm(b.textContent);
      if(/^(dong y|ok|dong)$/.test(t)&&b.closest('[class*="modal"],[class*="swal"],[class*="dialog"],[class*="confirm"],[role=dialog]')){b.click();hit=true}});return hit}
  /* lấy một lớp: chọn lớp, giữ tháng, bấm tìm, đợi SC tải dữ liệu xong, bấm Excel, đợi file */
  async function getOne(name,month,slow){var reX=/excel|xlsx?\b|file-export|xuat file|xuat excel/i,reS=/fa-search|search|tim kiem|xem bao cao/i;
    msg('Đang lấy '+name+'…');
    if(!await fSet(fld('lop hoc'),name)){nl('KHONG CHON DUOC LOP '+name);return false}
    await until(function(){return norm(fText(fld('lop hoc')))===norm(name)},3000);await sleep(slow?1500:700);
    closeAlerts();
    /* SC xóa ô Tháng học khi đổi lớp và tải lại danh sách tháng: chọn lại tháng tới khi đúng rồi mới tìm */
    if(month){var okM=await until(function(){return norm(fText(fld('thang hoc')))===norm(month)},slow?2500:1200);
      for(var r=0;r<8&&!okM;r++){await fSet(fld('thang hoc'),month);await sleep(slow?1200:700);okM=norm(fText(fld('thang hoc')))===norm(month)}
      if(!okM){msg('Chưa chọn được tháng '+month+' cho '+name);return false}}
    var bS=findBtn(reS,0),n0=apiDone;if(bS){bS.click();await until(function(){return apiDone>n0||closeAlerts()},slow?25000:15000);if(apiDone<=n0)return false;await sleep(slow?1500:700)}
    await until(function(){return !disabled(findBtn(reX,2))},8000);
    var p=waitFile(slow?40000:25000);findBtn(reX,2).click();return await p}
  async function auto1(MS){if(busy)return;var fL=fld('lop hoc'),fT=fld('thang hoc'),fKn=['khoi hoc/do tuoi','khoi hoc'],fK=fld(fKn);
    if(!fL){msg('Em chưa tìm thấy ô Lớp học. Cô mở Báo cáo thống kê > Sổ thu thanh toán tổng hợp rồi bấm lại.');return}
    if(!findBtn(/excel|xlsx?\b|file-export|xuat file|xuat excel/i,2)){msg('Em chưa tìm thấy nút Xuất Excel. Cô tự chọn lớp rồi bấm nút Excel của SC, em vẫn giữ file.');return}
    var months=MS&&MS.length?MS:[fText(fT)],have={};files.forEach(function(f){have[mKey(f.th)+'|'+lopKey(f.lop)]=1});busy=true;note='';draw();var miss=[];
    for(var mi=0;mi<months.length&&busy;mi++){var month=months[mi],mk=mKey(month);
    var ks=fK?await fOpts(fK):[null];if(!ks.length)ks=[null];
    /* chỉ 5 khối trường có lớp (cô chốt 07/11/2026): Nhà trẻ 13-24, Nhà trẻ 24-36, Mẫu giáo bé, nhỡ, lớn; bỏ Nhà trẻ 3-12 tháng, Khối 1, Khối 2… */
    var mn=ks.filter(function(k){var t=norm(k);return k&&/^(nha tre|mau giao)/.test(t)&&!/\b3\s*-\s*12\b/.test(t)});if(mn.length)ks=mn;
    nl('KHOI '+ks.join(' | '));
    var need=function(k){return !have[mk+'|'+k]&&(!WANT.length||WANT.indexOf(k)>=0)};
    /* lượt 1 đi nhanh; lượt 2 đi chậm, chỉ lấy lớp còn thiếu */
    for(var pass=0;pass<2&&busy;pass++){var slow=pass>0;if(WANT.length&&!WANT.some(need))break;
      for(var i=0;i<ks.length&&busy;i++){
        if(ks[i]!==null){msg('Chọn khối '+ks[i]+'…');var before=fText(fld('lop hoc'));if(!await fSet(fld(fKn),ks[i]))continue;
          await until(function(){return fText(fld('lop hoc'))!==before},slow?6000:3000);await sleep(slow?2000:1000)}
        var ls=await fOpts(fld('lop hoc'));if(!ls.length){await sleep(slow?3000:1500);ls=await fOpts(fld('lop hoc'))}nl('LOPS '+ks[i]+' (luot '+(pass+1)+'): '+ls.join(', '));
        for(var j=0;j<ls.length&&busy;j++){var key=lopKey(ls[j]);if(!need(key))continue;
          if(await getOne(ls[j],month,slow))have[mk+'|'+key]=1;else nl('THIEU '+ls[j]+' (luot '+(pass+1)+')')}}}
    WANT.forEach(function(w){if(!have[mk+'|'+w])miss.push(w+(months.length>1?' ('+month+')':''))})}
    busy=false;
    msg(miss.length?'Chưa lấy được: '+miss.join(', ')+'. Cô chọn tay các lớp này rồi bấm nút Excel của SC (em giữ file lại), hoặc bấm “Tự lấy tất cả lớp” lần nữa: em chỉ lấy thêm lớp còn thiếu.':(months.length>1?'Xong '+files.length+' file của '+months.join(' và ')+'. Cô bấm “Gửi sang RoseKids (sổ thu)” để RoseKids lưu từng tháng và lập danh sách bé mới.':'Xong '+files.length+' lớp. Cô bấm “Gửi sang RoseKids (sổ thu)”.'))}
  /* gửi sang RoseKids */
  function payload(p){return{rk:'sc-files',id:pid,purpose:p,files:files.map(function(f){return{name:f.name,lop:f.lop,buf:f.buf}}),how:Object.keys(howBy).map(function(m){return{month:m,rows:howBy[m]}})}}
  var pid='';
  function clip(p,cb){var d=payload(p);d.files=d.files.map(function(f){var b=new Uint8Array(f.buf),s='';for(var i=0;i<b.length;i+=8192)s+=String.fromCharCode.apply(null,b.subarray(i,i+8192));return{name:f.name,lop:f.lop,b64:btoa(s)}});
    return navigator.clipboard.writeText('RKSC1:'+JSON.stringify(d)).then(function(){cb&&cb(null,d.files.length)},function(e){cb&&cb(e)})}
  /* Dùng lại tab RoseKids đang mở (không tải lại trang). Không thấy tab nào thì chép sẵn, cô chuyển sang tab RoseKids là RoseKids tự nhận. */
  function send(p){if(!files.length){msg('Chưa có file nào.');return}pid=String(Date.now());clip(p);
    var w=oOpen.call(window,'','rosekids');if(!w){msg('Trình duyệt chặn mở RoseKids. Cô cho phép cửa sổ bật lên ở sc.edu.vn rồi bấm lại.');return}
    var fresh=false;try{fresh=w.location.href==='about:blank'}catch(e){}
    /* tab RoseKids cô mở riêng thì SC không gọi được theo tên: đóng cửa sổ trống, không mở tab mới; dữ liệu đã chép sẵn, cô sang tab RoseKids đang mở để nhận */
    if(fresh){try{w.close()}catch(e){}
      msg('Đã chép '+files.length+' file. Cô chuyển sang tab RoseKids đang mở: RoseKids tự nhận (đã cho phép đọc bộ nhớ tạm), nếu chưa thấy thì bấm “Nhận file từ SC” ở mục Sổ thu SC.');newP=p;draw();return}
    talk(w,p,'Đang gửi sang tab RoseKids…')}
  /* ---------- Danh sách học sinh (sc.edu.vn/student/student) ----------
     Đọc thẳng dữ liệu SC đang hiển thị cho cô (API Student/Search, dùng phiên đăng nhập SC sẵn có trên trang này; mã đăng nhập không gửi đi đâu),
     gồm học sinh đang ở các lớp và học sinh SC đã xóa khỏi lớp. Tên lớp lấy từ bộ nhớ của trang SC. Chỉ gửi các trường RoseKids dùng. */
  var hsData=null;
  function scTok(){var t=localStorage.getItem('___scToken')||'';try{if(t.charAt(0)==='"')t=JSON.parse(t)}catch(e){}return t}
  function scClasses(sy){return new Promise(function(res){try{var q=indexedDB.open('BCN_LOCAL_DATA');q.onerror=function(){res([])};q.onsuccess=function(){try{var g=q.result.transaction('BCNCompanyResources').objectStore('BCNCompanyResources').get('sch_class');
      g.onsuccess=function(){var d=(g.result&&g.result.data)||[];res(d.filter(function(c){return +c.sy_id===sy}).map(function(c){return{id:c.c_id,name:c.c_name,gl:c.gl_id,order:c.c_sortorder}}))};g.onerror=function(){res([])}}catch(e){res([])}}}catch(e){res([])}})}
  function scSy(){var t=fText(fld('nam hoc'))||'',m=t.match(/(20\d\d)\s*-\s*20\d\d/);if(m)return +m[1];var d=new Date();return d.getMonth()>=7?d.getFullYear():d.getFullYear()-1}
  function scDay(n){if(!n)return'';var d=new Date(n*1000+7*3600e3);return d.toISOString().slice(0,10)}
  function scIso(t){var m=String(t||'').match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);return m?m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2):''}
  function scRow(s){return{sid:s.s_id||'',pid:String(s.s_person_id||'').replace(/\s+/g,'').replace(/^'+/,''),last:String(s.s_lastname||'').trim(),first:String(s.s_firstname||'').trim(),dob:scIso(s.s_ngaysinh)||String(s.s_dateofbirth||'').slice(0,10),
      g:s.s_gender===1?'Nam':s.s_gender===0?'Nữ':'',phone:String(s.s_cellphone||'').trim(),fa:String(s.s_fathername||'').trim(),faP:String(s.s_fatherphone||'').trim(),mo:String(s.s_mothername||'').trim(),moP:String(s.s_motherphone||'').trim(),
      cid:s.c_id,inDate:scIso(s.s_ngayvaolop)||scDay(s.sc_dateto),outDate:scDay(s.sc_dateleave),note:String(s.sc_note||'').trim(),del:scDay(s.sc_datedeleted)}}
  async function sendHs(){if(busy)return;busy=true;msg('Đang đọc danh sách học sinh từ SC…');
    try{var tk=scTok();if(!tk)throw new Error('Chưa thấy phiên đăng nhập SC. Cô đăng nhập SC rồi bấm lại.');
      var sy=scSy(),cls=await scClasses(sy);if(!cls.length)throw new Error('Chưa đọc được danh sách lớp năm '+sy+'-'+(sy+1)+'. Cô mở trang Học sinh của SC một lần rồi bấm lại.');
      var get=async function(del){var r=await fetch('https://api.sc.edu.vn/api/v1/Student/Search',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tk},body:JSON.stringify({sy_id:sy,c_id:0,currentPage:1,isListDeleted:del})});
        var j=await r.json();if(!j||!j.success||!Array.isArray(j.data))throw new Error((j&&j.msg)||('SC trả lỗi '+r.status));return j.data};
      var on=await get(false),off=[];try{off=await get(true)}catch(e){}
      pid=String(Date.now());hsData={rk:'sc-hs',id:pid,sy:sy,at:new Date().toISOString(),classes:cls,rows:on.map(scRow),del:off.map(scRow)};
      busy=false;var t='RKSC1:'+JSON.stringify(hsData);try{await navigator.clipboard.writeText(t)}catch(e){}
      var w=oOpen.call(window,'','rosekids');if(!w){msg('Trình duyệt chặn mở RoseKids. Cô cho phép cửa sổ bật lên ở sc.edu.vn rồi bấm lại.');return}
      var fresh=false;try{fresh=w.location.href==='about:blank'}catch(e){}
      if(fresh){try{w.close()}catch(e){}msg('Đã chép danh sách '+on.length+' dòng học sinh. Cô chuyển sang tab RoseKids đang mở: RoseKids tự nhận, nếu chưa thấy thì vào mục Học sinh bấm “Nhận DSHS từ SC”.');newP='hs';draw();return}
      talk(w,'hs','Đang gửi '+on.length+' dòng học sinh sang tab RoseKids…')}
    catch(e){busy=false;msg('Không lấy được danh sách học sinh: '+(e.message||e))}}
  /* ---------- Hình thức thu (trang Theo dõi phiếu báo đóng tiền) ----------
     Lần lượt chọn từng Độ tuổi, từng Lớp học (giữ Tháng học cô đã chọn), bấm tìm, đọc mỗi dòng: họ tên, số phiếu, số biên lai, hình thức thu.
     Chỉ đọc, không bấm lưu. */
  var howData=null;
  function howRows(){return [].slice.call(DOC.querySelectorAll('table tbody tr')).map(function(tr){if(box.contains(tr))return null;var t=tr.innerText||'',bl=(t.match(/[A-Z]{1,3}\d*\.\d+/)||[''])[0],sel=tr.querySelector('select'),
      h=sel&&sel.selectedIndex>=0?sel.options[sel.selectedIndex].text:((t.match(/Chuyển khoản|Tiền mặt/i)||[''])[0]),pt=(t.match(/PT-[\d-]+/)||[''])[0],nm=((tr.cells[2]&&tr.cells[2].innerText)||'').split('\n')[0].trim();
      return bl?[nm,pt,bl,/m[aặ]t/i.test(norm(h))||/tien mat/.test(norm(h))?'tm':/khoan/.test(norm(h))?'ck':'']:null}).filter(Boolean)}
  /* đọc hình thức thu một tháng trên trang Theo dõi phiếu báo đóng tiền (DOC: trang hiện tại hoặc khung ẩn) */
  async function howScan(month,tag){var out=[],seen={},reS=/fa-search|search|tim kiem/i;
    await fSet(fld('thang hoc'),month);await sleep(800);
    var fK=fld(['do tuoi','khoi hoc/do tuoi','khoi hoc']),ks=fK?await fOpts(fK):[''];
    /* chỉ 5 khối trường có lớp (Nhà trẻ 13-24, 25-36, Mẫu giáo bé, nhỡ, lớn), chỉ 8 lớp RoseKids đang dùng; đủ 8 lớp thì dừng */
    var mn=ks.filter(function(k){var t=norm(k);return k&&/^(nha tre|mau giao)/.test(t)&&!/\b3\s*-\s*12\b/.test(t)});if(mn.length)ks=mn;
    for(var ki=0;ki<ks.length&&busy&&!(WANT.length&&WANT.every(function(w){return seen[w]}));ki++){if(ks[ki]){await fSet(fld(['do tuoi','khoi hoc/do tuoi','khoi hoc']),ks[ki]);await sleep(1000);closeAlerts()}
      var ls=await fOpts(fld('lop hoc'));ls=ls.filter(function(l){return !WANT.length||WANT.indexOf(lopKey(l))>=0});
      for(var li=0;li<ls.length&&busy;li++){msg((tag||'')+'Đang đọc hình thức thu '+ls[li]+' tháng '+month+'…');await fSet(fld('lop hoc'),ls[li]);await sleep(900);closeAlerts();
        for(var r=0;r<6&&norm(fText(fld('thang hoc')))!==norm(month);r++){await fSet(fld('thang hoc'),month);await sleep(700)}
        var tb=DOC.querySelector('table tbody'),before=tb?tb.innerText:'',b=findBtn(reS,0);if(b)b.click();
        await until(function(){var t=DOC.querySelector('table tbody');return t&&t.innerText!==before},6000);await sleep(1200);closeAlerts();
        out=out.concat(howRows());seen[lopKey(ls[li])]=1}}
    return out}
  /* đang ở trang Sổ thu: mở trang Theo dõi phiếu báo đóng tiền trong khung ẩn (cùng phiên đăng nhập SC, chỉ đọc) để lấy hình thức thu */
  async function howViaFrame(months){var fr=document.createElement('iframe'),res=[];fr.style.cssText='position:fixed;left:-3000px;top:0;width:1280px;height:900px;border:0;visibility:visible';
    fr.src=location.origin+'/income/theo-doi-phieu-thu';document.body.appendChild(fr);
    try{var ok=await until(function(){var d=fr.contentDocument;if(!d||!d.body)return false;DOC=d;var f=fld('lop hoc');DOC=document;return !!f},30000);
      if(!ok)throw new Error('không mở được trang Theo dõi phiếu báo đóng tiền');await sleep(1500);DOC=fr.contentDocument;
      for(var i=0;i<months.length&&busy;i++){var rows=await howScan(months[i],'');res.push({month:months[i],rows:rows})}}
    finally{DOC=document;try{fr.remove()}catch(e){}}return res}
  async function sendHow(){if(busy)return;var month=fText(fld('thang hoc'));if(!/\d{1,2}\s*\/\s*\d{4}/.test(month)){msg('Cô chọn Tháng học trên SC trước rồi bấm lại.');return}
    busy=true;msg('Đang đọc hình thức thu tháng '+month+'…');
    try{var out=await howScan(month,'');
      if(!busy)return;busy=false;if(!out.length){msg('Không đọc được dòng nào có số biên lai.');return}
      pid=String(Date.now());howData={rk:'sc-how',id:pid,month:month,at:new Date().toISOString(),rows:out};
      try{await navigator.clipboard.writeText('RKSC1:'+JSON.stringify(howData))}catch(e){}
      var w=oOpen.call(window,'','rosekids');if(!w){msg('Trình duyệt chặn mở RoseKids. Cô cho phép cửa sổ bật lên ở sc.edu.vn rồi bấm lại.');return}
      var fresh=false;try{fresh=w.location.href==='about:blank'}catch(e){}
      if(fresh){try{w.close()}catch(e){}msg('Đã chép hình thức thu '+out.length+' biên lai. Cô chuyển sang tab RoseKids: RoseKids tự nhận, nếu chưa thấy thì vào Thu học phí bấm “Đồng bộ từ SC”.');newP='how';draw();return}
      talk(w,'how','Đang gửi hình thức thu '+out.length+' biên lai sang tab RoseKids…')}
    catch(e){busy=false;msg('Không đọc được hình thức thu: '+(e.message||e))}}
  function openNew(p){var w=oOpen.call(window,RK+'#sc-nhan','rosekids');if(!w){msg('Trình duyệt chặn mở RoseKids. Cô cho phép cửa sổ bật lên ở sc.edu.vn rồi bấm lại.');return}talk(w,p,'Đang mở RoseKids…')}
  function talk(w,p,m){var t0=Date.now(),sent=false,iv;
    function lis(e){if(e.origin!==RKO||!e.data)return;
      if(e.data.rk==='ready'&&!sent){sent=true;w.postMessage(p==='hs'?hsData:p==='how'?howData:payload(p),RKO)}
      if(e.data.rk==='got'){window.removeEventListener('message',lis);clearInterval(iv);msg(p==='hs'?'Đã chuyển danh sách '+e.data.n+' học sinh sang RoseKids. Cô xem bảng so sánh ở mục Học sinh rồi bấm Cập nhật.':p==='how'?'Đã chuyển hình thức thu '+e.data.n+' biên lai sang RoseKids.':'Đã chuyển '+e.data.n+' file sang RoseKids.')}}
    window.addEventListener('message',lis);msg(m);
    iv=setInterval(function(){if(Date.now()-t0>40000){clearInterval(iv);window.removeEventListener('message',lis);msg('RoseKids chưa trả lời. Dữ liệu đã được chép sẵn: sang RoseKids (mục Sổ thu SC) bấm “Nhận file từ SC”.');return}
      try{w.postMessage({rk:'ping'},RKO)}catch(e){}},700)}
  draw()}
/* Khẩu phần dinh dưỡng (sc.edu.vn/foodkid): đọc Đơn vị tính, Nhà cung cấp, Nhóm trẻ, Bảng thành phần thực phẩm, Thực phẩm trường đang sử dụng,
   Thư viện món ăn rồi gửi sang RoseKids ({rk:'sc-kp'}). Chỉ đọc: nút tự bấm các menu và nút Tìm kiếm của SC, giữ lại kết quả SC trả về cho chính trang này
   (xin mỗi trang 100 dòng thay vì 20 để nhanh hơn), không bấm Lưu, Xóa và không gửi gì về SC. */
function kpBridge(RK){
  var RKO=new URL(RK).origin,busy=false,note='',data=null,pid='';
  var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
  var box=document.createElement('div');
  box.style.cssText='position:fixed;z-index:2147483647;right:16px;bottom:16px;width:340px;max-height:80vh;overflow:auto;background:#fff;border:2px solid #2e9e5b;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);font:14px/1.45 Arial,sans-serif;color:#222;padding:12px';
  document.body.appendChild(box);P.kp={show:function(){box.style.display='block';draw()},hide:function(){box.style.display='none'}};
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function bt(id,t,pri){return '<button data-rk="'+id+'" style="margin:4px 4px 0 0;padding:6px 10px;border-radius:8px;border:1px solid #2e9e5b;cursor:pointer;font:inherit;'+(pri?'background:#2e9e5b;color:#fff':'background:#fff;color:#2e9e5b')+'">'+t+'</button>'}
  function draw(){box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#2e9e5b">RoseKids ← SC · Khẩu phần</b>'+bt('x','Đóng')+'</div>'+
    '<div style="margin:6px 0;font-size:13px;color:#555">Em tự mở các trang Danh mục, Thư viện món ăn của SC để đọc thực phẩm, bảng thành phần dinh dưỡng và món ăn (chỉ đọc, không sửa gì trên SC), rồi gửi sang RoseKids.</div>'+
    (note?'<div style="margin:6px 0;color:#a3214a;white-space:pre-line">'+esc(note)+'</div>':'')+
    '<div>'+(busy?bt('stop','Dừng'):bt('go','Gửi dữ liệu khẩu phần sang RoseKids',true)+bt('sup','Chỉ gửi Nhà cung cấp',true)+bt('hist','Gửi thực đơn, sổ sách, kho từ 01/09',true))+(data&&!busy?bt('send','Gửi lại'):'')+'</div>'+
    (busy?'':'<div style="margin-top:6px;font-size:12px;color:#777">Nút thứ hai đọc thực đơn từng ngày (món, thực phẩm, sĩ số, sổ kiểm thực 3 bước) và phiếu nhập kho từ 01/09 đến hôm nay, mất khoảng 5 phút. Cô để yên trang SC cho em đọc.</div>')}
  function msg(t){note=t;draw()}
  box.addEventListener('click',function(e){e.stopPropagation();var b=e.target.closest('[data-rk]');if(!b)return;var a=b.getAttribute('data-rk');
    if(a==='x')box.style.display='none';else if(a==='stop'){busy=false;msg('Đã dừng.')}else if(a==='go')setTimeout(run,50);else if(a==='hist')setTimeout(runHist,50);else if(a==='sup')setTimeout(runSup,50);else if(a==='send')send()});
  /* giữ lại kết quả các lần tìm của chính trang SC */
  var got=[],want={size:0,page:0,dpage:0,day:0,ym:null,vid:0};
  var O=XMLHttpRequest.prototype.open,SD=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){var x=this;x.__rkU=String(u||'');
    try{if(want.day&&/\/so-kiem-thuc\/\d+/i.test(x.__rkU))arguments[1]=x.__rkU=x.__rkU.replace(/(so-kiem-thuc\/)\d+/i,'$1'+want.day);
      if(want.ym&&/ImportVoucher\/Search/i.test(x.__rkU)){var U1=new URL(x.__rkU,location.href);U1.searchParams.set('year',want.ym[0]);U1.searchParams.set('month',want.ym[1]);arguments[1]=x.__rkU=U1.href}
      if(want.vid&&/ImportVoucher\/GetDetail/i.test(x.__rkU)){var U2=new URL(x.__rkU,location.href);U2.searchParams.set('importVoucherId',want.vid);arguments[1]=x.__rkU=U2.href}}catch(e){}
    if(want.dpage&&/\/Dish\/Search/i.test(x.__rkU)){try{var U=new URL(x.__rkU,location.href);U.searchParams.set('currentPage',want.dpage);U.searchParams.set('searchText','');arguments[1]=x.__rkU=U.href}catch(e){}}
    x.addEventListener('load',function(){if(/\/api\/v1\/(ScProduct|ScFoodkid|Foodkid|sc-foodkid|ScInventory|sc-inventory)/i.test(x.__rkU)){try{got.push({u:x.__rkU.split('?')[0],j:JSON.parse(x.responseText)})}catch(e){}}});
    return O.apply(x,arguments)};
  XMLHttpRequest.prototype.send=function(b){if(typeof b==='string'&&/"currentPageSize":\d+/.test(b)){if(want.size)b=b.replace(/"currentPageSize":\d+/,'"currentPageSize":'+want.size);if(want.page)b=b.replace(/"currentPage":\d+/,'"currentPage":'+want.page)}return SD.call(this,b)};
  function link(p){var a=[].slice.call(document.querySelectorAll('a')).filter(function(x){return x.getAttribute('href')===p})[0];if(!a)throw new Error('không thấy menu '+p);a.click()}
  function searchBtn(){var i=document.querySelector('button i.glyphicon-search');return i&&i.parentElement}
  async function until(fn,ms){var t=Date.now();while(Date.now()-t<(ms||15000)){if(!busy)return null;var v=fn();if(v)return v;await sleep(250)}return null}
  function last(re,n0){for(var i=got.length-1;i>=n0;i--)if(re.test(got[i].u))return got[i].j;return null}
  async function page(p,re,click){var n0=got.length;link(p);await sleep(click?1500:3000);if(!last(re,n0)){var b=await until(searchBtn,click?8000:1000);if(b)b.click()}var j=await until(function(){return last(re,n0)},20000);if(!j)throw new Error('SC chưa trả dữ liệu ở trang '+p);return j}
  function arr(j,k){var d=j&&j.data;if(Array.isArray(d))return d;if(d&&k&&Array.isArray(d[k]))return d[k];if(d)for(var x in d)if(Array.isArray(d[x]))return d[x];return[]}
  /* nhóm trẻ: lấy mã, tên (để chỉ giữ món của nhóm Nhà trẻ, Mẫu giáo) */
  function grp(o){var id='',nm='';for(var k in o){if(!id&&/_id$/.test(k)&&!/^(u|o)_id$/.test(k))id=o[k];if(!nm&&/_name$/.test(k))nm=o[k]}return{id:String(id),name:String(nm||'').trim()}}
  async function run(){if(busy)return;busy=true;data=null;got=[];var out={units:[],sups:[],groups:[],ref:[],foods:[],dishes:[]};
    try{want.size=3000;
      msg('Đang đọc Nhóm trẻ…');try{var g=await page('/foodkid/nhom-tre',/kid-group|KidGroup/i,false);out.groups=arr(g).map(grp)}catch(e){}
      msg('Đang đọc Đơn vị tính…');out.units=arr(await page('/foodkid/don-vi-tinh',/CalculationUnit/i,false)).map(function(u){return{cu_id:u.cu_id,cu_name:u.cu_name,cu_weight:u.cu_weight}});
      msg('Đang đọc Nhà cung cấp…');out.sups=arr(await page('/foodkid/nha-cung-cap',/ProductSupplier/i,false),'listSupplier').map(function(s){var o={};for(var k in s){var v=s[k];if(v!=null&&typeof v!=='object')o[k]=v}return o});
      msg('Đang đọc Bảng thành phần thực phẩm…');out.ref=arr(await page('/foodkid/thuc-pham',/ProductFood\/Search/i,true)).map(function(r){return{f_id:r.f_id,f_name:r.f_name,f_nameabbreviation:r.f_nameabbreviation,f_disposalrate:r.f_disposalrate,f_protida:r.f_protida,f_protidv:r.f_protidv,f_lipida:r.f_lipida,f_lipidv:r.f_lipidv,f_glucid:r.f_glucid,f_calo:r.f_calo}});
      msg('Đang đọc Thực phẩm trường đang sử dụng…');want.size=100;var j=await page('/foodkid/thuc-pham-truong',/SchoolFood\/Search/i,false),a=arr(j),tot=(a[0]&&+a[0].myTotal)||a.length,seen={};
      var keep=function(L){L.forEach(function(x){if(!seen[x.sf_id]){seen[x.sf_id]=1;out.foods.push({sf_id:x.sf_id,f_id:x.f_id,cu_id:x.cu_id,s_id:x.s_id,sf_name:x.sf_name,sf_nameabbreviation:x.sf_nameabbreviation,sf_group:x.sf_group,sf_disposalrate:x.sf_disposalrate,sf_price:x.sf_price,sf_isoftenused:x.sf_isoftenused,sf_isusewarehouse:x.sf_isusewarehouse})}})};keep(a);
      for(var p=2;busy&&out.foods.length<tot&&p<=40;p++){msg('Đang đọc Thực phẩm trường: '+out.foods.length+'/'+tot+'…');var n0=got.length;want.page=p;var b=searchBtn();if(!b)break;b.click();
        var jj=await until(function(){return last(/SchoolFood\/Search/i,n0)},20000);want.page=0;if(!jj)break;var L=arr(jj);if(!L.length)break;keep(L)}
      want.page=0;want.size=0;
      msg('Đang đọc Thư viện món ăn…');link('/foodkid/mon-an');await sleep(2500);var dseen={},dtot=0;
      for(var q=1;busy&&q<=200;q++){var inp=[].slice.call(document.querySelectorAll('input')).filter(function(i){var l=i.closest('div')&&i.closest('div').parentElement;return l&&/Nội dung tìm kiếm/.test(l.innerText||'')&&i.type!=='checkbox'})[0];
        if(inp){var set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(inp,'rk'+q);inp.dispatchEvent(new Event('input',{bubbles:true}))}
        await sleep(200);var n1=got.length;want.dpage=q;var sb=searchBtn();if(!sb)break;sb.click();var dj=await until(function(){return last(/Dish\/Search/i,n1)},20000);want.dpage=0;if(!dj)break;
        var dd=dj.data||{},DL=dd.listDish||[];dtot=+dd.totalCount||dtot;var add=0;DL.forEach(function(x){if(!dseen[x.d_id]){dseen[x.d_id]=1;add++;var o={};['d_id','d_name','d_meals','d_ages','dc_id','d_regions','d_prepare','d_mainingredients','d_cookingsteps','d_malnutrition','d_fat','d_allergy','d_especially','d_samplevolume','d_sampledescription','d_step2a_quanlity_test_succeed','d_step2a_kichen_equipment','d_step2b_quanlity_test_succeed'].forEach(function(k){if(x[k]!=null&&x[k]!=='')o[k]=x[k]});out.dishes.push(o)}});
        msg('Đang đọc Thư viện món ăn: '+out.dishes.length+(dtot?'/'+dtot:'')+'…');if(!add||!DL.length||(dtot&&out.dishes.length>=dtot))break}
      if(inp){set.call(inp,'');inp.dispatchEvent(new Event('input',{bubbles:true}))}
      if(!busy)return;busy=false;pid=String(Date.now());data={rk:'sc-kp',id:pid,at:new Date().toISOString(),units:out.units,sups:out.sups,groups:out.groups,ref:out.ref,foods:out.foods,dishes:out.dishes};
      msg('Đã đọc '+out.foods.length+' thực phẩm, '+out.ref.length+' loại trong bảng thành phần, '+out.dishes.length+' món ăn. Đang gửi sang RoseKids…');send()}
    catch(e){busy=false;want.size=want.page=want.dpage=0;msg('Chưa đọc được: '+(e.message||e)+'. Cô thử bấm lại.')}}
  /* chỉ đọc trang Nhà cung cấp (không đọc thực phẩm, món ăn, thực đơn) */
  async function runSup(){if(busy)return;busy=true;data=null;got=[];
    try{msg('Đang đọc Nhà cung cấp…');want.size=1000;var sups=arr(await page('/foodkid/nha-cung-cap',/ProductSupplier/i,false),'listSupplier').map(function(s){var o={};for(var k in s){var v=s[k];if(v!=null&&typeof v!=='object')o[k]=v}return o});want.size=0;
      if(!busy)return;busy=false;pid=String(Date.now());data={rk:'sc-kp',only:'sups',id:pid,at:new Date().toISOString(),sups:sups};
      msg('Đã đọc '+sups.length+' nhà cung cấp. Đang gửi sang RoseKids…');send()}
    catch(e){busy=false;want.size=0;msg('Chưa đọc được: '+(e.message||e)+'. Cô thử bấm lại.')}}
  /* thực đơn, sổ kiểm thực, sĩ số từng ngày (trang Sổ kiểm thực 3 bước trả cả 2 nhóm trong 1 lần) và phiếu nhập kho; chỉ đọc */
  function pick(o,keys,re){var r={};for(var k in o){var v=o[k];if(v==null||v===''||v===0&&!/quantity|price/.test(k))continue;if(keys.indexOf(k)>=0||re&&re.test(k))r[k]=v}return r}
  async function runHist(){if(busy)return;busy=true;data=null;got=[];var out={groups:[],days:[],vouchers:[]};
    try{try{var g=await page('/foodkid/nhom-tre',/kid-group|KidGroup/i,false);out.groups=arr(g).map(grp)}catch(e){}
      var now=new Date(),y0=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1,d=new Date(y0,8,1),end=new Date(now.getFullYear(),now.getMonth(),now.getDate()),list=[];
      for(;d<=end;d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1))if(d.getDay()!==0)list.push(new Date(d));
      for(var i=0;busy&&i<list.length;i++){var ts=Math.round(list[i].getTime()/1000),iso=list[i].getFullYear()+'-'+String(list[i].getMonth()+1).padStart(2,'0')+'-'+String(list[i].getDate()).padStart(2,'0');
        msg('Đang đọc thực đơn, sổ kiểm thực ngày '+iso.split('-').reverse().join('/')+' ('+(i+1)+'/'+list.length+')…');
        var j=null;for(var t=0;busy&&!j&&t<2;t++){want.day=ts;var n0=got.length;link('/foodkid/bao-bi');await sleep(500);link('/foodkid/so-kiem-thuc-ba-buoc');j=await until(function(){return last(/so-kiem-thuc\/\d+/i,n0)},15000)}
        want.day=0;got=[];if(!j)throw new Error('SC chưa trả sổ kiểm thực ngày '+iso);var D=j.data||{};if(!(D.listMenu||[]).length)continue;
        out.days.push({date:iso,menus:D.listMenu.map(function(m){return pick(m,['m_id','kg_id','m_code','m_datefounded','m_quantitybefore','m_quantityafter','m_price'])}),
          foods:(D.listSchoolFood||[]).map(function(f){return pick(f,['m_id','sf_id','f_name','cu_id','sf_group','msf_meal','msf_sortorder','msf_disposalrate','msf_quantitybefore','msf_quantityafter','msf_totalquantitybefore','msf_totalquantityafter','msf_pricebefore','msf_priceafter','msf_useinwarehouse'],/^msf_step1/)}),
          dishes:(D.listMenuDish||[]).map(function(m){return pick(m,['m_id','d_id','d_name','md_meal'],/^md_step/)})})}
      if(!busy)return;
      var ms=[];for(var m=new Date(y0,8,1);m<=end;m=new Date(m.getFullYear(),m.getMonth()+1,1))ms.push([m.getFullYear(),m.getMonth()+1]);var withV=null,lastN=0;
      var V=[];for(var k=0;busy&&k<ms.length;k++){msg('Đang đọc phiếu nhập kho tháng '+ms[k][1]+'/'+ms[k][0]+'…');want.ym=ms[k];var n1=got.length;link('/foodkid/bao-bi');await sleep(500);link('/foodkid/phieu-nhap-kho');
        var vj=await until(function(){return last(/ImportVoucher\/Search/i,n1)},15000);want.ym=null;lastN=vj?arr(vj).length:0;if(lastN)withV=ms[k];if(vj)arr(vj).forEach(function(v){if(!V.some(function(x){return x.fr_id===v.fr_id}))V.push(pick(v,['fr_id','w_id','fr_code','fr_type','fr_datefounded','fr_totalimport','fr_description','fr_deliverorreceiver','fr_creator','fr_status']))})}
      if(!lastN&&withV){want.ym=withV;link('/foodkid/bao-bi');await sleep(500);link('/foodkid/phieu-nhap-kho');await sleep(2500);want.ym=null}await sleep(1200);
      for(var q=0;busy&&q<V.length;q++){msg('Đang đọc chi tiết phiếu nhập '+V[q].fr_code+' ('+(q+1)+'/'+V.length+')…');var btn=document.querySelector('tr.ant-curr-table-row button.btn-primary');if(!btn){msg('Tháng này SC chưa có phiếu nhập để mở, em bỏ qua chi tiết phiếu nhập.');break}
        want.vid=V[q].fr_id;var n2=got.length;btn.click();var dj=await until(function(){return last(/ImportVoucher\/GetDetail/i,n2)},15000);want.vid=0;
        var cl=document.querySelector('.ant-modal-close');if(cl)cl.click();await sleep(400);
        V[q].lines=dj?arr(dj).map(function(l){return pick(l,['sf_id','frd_foodname','frd_quantityimport','frd_priceimport','frd_totalimport'])}):null}
      out.vouchers=V;if(!busy)return;busy=false;pid=String(Date.now());data={rk:'sc-kph',id:pid,at:new Date().toISOString(),groups:out.groups,days:out.days,vouchers:out.vouchers};
      msg('Đã đọc '+out.days.length+' ngày có thực đơn và '+V.length+' phiếu nhập kho. Đang gửi sang RoseKids…');send()}
    catch(e){busy=false;want.day=0;want.ym=null;want.vid=0;msg('Chưa đọc được: '+(e.message||e)+'. Cô thử bấm lại.')}}
  function send(){if(!data)return;try{navigator.clipboard.writeText('RKSC1:'+JSON.stringify(data))}catch(e){}
    var w=window.open('','rosekids');if(!w){msg('Trình duyệt chặn mở RoseKids. Cô cho phép cửa sổ bật lên ở sc.edu.vn rồi bấm Gửi lại.');return}
    var fresh=false;try{fresh=w.location.href==='about:blank'}catch(e){}
    if(fresh){try{w.close()}catch(e){}msg('Đã chép sẵn dữ liệu. Cô chuyển sang tab RoseKids: RoseKids tự nhận (nếu chưa thấy, cô mở RoseKids rồi bấm Gửi lại).');return}
    var t0=Date.now(),sent=false,iv;
    function lis(e){if(e.origin!==RKO||!e.data)return;if(e.data.rk==='ready'&&!sent){sent=true;w.postMessage(data,RKO)}
      if(e.data.rk==='got'){window.removeEventListener('message',lis);clearInterval(iv);msg('Đã chuyển sang RoseKids. Cô sang tab RoseKids xem trước rồi bấm Ghi vào RoseKids.')}}
    window.addEventListener('message',lis);
    iv=setInterval(function(){if(Date.now()-t0>40000){clearInterval(iv);window.removeEventListener('message',lis);msg('RoseKids chưa trả lời. Dữ liệu đã được chép sẵn: cô sang tab RoseKids là tự nhận.');return}try{w.postMessage({rk:'ping'},RKO)}catch(e){}},700)}
  draw()}
window.__rkSC.show()})();
