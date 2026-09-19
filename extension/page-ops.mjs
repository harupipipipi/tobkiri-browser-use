/** This function is serialized into a CDP ISOLATED world. No extension token or privileges enter the page. */
export function pageOp(op, a={}) {
  const fail=(code,message)=>{throw new Error(`${code}: ${message}`);};
  const store=globalThis.__tobkiri_tabs_refs ??= {refs:new Map(),generation:0};
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  const label=el=>(el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim() || el.labels?.[0]?.innerText || el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('placeholder') || el.innerText || el.getAttribute('name') || '').trim().slice(0,180);
  function target() {
    let el;
    if(a.ref) el=store.refs.get(a.ref);
    else if(a.selector) {let list;try{list=document.querySelectorAll(a.selector);}catch{fail('INVALID_SELECTOR','Invalid CSS selector.');}if(list.length!==1)fail('AMBIGUOUS_TARGET',`Selector matched ${list.length} elements; use a snapshot ref.`);el=list[0];}
    if(!el?.isConnected || el.ownerDocument!==document)fail('STALE_REF','Take a new snapshot, or use a unique selector.');
    return el;
  }
  function point(el) {
    if(!visible(el))fail('NOT_VISIBLE','Target is not visible.');
    if(el.disabled || el.getAttribute('aria-disabled')==='true')fail('DISABLED','Target is disabled.');
    el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
    const r=el.getBoundingClientRect();
    const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
    if(right<=left||bottom<=top)fail('OUTSIDE_VIEWPORT','Target has no visible point.');
    const x=(left+right)/2,y=(top+bottom)/2;
    let hit=document.elementFromPoint(x,y);
    for(let i=0;i<10&&hit?.shadowRoot;i++){const deeper=hit.shadowRoot.elementFromPoint(x,y);if(!deeper||deeper===hit)break;hit=deeper;}
    if(!hit || (hit!==el&&!el.contains(hit)))fail('OBSCURED','Target center is covered by another element.');
    return {x,y};
  }
  if(op==='ready')return {readyState:document.readyState,url:location.href};
  if(op==='viewport')return {width:innerWidth,height:innerHeight,scrollX,scrollY,devicePixelRatio};
  if(op==='snapshot') {
    store.refs.clear();store.generation++;
    const prefix=`r${store.generation}_${Math.random().toString(36).slice(2,9)}_`;
    const elements=[],roots=[document];let examined=0,capped=false;
    const max=Math.floor(a.maxElements||180);
    while(roots.length && elements.length<max && examined<30000) {
      const root=roots.shift();
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT);let el;
      while((el=walker.nextNode())) {
        if(++examined>30000){capped=true;break;}
        if(el.shadowRoot)roots.push(el.shadowRoot);
        if(!el.matches('a[href],button,input,textarea,select,summary,[role="button"],[role="link"],[role="checkbox"],[role="radio"],[role="textbox"],[role="combobox"],[contenteditable="true"],[tabindex]') || !visible(el))continue;
        const ref=prefix+elements.length;store.refs.set(ref,el);
        const r=el.getBoundingClientRect();const sensitive=/password/i.test(el.type||'') || /password|one-time-code|cc-/i.test(el.autocomplete||'');
        const item={ref,tag:el.tagName.toLowerCase(),role:el.getAttribute('role')||undefined,name:label(el),type:el.type||undefined,disabled:!!el.disabled,inViewport:r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth,rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
        if('value' in el && !sensitive && el.type!=='file') item.value=String(el.value).slice(0,200);
        if(sensitive)item.value='[REDACTED]';
        if('checked'in el)item.checked=el.checked;
        if(el.tagName==='SELECT')item.options=[...el.options].slice(0,50).map(o=>({value:o.value,label:o.label,selected:o.selected}));
        elements.push(item);if(elements.length>=max){capped=true;break;}
      }
    }
    const text=document.body?.innerText||'';
    return {untrustedContent:true,title:document.title,url:location.href,text:text.slice(0,a.maxTextChars||18000),textTruncated:text.length>(a.maxTextChars||18000),elements,elementsTruncated:capped,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,devicePixelRatio},iframes:[...document.querySelectorAll('iframe')].slice(0,30).map(f=>({title:f.title,src:f.getAttribute('src'),note:'Iframe DOM is not exposed in v0.1; coordinates can target rendered content.'}))};
  }
  if(op==='point')return point(target());
  if(op==='checkState'){const el=target();if(!['checkbox','radio'].includes(el.type))fail('WRONG_ELEMENT','Target is not a checkbox/radio.');return {checked:el.checked,type:el.type};}
  if(op==='focus') {
    const el=target();point(el);
    if(a.edit && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable))fail('NOT_EDITABLE','Target is not an editable control.');
    if(a.edit && (el.readOnly || ['file','checkbox','radio','button','submit','reset','image','range','color','date','time','datetime-local','month','week','hidden'].includes(el.type)))fail('NOT_EDITABLE','This input needs a specialized/manual interaction.');
    el.focus({preventScroll:true});
    if(a.replace) {
      if(typeof el.select==='function')el.select();
      else if(el.isContentEditable){const range=document.createRange();range.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(range);}
    }
    return {focused:true};
  }
  if(op==='select') {
    const el=target();if(!(el instanceof HTMLSelectElement))fail('WRONG_ELEMENT','Expected native select.');point(el);
    const option=[...el.options].find(o=>o.value===a.value);if(!option||option.disabled)fail('BAD_OPTION','Option missing or disabled.');
    el.value=a.value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return {value:el.value,syntheticEvents:true};
  }
  if(op==='scroll') {
    const dx=a.deltaX||0,dy=a.deltaY||0;
    let el;
    if(a.ref||a.selector)el=target();
    else {
      const x=a.x??innerWidth/2,y=a.y??innerHeight/2;
      if(x<0||y<0||x>=innerWidth||y>=innerHeight)fail('OUTSIDE_VIEWPORT','Scroll coordinates must be in the viewport.');
      el=document.elementFromPoint(x,y);
      for(let i=0;i<10&&el?.shadowRoot;i++){const next=el.shadowRoot.elementFromPoint(x,y);if(!next||next===el)break;el=next;}
    }
    const root=document.scrollingElement;
    const canMove=(position,size,view,delta)=>delta<0?position>0:delta>0?position+view<size:false;
    while(el && el!==root) {
      const style=getComputedStyle(el);
      const yOk=/(auto|scroll|overlay)/.test(style.overflowY)&&canMove(el.scrollTop,el.scrollHeight,el.clientHeight,dy);
      const xOk=/(auto|scroll|overlay)/.test(style.overflowX)&&canMove(el.scrollLeft,el.scrollWidth,el.clientWidth,dx);
      if(yOk||xOk)break;
      el=el.parentElement||el.getRootNode()?.host;
    }
    el=el||root;if(!el)fail('NO_SCROLL_TARGET','No scrolling element.');
    const before={x:el.scrollLeft,y:el.scrollTop};el.scrollBy({left:dx,top:dy,behavior:'instant'});
    return {method:'dom-scroll',before,after:{x:el.scrollLeft,y:el.scrollTop},note:'Programmatic scrolling: no wheel event is dispatched.'};
  }
  if(op==='wait') {
    if(a.text!==undefined)return {matched:(document.body?.innerText||'').includes(a.text)};
    let el;try{el=document.querySelector(a.selector);}catch{fail('INVALID_SELECTOR','Invalid CSS selector.');}return {matched:!!el&&visible(el)};
  }
  fail('UNKNOWN_PAGE_OPERATION','Unsupported page operation.');
}
