import {chromium, expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {chmod, mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID, createHash} from 'node:crypto';
import path from 'node:path';

const root=process.cwd(), directory=path.join(root,'.work','review-native',randomUUID());
const application=path.resolve(process.argv[2]??'artifacts/review/app/Schreibatelier.exe');
const checks=path.join(root,'tests','Schreibatelier.Checks','bin','Release','net10.0','Schreibatelier.Checks.exe');
const portable=await access(path.join(path.dirname(application),'portable.txt')).then(()=>true,()=>false);
if(portable)throw new Error('Native review requires a nonportable build so test data stays isolated.');
await mkdir(directory,{recursive:true});
await mkdir(path.join(root,'artifacts'),{recursive:true});
await writeFile(path.join(root,'artifacts/review-native.json'),JSON.stringify({ok:false,status:'started',application,directory,checks:[]},null,2));
function watch(child) {
  let exited=false,error;
  const ended=new Promise(resolve=>{child.once('exit',()=>{exited=true;resolve()});child.once('error',e=>{error=e;exited=true;resolve()})});
  return {get exited(){return exited},get error(){return error},ended};
}
async function stop(child,status) {
  if(!status.exited)child.kill();
  await Promise.race([status.ended,delay(5000)]);
  if(!status.exited)throw new Error('Test process did not stop: '+child.pid);
}
async function command(args) {
  const child=spawn(checks,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
  await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(output)))});
}
await command(['--native-review-fixtures',directory]);
const fixture=JSON.parse(await readFile(path.join(directory,'fixtures.json'),'utf8'));
const prefsFile=path.join(fixture.data,'preferences.json'), results=[];
async function bridge(page,action,args={}) {
  return page.evaluate(({action,args})=>new Promise((resolve,reject)=>{
    const id='review-'+crypto.randomUUID(),api=window.chrome.webview;
    const cleanup=()=>{clearTimeout(timer);api.removeEventListener('message',receive)};
    const receive=event=>{if(event.data.id!==id)return;cleanup();event.data.ok?resolve(event.data.result):reject(new Error(event.data.error))};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Bridge timeout: '+action))},15000);
    api.addEventListener('message',receive);api.postMessage({id,action,args});
  }),{action,args});
}
async function run(label,inspect) {
  const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const child=spawn(application,['--integration-test','--integration-inspect',fixture.a],{cwd:directory,windowsHide:true,stdio:'ignore',env:{...process.env,DOTNET_GCHeapHardLimit:'10000000',WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}});
  const status=watch(child);let browser,page;
  try {
    for(let i=0;i<120&&!browser;i++){if(status.exited)throw status.error??new Error('Application exited before initialization');try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:500})}catch{await delay(100)}}
    if(!browser)throw new Error('WebView2 debugging connection unavailable');
    for(let i=0;i<120&&!page;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('https://app.schreibatelier.local/'));if(!page)await delay(100)}
    if(!page)throw new Error('App page unavailable');
    await expect(page.locator('#workspace')).toBeVisible();
    await inspect(page);
    await bridge(page,'close').catch(error=>{if(!page.isClosed())throw error});
    for(let i=0;i<100&&!status.exited;i++)await delay(100);
    if(!status.exited)throw new Error('Application did not close');
    results.push(label);console.log('PASS '+label);
  } finally {
    if(browser)await browser.close().catch(()=>{});
    await stop(child,status);
  }
}

for(const [invalid,expected] of [
  ['null',{}],['[]',{}],['42',{}],['{broken',{}],
  ['{"pandoc":42,"typst":false,"theme":{},"inspectorWidth":"wide","checkUpdatesAtStartup":1,"future":{"keep":true}}',{future:{keep:true}}],
  ['{"theme":"dark","theme":"light","future":{"keep":true}}',{}],
  ['{"theme":"dark","future":{"keep":true,"keep":false}}',{}],
  ['{"pandoc":"\\ud800","typst":"\\udc00","theme":"dark","inspectorWidth":320,"checkUpdatesAtStartup":false,"future":{"keep":"\\ud83d\\ude00"}}',{theme:'dark',inspectorWidth:320,checkUpdatesAtStartup:false,future:{keep:'😀'}}],
  ['{"theme":"\\ud800","pandoc":"","typst":"","future":{"keep":true}}',{pandoc:'',typst:'',future:{keep:true}}],
]) {
  await writeFile(prefsFile,invalid);
  await run('Startup tolerates preferences '+invalid,async page=>{
    expect((await bridge(page,'state')).filePath).toBe(fixture.a);
    const ready=await bridge(page,'ready');expect(ready.preferences).toEqual(expected);
    expect(await readFile(prefsFile,'utf8')).toBe(invalid);
  });
}

await writeFile(prefsFile,'{}');
let finalBody;
await run('Failed project switch preserves the active store; settings commit atomically',async page=>{
  const bytes=await readFile(fixture.b),hash=createHash('sha256').update(bytes).digest('hex');
  for(const file of [fixture.b,fixture.c]) {
    await expect(bridge(page,'openRecent',{path:file})).rejects.toThrow();
    expect((await bridge(page,'state')).filePath).toBe(fixture.a);
    await command(['--native-review-lease',file]);
    const document=await bridge(page,'document',{id:fixture.document});
    document.body=JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Still saved in A after '+path.basename(file)}]}]});
    finalBody=(await bridge(page,'save',{documents:[document]}))[0].body;
  }
  expect(createHash('sha256').update(await readFile(fixture.b)).digest('hex')).toBe(hash);
  await chmod(fixture.c,0o444);
  try {
    const readonly=await bridge(page,'openRecent',{path:fixture.c});expect(readonly.readOnly).toBe(true);
    await expect(bridge(page,'create',{parent:'manuscript',title:'Must not save',kind:'text'})).rejects.toThrow();
    expect((await bridge(page,'openRecent',{path:fixture.a})).filePath).toBe(fixture.a);
  } finally { await chmod(fixture.c,0o666); }

  const preferences={theme:'dark',inspectorWidth:320,checkUpdatesAtStartup:false,future:{keep:true},pandoc:'',typst:''};
  await bridge(page,'preferences',preferences);
  expect(JSON.parse(await readFile(prefsFile,'utf8'))).toEqual(preferences);
  const savedTools=(await bridge(page,'ready')).tools;
  for(const invalid of [{pandoc:17},{pandoc:'\ud800'},{typst:'\udc00'},{theme:'\ud800'}]) {
    await expect(bridge(page,'preferences',{...preferences,...invalid})).rejects.toThrow();
    const ready=await bridge(page,'ready');expect(ready.preferences).toEqual(preferences);expect(ready.tools).toEqual(savedTools);
    expect(JSON.parse(await readFile(prefsFile,'utf8'))).toEqual(preferences);
  }
  const readyFile=path.join(directory,'preferences-lock.ready');
  const holder=spawn(checks,['--native-review-lock-file',prefsFile,readyFile],{cwd:root,windowsHide:true,stdio:['pipe','ignore','pipe']});
  const holderStatus=watch(holder);let holderError='';holder.stderr.on('data',data=>holderError+=data);
  try {
    let ready=false;for(let i=0;i<100&&!ready;i++){if(holderStatus.exited)throw holderStatus.error??new Error(holderError);try{await access(readyFile);ready=true}catch{await delay(50)}}
    if(!ready)throw new Error('Preference lock helper did not initialize');
    await expect(bridge(page,'preferences',{...preferences,theme:'light',pandoc:'missing-converter.exe'})).rejects.toThrow();
    const current=await bridge(page,'ready');expect(current.preferences).toEqual(preferences);
    expect(current.tools.pandoc).not.toBe('missing-converter.exe');
    expect(JSON.parse(await readFile(prefsFile,'utf8'))).toEqual(preferences);
  } finally {
    if(!holderStatus.exited)holder.stdin.end('\n');
    await Promise.race([holderStatus.ended,delay(5000)]);await stop(holder,holderStatus);
  }
});
await run('Project and valid preferences survive complete native restart',async page=>{
  expect((await bridge(page,'document',{id:fixture.document})).body).toBe(finalBody);
  expect((await bridge(page,'ready')).preferences.future).toEqual({keep:true});
  await expect(page.locator('body')).toHaveClass(/dark/);
});
await mkdir(path.join(root,'artifacts'),{recursive:true});
await writeFile(path.join(root,'artifacts','review-native.json'),JSON.stringify({ok:true,application,directory,checks:results},null,2));
