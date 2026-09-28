import {test,expect,Page} from '@playwright/test';

// A deterministic native bridge: delayed replies remain under each test's control.
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const body=(text:string)=>JSON.stringify({type:'doc',content:[{type:'paragraph',content:text?[{type:'text',text}]:[]}]}),clone=(x:any)=>structuredClone(x);
    const doc=(id:string,parentId:string|null,kind:string,title:string,text='',position=0)=>({id,parentId,kind,title,body:body(text),meta:{},position,revision:0,words:text?2:0,deleted:false});
    const project={id:'review-project',title:'Review A',filePath:'review-a.schreibprojekt',readOnly:false,settings:{collections:[{title:'Szenen',ids:['scene','second']}]},documents:[doc('manuscript',null,'folder','Manuskript'),doc('research',null,'folder','Recherche','',1),doc('chapter','manuscript','folder','Kapitel'),doc('scene','chapter','text','Erste Szene','Text vorher'),doc('second','chapter','text','Zweite Szene','Zweiter Text',1)]};
    const listeners:Function[]=[],state:any={project,calls:[],hold:{},waiting:[],preferences:{checkUpdatesAtStartup:false},snapshots:[],saveNumber:0};
    state.command=(action:string)=>listeners.forEach(l=>l({data:{type:'command',action}}));
    state.release=(action:string,error?:string)=>{const i=state.waiting.findIndex((q:any)=>q.action===action);if(i<0)throw new Error('No pending '+action);const [q]=state.waiting.splice(i,1);error?q.reject(new Error(error)):q.resolve()};
    (window as any).__review=state;
    Object.defineProperty(window,'chrome',{configurable:true,value:{webview:{addEventListener:(_type:string,listener:Function)=>listeners.push(listener),postMessage:async({id,action,args}:any)=>{
      state.calls.push({action,args:clone(args)});
      try{
        const earlyDocument=action==='document'?clone(state.project.documents.find((d:any)=>d.id===args.id)):null;
        if(state.hold[action]&&(!state.holdDocumentId||action!=='document'||args.id===state.holdDocumentId))await new Promise<void>((resolve,reject)=>state.waiting.push({action,args:clone(args),resolve,reject}));
        let result:any=null;
        if(action==='ready')result={project:clone(state.project),tools:{},preferences:clone(state.preferences),updateInfo:{version:'0.1.0-alpha.6',portable:false},recentProjects:[]};
        else if(action==='document'){if(state.failDocumentId===args.id)throw new Error('Dokument nicht lesbar');result=earlyDocument}
        else if(action==='state')result=clone(state.project);
        else if(action==='save'){
          state.saveNumber++;if(state.failSaveNumber===state.saveNumber)throw new Error('Test-Speicherfehler');
          result=args.documents.map((d:any)=>{const saved=state.project.documents.find((x:any)=>x.id===d.id);if(saved.revision!==d.revision)throw new Error('Versionskonflikt');Object.assign(saved,clone(d),{revision:d.revision+1});return clone(saved)});
        }
        else if(['open','new','openRecent','restoreBackup'].includes(action)){if(!state.cancelOpen){state.project=clone(state.nextProject??state.project);result=clone(state.project)}}
        else if(action==='preferences'){if(state.failPreferences){state.failPreferences--;throw new Error('Test-Einstellungsfehler')}state.preferences=clone(args)}
        else if(action==='snapshots')result=state.snapshots.filter((s:any)=>s.documentId===args.id).map(({body,meta,...summary}:any)=>clone(summary));
        else if(action==='getSnapshot'){const s=state.snapshots.find((s:any)=>s.documentId===args.id&&s.id===args.snapshotId);if(!s)throw new Error('Textstand nicht gefunden');result=clone(s)}
        else if(action==='updateCheck')result={version:'0.1.0-alpha.7',notes:'Test',fileName:'test.exe',size:1024};
        else if(action==='updateDownload')result='test.exe';
        else if(action==='proofStatus')result={localAvailable:false,premiumConnected:false};
        for(const l of listeners)l({data:{id,ok:true,result}});
      }catch(e:any){for(const l of listeners)l({data:{id,ok:false,error:e.message}})}
    }}}});
  });
  await page.goto('http://127.0.0.1:4177/index.html');await expect(page.locator('.folder-overview')).toBeVisible();
});
const editor=(page:Page)=>page.locator('.editor-sheet .tiptap');
async function scene(page:Page){await page.locator('#tree [data-doc="scene"]').click();await expect(editor(page)).toContainText('Text vorher')}
async function pending(page:Page,action:string,count=1){await expect.poll(()=>page.evaluate(action=>(window as any).__review.waiting.filter((q:any)=>q.action===action).length,action)).toBe(count)}
async function command(page:Page,action:string){await page.evaluate(action=>(window as any).__review.command(action),action)}
async function release(page:Page,action:string,error?:string){await page.evaluate(({action,error})=>(window as any).__review.release(action,error),{action,error})}
async function calls(page:Page,action:string){return page.evaluate(action=>(window as any).__review.calls.filter((q:any)=>q.action===action).length,action)}

test('review regression F2 drains newer edits for every waiter before terminal close',async({page})=>{
  await scene(page);await page.evaluate(()=>{(window as any).__review.hold.save=true});
  await editor(page).fill('Erster Stand');await page.keyboard.press('Control+s');await pending(page,'save');
  await editor(page).fill('Zweiter Stand');await command(page,'save');await command(page,'close');
  await expect(page.locator('#workspace')).toHaveAttribute('inert','');await release(page,'save');await pending(page,'save');
  expect(await calls(page,'close')).toBe(0);await release(page,'save');await expect.poll(()=>calls(page,'close')).toBe(1);
  expect(await page.evaluate(()=>JSON.parse((window as any).__review.project.documents.find((d:any)=>d.id==='scene').body).content[0].content[0].text)).toBe('Zweiter Stand');
  await command(page,'open');expect(await calls(page,'open')).toBe(0);await expect(page.locator('#workspace')).toHaveAttribute('inert','');
});

test('review regression F2 second-batch failure preserves edits and releases transition for retry',async({page})=>{
  await scene(page);await page.evaluate(()=>{const s=(window as any).__review;s.hold.save=true;s.failSaveNumber=2});
  await editor(page).fill('Erster Stand');await page.keyboard.press('Control+s');await pending(page,'save');
  await editor(page).fill('Zweiter Stand');await command(page,'save');await command(page,'close');await release(page,'save');await pending(page,'save');await release(page,'save');
  await expect(page.locator('#saveState')).toContainText('fehlgeschlagen');await expect(page.locator('#workspace')).not.toHaveAttribute('inert','');expect(await calls(page,'close')).toBe(0);await expect(editor(page)).toContainText('Zweiter Stand');
  await page.evaluate(()=>{const s=(window as any).__review;s.hold.save=false;s.failSaveNumber=0});await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  expect(await page.evaluate(()=>(window as any).__review.project.documents.find((d:any)=>d.id==='scene').body)).toContain('Zweiter Stand');
});

test('review regression F2 delayed canceled open freezes input and rejects duplicate commands',async({page})=>{
  await scene(page);await editor(page).focus();await page.evaluate(()=>{const s=(window as any).__review;s.hold.open=true;s.cancelOpen=true});
  await command(page,'open');await pending(page,'open');await expect(page.locator('#workspace')).toHaveAttribute('inert','');
  await page.keyboard.type('DARF NICHT EINGEFUEGT WERDEN');await command(page,'open');await command(page,'new');expect(await calls(page,'open')).toBe(1);expect(await calls(page,'new')).toBe(0);
  await release(page,'open');await expect(page.locator('#workspace')).not.toHaveAttribute('inert','');await expect(editor(page)).toBeFocused();await expect(editor(page)).toHaveText('Text vorher');
  await editor(page).fill('Weiter schreiben');await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
});

test('review regression F2 update install shares terminal transition',async({page})=>{
  await scene(page);await editor(page).fill('Vor Update');await command(page,'updates');await page.locator('#updateDownload').click();await expect(page.locator('#updateInstall')).toBeVisible();
  await page.evaluate(()=>{(window as any).__review.hold.updateInstall=true});await page.locator('#updateInstall').click();await pending(page,'updateInstall');await expect(page.locator('#workspace')).toHaveAttribute('inert','');
  expect(await page.evaluate(()=>(window as any).__review.project.documents.find((d:any)=>d.id==='scene').body)).toContain('Vor Update');await command(page,'open');expect(await calls(page,'open')).toBe(0);
  await release(page,'updateInstall');await expect(page.locator('#updateStatus')).toContainText('Installer gestartet');await expect(page.locator('#workspace')).toHaveAttribute('inert','');
});

test('review regression F4 outline escapes targets while preserving ordinary values',async({page})=>{
  await page.evaluate(()=>{const s=(window as any).__review;s.nextProject=structuredClone(s.project);s.nextProject.documents.find((d:any)=>d.id==='scene').meta.target='<button data-action="close">Fremder Knopf</button>';s.nextProject.documents.find((d:any)=>d.id==='second').meta.target='123'});
  await command(page,'open');await expect(page.locator('#workspace')).not.toHaveAttribute('inert','');await page.locator('[data-view="outline"]').click();
  await expect(page.locator('[data-outline="scene"] td').last()).toHaveText('<button data-action="close">Fremder Knopf</button>');await expect(page.locator('.outline-table button')).toHaveCount(0);await expect(page.locator('[data-outline="second"] td').last()).toHaveText('123');expect(await calls(page,'close')).toBe(0);
});

test('review regression F6 collection destroys hidden editors and exits on an explicit view',async({page})=>{
  await scene(page);await page.evaluate(()=>{(window as any).__review.oldEditor=(document.querySelector('.editor-sheet .tiptap') as any).editor});
  const before=await page.evaluate(()=>(window as any).__review.project.documents.find((d:any)=>d.id==='scene').body);
  await page.locator('[data-collection="0"]').click();await expect(page.locator('[data-view="board"]')).toHaveClass('active');await expect(page.locator('.board-card')).toHaveCount(2);await expect(page.locator('#formatbar')).toBeHidden();
  expect(await page.evaluate(()=>(window as any).__review.oldEditor.isDestroyed)).toBe(true);await command(page,'insertTable');await command(page,'save');expect(await page.evaluate(()=>(window as any).__review.project.documents.find((d:any)=>d.id==='scene').body)).toBe(before);
  await page.locator('[data-card="scene"]').dblclick();await expect(editor(page)).toContainText('Text vorher');await page.locator('[data-collection="0"]').click();await page.locator('[data-view="write"]').click();await expect(editor(page)).toBeVisible();
  await page.locator('[data-view="relationships"]').click();await page.locator('[data-collection="0"]').click();await expect(page.locator('.board-card')).toHaveCount(2);await expect(page.locator('[data-view="board"]')).toHaveClass('active');
});

test('review regression F7 project adoption invalidates a pending reference even for the same project ID',async({page})=>{
  await scene(page);await page.locator('[data-action="splitView"]').click();await expect(page.locator('#referenceContent')).toContainText('Text vorher');
  await page.evaluate(()=>{const s=(window as any).__review;s.hold.document=true;s.holdDocumentId='second';s.nextProject=structuredClone(s.project);s.nextProject.title='Review B'});
  await page.locator('#referenceSelect').selectOption('second');await pending(page,'document');await command(page,'open');await expect(page.locator('#projectLabel')).toHaveText('Review B');await release(page,'document');
  await expect(page.locator('#referencePane')).toBeHidden();await expect(page.locator('#referenceContent')).toHaveCount(0);await expect(page.locator('#toast')).not.toContainText('geändert');
  await page.evaluate(()=>{const s=(window as any).__review;s.nextProject=structuredClone(s.project);s.nextProject.title='Review A';s.hold.document=false});await command(page,'open');await expect(page.locator('#projectLabel')).toHaveText('Review A');await expect(page.locator('#referencePane')).toBeHidden();
});

test('review regression F7 reference failure leaves the main editor usable',async({page})=>{
  await scene(page);await page.locator('[data-action="splitView"]').click();await page.evaluate(()=>(window as any).__review.failDocumentId='second');await page.locator('#referenceSelect').selectOption('second');
  await expect(page.locator('#toast')).toContainText('Dokument nicht lesbar');await expect(page.locator('#referencePane')).toBeHidden();await expect(editor(page)).toBeVisible();await editor(page).fill('Haupttext bleibt bedienbar');await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
});

test('review regression F9 snapshot list uses summaries and comparison loads only the selected body',async({page})=>{
  await scene(page);await page.evaluate(()=>{const s=(window as any).__review;s.snapshots=[{id:'snapshot-1',documentId:'scene',title:'Vorher',created:'2026-09-28T10:00:00Z',body:JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Alter Text'}]}]}),meta:{}}]});
  await page.locator('[data-inspector="snapshots"]').click();await expect(page.locator('[data-compare="snapshot-1"]')).toBeVisible();expect(await calls(page,'getSnapshot')).toBe(0);await page.locator('[data-compare="snapshot-1"]').click();
  await expect(page.locator('#dialogTitle')).toContainText('Vorher');await expect(page.locator('.diff')).toContainText('Alter');await expect(page.locator('.diff')).toContainText('vorher');expect(await calls(page,'snapshots')).toBe(1);
  expect(await page.evaluate(()=>(window as any).__review.calls.find((q:any)=>q.action==='getSnapshot').args)).toEqual({id:'scene',snapshotId:'snapshot-1'});
});

test('review regression F10 text and notes leave title DOM untouched while rename updates labels',async({page})=>{
  await scene(page);await page.evaluate(()=>{const s=(window as any).__review;s.titleMutations=0;new MutationObserver(records=>s.titleMutations+=records.length).observe(document.querySelector('#tree [data-doc="scene"] .row-label')!,{childList:true,characterData:true,subtree:true})});
  await editor(page).fill('Nur Text geändert');expect(await page.evaluate(()=>(window as any).__review.titleMutations)).toBe(0);await page.locator('[data-inspector="notes"]').click();await page.locator('#metaNotes').fill('Nur Notizen');expect(await page.evaluate(()=>(window as any).__review.titleMutations)).toBe(0);
  await page.locator('#documentTitle').fill('Neuer Titel');await expect(page.locator('#tree [data-doc="scene"] .row-label')).toHaveText('Neuer Titel');await expect(page.locator('#breadcrumb')).toContainText('Neuer Titel');expect(await page.evaluate(()=>(window as any).__review.titleMutations)).toBeGreaterThan(0);
});

test('review regression F13 failed preferences roll back theme and do not leak into later saves',async({page})=>{
  await page.evaluate(()=>(window as any).__review.failPreferences=1);await page.locator('[data-action="theme"]').click();await expect(page.locator('#toast')).toContainText('Test-Einstellungsfehler');await expect(page.locator('body')).not.toHaveClass(/dark/);
  await page.locator('[data-action="settings"]').click();await page.locator('#pandoc').fill('nicht-gespeichert.exe');await page.evaluate(()=>(window as any).__review.failPreferences=1);await page.locator('#dialogSubmit').click();await expect(page.locator('#toast')).toContainText('Test-Einstellungsfehler');
  await page.locator('[data-action="theme"]').click();await expect(page.locator('body')).toHaveClass(/dark/);await expect.poll(()=>page.evaluate(()=>(window as any).__review.preferences.theme)).toBe('dark');expect(await page.evaluate(()=>(window as any).__review.preferences.pandoc)).toBeUndefined();
  await page.locator('[data-action="settings"]').click();await expect(page.locator('#pandoc')).toHaveValue('');
});

test('review regression F13 serializes preference patches against the latest successful state',async({page})=>{
  await page.evaluate(()=>(window as any).__review.hold.preferences=true);await page.locator('[data-action="theme"]').click();await pending(page,'preferences');await page.locator('#inspectorResize').focus();await page.keyboard.press('Home');
  expect(await calls(page,'preferences')).toBe(1);await release(page,'preferences');await pending(page,'preferences');await release(page,'preferences');
  await expect.poll(()=>page.evaluate(()=>(window as any).__review.preferences)).toMatchObject({theme:'dark',inspectorWidth:230,checkUpdatesAtStartup:false});
});

test('review regression F17 clipboard preserves allowed formatting and strips executable HTML',async({page})=>{
  await scene(page);await editor(page).fill('');await editor(page).evaluate(el=>{const data=new DataTransfer();data.setData('text/html','<p><strong>Fetter Text</strong> <a href="https://example.com">Link</a><img src="x" onerror="alert(1)"><script>alert(1)</script><span onclick="alert(1)" style="color:red"> Ende</span></p>');data.setData('text/plain','Fetter Text Link Ende');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}))});
  await expect(editor(page)).toContainText('Fetter Text');await expect(editor(page).locator('strong')).toHaveText('Fetter Text');await expect(editor(page).locator('a')).toHaveAttribute('href','https://example.com');await expect(editor(page).locator('img,script,[onclick],[onerror]')).toHaveCount(0);await page.keyboard.press('Control+s');
  expect(await page.evaluate(()=>(window as any).__review.project.documents.find((d:any)=>d.id==='scene').body)).not.toContain('alert(1)');
});

test('review regression F2 open dialog preserves its draft and rejects native project transitions',async({page})=>{
  await page.locator('[data-action="settings"]').click();await page.locator('#pandoc').fill('Entwurf.exe');
  await command(page,'open');await command(page,'close');await expect(page.locator('#toast')).toContainText('Dialog');
  expect(await calls(page,'open')).toBe(0);expect(await calls(page,'close')).toBe(0);await expect(page.locator('#dialog')).toBeVisible();await expect(page.locator('#pandoc')).toHaveValue('Entwurf.exe');await expect(page.locator('#workspace')).not.toHaveAttribute('inert','');
  await page.locator('#dialog .dialog-actions [value="cancel"]').click();await command(page,'open');await expect.poll(()=>calls(page,'open')).toBe(1);await expect(page.locator('#workspace')).not.toHaveAttribute('inert','');
});

test('review regression F13 three fast theme changes settle to the last confirmed preference after failure',async({page})=>{
  await page.evaluate(()=>{const s=(window as any).__review;s.hold.preferences=true;s.failPreferences=1});
  await page.locator('[data-action="theme"]').click();await pending(page,'preferences');await page.locator('[data-action="theme"]').click();await page.locator('[data-action="theme"]').click();
  await release(page,'preferences');await pending(page,'preferences');await release(page,'preferences');await pending(page,'preferences');await release(page,'preferences');
  await expect.poll(()=>page.evaluate(()=>(window as any).__review.preferences.theme)).toBe('dark');await expect(page.locator('body')).toHaveClass(/dark/);
  expect(await page.evaluate(()=>(window as any).__review.calls.filter((q:any)=>q.action==='preferences').map((q:any)=>q.args.theme))).toEqual(['dark','light','dark']);
});
