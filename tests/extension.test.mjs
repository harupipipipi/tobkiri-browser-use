/** Production background.mjs against a MOCK Chrome API and the REAL HTTP bridge.
 * These tests cover authorization/dispatch behavior, not MV3 or actual debugger attachment.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {startBridge} from '../src/bridge.mjs';
import {request} from '../src/config.mjs';
const event=()=>{const listeners=[];return {listeners,addListener:fn=>listeners.push(fn),emit:(...args)=>listeners.forEach(fn=>fn(...args))};};
function fakeChrome(config) {
 const tabs=new Map([[1,{id:1,windowId:1,url:'https://human.example/',title:'PRIVATE HUMAN TAB',active:true,incognito:false,groupId:-1,autoDiscardable:true}]]),groups=new Map(),debuggers=new Set(),cdpCalls=[],activationCalls=[];
 const flags={dropInput:false,domFails:false,navFails:false};
 let nextTab=2,nextGroup=1;
 const store=initial=>{const values=structuredClone(initial);return {async setAccessLevel(){},async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>k in values).map(k=>[k,structuredClone(values[k])]));},async set(v){Object.assign(values,structuredClone(v));}};};
 const chrome={
  storage:{local:store({config:{...config,enabled:true,allowCreate:false,protectActive:true}}),session:store({})},
  runtime:{id:'a'.repeat(32),getURL:path=>`chrome-extension://${'a'.repeat(32)}/${path}`,onMessage:event(),onStartup:event(),onInstalled:event()},
  alarms:{async create(){},onAlarm:event()},
  action:{async setBadgeText(){},async setBadgeBackgroundColor(){}},
  windows:{async getAll(){return [{id:1,focused:true,incognito:false}];}},
  tabs:{onRemoved:event(),
   async get(id){if(!tabs.has(Number(id)))throw new Error('No such tab');return {...tabs.get(Number(id))};},
   async query(q){return [...tabs.values()].filter(t=>(q.active===undefined||t.active===q.active)&&(q.groupId===undefined||t.groupId===q.groupId)).map(t=>({...t}));},
   async create(p){assert.equal(p.active,false,'Production code must explicitly create inactive tabs');if(p.active)activationCalls.push(p);const t={id:nextTab++,windowId:p.windowId,url:p.url,title:'AI tab',active:false,incognito:false,groupId:-1,autoDiscardable:true};tabs.set(t.id,t);return {...t};},
   async update(id,p){if(p.active)activationCalls.push(p);const t=tabs.get(id);if(!t)throw new Error('Missing tab');Object.assign(t,p);return {...t};},
   async group(p){const id=p.groupId??nextGroup++;if(!groups.has(id))groups.set(id,{id,title:'',color:'grey',collapsed:false});for(const tid of p.tabIds)tabs.get(tid).groupId=id;return id;},
   async remove(id){const t=tabs.get(id);tabs.delete(id);chrome.tabs.onRemoved.emit(id);if(t?.groupId>=0&&![...tabs.values()].some(x=>x.groupId===t.groupId)){const g=groups.get(t.groupId);groups.delete(t.groupId);chrome.tabGroups.onRemoved.emit(g);}}
  },
  tabGroups:{onRemoved:event(),async get(id){if(!groups.has(id))throw new Error('No group');return {...groups.get(id)};},async update(id,p){if(!groups.has(id))throw new Error('No group');Object.assign(groups.get(id),p);return {...groups.get(id)};}},
  debugger:{onDetach:event(),onEvent:event(),
   async getTargets(){return [...debuggers].map(tabId=>({tabId,attached:true}));},
   async attach({tabId}){if(debuggers.has(tabId))throw new Error('Already attached');debuggers.add(tabId);},
   async detach({tabId}){debuggers.delete(tabId);chrome.debugger.onDetach.emit({tabId},'canceled_by_user');},
   async sendCommand({tabId},method,p={}){
    cdpCalls.push({tabId,method,params:p});
    if(method==='Page.getFrameTree')return {frameTree:{frame:{id:`frame-${tabId}`,loaderId:'mock-loader'}}};
    if(method==='Page.createIsolatedWorld')return {executionContextId:1};
    if(method==='Page.navigate'){if(flags.navFails)return {errorText:'net::ERR_FAILED'};tabs.get(tabId).url=p.url;chrome.debugger.onEvent.emit({tabId},'Page.frameNavigated',{frame:{id:`frame-${tabId}`}});return {frameId:`frame-${tabId}`,loaderId:'mock-loader'};}
    if(method==='Runtime.evaluate'){
     const x=p.expression;let value={};
     if(x.includes(')("ready",'))value={readyState:'complete',url:tabs.get(tabId).url};
     else if(x.includes(')("snapshot",'))value={text:'mock document',elements:[]};
     else if(x.includes(')("point",'))value={x:50,y:60};
     else if(x.includes(')("viewport",'))value={width:1200,height:800};
     else if(x.includes(')("wait",'))value={matched:false};
     else if(x.includes(')("scroll",'))value={method:'dom-scroll',before:{x:0,y:0},after:{x:0,y:100}};
     else if(x.includes(')("armInput",'))value={armed:true};
     else if(x.includes(')("inputProbe",'))value={seen:flags.dropInput?{}:{pointerdown:1,mousedown:1,mouseup:1,click:1,keydown:1,keypress:1,keyup:1,beforeinput:1,input:1}};
     else if(x.includes(')("domClick",'))value={applied:!flags.domFails,tag:'button'};
     else if(x.includes(')("domType",')){if(flags.domFails)return {exceptionDetails:{text:'NOT_EDITABLE: Target is not editable.'}};value={applied:true};}
     else if(x.includes(')("domKey",'))value={applied:!flags.domFails,inserted:!flags.domFails};
     return {result:{type:'object',value}};
    }
    return {};
   }
  }
 };
 return {chrome,tabs,groups,debuggers,cdpCalls,activationCalls,flags};
}
test('extension permission and dispatch integration (MOCK native Chrome APIs)',async t=>{
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const c={port,token:randomBytes(32).toString('hex')},bridge=await startBridge(c);
 const owner=(await request(c,'/session/register',{name:'agent-one'})).sessionId;
 const second=(await request(c,'/session/register',{name:'agent-two'})).sessionId;
 const fake=fakeChrome(c);globalThis.chrome=fake.chrome;
 await import('../extension/background.mjs');
 const ui=message=>new Promise((resolve,reject)=>chrome.runtime.onMessage.listeners[0](message,{id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')},r=>r.error?reject(new Error(r.error)):resolve(r.result)));
 t.after(async()=>{await ui({type:'disconnect'});await bridge.stop();});
 for(let i=0;i<100;i++){if((await request(c,'/status')).connected)break;await new Promise(r=>setTimeout(r,10));}
 const tool=async(name,args={},sessionId=owner)=>(await request(c,'/rpc',{sessionId,name,args})).result;
 let w;
 await t.test('initial creation requires explicit user enablement',async()=>{await assert.rejects(tool('browser_workspace_create',{name:'task'}),/CREATE_NOT_ALLOWED/);assert.equal(fake.tabs.size,1);await ui({type:'settings',allowCreate:true});});
 await t.test('create grants only a background tab and creates colored group',async()=>{w=await tool('browser_workspace_create',{name:'PR1322',color:'cyan'});assert.equal(w.active,false);assert.equal(fake.groups.get(w.groupId).title,'🔎 PR1322');assert.equal(fake.activationCalls.length,0);assert.equal(fake.tabs.get(w.tabId).autoDiscardable,false);});
 await t.test('list never exposes unshared human tabs or another MCP session',async()=>{assert.deepEqual((await tool('browser_tabs')).tabs.map(t=>t.tabId),[w.tabId]);assert.deepEqual((await tool('browser_tabs',{},second)).tabs,[]);assert.ok(!JSON.stringify(await tool('browser_workspaces')).includes('PRIVATE HUMAN TAB'));});
 await t.test('ungranted and cross-session read/write attempts are rejected',async()=>{await assert.rejects(tool('browser_snapshot',{tabId:1}),/NOT_GRANTED/);await assert.rejects(tool('browser_click',{tabId:w.tabId,selector:'button'},second),/NOT_GRANTED/);});
 await t.test('navigation uses target CDP, never an active-tab switch',async()=>{await tool('browser_tab_navigate',{tabId:w.tabId,url:'https://example.org/'});assert.equal(fake.tabs.get(w.tabId).url,'https://example.org/');assert.ok(fake.cdpCalls.some(c=>c.method==='Page.navigate'));assert.equal(fake.activationCalls.length,0);});
 await t.test('human takeover rejects mutations while reads still work',async()=>{fake.tabs.get(w.tabId).active=true;await assert.rejects(tool('browser_click',{tabId:w.tabId,selector:'button'}),/HUMAN_ACTIVE_TAB/);assert.equal((await tool('browser_snapshot',{tabId:w.tabId})).text,'mock document');fake.tabs.get(w.tabId).active=false;});
 await t.test('global pause and workspace pause are not remotely bypassable',async()=>{await ui({type:'settings',enabled:false});await assert.rejects(tool('browser_click',{tabId:w.tabId,selector:'button'}),/PAUSED/);await ui({type:'settings',enabled:true});await ui({type:'workspace-pause',workspaceId:w.workspaceId});await assert.rejects(tool('browser_click',{tabId:w.tabId,selector:'button'}),/WORKSPACE_PAUSED/);await ui({type:'workspace-pause',workspaceId:w.workspaceId});});
 await t.test('click and type dispatch CDP input; no clipboard or focus commands',async()=>{await tool('browser_click',{tabId:w.tabId,selector:'button'});await tool('browser_type',{tabId:w.tabId,selector:'input',text:'test input'});assert.ok(fake.cdpCalls.some(c=>c.method==='Input.insertText'));assert.ok(!fake.cdpCalls.some(c=>c.method==='Page.bringToFront'));await assert.rejects(tool('browser_press',{tabId:w.tabId,key:'Control+V'}),/CLIPBOARD_BLOCKED/);await assert.rejects(tool('browser_press',{tabId:w.tabId,key:'Control+L'}),/BROWSER_SHORTCUT_BLOCKED/);});
 await t.test('scroll uses DOM, not hidden-tab mouseWheel commands',async()=>{const r=await tool('browser_scroll',{tabId:w.tabId,deltaY:100});assert.equal(r.method,'dom-scroll');assert.ok(!fake.cdpCalls.some(c=>c.params.type==='mouseWheel'));});
 await t.test('eval evaluates in the MAIN world (no isolated contextId)',async()=>{const r=await tool('browser_eval',{tabId:w.tabId,expression:'window.answer=42'});assert.equal(r.type,'object');const call=fake.cdpCalls.filter(c=>c.method==='Runtime.evaluate').at(-1);assert.equal(call.params.expression,'window.answer=42');assert.equal(call.params.contextId,undefined,'main-world eval must not pass an isolated-world contextId');assert.equal(call.params.returnByValue,true);});
 await t.test('cdp passes method and params through to the granted tab',async()=>{await tool('browser_cdp',{tabId:w.tabId,method:'Page.captureScreenshot',params:{format:'jpeg'}});assert.ok(fake.cdpCalls.some(c=>c.method==='Page.captureScreenshot'&&c.params.format==='jpeg'));});
 await t.test('eval and cdp enforce grants, pause and active-tab protection',async()=>{await assert.rejects(tool('browser_eval',{tabId:1,expression:'1'}),/NOT_GRANTED/);await assert.rejects(tool('browser_cdp',{tabId:1,method:'Page.reload'}),/NOT_GRANTED/);await assert.rejects(tool('browser_eval',{tabId:w.tabId,expression:'1'},second),/NOT_GRANTED/);fake.tabs.get(w.tabId).active=true;await assert.rejects(tool('browser_eval',{tabId:w.tabId,expression:'1'}),/HUMAN_ACTIVE_TAB/);await assert.rejects(tool('browser_cdp',{tabId:w.tabId,method:'Page.reload'}),/HUMAN_ACTIVE_TAB/);fake.tabs.get(w.tabId).active=false;});
 await t.test('undelivered trusted input falls back to DOM ops, keeps the grant, and stays honest',async()=>{
  fake.flags.dropInput=true;
  try{
    const c=await tool('browser_click',{tabId:w.tabId,selector:'button'});assert.equal(c.clicked,true);assert.equal(c.trusted,false);
    const ty=await tool('browser_type',{tabId:w.tabId,selector:'input',text:'x'});assert.equal(ty.inserted,true);assert.equal(ty.trusted,false);
    const p=await tool('browser_press',{tabId:w.tabId,key:'Enter'});assert.equal(p.pressed,true);assert.equal(p.trusted,false);
    await assert.rejects(tool('browser_drag',{tabId:w.tabId,points:[{x:1,y:1},{x:20,y:20}]}),/INPUT_NOT_APPLIED/,'drag has no DOM fallback');
    assert.ok((await tool('browser_tabs')).tabs.some(t=>t.tabId===w.tabId&&!t.revoked),'grant must survive undelivered input');
    fake.flags.domFails=true;
    await assert.rejects(tool('browser_click',{tabId:w.tabId,selector:'button'}),/INPUT_NOT_APPLIED/,'failed DOM click must not claim success');
    await assert.rejects(tool('browser_type',{tabId:w.tabId,selector:'input',text:'x'}),/NOT_EDITABLE/,'page-op failure surfaces truthfully');
    assert.ok((await tool('browser_tabs')).tabs.some(t=>t.tabId===w.tabId&&!t.revoked),'grant survives failed DOM fallback');
  }finally{fake.flags.dropInput=false;fake.flags.domFails=false;}
 });
 await t.test('group collapse also protects ungranted human tabs manually added to group',async()=>{fake.tabs.get(1).groupId=w.groupId;await assert.rejects(tool('browser_workspace_update',{workspaceId:w.workspaceId,collapsed:true}),/HUMAN_ACTIVE_TAB/);fake.tabs.get(1).groupId=-1;await tool('browser_workspace_update',{workspaceId:w.workspaceId,name:'Renamed',color:'yellow'});assert.equal(fake.groups.get(w.groupId).title,'🔎 Renamed');});
 await t.test('content pages cannot impersonate popup permission changes',async()=>{const result=await new Promise(resolve=>chrome.runtime.onMessage.listeners[0]({type:'settings',protectActive:false},{id:chrome.runtime.id,url:'https://evil.example/'},resolve));assert.ok(result.error);assert.equal((await tool('browser_status')).protectActive,true);});
 await t.test('a canceled queued wait stops after user pauses',async()=>{const p=tool('browser_wait',{tabId:w.tabId,text:'never appears',timeoutMs:3000}).catch(e=>e);await new Promise(r=>setTimeout(r,50));await ui({type:'settings',enabled:false});assert.match((await p).message,/PAUSED|CANCELED/);await ui({type:'settings',enabled:true});});
 await t.test('returning tab revokes access and restores auto-discard without closing',async()=>{await tool('browser_workspace_release',{workspaceId:w.workspaceId});assert.deepEqual((await tool('browser_tabs')).tabs,[]);assert.ok(fake.tabs.has(w.tabId));assert.equal(fake.tabs.get(w.tabId).autoDiscardable,true);assert.equal(fake.debuggers.size,0);});
 await t.test('close last owned tab then reopen workspace recreates its deleted group',async()=>{const x=await tool('browser_workspace_create',{name:'reopen'});await tool('browser_tab_close',{tabId:x.tabId});const y=await tool('browser_tab_open',{workspaceId:x.workspaceId,url:'about:blank'});assert.notEqual(y.groupId,x.groupId);assert.ok(fake.groups.has(y.groupId));});
 await t.test('native debugger cancellation revokes grant, never silently reattaches',async()=>{const x=await tool('browser_workspace_create',{name:'cancel'});await tool('browser_snapshot',{tabId:x.tabId});fake.debuggers.delete(x.tabId);chrome.debugger.onDetach.emit({tabId:x.tabId},'canceled_by_user');await assert.rejects(tool('browser_snapshot',{tabId:x.tabId}),/NOT_GRANTED/);assert.ok(!fake.debuggers.has(x.tabId));});
 await t.test('session end releases its grants but leaves tabs open',async()=>{const x=await tool('browser_workspace_create',{name:'second agent'},second);await request(c,'/session/release',{sessionId:second});for(let i=0;i<50;i++){if(!(await ui({type:'status'})).tabs.some(t=>t.tabId===x.tabId))break;await new Promise(r=>setTimeout(r,10));}assert.ok(fake.tabs.has(x.tabId));assert.ok(!(await ui({type:'status'})).tabs.some(t=>t.tabId===x.tabId));});
 await t.test('a failed first navigation returns the granted tab with a warning, not PARTIAL_TAB_CREATION',async()=>{
  const w2=await tool('browser_workspace_create',{name:'navwarn'});
  fake.flags.navFails=true;
  try{
    const t2=await tool('browser_tab_open',{workspaceId:w2.workspaceId,url:'https://example.com/'});
    assert.ok(t2.tabId);assert.match(t2.warning,/Initial navigation failed/);
    assert.ok((await tool('browser_tabs')).tabs.some(t=>t.tabId===t2.tabId&&!t.revoked),'created tab stays granted and listed');
  }finally{fake.flags.navFails=false;}
 });
 await t.test('revoked grants can be explicitly re-granted or closed, never orphaned',async()=>{
  const x=await tool('browser_workspace_create',{name:'regrant'});
  await tool('browser_snapshot',{tabId:x.tabId});
  fake.debuggers.delete(x.tabId);chrome.debugger.onDetach.emit({tabId:x.tabId},'canceled_by_user');
  await assert.rejects(tool('browser_snapshot',{tabId:x.tabId}),/NOT_GRANTED/);
  const other=(await request(c,'/session/register',{name:'agent-three'})).sessionId;
  await assert.rejects(tool('browser_tab_regrant',{tabId:x.tabId},other),/NOT_GRANTED/,'cross-session re-grant must be rejected');
  const r=await tool('browser_tab_regrant',{tabId:x.tabId});
  assert.equal(r.revoked,false);
  await tool('browser_snapshot',{tabId:x.tabId});
  fake.debuggers.delete(x.tabId);chrome.debugger.onDetach.emit({tabId:x.tabId},'canceled_by_user');
  await assert.rejects(tool('browser_snapshot',{tabId:x.tabId}),/NOT_GRANTED/);
  const cl=await tool('browser_tab_close',{tabId:x.tabId});
  assert.equal(cl.closed,true);assert.equal(cl.wasRevoked,true);assert.ok(!fake.tabs.has(x.tabId));
  await assert.rejects(tool('browser_tab_close',{tabId:1}),/NOT_GRANTED/,'ungranted human tab is still unclosable');
 });
});
