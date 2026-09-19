import {AppError,validateArgs,safeUrl,VERSION} from './shared.mjs';
import {pageOp} from './page-ops.mjs';
import {imageSize} from './image-size.mjs';

let config={enabled:false,allowCreate:false,protectActive:true,port:17653,token:''};
let workspaces={},grants={},audit=[],clients=[],connected=false,lastError='',connectionId=null;
let epoch=0,loopRunning=false,reconnectTimer=null;const attached=new Set(),worlds=new Map(),locks=new Map(),canceled=new Set(),intentionalDetach=new Set();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const boot=(async()=>{
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  const c=await chrome.storage.local.get('config');if(c.config)config={...config,...c.config};
  if(!config.instanceId){config.instanceId=crypto.randomUUID();await chrome.storage.local.set({config});}
  const s=await chrome.storage.session.get(['workspaces','grants','audit']);workspaces=s.workspaces||{};grants=s.grants||{};audit=s.audit||[];
  // If Chrome killed the worker, adopt only debugger targets that are ALSO in our explicit grant ledger.
  try{const targets=await chrome.debugger.getTargets();for(const t of targets)if(t.attached && grants[t.tabId] && !grants[t.tabId].revoked)attached.add(t.tabId);}catch{}
  await chrome.alarms.create('bridge-reconnect',{periodInMinutes:0.5});await badge();
})();
function record(name,tabId,status) {audit.unshift({at:new Date().toISOString(),name,tabId:tabId??null,status});audit=audit.slice(0,120);void persist();}
async function persist(){await chrome.storage.session.set({workspaces,grants,audit});}
async function badge(){await chrome.action.setBadgeText({text:config.enabled?(connected?'ON':'…'):'OFF'});await chrome.action.setBadgeBackgroundColor({color:config.enabled?'#28adba':'#697080'});}
async function http(path,body,timeout=21000) {
  const r=await fetch(`http://127.0.0.1:${config.port}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout),cache:'no-store'});
  const data=await r.json();if(!r.ok || data.error)throw new Error(data.error||`HTTP ${r.status}`);return data;
}
async function syncClients(next) {
  clients=next;
  const alive=new Set(next.map(c=>c.id));
  for(const [id,w] of Object.entries(workspaces))if(!alive.has(w.owner))await releaseWorkspace(id);
  await persist();
}
async function loop() {
  await boot;if(loopRunning || !config.token)return;loopRunning=true;
  try {
    const info=await http('/extension/connect',{extensionId:chrome.runtime.id,instanceId:config.instanceId,version:VERSION});
    connectionId=info.connectionId;await syncClients(info.sessions);connected=true;lastError='';await badge();
    while(config.token) {
      // The bounded poll returns at least every 15 seconds. Persisting connection status also renews MV3's idle timer.
      await chrome.storage.session.set({lastHeartbeat:Date.now()});
      const cid=connectionId;const batch=await http(`/extension/poll?connectionId=${encodeURIComponent(cid)}`);
      if(cid!==connectionId)break;
      for(const message of batch.messages||[]) {
        if(message.kind==='cancel') {canceled.add(message.id);setTimeout(()=>canceled.delete(message.id),60000);}
        else if(message.kind==='sessions')await syncClients(message.sessions);
        else if(message.kind==='command')void runCommand(message,cid);
      }
    }
  } catch(e) {lastError=String(e.message).slice(0,220);}
  finally {
    connected=false;connectionId=null;epoch++;loopRunning=false;await detachAll();await badge();
    clearTimeout(reconnectTimer);if(config.token)reconnectTimer=setTimeout(()=>void loop(),3000);
  }
}
function checkpoint(ctx) {
  if(!config.enabled)throw new AppError('PAUSED','User paused automation in the extension.');
  if(ctx && (ctx.epoch!==epoch || canceled.has(ctx.id) || Date.now()>ctx.deadline || !connected))throw new AppError('CANCELED','Operation stopped or its deadline expired.');
}
async function getWorkspace(id,owner) {
  const w=workspaces[id];if(!w || w.owner!==owner)throw new AppError('NOT_GRANTED','Workspace is not owned by this MCP session.');return w;
}
async function guard(tabId,ctx,mutating=true) {
  checkpoint(ctx);const g=grants[tabId];
  if(!g || g.owner!==ctx.owner || g.revoked)throw new AppError('NOT_GRANTED','This tab is not granted to this MCP session.');
  if(workspaces[g.workspaceId]?.paused)throw new AppError('WORKSPACE_PAUSED','User paused this workspace.');
  const tab=await chrome.tabs.get(tabId);safeUrl(tab.pendingUrl || tab.url || 'about:blank');
  if(tab.incognito)throw new AppError('INCOGNITO_BLOCKED','Incognito is not supported.');
  if(config.protectActive && tab.active && mutating)throw new AppError('HUMAN_ACTIVE_TAB','This tab is active. Ask the user to switch to a different tab; do not disable protection on their behalf.');
  checkpoint(ctx);return tab;
}
async function detach(tabId) {
  worlds.delete(tabId);
  if(!attached.has(tabId))return;attached.delete(tabId);intentionalDetach.add(tabId);
  try{await chrome.debugger.detach({tabId});}catch{}finally{setTimeout(()=>intentionalDetach.delete(tabId),1000);}
}
async function detachAll(){await Promise.all([...attached].map(detach));}
async function releaseTab(tabId) {const g=grants[tabId];delete grants[tabId];await detach(Number(tabId));if(g?.restoreAutoDiscardable)await chrome.tabs.update(Number(tabId),{autoDiscardable:true}).catch(()=>{});await persist();}
async function releaseWorkspace(id) {for(const [tabId,g]of Object.entries(grants))if(g.workspaceId===id)await releaseTab(Number(tabId));delete workspaces[id];await persist();}
async function attach(tabId,ctx,mutating=true) {
  await guard(tabId,ctx,mutating);
  if(attached.has(tabId))return;
  try{await chrome.debugger.attach({tabId},'1.3');}catch(e){throw new AppError('DEBUGGER_UNAVAILABLE',`Cannot attach (another debugger, restricted page or policy). ${e.message}`);}
  attached.add(tabId);
  try {
    await raw(tabId,'Page.enable',{},ctx,mutating);
    await raw(tabId,'Runtime.enable',{},ctx,mutating);
    // Prevent the page from opening an OS file picker. Uploading files is intentionally not an API in v0.1.
    await raw(tabId,'Page.setInterceptFileChooserDialog',{enabled:true},ctx,mutating);
  } catch(e){await detach(tabId);throw e;}
}
async function raw(tabId,method,params,ctx,mutating=true) {
  await guard(tabId,ctx,mutating);
  let timer;
  try {
    return await Promise.race([
      chrome.debugger.sendCommand({tabId},method,params),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new AppError('CDP_TIMEOUT','Browser command did not acknowledge. Grant revoked; inspect the tab and explicitly re-grant it before retrying.')),Math.max(1,Math.min(12000,ctx.deadline-Date.now())));})
    ]);
  } catch(e) {
    if(e.code==='CDP_TIMEOUT'){if(grants[tabId])grants[tabId].revoked=true;await detach(tabId);record('cdp-timeout',tabId,'revoked');}
    throw e;
  } finally {clearTimeout(timer);}
}
async function page(tabId,op,args,ctx,mutating=true) {
  await attach(tabId,ctx,mutating);
  let contextId=worlds.get(tabId);
  if(!contextId) {
    const {frameTree}=await raw(tabId,'Page.getFrameTree',{},ctx,mutating);
    const world=await raw(tabId,'Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'tobkiri-tabs-isolated'},ctx,mutating);
    contextId=world.executionContextId;worlds.set(tabId,contextId);
  }
  const result=await raw(tabId,'Runtime.evaluate',{expression:`(${pageOp.toString()})(${JSON.stringify(op)},${JSON.stringify(args||{})})`,contextId,returnByValue:true,awaitPromise:true,timeout:4000},ctx,mutating);
  if(result.exceptionDetails)throw new AppError('PAGE_ERROR',result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
async function tabInfo(tabId) {
  const t=await chrome.tabs.get(Number(tabId));const g=grants[tabId];return {tabId:t.id,workspaceId:g?.workspaceId,title:t.title,url:t.url,active:t.active,groupId:t.groupId,revoked:!!g?.revoked,discarded:t.discarded};
}
async function listTabs(owner,workspaceId) {
  const result=[];for(const [id,g]of Object.entries(grants))if(g.owner===owner&&(!workspaceId||g.workspaceId===workspaceId)){try{result.push(await tabInfo(id));}catch{delete grants[id];}}
  return result;
}
async function newTab(owner,workspaceId,url,ctx) {
  checkpoint(ctx);
  if(!config.allowCreate)throw new AppError('CREATE_NOT_ALLOWED','User must enable new AI tabs in the extension.');
  const w=await getWorkspace(workspaceId,owner);
  if(w.paused)throw new AppError('WORKSPACE_PAUSED','User paused this workspace.');
  const tab=await chrome.tabs.create({windowId:w.windowId,url:'about:blank',active:false});
  // Record grant before navigating. Group ownership is a separate ledger, not inferred from membership.
  grants[tab.id]={owner,workspaceId,revoked:false,restoreAutoDiscardable:true};
  try {
    checkpoint(ctx);
    if(w.groupId!==null){try{await chrome.tabGroups.get(w.groupId);}catch{w.groupId=null;}}
    const grouping=w.groupId===null?{tabIds:[tab.id]}:{tabIds:[tab.id],groupId:w.groupId};
    w.groupId=await chrome.tabs.group(grouping);
    await chrome.tabGroups.update(w.groupId,{title:`🔎 ${w.name}`,color:w.color});
    await chrome.tabs.update(tab.id,{autoDiscardable:false});
    await persist();
    if(url!=='about:blank')await navigate(tab.id,url,ctx,15000);
    return await tabInfo(tab.id);
  } catch(e) {await persist();throw new AppError('PARTIAL_TAB_CREATION',`${e.message} A background tab may remain; inspect browser_tabs before retrying.`);}
}
async function navigate(tabId,url,ctx,timeoutMs=15000) {
  safeUrl(url);await attach(tabId,ctx);
  const nav=await raw(tabId,'Page.navigate',{url},ctx);
  if(nav.errorText)throw new AppError('NAVIGATION_FAILED',nav.errorText);
  worlds.delete(tabId);const until=Date.now()+timeoutMs;
  while(Date.now()<until) {
    await guard(tabId,ctx);
    try {
      const {frameTree}=await raw(tabId,'Page.getFrameTree',{},ctx);
      if(!nav.loaderId || frameTree.frame.loaderId===nav.loaderId) {
        const r=await page(tabId,'ready',{},ctx);
        if(['interactive','complete'].includes(r.readyState))return await tabInfo(tabId);
      }
    } catch(e) {
      if(!/context|navigat|frame|document/i.test(e.message))throw e;worlds.delete(tabId);
    }
    await sleep(100);
  }
  throw new AppError('NAVIGATION_TIMEOUT','Navigation may have happened. Inspect the tab before retrying.');
}
async function point(tabId,a,ctx) {
  if(a.ref||a.selector)return await page(tabId,'point',a,ctx);
  const v=await page(tabId,'viewport',{},ctx);const x=a.x??v.width/2,y=a.y??v.height/2;
  if(x<0||y<0||x>=v.width||y>=v.height)throw new AppError('OUTSIDE_VIEWPORT','Coordinates must be inside the screenshot viewport in CSS pixels.');
  return {x,y};
}
async function click(tabId,p,a,ctx) {
  const button=a.button||'left',buttons={left:1,right:2,middle:4}[button];
  await raw(tabId,'Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'none'},ctx);
  const count=a.clickCount||1;
  for(let n=1;n<=count;n++){
    await raw(tabId,'Input.dispatchMouseEvent',{type:'mousePressed',...p,button,buttons,clickCount:n},ctx);
    try{await raw(tabId,'Input.dispatchMouseEvent',{type:'mouseReleased',...p,button,buttons:0,clickCount:n},ctx);}
    catch(e){await detach(tabId);throw e;}
  }
}
async function press(tabId,key,ctx) {
  const parts=key.split('+');let last=parts.pop();let modifiers=0;
  for(const p of parts){const n={Alt:1,Control:2,Ctrl:2,Meta:4,Cmd:4,Shift:8}[p];if(!n)throw new AppError('BAD_KEY','Unknown modifier.');modifiers|=n;}
  const table={Enter:['Enter',13,'\r'],Tab:['Tab',9,'\t'],Escape:['Escape',27],Backspace:['Backspace',8],Delete:['Delete',46],ArrowLeft:['ArrowLeft',37],ArrowUp:['ArrowUp',38],ArrowRight:['ArrowRight',39],ArrowDown:['ArrowDown',40],Home:['Home',36],End:['End',35],PageUp:['PageUp',33],PageDown:['PageDown',34],Space:['Space',32,' ']};
  const known=table[last];if(!known&&last.length!==1)throw new AppError('BAD_KEY','Unsupported page key.');
  if((modifiers&6) && !['a','c','v','x','z','y'].includes(last.toLowerCase()))throw new AppError('BROWSER_SHORTCUT_BLOCKED','Browser/OS shortcuts are not provided.');
  if((modifiers&6) && ['c','v','x'].includes(last.toLowerCase()))throw new AppError('CLIPBOARD_BLOCKED','Use browser_type, not the system clipboard.');
  const text=modifiers&7?undefined:(known?.[2]??(!known?last:undefined));
  const params={key:last==='Space'?' ':last,code:known?.[0]||( /[a-z]/i.test(last)?`Key${last.toUpperCase()}`:''),windowsVirtualKeyCode:known?.[1]||last.toUpperCase().charCodeAt(0),modifiers};
  if((modifiers&6)&&last.toLowerCase()==='a')params.commands=['selectAll'];
  await raw(tabId,'Input.dispatchKeyEvent',{...params,type:text?'keyDown':'rawKeyDown',...(text?{text,unmodifiedText:text}:{})},ctx);
  try{await raw(tabId,'Input.dispatchKeyEvent',{...params,type:'keyUp'},ctx);}catch(e){await detach(tabId);throw e;}
}
async function dispatch(name,a,ctx) {
  const owner=ctx.owner;
  if(name==='browser_status')return {connected,version:VERSION,enabled:config.enabled,allowCreate:config.allowCreate,protectActive:config.protectActive,sessionId:owner,grantedTabs:(await listTabs(owner)).length,limitations:['Main-world eval and raw CDP are exposed on granted tabs','No OS input/cookie export','Cross-origin iframe DOM and native dialogs are not supported','Page-initiated popups can still interrupt focus']};
  if(name==='browser_workspaces')return {workspaces:Object.entries(workspaces).filter(([,w])=>w.owner===owner).map(([workspaceId,w])=>({workspaceId,...w})),tabs:await listTabs(owner)};
  if(name==='browser_tabs'){if(a.workspaceId)await getWorkspace(a.workspaceId,owner);return {tabs:await listTabs(owner,a.workspaceId)};}
  if(name==='browser_workspace_release'){await getWorkspace(a.workspaceId,owner);await releaseWorkspace(a.workspaceId);return {released:true,tabsClosed:false};}
  if(name==='browser_tab_release'){if(grants[a.tabId]?.owner!==owner)throw new AppError('NOT_GRANTED','Tab not owned.');await releaseTab(a.tabId);return {released:true,tabClosed:false};}
  checkpoint(ctx);
  if(name==='browser_workspace_create') {
    if(!config.allowCreate)throw new AppError('CREATE_NOT_ALLOWED','User must enable new AI tabs.');
    const windows=await chrome.windows.getAll({windowTypes:['normal']});
    const win=windows.find(w=>w.focused&&!w.incognito)||windows.find(w=>!w.incognito);
    if(!win)throw new AppError('NO_WINDOW','Open a normal browser window first.');
    const workspaceId=crypto.randomUUID();workspaces[workspaceId]={owner,name:a.name,color:a.color||'cyan',windowId:win.id,groupId:null,paused:false};
    await persist();return {workspaceId,...await newTab(owner,workspaceId,a.url||'about:blank',ctx)};
  }
  if(name==='browser_workspace_update') {
    const w=await getWorkspace(a.workspaceId,owner);
    if(w.paused)throw new AppError('WORKSPACE_PAUSED','User paused workspace.');
    if(a.name!==undefined)w.name=a.name;if(a.color!==undefined)w.color=a.color;
    const update={title:`🔎 ${w.name}`,color:w.color};if(a.collapsed!==undefined)update.collapsed=a.collapsed;
    if(a.collapsed && config.protectActive && w.groupId!==null){for(const t of await chrome.tabs.query({groupId:w.groupId}))if(t.active)throw new AppError('HUMAN_ACTIVE_TAB','Cannot collapse a group containing the active tab.');}
    if(w.groupId!==null)await chrome.tabGroups.update(w.groupId,update);await persist();return {workspaceId:a.workspaceId,...w};
  }
  if(name==='browser_tab_open')return await newTab(owner,a.workspaceId,a.url,ctx);
  if(name==='browser_tab_navigate')return await navigate(a.tabId,a.url,ctx,a.timeoutMs);
  if(name==='browser_tab_close'){await guard(a.tabId,ctx);await chrome.tabs.remove(a.tabId);await releaseTab(a.tabId);return {closed:true};}
  const readOnly=['browser_snapshot','browser_screenshot','browser_wait'].includes(name);
  await attach(a.tabId,ctx,!readOnly);
  if(name==='browser_snapshot')return await page(a.tabId,'snapshot',a,ctx,false);
  if(name==='browser_click'){await click(a.tabId,await point(a.tabId,a,ctx),a,ctx);return {clicked:true,tabId:a.tabId};}
  if(name==='browser_type'){await page(a.tabId,'focus',{...a,edit:true,replace:a.replace!==false},ctx);await raw(a.tabId,'Input.insertText',{text:a.text},ctx);return {inserted:true,characters:a.text.length};}
  if(name==='browser_press'){if(a.ref||a.selector)await page(a.tabId,'focus',a,ctx);await press(a.tabId,a.key,ctx);return {pressed:true};}
  if(name==='browser_scroll')return await page(a.tabId,'scroll',a,ctx);
  if(name==='browser_drag'){
    const v=await page(a.tabId,'viewport',{},ctx);if(a.points.some(p=>p.x>=v.width||p.y>=v.height))throw new AppError('OUTSIDE_VIEWPORT','Drag path exceeds viewport.');
    const p=a.points[0];await raw(a.tabId,'Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',buttons:1,clickCount:1},ctx);
    try{
      for(const p of a.points.slice(1)){await raw(a.tabId,'Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1},ctx);await sleep((a.durationMs??300)/(a.points.length-1));}
      await raw(a.tabId,'Input.dispatchMouseEvent',{type:'mouseReleased',...a.points.at(-1),button:'left',buttons:0,clickCount:1},ctx);
    }catch(e){await detach(a.tabId);throw e;}return {dragged:true};
  }
  if(name==='browser_screenshot') {
    const format=a.format||'png';const params={format,fromSurface:true,captureBeyondViewport:!!a.fullPage};let clipped=false;
    const v=await page(a.tabId,'viewport',{},ctx,false);let width=v.width,height=v.height;
    if(a.fullPage){const m=await raw(a.tabId,'Page.getLayoutMetrics',{},ctx,false),size=m.cssContentSize||m.contentSize;width=Math.max(1,Math.min(Math.ceil(size.width),8192));height=Math.max(1,Math.min(Math.ceil(size.height),16384,Math.floor(16000000/width)));clipped=width<size.width||height<size.height;params.clip={x:0,y:0,width,height,scale:1};}
    else if(width*height>16000000)throw new AppError('IMAGE_TOO_LARGE','Viewport exceeds the screenshot size limit.');
    if(format==='jpeg')params.quality=85;
    const shot=await raw(a.tabId,'Page.captureScreenshot',params,ctx,false);
    if(shot.data.length>22000000)throw new AppError('IMAGE_TOO_LARGE','Try JPEG or viewport-only.');
    const pixels=imageSize(shot.data,format);
    return {tabId:a.tabId,coordinateSystem:'Actions use CSS VIEWPORT pixels, not raw image pixels. For full-page images, also subtract current viewport scroll offsets.',width,height,imagePixels:pixels,viewport:v,cssPerImagePixel:{x:width/pixels.width,y:height/pixels.height},fullPage:!!a.fullPage,clipped,image:{data:shot.data,mimeType:`image/${format}`}};
  }
  if(name==='browser_wait'){const until=Date.now()+(a.timeoutMs||10000);while(Date.now()<until){const r=await page(a.tabId,'wait',a,ctx,false);if(r.matched)return {matched:true};await sleep(150);}throw new AppError('WAIT_TIMEOUT','Condition not met.');}
  if(name==='browser_select')return await page(a.tabId,'select',a,ctx);
  if(name==='browser_eval'){
    // Main-world evaluation: no contextId targets the page's default execution context.
    const result=await raw(a.tabId,'Runtime.evaluate',{expression:a.expression,returnByValue:true,awaitPromise:a.awaitPromise!==false,userGesture:true,timeout:8000},ctx);
    if(result.exceptionDetails)throw new AppError('PAGE_ERROR',result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    const r=result.result||{};return {type:r.type,subtype:r.subtype,className:r.className,value:r.value,unserializableValue:r.unserializableValue,description:r.description};
  }
  if(name==='browser_cdp')return await raw(a.tabId,a.method,a.params||{},ctx);
  if(name==='browser_check'){const s=await page(a.tabId,'checkState',a,ctx);if(s.type==='radio'&&!a.checked)throw new AppError('RADIO_UNCHECK','Select another radio button instead.');if(s.checked!==a.checked)await click(a.tabId,await page(a.tabId,'point',a,ctx),{},ctx);const after=await page(a.tabId,'checkState',a,ctx);if(after.checked!==a.checked)throw new AppError('CHECK_NOT_APPLIED','The page did not keep the requested state. Inspect the element; do not blindly repeat the click.');return {checked:after.checked,changed:s.checked!==a.checked};}
  throw new AppError('UNKNOWN_TOOL','Not implemented.');
}
async function runCommand(message,cid) {
  const key=message.args?.tabId!==undefined?`tab:${message.args.tabId}`:'structure';
  const ctx={...message,epoch};
  const previous=locks.get(key)||Promise.resolve();
  const job=previous.catch(()=>{}).then(async()=>{
    try {
      validateArgs(message.name,message.args);
      if(!clients.some(c=>c.id===message.owner))throw new AppError('SESSION_EXPIRED','MCP session no longer exists.');
      const result=await dispatch(message.name,message.args,ctx);
      record(message.name,message.args.tabId,'ok');
      await http('/extension/result',{connectionId:cid,id:message.id,result});
    }catch(e){record(message.name,message.args?.tabId,e.code||'error');await http('/extension/result',{connectionId:cid,id:message.id,error:String(e.message).slice(0,1400)}).catch(()=>{});}
    finally{canceled.delete(message.id);}
  });locks.set(key,job);await job;if(locks.get(key)===job)locks.delete(key);
}
chrome.debugger.onDetach.addListener((source,reason)=>{
  attached.delete(source.tabId);worlds.delete(source.tabId);
  if(!intentionalDetach.has(source.tabId) && grants[source.tabId] && reason==='canceled_by_user'){
    grants[source.tabId].revoked=true;record('debugger-detached',source.tabId,'revoked');void persist();
  }
});
chrome.debugger.onEvent.addListener((source,method,params)=>{
  const tabId=source.tabId;
  if(method==='Page.frameNavigated' && !params.frame.parentId)worlds.delete(tabId);
  if(method==='Runtime.executionContextsCleared')worlds.delete(tabId);
  if(method==='Page.javascriptDialogOpening' && attached.has(tabId)){
    record('javascript-dialog',tabId,'dismissed');void chrome.debugger.sendCommand({tabId},'Page.handleJavaScriptDialog',{accept:false}).catch(()=>{});
  }
  if(method==='Page.fileChooserOpened')record('file-chooser',tabId,'blocked');
});
chrome.tabGroups.onRemoved.addListener(group=>{for(const w of Object.values(workspaces))if(w.groupId===group.id)w.groupId=null;void persist();});
chrome.tabs.onRemoved.addListener(tabId=>{delete grants[tabId];attached.delete(tabId);worlds.delete(tabId);void persist();});
chrome.alarms.onAlarm.addListener(()=>void loop());
chrome.runtime.onStartup.addListener(()=>void loop());
chrome.runtime.onInstalled.addListener(()=>void loop());
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id || sender.url?.split('?')[0]!==chrome.runtime.getURL('popup.html')){respond({error:'Only the extension popup may change grants/settings.'});return false;}
  (async()=>{
    await boot;
    if(message.type==='status')return {config:{enabled:config.enabled,allowCreate:config.allowCreate,protectActive:config.protectActive,paired:!!config.token},connected,lastError,clients,workspaces:Object.entries(workspaces).map(([id,w])=>({id,...w})),tabs:await Promise.all(Object.keys(grants).map(id=>tabInfo(id).catch(()=>null))).then(a=>a.filter(Boolean)),audit};
    if(message.type==='pair'){
      const m=/^tbt1\.(\d{4,5})\.([a-f0-9]{64})$/.exec(message.code?.trim()||'');
      if(!m||+m[1]<1024||+m[1]>65535)throw new Error('Invalid pairing code. Run npm run setup.');
      if(loopRunning)throw new Error('Disconnect before changing the pairing code.');
      config={...config,port:+m[1],token:m[2],enabled:true,allowCreate:!!message.allowCreate};
      await chrome.storage.local.set({config});void loop();return {ok:true};
    }
    if(message.type==='settings'){
      for(const k of ['enabled','allowCreate','protectActive'])if(typeof message[k]==='boolean')config[k]=message[k];
      epoch++;if(!config.enabled)await detachAll();await chrome.storage.local.set({config});await badge();return {ok:true};
    }
    if(message.type==='disconnect'){
      config.enabled=false;config.token='';epoch++;await detachAll();for(const id of Object.keys(workspaces))await releaseWorkspace(id);
      await chrome.storage.local.set({config});await badge();return {ok:true};
    }
    if(message.type==='workspace-pause'){
      const w=workspaces[message.workspaceId];if(!w)throw new Error('Workspace missing.');w.paused=!w.paused;epoch++;
      if(w.paused)for(const [id,g]of Object.entries(grants))if(g.workspaceId===message.workspaceId)await detach(Number(id));
      await persist();return {ok:true};
    }
    if(message.type==='workspace-release'){epoch++;await releaseWorkspace(message.workspaceId);return {ok:true};}
    if(message.type==='grant-current'){
      const client=clients.find(c=>c.id===message.owner);if(!client)throw new Error('Start an MCP client first.');
      const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});if(!tab)throw new Error('No active tab.');safeUrl(tab.url);if(tab.incognito)throw new Error('Incognito blocked.');
      if(grants[tab.id])await releaseTab(tab.id);
      const id=crypto.randomUUID();workspaces[id]={owner:client.id,name:'Shared tab',color:'yellow',windowId:tab.windowId,groupId:null,paused:false};grants[tab.id]={owner:client.id,workspaceId:id,revoked:false};
      // Do not move/re-group a user's existing tab without a separate instruction.
      await persist();record('manual-grant',tab.id,'ok');return {ok:true};
    }
    throw new Error('Unknown popup request.');
  })().then(result=>respond({result}),e=>respond({error:e.message}));return true;
});
void loop();
