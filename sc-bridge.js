/* RoseKids ← SC: chạy trên trang sc.edu.vn khi cô bấm nút trên thanh dấu trang (nút chỉ nạp file này).
   Xem giải thích ở index.html, mục “Tải thẳng sổ thu từ SC”. */
(function(){var C=window.__rkSCcfg||{};
function scBridge(RK,WANT){
  if(window.__rkSC){window.__rkSC.show();return}
  var RKO=new URL(RK).origin,files=[],seen={},on=true,waitFn=null,busy=false;
  var norm=function(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u0111\u0110]/g,'d').toLowerCase().replace(/\s+/g,' ').trim()};
  var lopKey=function(t){return norm(t).replace(/^lop\s+/,'')};WANT=(WANT||[]).map(lopKey);
  var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
  var box=document.createElement('div');
  box.style.cssText='position:fixed;z-index:2147483647;right:16px;bottom:16px;width:340px;max-height:80vh;overflow:auto;background:#fff;border:2px solid #d63d6b;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);font:14px/1.45 Arial,sans-serif;color:#222;padding:12px';
  document.body.appendChild(box);
  window.__rkSC={show:function(){box.style.display='block';on=true;draw()}};
  var note='';
  function msg(t){note=t;draw()}
  function bt(id,t,pri){return '<button data-rk="'+id+'" style="margin:4px 4px 0 0;padding:6px 10px;border-radius:8px;border:1px solid #d63d6b;cursor:pointer;font:inherit;'+(pri?'background:#d63d6b;color:#fff':'background:#fff;color:#d63d6b')+'">'+t+'</button>'}
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function draw(){
    var m=fText(fld('thang hoc'));
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#d63d6b">RoseKids ← SC</b>'+bt('x','Đóng')+'</div>'+
      '<div style="margin:6px 0">Tháng học: <b>'+esc(m||'?')+'</b> (cô đổi ở ô Tháng học của SC nếu cần).</div>'+
      '<div>Đã lấy <b>'+files.length+'</b> file'+(files.length?': '+files.map(function(f){return esc(f.lop||f.name)}).join(', '):'')+'</div>'+
      (note?'<div style="margin-top:6px;color:#a3214a;white-space:pre-line">'+esc(note)+'</div>':'')+
      '<div style="margin-top:6px">'+(busy?bt('stop','Dừng'):bt('auto','Tự lấy tất cả lớp',!files.length))+
      (files.length&&!busy?bt('kt','Gửi sang RoseKids: kiểm tra phiếu',true)+bt('st','Gửi làm sổ thu (nợ, dư)')+bt('cp','Chép')+bt('clr','Xóa danh sách'):'')+'</div>'+
      '<div>'+bt('dg','Chép thông tin trang')+'</div>'+
      '<div style="margin-top:6px;font-size:12px;color:#666">Cô cũng có thể tự chọn lớp rồi bấm nút Xuất Excel của SC: em giữ file lại ở đây, không lưu xuống máy.</div>'}
  box.addEventListener('click',function(e){e.stopPropagation();var b=e.target.closest('[data-rk]');if(!b)return;var a=b.getAttribute('data-rk');
    if(a==='x'){box.style.display='none';on=false}else if(a==='auto')setTimeout(auto,50);else if(a==='stop'){busy=false;msg('Đã dừng.')}
    else if(a==='kt')send('kiemtra');else if(a==='st')send('sothu');else if(a==='cp')copy();else if(a==='clr'){files=[];msg('')}else if(a==='dg')diag()});
  /* ô chọn theo nhãn (Khối học/độ tuổi, Lớp học, Tháng học): ô select thường hoặc ô tự làm của SC */
  function vis(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
  function fld(label){var ns=[].concat(label).map(norm),els=[].slice.call(document.querySelectorAll('h6,label,span,div,p,b,strong,h5,td,th')).filter(function(e){return !box.contains(e)&&e.children.length<=2});
    /* ưu tiên ô nhãn đúng nguyên chữ (vd <h6>Tháng học</h6>), rồi mới tới ô bắt đầu bằng chữ đó */
    var cand=[];[function(t,n){return t===n},function(t,n){return t.indexOf(n)===0&&t.length<=n.length+12}].forEach(function(ok){ns.forEach(function(n){els.forEach(function(e){if(cand.indexOf(e)<0&&ok(norm(e.textContent),n))cand.push(e)})})});
    for(var i=0;i<cand.length;i++){var e=cand[i],p=e.parentElement;for(var u=0;u<4&&p;u++){var s=p.querySelector('select');
        var c=[].slice.call(p.children).filter(function(x){return x!==e&&!x.contains(e)&&vis(x)});
        if(s||c.length){var ctlEl=c[0]||s;return{lab:e,sel:s&&(!c.length||c[0].contains(s)||c[0]===s)?s:null,el:ctlEl}}p=p.parentElement}}return null}
  function fText(f){if(!f)return'';if(f.sel){var o=f.sel.options[f.sel.selectedIndex];if(o)return o.text.trim()}
    var inp=f.el.querySelector('input');var t=(f.el.innerText||'').split('\n').map(function(x){return x.trim()}).filter(Boolean)[0]||'';return t||(inp&&inp.value)||''}
  var OPT='[class*="-select-item-option"],[role=option],li,.dropdown-item,.select2-results__option,.ant-select-item,.el-select-dropdown__item,.vs__dropdown-option,.ng-option,.multiselect__option,.v-list-item,.item,.option';
  function press(el){['pointerdown','mousedown','pointerup','mouseup','click'].forEach(function(t){var E=/^pointer/.test(t)?(window.PointerEvent||MouseEvent):MouseEvent;el.dispatchEvent(new E(t,{bubbles:true,cancelable:true,view:window}))})}
  async function fOpen(f){var before=new Set([].slice.call(document.querySelectorAll(OPT)).filter(vis));
    var tgt=f.el.querySelector('[role=combobox],.select2-selection,.ant-select-selector,.el-input__inner,.vs__dropdown-toggle,.ng-select-container,.multiselect,input,button')||f.el;press(tgt);if(tgt.focus)tgt.focus();await sleep(500);
    var r0=f.el.getBoundingClientRect();
    var os=[].slice.call(document.querySelectorAll(OPT)).filter(function(o){if(box.contains(o)||!vis(o)||before.has(o)&&!f.el.contains(o)&&!o.closest('[role=listbox]'))return false;if(o.querySelector(OPT))return false;var t=(o.innerText||'').trim();return t&&t.length<80});
    if(!os.length)os=[].slice.call(document.querySelectorAll(OPT)).filter(function(o){var r=o.getBoundingClientRect();return vis(o)&&!box.contains(o)&&!o.querySelector(OPT)&&Math.abs(r.left-r0.left)<60&&r.top>=r0.top-400&&r.top<r0.bottom+600&&(o.innerText||'').trim()});
    return os}
  function fClose(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',keyCode:27,bubbles:true}));press(document.body)}
  function okOpt(t){t=norm(t);return t&&!/^(tat ca|chon|-|khong co)/.test(t)}
  /* danh sách xổ xuống kiểu Ant Design chỉ vẽ các dòng đang thấy: kéo dần xuống để thấy hết */
  function holderOf(os){for(var i=0;i<os.length;i++){var h=os[i].closest('.rc-virtual-list-holder')||os[i].closest('[role=listbox]');if(h&&h.scrollHeight>h.clientHeight+2)return h}
    var d=os[0]&&os[0].parentElement;while(d&&d!==document.body){if(d.scrollHeight>d.clientHeight+2&&/auto|scroll/.test(getComputedStyle(d).overflowY))return d;d=d.parentElement}return null}
  async function toTop(h){for(var k=0;k<30&&h.scrollTop>0;k++){h.dispatchEvent(new WheelEvent('wheel',{deltaY:-1000,bubbles:true,cancelable:true}));await sleep(60);if(h.scrollTop>0){h.scrollTop=0;h.dispatchEvent(new Event('scroll'))}await sleep(60)}}
  async function scan(f,want){var os=await fOpen(f),out=[],h=holderOf(os),guard=0;
    if(h&&h.scrollTop>0){await toTop(h);await sleep(200);os=[].slice.call(document.querySelectorAll(OPT)).filter(function(o){return vis(o)&&!box.contains(o)&&!o.querySelector(OPT)&&h.contains(o)})}
    while(true){var hit=null;os.forEach(function(o){var t=(o.innerText||'').trim();if(want&&norm(t)===norm(want))hit=o;if(t&&out.indexOf(t)<0)out.push(t)});
      if(hit)return{hit:hit,out:out};if(!h||guard++>40)break;var top=h.scrollTop,dy=Math.max(40,h.clientHeight*0.7);h.dispatchEvent(new WheelEvent('wheel',{deltaY:dy,bubbles:true,cancelable:true}));await sleep(150);if(h.scrollTop===top){h.scrollTop=top+dy;h.dispatchEvent(new Event('scroll'))}await sleep(200);if(h.scrollTop===top)break;
      os=[].slice.call(document.querySelectorAll(OPT)).filter(function(o){return vis(o)&&!box.contains(o)&&!o.querySelector(OPT)&&h.contains(o)})}
    if(h)await toTop(h);return{hit:null,out:out}}
  async function fOpts(f){if(f.sel)return [].slice.call(f.sel.options).filter(function(o){return o.value!==''&&okOpt(o.text)}).map(function(o){return o.text.trim()});
    var r=await scan(f,null);fClose();await sleep(200);return r.out.filter(okOpt)}
  async function fSet(f,text){if(norm(fText(f))===norm(text))return true;
    if(f.sel){var o=[].slice.call(f.sel.options).find(function(x){return norm(x.text)===norm(text)});if(!o)return false;f.sel.value=o.value;
      f.sel.dispatchEvent(new Event('input',{bubbles:true}));f.sel.dispatchEvent(new Event('change',{bubbles:true}));try{if(window.jQuery)window.jQuery(f.sel).trigger('change')}catch(e){}return true}
    var r=await scan(f,text),hit=r.hit;if(!hit){fClose();return false}
    hit.scrollIntoView&&hit.scrollIntoView({block:'nearest'});press(hit);await sleep(300);return true}
  function cmdBtns(){var l=null,els=document.querySelectorAll('label,span,div,p');for(var i=0;i<els.length;i++)if(norm(els[i].textContent)==='cac nut lenh'){l=els[i];break}
    var p=l&&l.parentElement;for(var u=0;u<4&&p;u++){var b=p.querySelectorAll('button,a,[role=button]');if(b.length>=2)return [].slice.call(b);p=p.parentElement}return []}
  function findBtn(re,idx){var c=cmdBtns(),hay=function(b){return (b.title||'')+' '+(b.getAttribute('aria-label')||'')+' '+b.className+' '+b.innerHTML+' '+b.textContent};
    for(var i=0;i<c.length;i++)if(re.test(hay(c[i])))return c[i];if(c.length>=3)return c[idx]||null;
    var all=[].slice.call(document.querySelectorAll('button,a,[role=button]'));for(i=0;i<all.length;i++)if(!box.contains(all[i])&&re.test(hay(all[i])))return all[i];return null}
  function curLop(){return fText(fld('lop hoc'))}
  function diag(){var l=fld('lop hoc'),root=l?l.lab.closest('form')||l.lab.parentElement.parentElement.parentElement.parentElement:document.body;
    var h=(root?root.outerHTML:'').replace(/\s+/g,' ').slice(0,30000);var F=['khoi hoc','lop hoc','thang hoc'].map(function(k){var f=fld(k);return k+': '+(f?(f.sel?'select ':'')+f.el.tagName+'.'+f.el.className+' = '+fText(f):'không thấy')}).join('\n');navigator.clipboard.writeText('RKDIAG '+location.href+'\n'+F+'\nNUT: '+cmdBtns().map(function(b){return b.tagName+'.'+b.className+' '+(b.title||'')}).join(' | ')+'\nMANG:\n'+netlog.join('\n')+'\nHTML:\n'+h).then(function(){msg('Đã chép thông tin trang SC. Cô dán (Ctrl+V) vào tin nhắn gửi em.')},function(e){msg('Chưa chép được: '+e.message)})}
  /* giữ lại file Excel SC tạo ra */
  function isX(type){return !type||/sheet|excel|octet|zip|xls/i.test(type)}
  function take(blob,name){var lop=curLop();return blob.slice(0,4).arrayBuffer().then(function(h){var b=new Uint8Array(h),zip=b[0]===0x50&&b[1]===0x4b,ole=b[0]===0xd0&&b[1]===0xcf;
    if(!zip&&!ole){nl('BO blob '+blob.type+' '+blob.size);return}return blob.arrayBuffer().then(function(buf){if(files.some(function(f){return f.lop===lop&&f.buf.byteLength===buf.byteLength&&Date.now()-f.at<4000}))return;files=files.filter(function(f){return !lop||f.lop!==lop});
      files.push({name:name||('SC_'+(lop||files.length+1)+(ole?'.xls':'.xlsx')),lop:lop,buf:buf,at:Date.now()});nl('LAY '+lop+' '+buf.byteLength);draw();if(waitFn){var w=waitFn;waitFn=null;w()}})})}
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
  async function auto(){try{await auto1()}catch(e){busy=false;msg('Lỗi: '+(e&&e.message||e)+'. Cô bấm “Chép thông tin trang” rồi dán gửi em.')}}
  /* chờ SC tải xong: đợi đến khi điều kiện đúng (tối đa ms) */
  async function until(fn,ms){var t=Date.now();while(Date.now()-t<ms){try{if(fn())return true}catch(e){}await sleep(250)}return false}
  function disabled(b){return !b||b.disabled||b.getAttribute('disabled')!==null||/disabled/.test(b.className)}
  /* đóng hộp thông báo của SC (vd “Bạn chưa chọn tháng học!”): bấm Đồng ý; trả về true nếu có hộp */
  function closeAlerts(){var hit=false;[].slice.call(document.querySelectorAll('button,a')).forEach(function(b){if(box.contains(b)||!vis(b))return;var t=norm(b.textContent);
      if(/^(dong y|ok|dong)$/.test(t)&&b.closest('[class*="modal"],[class*="swal"],[class*="dialog"],[class*="confirm"],[role=dialog]')){b.click();hit=true}});return hit}
  /* lấy một lớp: chọn lớp, giữ tháng, bấm tìm, đợi SC tải dữ liệu xong, bấm Excel, đợi file */
  async function getOne(name,month,slow){var reX=/excel|xlsx?\b|file-export|xuat file|xuat excel/i,reS=/fa-search|search|tim kiem|xem bao cao/i;
    msg('Đang lấy '+name+'…');
    if(!await fSet(fld('lop hoc'),name))return false;
    await until(function(){return norm(fText(fld('lop hoc')))===norm(name)},3000);await sleep(slow?1500:700);
    closeAlerts();
    /* SC xóa ô Tháng học khi đổi lớp và tải lại danh sách tháng: chọn lại tháng tới khi đúng rồi mới tìm */
    if(month){var okM=await until(function(){return norm(fText(fld('thang hoc')))===norm(month)},slow?2500:1200);
      for(var r=0;r<8&&!okM;r++){await fSet(fld('thang hoc'),month);await sleep(slow?1200:700);okM=norm(fText(fld('thang hoc')))===norm(month)}
      if(!okM){msg('Chưa chọn được tháng '+month+' cho '+name);return false}}
    var bS=findBtn(reS,0),n0=apiDone;if(bS){bS.click();await until(function(){return apiDone>n0||closeAlerts()},slow?25000:15000);if(apiDone<=n0)return false;await sleep(slow?1500:700)}
    await until(function(){return !disabled(findBtn(reX,2))},8000);
    var p=waitFile(slow?40000:25000);findBtn(reX,2).click();return await p}
  async function auto1(){if(busy)return;var fL=fld('lop hoc'),fT=fld('thang hoc'),fKn=['khoi hoc/do tuoi','khoi hoc'],fK=fld(fKn);
    if(!fL){msg('Em chưa tìm thấy ô Lớp học. Cô mở Báo cáo thống kê > Sổ thu thanh toán tổng hợp rồi bấm lại.');return}
    if(!findBtn(/excel|xlsx?\b|file-export|xuat file|xuat excel/i,2)){msg('Em chưa tìm thấy nút Xuất Excel. Cô tự chọn lớp rồi bấm nút Excel của SC, em vẫn giữ file.');return}
    var month=fText(fT),have={};files.forEach(function(f){have[lopKey(f.lop)]=1});busy=true;note='';draw();
    var ks=fK?await fOpts(fK):[null];if(!ks.length)ks=[null];
    /* chỉ 5 khối trường có lớp (cô chốt 07/11/2026): Nhà trẻ 13-24, Nhà trẻ 24-36, Mẫu giáo bé, nhỡ, lớn; bỏ Nhà trẻ 3-12 tháng, Khối 1, Khối 2… */
    var mn=ks.filter(function(k){return k&&/^(nha tre 13-24|nha tre 24-36|mau giao (be|nho|lon))/.test(norm(k))});if(mn.length)ks=mn;
    var need=function(k){return !have[k]&&(!WANT.length||WANT.indexOf(k)>=0)};
    /* lượt 1 đi nhanh; lượt 2 đi chậm, chỉ lấy lớp còn thiếu */
    for(var pass=0;pass<2&&busy;pass++){var slow=pass>0;if(WANT.length&&!WANT.some(need))break;
      for(var i=0;i<ks.length&&busy;i++){
        if(ks[i]!==null){msg('Chọn khối '+ks[i]+'…');var before=fText(fld('lop hoc'));if(!await fSet(fld(fKn),ks[i]))continue;
          await until(function(){return fText(fld('lop hoc'))!==before},slow?6000:3000);await sleep(slow?2000:1000)}
        var ls=await fOpts(fld('lop hoc'));if(!ls.length){await sleep(slow?3000:1500);ls=await fOpts(fld('lop hoc'))}
        for(var j=0;j<ls.length&&busy;j++){var key=lopKey(ls[j]);if(!need(key))continue;
          if(await getOne(ls[j],month,slow))have[key]=1}}}
    var miss=WANT.filter(function(w){return !have[w]});busy=false;
    msg(miss.length?'Chưa lấy được: '+miss.join(', ')+'. Cô chọn tay các lớp này rồi bấm nút Excel của SC (em giữ file lại), hoặc bấm “Tự lấy tất cả lớp” lần nữa: em chỉ lấy thêm lớp còn thiếu.':'Xong '+files.length+' lớp. Cô bấm “Gửi sang RoseKids”.')}
  /* gửi sang RoseKids */
  function payload(p){return{rk:'sc-files',purpose:p,files:files.map(function(f){return{name:f.name,lop:f.lop,buf:f.buf}})}}
  function send(p){var w=oOpen.call(window,RK+'#sc-nhan','rosekids');if(!w){msg('Trình duyệt chặn mở RoseKids. Cô cho phép cửa sổ bật lên ở sc.edu.vn rồi bấm lại.');return}
    var t0=Date.now(),sent=false,iv;
    function lis(e){if(e.origin!==RKO||!e.data)return;
      if(e.data.rk==='ready'&&!sent){sent=true;w.postMessage(payload(p),RKO)}
      if(e.data.rk==='got'){window.removeEventListener('message',lis);clearInterval(iv);msg('Đã chuyển '+e.data.n+' file sang RoseKids.')}}
    window.addEventListener('message',lis);msg('Đang mở RoseKids…');
    iv=setInterval(function(){if(Date.now()-t0>40000){clearInterval(iv);window.removeEventListener('message',lis);msg('RoseKids chưa trả lời. Cô bấm “Chép”, sang RoseKids (Học phí > Kiểm tra phiếu thu) bấm “Dán từ SC”.');return}
      try{w.postMessage({rk:'ping'},RKO)}catch(e){}},700)}
  function copy(){var d=payload('kiemtra');d.files=d.files.map(function(f){var b=new Uint8Array(f.buf),s='';for(var i=0;i<b.length;i+=8192)s+=String.fromCharCode.apply(null,b.subarray(i,i+8192));return{name:f.name,lop:f.lop,b64:btoa(s)}});
    navigator.clipboard.writeText('RKSC1:'+JSON.stringify(d)).then(function(){msg('Đã chép '+d.files.length+' file. Sang RoseKids bấm “Dán từ SC”.')},function(e){msg('Chưa chép được: '+e.message)})}
  draw()}
scBridge(C.rk,C.want)})();
