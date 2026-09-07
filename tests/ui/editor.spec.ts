import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const body=(text:string)=>JSON.stringify({type:'doc',content:[{type:'paragraph',content:text?[{type:'text',text}]:[]}]});
    const docs:any[]=[{id:'manuscript',title:'Manuskript',parentId:null,position:0,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'research',title:'Recherche',parentId:null,position:1,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'chapter',title:'Kapitel 1 · Ankunft',parentId:'manuscript',position:0,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'scene',title:'Das Haus am See',parentId:'chapter',position:0,kind:'text',body:body('Der Morgen lag still über dem See. Mara blieb am Gartentor stehen. In ihrer Manteltasche lag der Schlüssel.'),meta:{synopsis:'Mara kehrt an den Ort ihrer Kindheit zurück. Ein alter Schlüssel führt sie zu einer offenen Frage.',status:'Entwurf',tags:'Mara, Heimkehr',color:'#b77d4e'},revision:0,words:21},{id:'scene2',title:'Ein unerwarteter Brief',parentId:'chapter',position:1,kind:'text',body:body('Auf dem Küchentisch lag ein Umschlag.'),meta:{synopsis:'Ein Brief verändert alles.',status:'Idee'},revision:0,words:6}];
    const project:any={id:'test',title:'Ein neuer Morgen',settings:{wordTarget:80000},documents:docs,readOnly:false,filePath:'test.schreibprojekt'};
    const persisted=JSON.parse(sessionStorage.getItem('testSavedProject')??'null');
    if(persisted){docs.splice(0,docs.length,...persisted.documents);Object.assign(project,persisted,{documents:docs})}
    const listeners:Function[]=[];const snapshots:any[]=[];const clone=(x:any)=>JSON.parse(JSON.stringify(x));
    (window as any).__test={project,docs,failSave:false,saveDelay:0,snapshots,proofDelay:0,proofCalls:[],proofTraffic:[],premiumConnected:false,listeners};
    Object.defineProperty(window,'chrome',{configurable:true,value:{webview:{addEventListener:(_type:string,listener:Function)=>listeners.push(listener),postMessage:async({id,action,args}:any)=>{
      try{
        if(action.startsWith('proof'))(window as any).__test.proofTraffic.push(action);
        let result:any=null;
        if(action==='ready')result={project:sessionStorage.getItem('testWelcome')?null:clone(project),recentProjects:JSON.parse(sessionStorage.getItem('testRecentProjects')??'[]'),tools:{},preferences:{checkUpdatesAtStartup:false,...JSON.parse(sessionStorage.getItem('testPreferences')??'{}')},updateInfo:{version:'0.1.0-alpha.2',portable:!!sessionStorage.getItem('testPortable')}};
        else if(action==='preferences')sessionStorage.setItem('testPreferences',JSON.stringify(args));
        else if(action==='updateCheck'){if((window as any).__test.updateError)throw new Error('GitHub ist gerade nicht erreichbar.');result=(window as any).__test.updateRelease??null}
        else if(action==='updateDownload'){
          if((window as any).__test.waitForUpdate)await new Promise<void>(resolve=>{(window as any).__test.cancelUpdate=resolve});
          if((window as any).__test.cancelledUpdate)throw new Error('Update-Vorgang abgebrochen.');
          if((window as any).__test.downloadError)throw new Error('SHA-256-Prüfung fehlgeschlagen.');
          for(const l of listeners)l({data:{type:'updateProgress',percent:100}});result='test.zip';
        }
        else if(action==='updateCancel'){(window as any).__test.cancelledUpdate=true;(window as any).__test.cancelUpdate?.()}
        else if(action==='updateInstall'){(window as any).__test.installedUpdate=true}
        else if(action==='updateShowFile'){(window as any).__test.openedUpdateFolder=true}
        else if(action==='licenses')result='Schreibatelier – Test-Lizenztext';
        else if(action==='proofStatus')result={localAvailable:true,premiumConnected:(window as any).__test.premiumConnected};
        else if(action==='proofCodexStatus')result={connected:true,email:'test@example.invalid',plan:'plus',models:[{id:'test-model',name:'Testmodell'}]};
        else if(action==='proofPremiumConnect'){(window as any).__test.premiumConnected=true;result=true}
        else if(action==='proofPremiumDisconnect'){(window as any).__test.premiumConnected=false;result=true}
        else if(action==='proofCheck'){
          (window as any).__test.proofCalls.push(clone(args));await new Promise(r=>setTimeout(r,(window as any).__test.proofDelay));
          result={issues:args.blocks.flatMap((b:any)=>[['Feler','Fehler'],['Gramatik','Grammatik'],['Mara','Maria']].flatMap(([original,replacement])=>{const offset=b.text.indexOf(original);return offset<0?[]:[{block:b.id,offset,length:original.length,original,replacements:[replacement],message:'Bitte Schreibweise prüfen.',category:'spelling',rule:'TEST'}]}))};
        }
        else if(action==='state')result=clone(project);
        else if(action==='open')result=clone(project);
        else if(action==='openRecent'){if((window as any).__test.recentError)throw new Error('Das Projekt wurde verschoben oder gelöscht.');(window as any).__test.openedRecent=args.path;result=clone(project);result.filePath=args.path}
        else if(action==='document')result=clone(docs.find(d=>d.id===args.id));
        else if(action==='save'||action==='replace'){await new Promise(r=>setTimeout(r,(window as any).__test.saveDelay));if((window as any).__test.failSave)throw new Error('Datenträger ist schreibgeschützt.');result=args.documents.map((d:any)=>{const old=docs.find(x=>x.id===d.id);if(old.revision!==d.revision)throw new Error('Versionskonflikt');if(action==='replace')snapshots.push({...clone(old),documentId:old.id,title:'Vor Suchen und Ersetzen'});Object.assign(old,clone(d),{revision:d.revision+1});return clone(old)})}
        else if(action==='create'){const d={id:crypto.randomUUID(),parentId:args.parent,title:args.title,kind:args.kind,body:args.body??body(''),meta:args.meta??{},position:docs.filter(x=>x.parentId===args.parent).length,revision:0,words:0};docs.push(d);result=clone(d)}
        else if(action==='snapshot'){const d=docs.find(d=>d.id===args.id);const s={id:crypto.randomUUID(),documentId:d.id,title:args.title,created:new Date().toISOString(),body:d.body,meta:clone(d.meta)};snapshots.push(s);result=s.id}
        else if(action==='trash'){
          if(project.readOnly)throw new Error('Dieses Projekt ist schreibgeschützt.');
          if(['manuscript','research'].includes(args.id))throw new Error('Die Projektbereiche bleiben erhalten.');
          const d=docs.find(d=>d.id===args.id);if(!args.deleted&&docs.find(p=>p.id===d.parentId)?.deleted)throw new Error('Bitte zuerst den übergeordneten Ordner wiederherstellen.');
          const visit=(id:string)=>{const item=docs.find(d=>d.id===id);item.deleted=args.deleted;item.revision++;for(const child of docs.filter(d=>d.parentId===id))visit(child.id)};visit(d.id);result=clone(project);
        }
        else if(action==='snapshots')result=clone(snapshots.filter(s=>s.documentId===args.id));
        else if(action==='settings'){await new Promise(r=>setTimeout(r,(window as any).__test.settingsDelay??0));if(args.projectId!==project.id)throw new Error('Das Projekt wurde gewechselt.');if(project.readOnly||(window as any).__test.failSettings)throw new Error('Einstellungen konnten nicht gespeichert werden.');if(args.baseTitle===undefined||args.title!==args.baseTitle)project.title=args.title;
          if(args.baseSettings){for(const key of new Set([...Object.keys(args.settings),...Object.keys(args.baseSettings)])){if(JSON.stringify(args.settings[key])===JSON.stringify(args.baseSettings[key]))continue;if(JSON.stringify(project.settings[key])!==JSON.stringify(args.baseSettings[key])&&JSON.stringify(project.settings[key])!==JSON.stringify(args.settings[key]))throw new Error('Diese Projekteinstellung wurde zwischenzeitlich geändert.');if(key in args.settings)project.settings[key]=clone(args.settings[key]);else delete project.settings[key]}}
          else project.settings=args.settings;result=clone(project)}
        else if(action==='search')result=docs.filter(d=>d.body.includes(args.query)||d.title.includes(args.query)).map(d=>({...d,excerpt:'Gefundener Text'}));
        for(const l of listeners)l({data:{id,ok:true,result}});
      }catch(e:any){for(const l of listeners)l({data:{id,ok:false,error:e.message}})}
    }}}});
  });
  await page.goto('http://127.0.0.1:4177/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#workspace')).toBeVisible();
});

async function timelineFixture(page:any,count=3){
  await page.evaluate(count=>{
    const p=(window as any).__test.project,a='a'.repeat(32),b='b'.repeat(32),c='c'.repeat(32);
    p.settings.timeline={basis:'relative',strands:[{id:a,name:'Haupthandlung'},{id:b,name:'Die Suche'}]};
    const first=p.documents.find((d:any)=>d.id==='scene'),second=p.documents.find((d:any)=>d.id==='scene2');
    first.meta.timeline={start:{day:2,time:'09:00'},end:{day:2,time:'12:00'},strandId:a};first.meta.storyCardIds=[c];
    second.meta.timeline={start:{day:1},strandId:a};
    p.documents.push({...structuredClone(first),id:'third',position:2,title:'Dritte Szene',kind:'script',meta:{timeline:{start:{day:2,time:'10:00'},end:{day:3},strandId:b},storyCardIds:[c]}});
    p.documents.push({id:c,parentId:'research',position:0,kind:'text',title:'Mara',body:first.body,revision:0,meta:{storyCard:{type:'figure',aliases:[],fields:{}}},words:0});
    for(let i=3;i<count;i++)p.documents.push({...structuredClone(first),id:'extra'+i,position:i,title:'Szene '+i,meta:{timeline:{start:{day:i*1000},strandId:i%2?a:b}}});
    sessionStorage.setItem('testSavedProject',JSON.stringify(p));
  },count);await page.reload();await page.locator('[data-view="timeline"]').click();
}
test('timeline setup, strand management, metadata and persistence use existing project settings',async({page})=>{
  await page.locator('[data-view="timeline"]').click();await page.locator('#timelineView [data-timeline-action="setup"]').click();
  await expect(page.locator('#timelineBasis')).toHaveValue('relative');await page.locator('#dialogSubmit').click();
  await page.locator('[data-timeline-scene="scene"]').click();await expect(page.locator('[data-view="timeline"]')).toHaveClass('active');
  await page.locator('#inspectorContent [data-timeline-action="newStrand"]').click();await page.locator('#timelineStrandName').fill('Maras Suche');await page.locator('#dialogSubmit').click();
  await expect(page.locator('#timelineSceneStrand')).toContainText('Maras Suche');
  const strand=await page.evaluate(()=>(window as any).__test.project.settings.timeline.strands[0].id);
  await page.locator('#timelineSceneStrand').selectOption(strand);await page.locator('#timelineStartDay').fill('-1');await page.locator('#timelineStartTime').fill('23:59');await page.locator('#timelineEndDay').fill('1');await page.keyboard.press('Control+s');
  await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await expect(page.locator('.timeline-lane').filter({has:page.locator('h3',{hasText:'Maras Suche'})})).toContainText('Tag -1');
  await page.locator('[data-timeline-action="manage"]').click();await expect(page.locator('[data-timeline-action="deleteStrand"]')).toBeDisabled();
  await page.locator('[data-timeline-action="renameStrand"]').click();await page.locator('#timelineStrandName').fill('Heimkehr');await page.locator('#dialogSubmit').click();
  await expect(page.locator('.timeline-lane').first()).toContainText('Heimkehr');
  await page.evaluate(()=>sessionStorage.setItem('testSavedProject',JSON.stringify((window as any).__test.project)));await page.reload();await page.locator('[data-doc="scene"]').click();
  await expect(page.locator('#timelineStartDay')).toHaveValue('-1');await expect(page.locator('#timelineStartTime')).toHaveValue('23:59');await expect(page.locator('#timelineEndDay')).toHaveValue('1');await expect(page.locator('#timelineSceneStrand')).toHaveValue(strand);
});
test('timeline filters, navigation, zoom and theme preserve manuscript order and text',async({page})=>{
  await timelineFixture(page);const before=await page.evaluate(()=>JSON.stringify((window as any).__test.docs));
  await expect(page.locator('[data-timeline-scene]')).toHaveCount(3);await expect(page.locator('.timeline-lane').first().locator('[data-timeline-scene]').first()).toHaveAttribute('data-timeline-scene','scene2');
  await page.locator('#timelineFilter-figure').selectOption('c'.repeat(32));await expect(page.locator('[data-timeline-scene]')).toHaveCount(2);
  await page.locator('#timelineFilter-strand').selectOption('a'.repeat(32));await expect(page.locator('[data-timeline-scene]')).toHaveCount(1);
  await page.locator('[data-timeline-scene="scene"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#timelineStartDay')).toHaveValue('2');
  await page.locator('[data-timeline-action="in"]').click();await page.locator('[data-timeline-action="in"]').click();
  await page.locator('#timelineScroll').evaluate(el=>{el.scrollLeft=170});
  await page.locator('#inspectorContent [data-timeline-action="text"]').click();await expect(page.locator('.tiptap').first()).toContainText('Gartentor');
  await page.locator('[data-view="timeline"]').click();await expect(page.locator('#timelineFilter-figure')).toHaveValue('c'.repeat(32));expect(await page.locator('#timelineScroll').evaluate(el=>el.scrollLeft)).toBe(170);
  expect(await page.evaluate(()=>JSON.stringify((window as any).__test.docs))).toBe(before);
  await page.locator('#timelineFilter-strand').selectOption('');await page.locator('#timelineFilter-figure').selectOption('');await page.locator('[data-timeline-action="fit"]').click();
  await page.screenshot({path:'artifacts/timeline-light.png'});
  await page.setViewportSize({width:1280,height:760});await page.locator('#inspectorResize').focus();await page.keyboard.press('Home');await page.locator('[data-action="theme"]').click();await page.screenshot({path:'artifacts/timeline-dark.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('timeline invalid drafts and save errors block data loss; read-only remains navigable',async({page})=>{
  await timelineFixture(page);await page.locator('[data-timeline-scene="scene"]').click();
  await page.locator('#timelineEndDay').fill('0');await expect(page.locator('#timelineFieldError')).toContainText('vor dem Beginn');
  await page.locator('[data-timeline-scene="third"]').click();await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');await expect(page.locator('#timelineEndDay')).toHaveValue('0');
  await page.locator('#timelineEndDay').fill('4');await page.evaluate(()=>{(window as any).__test.failSave=true});await page.locator('[data-view="write"]').click();await expect(page.locator('#saveState')).toHaveText('Speichern fehlgeschlagen');await expect(page.locator('#timelineEndDay')).toHaveValue('4');
  await page.evaluate(()=>{(window as any).__test.failSave=false});await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await page.evaluate(()=>{const p=(window as any).__test.project;p.readOnly=true;sessionStorage.setItem('testSavedProject',JSON.stringify(p))});await page.reload();await page.locator('[data-view="timeline"]').click();await page.locator('[data-timeline-scene="scene"]').click();
  await expect(page.locator('#timelineStartDay')).toBeDisabled();await expect(page.locator('#timelineEndDay')).toHaveValue('4');await page.locator('#timelineFilter-strand').selectOption('b'.repeat(32));await expect(page.locator('[data-timeline-scene]')).toHaveCount(1);
});
test('timeline handles calendar precision, settings failure and project switches',async({page})=>{
  await page.locator('[data-view="timeline"]').click();await page.locator('#timelineView [data-timeline-action="setup"]').click();await page.locator('#timelineBasis').selectOption('calendar');
  await page.evaluate(()=>{(window as any).__test.failSettings=true});await page.locator('#dialogSubmit').click();await expect(page.locator('#toast')).toContainText('Einstellungen konnten nicht');await expect(page.locator('#timelineView [data-timeline-action="setup"]')).toBeVisible();
  await page.evaluate(()=>{(window as any).__test.failSettings=false});await page.locator('#timelineView [data-timeline-action="setup"]').click();await page.locator('#timelineBasis').selectOption('calendar');await page.locator('#dialogSubmit').click();
  await page.locator('[data-timeline-scene="scene"]').click();await page.locator('#timelineStartDay').fill('2024-02-29');await page.locator('#timelineEndDay').fill('2024-03-01');await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await expect(page.locator('[data-timeline-scene="scene"]')).toContainText('29.02.2024 · tagesgenau');
  await page.evaluate(()=>{const t=(window as any).__test;t.project.id='different-project';delete t.project.settings.timeline;t.docs.forEach((d:any)=>delete d.meta.timeline);t.listeners.forEach((l:Function)=>l({data:{type:'command',action:'open'}}))});
  await expect(page.locator('[data-view="write"]')).toHaveClass('active');await page.locator('[data-view="timeline"]').click();await expect(page.locator('#timelineView [data-timeline-action="setup"]')).toBeVisible();
});
test('timeline renders 1000 sparse scenes without one element per empty day',async({page})=>{
  await timelineFixture(page,1000);await expect(page.locator('[data-timeline-scene]')).toHaveCount(1000);expect(await page.locator('.timeline-ticks span').count()).toBeLessThanOrEqual(7);
  expect(await page.locator('#timelineView *').count()).toBeLessThan(9000);await page.locator('#timelineFilter-strand').selectOption('b'.repeat(32));await expect(page.locator('[data-timeline-scene]')).toHaveCount(499);
});
test('timeline settings preserve concurrent scene edits and allow deleting an unused strand',async({page})=>{
  await timelineFixture(page);await page.locator('[data-timeline-scene="scene"]').click();
  await page.locator('#inspectorContent [data-timeline-action="newStrand"]').click();await page.locator('#timelineStrandName').fill('Unbenutzt');
  await page.evaluate(()=>{(window as any).__test.settingsDelay=400});await page.locator('#dialogSubmit').click();
  await page.locator('#timelineEndDay').fill('4');await expect(page.locator('#timelineSceneStrand')).toContainText('Unbenutzt');await page.keyboard.press('Control+s');
  await expect.poll(()=>page.evaluate(()=>(window as any).__test.docs.find((d:any)=>d.id==='scene').meta.timeline.end.day)).toBe(4);
  await expect(page.locator('#timelineEndDay')).toHaveValue('4');await page.locator('[data-timeline-action="manage"]').click();
  await page.locator('.timeline-strand-entry').filter({hasText:'Unbenutzt'}).locator('[data-timeline-action="deleteStrand"]').click();await page.locator('#dialogSubmit').click();await expect(page.locator('#timelineSceneStrand')).not.toContainText('Unbenutzt');
  await page.locator('#inspectorContent [data-timeline-action="newStrand"]').click();await page.locator('#timelineStrandName').fill('Verspätet');await page.locator('#dialogSubmit').click();
  await page.evaluate(()=>{const t=(window as any).__test;t.project.id='new-timeline-project';t.project.settings={};t.docs.forEach((d:any)=>delete d.meta.timeline);t.listeners.forEach((l:Function)=>l({data:{type:'command',action:'open'}}))});
  await expect(page.locator('[data-view="write"]')).toHaveClass('active');await page.locator('[data-view="timeline"]').click();await expect(page.locator('#timelineView [data-timeline-action="setup"]')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).__test.project.settings.timeline??null)).toBe(null);
});

test('welcome lists three recent projects with direct opening and missing-file feedback',async({page})=>{
  const entries=[{title:'Nacht <img src=x onerror=alert(1)>',filePath:'D:\\Romane\\Nacht.schreibprojekt'},{title:'Am See',filePath:'D:\\Romane\\Am See.schreibprojekt'},{title:'Am See',filePath:'E:\\Archiv\\'+('Langer Ordnername\\'.repeat(12))+'Am See.schreibprojekt'},{title:'Viertes Projekt',filePath:'D:\\Vier.schreibprojekt'}];
  await page.evaluate(entries=>{sessionStorage.setItem('testWelcome','true');sessionStorage.setItem('testRecentProjects',JSON.stringify(entries))},entries);await page.reload();
  await expect(page.locator('#welcome')).toBeVisible();
  const buttons=page.locator('#recentProjects button');await expect(buttons).toHaveCount(3);
  await expect(buttons.locator('span')).toHaveText(entries.slice(0,3).map(p=>p.title));await expect(page.locator('#recentProjects img')).toHaveCount(0);
  await expect(buttons.nth(1).locator('small')).toHaveText(entries[1].filePath);
  await page.screenshot({path:'artifacts/recent-projects-light.png'});
  await buttons.nth(1).click();await expect(page.locator('#workspace')).toBeVisible();expect(await page.evaluate(()=>(window as any).__test.openedRecent)).toBe(entries[1].filePath);
  await page.reload();await page.evaluate(()=>{(window as any).__test.recentError=true});await buttons.first().click();await expect(page.locator('#toast')).toContainText('verschoben oder gelöscht');await expect(page.locator('#welcome')).toBeVisible();await expect(buttons.first()).toBeEnabled();
  await page.setViewportSize({width:960,height:540});await page.locator('[data-action="theme"]').click();await buttons.last().scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth&&document.getElementById('welcome')!.scrollWidth<=document.getElementById('welcome')!.clientWidth)).toBe(true);
  await page.screenshot({path:'artifacts/recent-projects-compact-dark.png'});
  await page.evaluate(()=>{(window as any).__test.recentError=false});await buttons.last().focus();await page.keyboard.press('Enter');await expect(page.locator('#workspace')).toBeVisible();expect(await page.evaluate(()=>(window as any).__test.openedRecent)).toBe(entries[2].filePath);
  await page.evaluate(()=>sessionStorage.removeItem('testRecentProjects'));await page.reload();await expect(page.locator('#recentProjectsEmpty')).toBeVisible();await expect(buttons).toHaveCount(0);
});

test('updates verify downloads, retain unsaved text on failure and only install after saving',async({page})=>{
  await page.locator('[data-doc="scene"]').click();
  await page.evaluate(()=>{(window as any).__test.updateRelease={version:'0.1.0-alpha.3',notes:'<img src=x onerror=alert(1)> Neue Funktionen',fileName:'Setup.exe',size:300000000};(window as any).__test.failSave=true});
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' UPDATE-TEXT');
  const open=()=>page.evaluate(()=>(window as any).__test.listeners.forEach((l:Function)=>l({data:{type:'command',action:'updates'}})));
  await open();const dialog=page.locator('#updateDialog');await expect(dialog).toBeVisible();
  await expect(page.locator('#updateStatus')).toContainText('alpha.3');await expect(page.locator('#updateNotes img')).toHaveCount(0);
  await page.evaluate(()=>{(window as any).__test.downloadError=true});await page.locator('#updateDownload').click();
  await expect(page.locator('#updateStatus')).toContainText('SHA-256');await expect(page.locator('#updateInstall')).toBeHidden();
  await page.evaluate(()=>{(window as any).__test.downloadError=false});await page.locator('#updateDownload').click();await expect(page.locator('#updateInstall')).toBeVisible();
  await page.locator('#updateInstall').click();await expect(page.locator('#updateStatus')).toContainText('schreibgeschützt');
  expect(await page.evaluate(()=>(window as any).__test.installedUpdate)).toBeUndefined();await expect(dialog).toBeVisible();
  await page.evaluate(()=>{(window as any).__test.failSave=false});await page.locator('#updateInstall').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__test.installedUpdate)).toBe(true);
  expect(await page.evaluate(()=>(window as any).__test.docs.find((d:any)=>d.id==='scene').body)).toContain('UPDATE-TEXT');
  await page.screenshot({path:'artifacts/update-dialog.png'});
});

test('portable updates work on welcome, report network errors and cancel downloads',async({page})=>{
  await page.evaluate(()=>{sessionStorage.setItem('testWelcome','true');sessionStorage.setItem('testPortable','true')});await page.reload();
  const open=()=>page.evaluate(()=>(window as any).__test.listeners.forEach((l:Function)=>l({data:{type:'command',action:'updates'}})));
  await page.evaluate(()=>{(window as any).__test.updateError=true});await open();await expect(page.locator('#updateStatus')).toContainText('nicht erreichbar');
  await page.evaluate(()=>{(window as any).__test.updateError=false});await page.locator('#updateCheck').click();await expect(page.locator('#updateStatus')).toContainText('Keine neuere');
  await page.evaluate(()=>{(window as any).__test.updateRelease={version:'0.1.0-alpha.3',notes:'Portable Aktualisierung',size:320000000};(window as any).__test.waitForUpdate=true});
  await page.locator('#updateCheck').click();await page.locator('#updateDownload').click();await expect(page.locator('#updateClose')).toHaveText('Abbrechen');
  await page.locator('#updateClose').click();await expect(page.locator('#updateDialog')).toBeHidden();await expect(page.locator('#updateDownload')).toBeEnabled();
  await page.evaluate(()=>{(window as any).__test.waitForUpdate=false;(window as any).__test.cancelledUpdate=false});await open();await page.locator('#updateDownload').click();
  await expect(page.locator('#updateStatus')).toContainText('erfolgreich');await expect(page.locator('#updateInstall')).toBeHidden();await expect(page.locator('#updateInstructions')).toContainText('Data');
  await page.locator('#updateShow').click();expect(await page.evaluate(()=>(window as any).__test.openedUpdateFolder)).toBe(true);
  await page.locator('#updateAuto').check();expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('testPreferences')!).checkUpdatesAtStartup)).toBe(true);
  await page.locator('#updateClose').click();await expect(page.locator('#welcome')).toBeVisible();
});

test('write, format, save, reopen and preserve footnotes',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('[data-doc="scene"]').click();
  const editor=page.locator('.editor-sheet .tiptap');await expect(editor).toContainText('Gartentor');
  await editor.click();await page.keyboard.press('Control+End');await page.keyboard.type(' Ein neuer Satz.');await page.keyboard.press('Control+s');
  await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await page.locator('[data-action="insertFootnote"]').click();await page.locator('#value').fill('Ein sicher gespeicherter Hinweis.');await page.locator('#dialogSubmit').click();await page.keyboard.press('Control+s');
  await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await expect(page.locator('.footnote')).toHaveCount(1);
  await page.locator('[data-doc="scene2"]').click();await expect(page.locator('#documentTitle')).toHaveValue('Ein unerwarteter Brief');await page.locator('[data-doc="scene"]').click();
  await expect(editor).toContainText('Ein neuer Satz.');await expect(page.locator('.footnote')).toHaveAttribute('data-note','Ein sicher gespeicherter Hinweis.');
  expect(errors).toEqual([]);
});
test('save failure retains text and blocks navigation',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.evaluate(()=>{(window as any).__test.failSave=true});
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' NICHT VERLIEREN');await page.keyboard.press('Control+s');
  await expect(page.locator('#saveState')).toHaveText('Speichern fehlgeschlagen');await page.locator('[data-doc="scene2"]').click();
  await expect(page.locator('.editor-sheet .tiptap')).toContainText('NICHT VERLIEREN');
  await page.evaluate(()=>{(window as any).__test.failSave=false});await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
});
test('edits during a save are not overwritten by its acknowledgement',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.evaluate(()=>{(window as any).__test.saveDelay=400});
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' ERSTER');await page.keyboard.press('Control+s');await page.keyboard.type(' ZWEITER');
  await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert',{timeout:7000});
  const text=await page.evaluate(()=>JSON.parse((window as any).__test.docs.find((d:any)=>d.id==='scene').body).content[0].content.map((n:any)=>n.text??'').join(''));
  expect(text).toContain('ERSTER ZWEITER');
});
test('board, outline, inspector, theme and focus share one project',async({page})=>{
  await page.locator('[data-doc="chapter"]').click();await page.locator('[data-view="board"]').click();await expect(page.locator('.board-card')).toHaveCount(2);
  await page.locator('[data-card="scene"]').dblclick();await page.locator('#metaSynopsis').fill('Neue Zusammenfassung');await page.keyboard.press('Control+s');
  await page.locator('[data-doc="chapter"]').click();await page.locator('[data-view="outline"]').click();await expect(page.locator('.outline-table')).toContainText('Neue Zusammenfassung');
  await page.locator('[data-action="theme"]').click();await expect(page.locator('body')).toHaveClass('dark');await page.keyboard.press('F11');await expect(page.locator('body')).toHaveClass(/focus-mode/);await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/focus-mode/);
});
test('visual baseline light, dark, corkboard and compact viewport',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.screenshot({path:'artifacts/screenshots/editor-light.png',fullPage:true});
  await page.locator('[data-action="theme"]').click();await page.screenshot({path:'artifacts/screenshots/editor-dark.png',fullPage:true});
  await page.locator('[data-action="theme"]').click();await page.locator('[data-doc="chapter"]').click();await page.locator('[data-view="board"]').click();await page.screenshot({path:'artifacts/screenshots/board.png',fullPage:true});
  await page.setViewportSize({width:960,height:540});await page.locator('[data-card="scene"]').dblclick();await expect(page.locator('#documentTitle')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});

test('notebook resizes by dragging and keyboard, persists and fits smaller windows',async({page})=>{
  const notebook=page.locator('#notebook'),handle=page.getByRole('separator',{name:'Notizbuchbreite ändern'});
  await page.locator('[data-doc="scene"]').click();
  await page.locator('[data-inspector="notes"]').click();
  await page.locator('#metaNotes').fill('Diese Notiz bleibt beim Verbreitern erhalten.');
  const drag=async(delta:number)=>{
    const box=(await handle.boundingBox())!;
    await page.mouse.move(box.x+box.width/2,box.y+40);await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+delta,box.y+40,{steps:8});await page.mouse.up();
    await expect(page.locator('body')).not.toHaveClass(/resizing-inspector/);
  };
  await expect(notebook).toHaveCSS('width','266px');
  await drag(-120);await expect(notebook).toHaveCSS('width','386px');
  await drag(50);await expect(notebook).toHaveCSS('width','336px');
  await expect(page.locator('#metaNotes')).toHaveValue('Diese Notiz bleibt beim Verbreitern erhalten.');
  await handle.press('ArrowLeft');await expect(notebook).toHaveCSS('width','346px');
  await handle.press('ArrowRight');await expect(notebook).toHaveCSS('width','336px');
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('testPreferences')!).inspectorWidth)).toBe(336);
  await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await page.reload();await expect(notebook).toHaveCSS('width','336px');
  await drag(1200);await expect(notebook).toHaveCSS('width','230px');
  await drag(-1200);await expect(notebook).toHaveCSS('width','764px');
  await handle.press('Home');await expect(notebook).toHaveCSS('width','230px');
  await handle.press('End');await expect(notebook).toHaveCSS('width','764px');
  for(const width of [1250,1100,960,760]){
    await page.setViewportSize({width,height:700});
    if(width===960){await expect(notebook).toBeHidden();await page.locator('[data-action="inspectorToggle"]').click()}
    await expect(notebook).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    const box=(await notebook.boundingBox())!;
    expect(box.x+box.width).toBe(width);
    expect(box.width).toBe(Math.min(764,width-(width>1200?696:width>1050?640:190)));
    await expect(handle).toHaveAttribute('aria-valuenow',String(box.width));
    await page.keyboard.press('F11');await expect(notebook).toBeHidden();await expect(handle).toBeHidden();
    await page.keyboard.press('Escape');await expect(notebook).toBeVisible();
  }
  await handle.press('Home');await drag(-100);await expect(notebook).toHaveCSS('width','330px');
  await page.setViewportSize({width:1460,height:900});
  await page.locator('[data-doc="scene"]').click();
  await page.screenshot({path:'artifacts/screenshots/notebook-resizable.png'});
});

test('project replacement spans formatting and preserves previous versions',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+a');await page.keyboard.type('Alpha Beta Alpha');
  await page.keyboard.press('Control+Home');await page.keyboard.press('Control+Shift+ArrowRight');await page.keyboard.press('Control+b');await page.keyboard.press('ArrowRight');
  await page.locator('[data-action="find"]').click();await page.locator('#find').fill('Alpha Beta');await page.locator('#replace').fill('Gamma');await page.locator('#replaceScope').selectOption('project');await page.locator('#dialogSubmit').click();
  await expect(page.locator('#dialogTitle')).toHaveText('Projektweite Ersetzung');await page.locator('#dialogSubmit').click();await expect(page.locator('.editor-sheet .tiptap')).toHaveText('Gamma Alpha');
  expect(await page.evaluate(()=>(window as any).__test.snapshots.length)).toBe(1);
});

test('typography, editable footnotes and reusable custom templates',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+a');await page.locator('[data-action="moreFormat"]').click();await page.locator('[data-menu-action="typography"]').click();
  await page.locator('#fontFamily').selectOption('Arial');await page.locator('#size').fill('16');await page.locator('#height').fill('1.5');await page.locator('#dialogSubmit').click();await expect(page.locator('.editor-sheet .tiptap span').first()).toHaveCSS('font-family','Arial');
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.locator('[data-action="insertFootnote"]').click();await page.locator('#value').fill('Anfang');await page.locator('#dialogSubmit').click();
  await page.locator('[data-inspector="notes"]').click();await page.locator('[data-note-id]').click();await page.locator('#noteText').fill('Überarbeitet');await page.locator('#dialogSubmit').click();await expect(page.locator('.footnote')).toHaveAttribute('data-note','Überarbeitet');
  await page.locator('[data-action="documentMenu"]').click();await page.locator('[data-menu-action="saveTemplate"]').click();await page.locator('#value').fill('Meine Szene');await page.locator('#dialogSubmit').click();
  await page.locator('[data-action="templates"]').click();await page.locator('#template').selectOption('custom-0');await page.locator('#dialogSubmit').click();await page.locator('#value').fill('Aus eigener Vorlage');await page.locator('#dialogSubmit').click();await expect(page.locator('#documentTitle')).toHaveValue('Aus eigener Vorlage');await expect(page.locator('.footnote')).toHaveAttribute('data-note','Überarbeitet');
});

test('proofreading marks exact text, preserves formatting and footnotes, and supports undo',async({page})=>{
  await page.evaluate(()=>{(window as any).__test.docs.find((d:any)=>d.id==='scene').body=JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'😀 Ein '},{type:'text',text:'Feler',marks:[{type:'bold'}]},{type:'footnote',attrs:{id:'proof-note',text:'Feler in der Fußnote bleibt erhalten.'}},{type:'text',text:' bleibt.'}]},{type:'paragraph',content:[{type:'text',text:'Gramatik',marks:[{type:'italic'}]}]}]})});
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="proof"]').click();await page.locator('#proofRun').click();
  await expect(page.locator('.proof-finding')).toHaveCount(2);await expect(page.locator('.proof-mark').first()).toHaveText('Feler');
  await page.locator('[data-finding="0"] [data-proof-action="replace"]').click();
  await expect(page.locator('.editor-sheet strong')).toHaveText('Fehler');await expect(page.locator('.editor-sheet em')).toHaveText('Gramatik');
  await expect(page.locator('.footnote')).toHaveAttribute('data-note','Feler in der Fußnote bleibt erhalten.');
  await page.keyboard.press('Control+z');await expect(page.locator('.editor-sheet strong')).toHaveText('Feler');
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(2);
  await page.locator('[data-finding="1"] [data-proof-action="replace"]').click();await expect(page.locator('.editor-sheet em')).toHaveText('Grammatik');
  await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await page.locator('[data-doc="scene2"]').click();await page.locator('[data-doc="scene"]').click();await expect(page.locator('.editor-sheet em')).toHaveText('Grammatik');await expect(page.locator('.footnote')).toHaveCount(1);
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(1);await page.screenshot({path:'artifacts/screenshots/proofreading.png'});
});

test('proofreading discards stale results and project dictionary suppresses only allowed words',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="proof"]').click();
  await page.evaluate(()=>{(window as any).__test.proofDelay=400});await page.locator('#proofRun').click();
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' Neu.');
  await expect(page.locator('#proofStatus')).toContainText('Ergebnisse verworfen');await expect(page.locator('.proof-finding')).toHaveCount(0);
  await page.evaluate(()=>{(window as any).__test.proofDelay=0});await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(1);
  await page.locator('[data-proof-action="allow"]').click();await expect(page.locator('.proof-finding')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__test.project.settings.proofDictionary)).toEqual(['Mara']);
  await page.locator('#proofRun').click();await expect(page.locator('#proofStatus')).toContainText('0 Hinweise');
  await page.locator('[data-doc="scene2"]').click();await page.locator('[data-doc="scene"]').click();await page.locator('#proofRun').click();await expect(page.locator('#proofStatus')).toContainText('0 Hinweise');
});

test('proofreading sends selected text only on request, uses language and discovered KI model',async({page})=>{
  await page.locator('[data-doc="scene"]').click();const editor=page.locator('.editor-sheet .tiptap');await editor.click();await page.keyboard.press('Control+a');await page.keyboard.type('Mara sieht einen Feler');
  await editor.evaluate(element=>{const text=element.querySelector('p')!.firstChild!;const range=document.createRange();range.setStart(text,text.textContent!.lastIndexOf('Feler'));range.setEnd(text,text.textContent!.length);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)});
  await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('Feler');
  await page.locator('[data-action="proof"]').click();await expect(page.locator('#proofRun')).toHaveText('Markierung prüfen');
  await page.locator('#proofEngine').selectOption('codex');await expect(page.locator('#proofModel')).toHaveValue('test-model');
  expect(await page.evaluate(()=>(window as any).__test.proofCalls.length)).toBe(0);
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(1);
  const call=await page.evaluate(()=>(window as any).__test.proofCalls[0]);expect(call.engine).toBe('codex');expect(call.model).toBe('test-model');expect(call.blocks.map((b:any)=>b.text)).toEqual(['Feler']);
  await page.locator('#proofLanguage').selectOption('de-CH');await expect(page.locator('#proofStatus')).toHaveText('Prüfsprache gespeichert.');
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(1);
  expect(await page.evaluate(()=>(window as any).__test.proofCalls.at(-1).language)).toBe('de-CH');
  await page.locator('#proofEngine').selectOption('premium');await page.locator('[data-proof-action="premiumConnect"]').click();
  await page.locator('#ltEmail').fill('test@example.invalid');await page.locator('#ltKey').fill('test-key');await page.locator('#dialogSubmit').click();
  await expect(page.locator('#proofAccount')).toContainText('Premium-Zugang gespeichert');await expect(page.locator('#ltKey')).toHaveValue('');
  await page.locator('[data-proof-action="premiumDisconnect"]').click();await expect(page.locator('#proofAccount')).toContainText('Noch kein Premium-Konto');
});


test('account dialog can be cancelled with empty or invalid required fields',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="proof"]').click();await page.locator('#proofEngine').selectOption('premium');
  const dialog=page.getByRole('dialog');
  for(const invalid of [false,true])for(const button of ['Abbrechen','Schließen']){
    await page.locator('[data-proof-action="premiumConnect"]').click();
    if(invalid){await page.locator('#ltEmail').fill('keine-email');await page.locator('#ltKey').fill('test-key')}
    await page.locator('#dialogSubmit').click();await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:button,exact:true}).click();await expect(dialog).toBeHidden();
    await expect(page.locator('#ltKey')).toHaveValue('');expect(await page.evaluate(()=>(window as any).__test.premiumConnected)).toBe(false);
  }
});

test('help and licenses have one close action, editable dialogs retain cancel',async({page})=>{
  const dialog=page.getByRole('dialog');
  for(const action of ['help','licenses']){
    await page.evaluate(action=>(window as any).__test.listeners.forEach((listener:Function)=>listener({data:{type:'command',action}})),action);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.dialog-actions button:visible')).toHaveText(['Schließen']);
    await dialog.locator('#dialogSubmit').click();await expect(dialog).toBeHidden();
    await page.locator('[data-action="settings"]').click();
    await expect(dialog.locator('.dialog-actions button:visible')).toHaveText(['Abbrechen','Übernehmen']);
    await dialog.getByRole('button',{name:'Abbrechen',exact:true}).click();await expect(dialog).toBeHidden();
  }
});

test('local automatic proofreading never triggers online calls and read-only corrections stay disabled',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="proof"]').click();await page.locator('#proofAuto').check();
  const editor=page.locator('.editor-sheet .tiptap');await editor.click();await page.keyboard.press('Control+End');await page.keyboard.type(' Feler');
  await expect.poll(()=>page.evaluate(()=>(window as any).__test.proofCalls.length)).toBe(1);await expect(page.locator('.proof-finding')).toHaveCount(2);
  await page.evaluate(()=>{(window as any).__test.proofDelay=2300});await page.locator('#proofRun').click();
  await editor.click();await page.keyboard.type(' neu');await page.evaluate(()=>{(window as any).__test.proofDelay=0});
  await expect.poll(()=>page.evaluate(()=>(window as any).__test.proofCalls.length)).toBe(3);await expect(page.locator('.proof-finding')).toHaveCount(2);
  await page.locator('#proofEngine').selectOption('premium');await editor.click();await page.keyboard.type(' weiter');await page.waitForTimeout(1700);
  expect(await page.evaluate(()=>(window as any).__test.proofCalls.length)).toBe(3);
  await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toHaveText('✓ Alle Änderungen gespeichert');
  await page.evaluate(()=>{(window as any).__test.project.readOnly=true;document.querySelector<HTMLElement>('[data-action="open"]')!.click()});
  await page.locator('[data-doc="scene"]').click();await page.locator('#proofRun').click();await expect(page.locator('[data-proof-action="replace"]').first()).toBeDisabled();
});

async function openStyleAnalysis(page:any,text?:string) {
  if(text!==undefined)await page.evaluate(text=>{(window as any).__test.docs.find((d:any)=>d.id==='scene').body=JSON.stringify({type:'doc',content:text.split('\n').map(text=>({type:'paragraph',content:text?[{type:'text',text}]:[]}))})},text);
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="proof"]').click();await page.locator('#proofEngine').selectOption('style');
  await expect(page.locator('#styleOptions')).toBeVisible();
}
const styleSample='Das Fenster steht offen. Das Fenster klappert eigentlich.\n'+Array.from({length:30},(_,i)=>'Wort'+i).join(' ')+'.';

test('style analysis finds all categories offline, navigates without changing scope and preserves text',async({page})=>{
  await openStyleAnalysis(page,styleSample);
  const traffic=await page.evaluate(()=>(window as any).__test.proofTraffic.length),before=await page.evaluate(()=>(window as any).__test.docs.find((d:any)=>d.id==='scene').body);
  await expect(page.locator('#proofAccount')).toBeHidden();await expect(page.locator('#proofStyleLabel')).toBeHidden();await expect(page.locator('#proofModelField')).toBeHidden();await expect(page.locator('#proofAuto')).not.toBeChecked();
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(3);
  expect((await page.locator('[data-rule="sentence-length"] .proof-location').innerText()).length).toBeLessThanOrEqual(181);
  await expect(page.locator('#styleOverview [data-proof-action="sentence"]')).toHaveCount(3);
  await expect(page.locator('#styleOverview')).toContainText('30 Wörter');await expect(page.locator('[data-proof-action="replace"]')).toHaveCount(0);
  await page.locator('[data-rule="repetition"] .proof-location').focus();await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('Fenster');await expect(page.locator('#proofRun')).toHaveText('Abschnitt analysieren');
  await page.locator('[data-proof-action="sentence"]').last().click();await expect(page.locator('#proofRun')).toHaveText('Abschnitt analysieren');
  await page.locator('[data-rule="wording"] [data-proof-action="ignore"]').click();await expect(page.locator('.proof-finding')).toHaveCount(2);
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(3);
  expect(await page.evaluate(()=>(window as any).__test.docs.find((d:any)=>d.id==='scene').body)).toBe(before);
  expect(await page.evaluate(()=>(window as any).__test.proofTraffic.length)).toBe(traffic);
  await page.screenshot({path:'artifacts/style-analysis-light.png'});
  await page.setViewportSize({width:960,height:640});await page.locator('[data-action="theme"]').click();
  await page.locator('#inspectorResize').focus();await page.keyboard.press('Home');
  expect(await page.locator('#proofPanel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.locator('[data-rule="wording"]').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/style-analysis-dark.png'});
  await page.locator('[data-rule="wording"] .proof-location').click();await page.keyboard.type('bewusst');await page.keyboard.press('Control+z');
  await expect(page.locator('.editor-sheet .tiptap')).toContainText('eigentlich');await expect(page.locator('.proof-mark')).toHaveCount(0);
});

test('style analysis settings persist and failed saves or read-only projects keep data safe',async({page})=>{
  await openStyleAnalysis(page,styleSample);
  await page.locator('#styleSentences').uncheck();await expect(page.locator('#proofStatus')).toContainText('gespeichert');
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(2);await expect(page.locator('#styleOverview')).toBeEmpty();
  await page.locator('#styleWording').uncheck();await expect(page.locator('#proofStatus')).toContainText('gespeichert');
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(1);
  await page.locator('#styleRepetitions').uncheck();await expect(page.locator('#proofStatus')).toContainText('gespeichert');
  await page.locator('#proofRun').click();await expect(page.locator('#proofStatus')).toContainText('0 Stilhinweise');
  await page.locator('#styleWording').check();await expect(page.locator('#proofStatus')).toContainText('gespeichert');
  await page.evaluate(()=>sessionStorage.setItem('testSavedProject',JSON.stringify((window as any).__test.project)));await page.reload();await openStyleAnalysis(page);
  await expect(page.locator('#styleSentences')).not.toBeChecked();await expect(page.locator('#styleRepetitions')).not.toBeChecked();await expect(page.locator('#styleWording')).toBeChecked();
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(1);
  await page.evaluate(()=>{(window as any).__test.failSettings=true});await page.locator('#styleSentences').click();
  await expect(page.locator('#proofStatus')).toContainText('nicht gespeichert');await expect(page.locator('#styleSentences')).not.toBeChecked();
  await page.evaluate(()=>{(window as any).__test.failSettings=false;(window as any).__test.failSave=true});
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' ERHALTEN');
  await page.locator('#styleSentences').click();await expect(page.locator('#proofStatus')).toContainText('schreibgeschützt');await expect(page.locator('#styleSentences')).not.toBeChecked();await expect(page.locator('.editor-sheet .tiptap')).toContainText('ERHALTEN');
  await page.locator('[data-doc="scene2"]').click();await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');
  await page.evaluate(()=>{(window as any).__test.failSave=false});await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  await page.evaluate(()=>{(window as any).__test.project.readOnly=true;document.querySelector<HTMLElement>('[data-action="open"]')!.click()});await page.locator('[data-doc="scene"]').click();
  await expect(page.locator('#styleSentences')).toBeDisabled();await expect(page.locator('#proofAuto')).toBeDisabled();await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(1);
});

test('style analysis pending preference save cannot overwrite a different project',async({page})=>{
  await openStyleAnalysis(page,styleSample);
  await page.evaluate(()=>{(window as any).__test.settingsDelay=300});await page.locator('#styleWording').click();
  await page.evaluate(()=>{const next=(window as any).__test.project;next.id='another-project';next.title='Zweites Projekt';next.settings={wordTarget:1234};document.querySelector<HTMLElement>('[data-action="open"]')!.click()});
  await expect(page.locator('#projectLabel')).toHaveText('Zweites Projekt');await expect(page.locator('#proofRun')).toBeEnabled();
  expect(await page.evaluate(()=>(window as any).__test.project.settings)).toEqual({wordTarget:1234});
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="proof"]').click();await expect(page.locator('#styleWording')).toBeChecked();
});

test('style analysis automatic mode is opt-in and only runs in the visible analysis view',async({page})=>{
  await openStyleAnalysis(page,'Fenster Fenster.');const traffic=await page.evaluate(()=>(window as any).__test.proofTraffic.length);
  const editor=page.locator('.editor-sheet .tiptap');await editor.click();await page.keyboard.press('Control+End');await page.keyboard.type(' eigentlich');await page.waitForTimeout(1700);await expect(page.locator('.proof-finding')).toHaveCount(0);
  await page.locator('#proofAuto').check();await expect(page.locator('#proofStatus')).toContainText('gespeichert');await expect(page.locator('.proof-finding')).toHaveCount(2);
  await editor.click();await page.keyboard.press('Control+End');await page.keyboard.type(' quasi');await expect(page.locator('.proof-finding')).toHaveCount(3);
  await page.locator('[data-inspector="notes"]').click();await editor.click();await page.keyboard.press('Control+End');await page.keyboard.type(' irgendwie');await page.waitForTimeout(1700);await expect(page.locator('.proof-finding')).toHaveCount(0);
  await page.locator('[data-inspector="proof"]').click();await page.waitForTimeout(1700);await expect(page.locator('.proof-finding')).toHaveCount(0);
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(4);
  expect(await page.evaluate(()=>(window as any).__test.proofTraffic.length)).toBe(traffic);
  await page.locator('#proofAuto').uncheck();await expect(page.locator('#proofStatus')).toContainText('gespeichert');
  await page.evaluate(()=>sessionStorage.setItem('testSavedProject',JSON.stringify((window as any).__test.project)));await page.reload();await openStyleAnalysis(page);await expect(page.locator('#proofAuto')).not.toBeChecked();
});

test('style analysis handles selection, combined editors, project changes and cancellation',async({page})=>{
  await openStyleAnalysis(page,styleSample);
  await page.locator('.editor-sheet .tiptap').evaluate((el:any)=>{const node=el.firstChild.firstChild,range=document.createRange();range.setStart(node,0);range.setEnd(node,10);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)});
  await page.locator('[data-action="proof"]').click();await expect(page.locator('#proofRun')).toHaveText('Markierung analysieren');await page.locator('#proofRun').click();await expect(page.locator('#styleOverview')).toContainText('Ausschnitt 1: 2 Wörter');
  await page.locator('[data-action="proof"]').click();await expect(page.locator('#proofRun')).toHaveText('Markierung analysieren');
  await page.locator('[data-doc="chapter"]').click();await page.locator('#combined').check();
  await page.locator('.editor-sheet .tiptap').nth(1).click();await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(3);
  await page.locator('.editor-sheet .tiptap').nth(2).click();await expect(page.locator('.proof-mark')).toHaveCount(0);await expect(page.locator('.proof-finding')).toHaveCount(0);await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(0);await expect(page.locator('#styleOverview [data-proof-action="sentence"]')).toHaveCount(1);
  await page.locator('#combined').uncheck();await page.locator('[data-doc="scene"]').click();
  await page.locator('.editor-sheet .tiptap').fill(('Fenster Fenster eigentlich.\n').repeat(1500));
  await page.evaluate(()=>{document.querySelector<HTMLButtonElement>('#proofRun')!.click();document.querySelector<HTMLButtonElement>('#proofCancel')!.click()});
  await expect(page.locator('#proofRun')).toBeEnabled();await expect(page.locator('.proof-finding')).toHaveCount(0);
  await page.locator('#proofRun').click();await page.locator('#proofEngine').selectOption('local');await expect(page.locator('#proofRun')).toBeEnabled();await expect(page.locator('.proof-finding')).toHaveCount(0);
  await page.locator('#proofEngine').selectOption('style');await page.locator('#proofRun').click();
  await page.evaluate(()=>{(window as any).__test.project.id='other';(window as any).__test.project.settings={};document.querySelector<HTMLElement>('[data-action="open"]')!.click()});
  await expect(page.locator('.proof-finding')).toHaveCount(0);await expect(page.locator('.proof-mark')).toHaveCount(0);
});

test('style analysis paginates long results and refreshes card name exceptions',async({page})=>{
  await openStyleAnalysis(page,Array(60).fill('Fenster Fenster eigentlich.').join('\n'));
  await page.locator('#proofRun').click();await expect(page.locator('.proof-finding')).toHaveCount(50);await expect(page.locator('#styleOverview [data-proof-action="sentence"]')).toHaveCount(50);
  await page.locator('[data-proof-action="sentencesPage"]').last().click();await expect(page.locator('#styleOverview [data-proof-action="sentence"]')).toHaveCount(10);await page.locator('#styleOverview [data-proof-action="sentence"]').last().click();await expect(page.locator('#proofRun')).toHaveText('Abschnitt analysieren');
  await page.locator('[data-proof-action="resultsPage"]').last().click();await expect(page.locator('.proof-finding')).toHaveCount(50);
  await newStoryCard(page,'item','Fenster');await page.locator('[data-inspector="proof"]').click();await page.locator('#proofRun').click();await expect(page.locator('#proofStatus')).toContainText('119 Stilhinweise');
  expect(await page.locator('[data-rule="repetition"] .proof-location').allTextContents()).not.toContain('Fenster');
});

async function newStoryCard(page:any,type:string,name:string) {
  await page.locator('[data-inspector="cards"]').click();
  await page.locator(`[data-story-action="${type==='figure'?'newFigure':type==='place'?'newPlace':'newItem'}"]`).click();
  await page.locator('#storyNewName').fill(name);await page.locator('#dialogSubmit').click();
  await expect(page.locator('#storyTitle')).toHaveValue(name);
}

async function trashFromContext(page:any,id:string) {
  await page.locator(`#tree [data-doc="${id}"]`).click({button:'right'});
  await page.locator('#contextTrash').click();await expect(page.locator('#dialog')).toBeVisible();
  await page.locator('#dialogSubmit').click();await expect(page.locator(`#tree [data-doc="${id}"]`)).toHaveCount(0);
}

test('item cards persist fields aliases and assignments and restore through the context menu',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="newStoryItem"]').click();
  await expect(page.locator('#dialogTitle')).toHaveText('Gegenstand anlegen');await page.locator('#storyNewName').fill('Silberschlüssel');await page.locator('#dialogSubmit').click();
  await expect(page.locator('#storyDetail h3')).toHaveText('Gegenstand bearbeiten');await page.locator('#storyAliases').fill('Schlüssel');
  const fields={description:'Ein kleiner Schlüssel.',features:'Silber mit einer Kerbe.',owner:'Mara',origin:'Von ihrer Großmutter.',significance:'Öffnet das verborgene Zimmer.',notes:'Nicht verlieren.'};
  for(const [name,value] of Object.entries(fields))await page.locator('#storyField-'+name).fill(value);
  await page.locator('[data-story-action="addField"]').click();await page.locator('#storyFieldName').fill('Gewicht');await page.locator('#dialogSubmit').click();await page.locator('#storyCustom-0').fill('90 g');
  await page.locator('[data-story-action="assign"]').click();await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveText('Schlüssel');
  const editor=await page.locator('.editor-sheet .tiptap').elementHandle();await page.locator('.editor-sheet [data-story-ids]').click();await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');expect(await editor!.evaluate(el=>el.isConnected)).toBe(true);
  await page.locator('[data-doc="scene2"]').click();await page.locator('[data-story-action="assign"]').click();await expect(page.locator('[data-story-action="scene"]')).toHaveCount(2);
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' Silberschlüssel und Schlüssel.');await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveText(['Silberschlüssel','Schlüssel']);
  await page.locator('#storyFilter').selectOption('item');await page.locator('#storySearch').fill('Schlüssel');await expect(page.locator('#storyList button')).toHaveText(['Silberschlüssel · Gegenstand']);
  await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  const id=await page.locator('[data-story-group="story-item"] [data-doc]').getAttribute('data-doc');
  await page.evaluate(()=>sessionStorage.setItem('testSavedProject',JSON.stringify((window as any).__test.project)));await page.reload();await page.locator('[data-doc="scene2"]').click();
  await page.locator(`[data-story-group="story-item"] [data-doc="${id}"]`).focus();await page.keyboard.press('Enter');
  for(const [name,value] of Object.entries(fields))await expect(page.locator('#storyField-'+name)).toHaveValue(value);
  await expect(page.locator('#storyCustom-0')).toHaveValue('90 g');await expect(page.locator('[data-story-action="scene"]')).toHaveCount(2);await expect(page.locator('#storyAliases')).toHaveValue('Schlüssel');
  await expect(page.locator('[data-tree-root="research"]')).not.toContainText('Silberschlüssel');
  await trashFromContext(page,id!);await expect(page.locator('#storyAssigned')).toContainText('Silberschlüssel (nicht verfügbar)');await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(0);
  await page.locator('[data-action="showTrash"]').click();await page.locator(`[data-restore-doc="${id}"]`).click();await page.locator('[data-doc="scene2"]').click();
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveText(['Silberschlüssel','Schlüssel']);await page.locator(`#tree [data-doc="${id}"]`).click();await expect(page.locator('#storyField-owner')).toHaveValue('Mara');
  await page.screenshot({path:'artifacts/items-light.png'});
  await page.setViewportSize({width:960,height:540});await page.locator('[data-action="theme"]').click();await page.locator('[data-story-group="story-item"]').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.getElementById('tree')!.scrollWidth<=document.getElementById('tree')!.clientWidth&&document.getElementById('notebook')!.scrollWidth<=document.getElementById('notebook')!.clientWidth)).toBe(true);
  await page.screenshot({path:'artifacts/items-dark.png'});
});

test('item cards are available from templates and notebook and protect unsaved and read-only fields',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-action="templates"]').click();await page.locator('#template').selectOption('item');await page.locator('#dialogSubmit').click();
  await expect(page.locator('#dialogTitle')).toHaveText('Gegenstand anlegen');await page.locator('#storyNewName').fill('Laterne');await page.locator('#dialogSubmit').click();await expect(page.locator('#storyDetail h3')).toHaveText('Gegenstand bearbeiten');
  await newStoryCard(page,'item','Brief');await page.evaluate(()=>(window as any).__test.failSave=true);await page.locator('#storyField-origin').fill('Vom König.');await page.keyboard.press('Control+s');
  await expect(page.locator('#saveState')).toContainText('fehlgeschlagen');await page.locator('[data-doc="scene2"]').click();await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');await expect(page.locator('#storyField-origin')).toHaveValue('Vom König.');
  await page.evaluate(()=>(window as any).__test.failSave=false);await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  await page.evaluate(()=>{const p=(window as any).__test.project;p.readOnly=true;sessionStorage.setItem('testSavedProject',JSON.stringify(p))});await page.reload();
  await expect(page.locator('[data-action="newStoryItem"]')).toBeDisabled();await page.locator('[data-story-group="story-item"] [data-doc]').filter({hasText:'Brief'}).click();await expect(page.locator('[data-story-action="newItem"]')).toBeDisabled();
  await expect(page.locator('#storyField-origin')).toHaveValue('Vom König.');await expect(page.locator('#storyField-origin')).toBeDisabled();await expect(page.locator('[data-story-action="trash"]')).toBeDisabled();
});

test('context trash targets the clicked section and restores whole folders',async({page})=>{
  await page.locator('[data-doc="scene"]').click();
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' Ungespeicherter Zusatz.');
  const editor=await page.locator('.editor-sheet .tiptap').elementHandle();
  await page.locator('[data-doc="scene2"]').click({button:'right'});
  await expect(page.locator('#documentContextTitle')).toHaveText('Ein unerwarteter Brief');await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');
  await page.locator('#contextTrash').click();await expect(page.locator('#dialogBody')).toContainText('Ein unerwarteter Brief');
  await page.locator('.dialog-actions [value="cancel"]').click();await expect(page.locator('[data-doc="scene2"]')).toBeVisible();
  await trashFromContext(page,'scene2');await expect(page.locator('#trashCount')).toHaveText('1');await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');
  expect(await editor!.evaluate(el=>el.isConnected)).toBe(true);
  expect(await page.evaluate(()=>(window as any).__test.docs.find((d:any)=>d.id==='scene').body)).toContain('Ungespeicherter Zusatz.');
  await page.locator('[data-action="showTrash"]').click();await page.locator('[data-restore-doc="scene2"]').click();
  await expect(page.locator('[data-doc="scene2"]')).toBeVisible();await expect(page.locator('[data-restore-doc]')).toHaveCount(0);await expect(page.locator('#trashCount')).toHaveText('0');
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-doc="chapter"]').focus();await page.keyboard.press('Shift+F10');
  await expect(page.locator('#contextTrash')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#documentContextMenu')).toBeHidden();await expect(page.locator('[data-doc="chapter"]')).toBeFocused();
  await page.keyboard.press('Shift+F10');await page.keyboard.press('Enter');await expect(page.locator('#dialogBody')).toContainText('2 Untereinträge');await page.locator('#dialogSubmit').click();
  await expect(page.locator('#documentTitle')).toHaveValue('Manuskript');await expect(page.locator('#trashCount')).toHaveText('3');await expect(page.locator('[data-doc="scene"]')).toHaveCount(0);
  await page.locator('[data-action="showTrash"]').click();await page.locator('[data-restore-doc="chapter"]').click();await expect(page.locator('#trashCount')).toHaveText('0');await expect(page.locator('[data-doc="scene"]')).toBeVisible();
  await page.locator('[data-doc="manuscript"]').click({button:'right'});await expect(page.locator('#contextTrash')).toBeDisabled();await expect(page.locator('#documentContextHint')).toContainText('Projektbereiche');
  await page.keyboard.press('Escape');await page.locator('[data-doc="chapter"]').click();await page.locator('[data-view="board"]').click();
  await page.locator('[data-card="scene2"]').click({button:'right'});await page.locator('#contextTrash').click();await page.locator('#dialogSubmit').click();await expect(page.locator('[data-card]')).toHaveCount(1);
});

test('context trash handles figures places and research files with recoverable assignments',async({page})=>{
  await page.evaluate(()=>{const p=(window as any).__test.project,base={body:JSON.stringify({type:'doc',content:[{type:'paragraph'}]}),parentId:'research',revision:0,words:0,meta:{}};p.documents.push({...base,id:'research-note',title:'Recherche-Notiz',position:0,kind:'text'},{...base,id:'research-file',title:'Landkarte.pdf',position:1,kind:'asset',meta:{assetId:'map',mime:'application/pdf'}});sessionStorage.setItem('testSavedProject',JSON.stringify(p))});await page.reload();
  await page.locator('[data-doc="scene"]').click();await newStoryCard(page,'figure','Mara');await page.locator('#storyField-notes').fill('Wichtige Figurennotiz');await page.locator('[data-story-action="assign"]').click();
  await newStoryCard(page,'place','Altes Haus');await page.locator('[data-story-action="assign"]').click();await page.locator('#storyField-atmosphere').fill('Still und verlassen.');
  const ids=await page.evaluate(()=>(window as any).__test.docs.filter((d:any)=>d.meta.storyCard).map((d:any)=>d.id));
  await page.locator(`#tree [data-doc="${ids[0]}"]`).click({button:'right'});await page.screenshot({path:'artifacts/context-trash-light.png'});await page.keyboard.press('Escape');
  for(const id of [...ids,'research-note','research-file'])await trashFromContext(page,id);
  await expect(page.locator('#trashCount')).toHaveText('4');await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');
  await expect(page.locator('#storyAssigned')).toContainText('Mara (nicht verfügbar)');await expect(page.locator('#storyAssigned')).toContainText('Altes Haus (nicht verfügbar)');await expect(page.locator('#storyTitle')).toHaveCount(0);
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(0);
  await page.locator('[data-action="showTrash"]').click();for(const id of [...ids,'research-note','research-file'])await page.locator(`[data-restore-doc="${id}"]`).click();
  await expect(page.locator('#trashCount')).toHaveText('0');await expect(page.locator('[data-restore-doc]')).toHaveCount(0);
  await page.locator('[data-doc="scene"]').click();await page.locator(`#tree [data-doc="${ids[0]}"]`).click();await expect(page.locator('#storyField-notes')).toHaveValue('Wichtige Figurennotiz');await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveText('Mara');
  await page.locator(`#tree [data-doc="${ids[1]}"]`).click();await expect(page.locator('#storyField-atmosphere')).toHaveValue('Still und verlassen.');
  await page.setViewportSize({width:960,height:540});await page.locator('[data-action="theme"]').click();await page.locator('[data-doc="research-file"]').click({button:'right'});
  expect(await page.locator('#documentContextMenu').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})).toBe(true);
  await page.screenshot({path:'artifacts/context-trash-dark.png'});
});

test('context trash preserves drafts on save errors and respects read-only and project changes',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await page.evaluate(()=>(window as any).__test.failSave=true);
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' Dieser Text bleibt.');
  await page.locator('[data-doc="scene2"]').click({button:'right'});await page.locator('#contextTrash').click();
  await expect(page.locator('#saveState')).toContainText('fehlgeschlagen');await expect(page.locator('#dialog')).toBeHidden();await expect(page.locator('[data-doc="scene2"]')).toBeVisible();await expect(page.locator('.editor-sheet .tiptap')).toContainText('Dieser Text bleibt.');
  await page.evaluate(()=>(window as any).__test.failSave=false);await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  await page.evaluate(()=>{const t=(window as any).__test;t.project.readOnly=true;t.docs.find((d:any)=>d.id==='scene2').deleted=true;sessionStorage.setItem('testSavedProject',JSON.stringify(t.project))});await page.reload();
  await page.locator('[data-doc="scene"]').click({button:'right'});await expect(page.locator('#contextTrash')).toBeDisabled();await expect(page.locator('#documentContextHint')).toContainText('schreibgeschützt');await page.keyboard.press('Escape');
  await page.locator('[data-action="showTrash"]').click();await expect(page.locator('[data-restore-doc="scene2"]')).toBeDisabled();
  await page.locator('[data-doc="scene"]').click({button:'right'});await page.evaluate(()=>{const t=(window as any).__test;t.project.id='another-project';t.listeners.forEach((l:Function)=>l({data:{type:'command',action:'open'}}))});
  await expect(page.locator('#documentContextMenu')).toBeHidden();await expect(page.locator('#documentTitle')).toHaveValue('Manuskript');
});

test('sidebar separates existing and new story cards from research and keeps the scene open',async({page})=>{
  await page.evaluate(()=>{
    const p=(window as any).__test.project,base={kind:'text',body:JSON.stringify({type:'doc',content:[{type:'paragraph'}]}),parentId:'research',revision:0,words:0};
    p.documents.push({...base,id:'existing-figure',title:'Mara',position:0,meta:{storyCard:{type:'figure',aliases:[],fields:{}},custom:{}}},{...base,id:'research-note',title:'Historische Quellen',position:1,meta:{}});
    sessionStorage.setItem('testSavedProject',JSON.stringify(p));
  });await page.reload();await page.locator('[data-doc="scene"]').click();
  const figures=page.locator('[data-story-group="story-figure"]'),places=page.locator('[data-story-group="story-place"]'),research=page.locator('[data-tree-root="research"]');
  await expect(figures.locator('[data-doc]')).toHaveCount(1);await expect(research).toContainText('Historische Quellen');await expect(research).not.toContainText('Mara');
  await figures.locator('[data-action="newStoryFigure"]').click();await page.locator('#storyNewName').fill('Nora');await page.locator('#dialogSubmit').click();
  await expect(page.locator('#storyTitle')).toHaveValue('Nora');await page.locator('#storyTitle').fill('Nora Berg');await page.keyboard.press('Control+s');
  await expect(figures.locator('.row-label')).toHaveText(['Mara','Nora Berg']);
  await places.locator('[data-action="newStoryPlace"]').click();await page.locator('#storyNewName').fill('Altes Haus');await page.locator('#dialogSubmit').click();
  await expect(places.locator('.row-label')).toHaveText(['Altes Haus']);await expect(research.locator('[data-doc]')).toHaveCount(2);
  await figures.locator('summary').focus();await page.keyboard.press('Enter');await expect(figures).not.toHaveAttribute('open');
  await page.locator('[data-doc="scene2"]').click();await expect(figures).not.toHaveAttribute('open');
  await figures.locator('summary').focus();await page.keyboard.press('Enter');await expect(figures).toHaveAttribute('open');
  const editor=await page.locator('.editor-sheet .tiptap').elementHandle();
  await figures.locator('[data-doc="existing-figure"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#storyTitle')).toHaveValue('Mara');await expect(page.locator('#documentTitle')).toHaveValue('Ein unerwarteter Brief');
  expect(await editor!.evaluate(el=>el.isConnected)).toBe(true);
  await page.locator('[data-doc="research"]').click();await page.locator('[data-view="board"]').click();
  await expect(page.locator('[data-card]')).toHaveCount(1);await expect(page.locator('[data-card]')).toContainText('Historische Quellen');
  await page.locator('[data-view="outline"]').click();await expect(page.locator('[data-outline]')).toHaveCount(1);
  await page.locator('[data-view="write"]').click();await page.locator('#combined').check();await expect(page.locator('.section-label')).toHaveText(['Recherche','Historische Quellen']);
  await page.locator('#combined').uncheck();await page.locator('[data-doc="scene"]').click();
  await page.screenshot({path:'artifacts/storycards-sidebar-light.png'});
  await page.setViewportSize({width:960,height:540});await page.locator('[data-action="theme"]').click();await places.scrollIntoViewIfNeeded();
  expect(await page.locator('#tree').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:'artifacts/storycards-sidebar-dark.png'});
  await page.evaluate(()=>sessionStorage.setItem('testSavedProject',JSON.stringify((window as any).__test.project)));await page.reload();
  await expect(figures.locator('.row-label')).toHaveText(['Mara','Nora Berg']);await expect(places.locator('.row-label')).toHaveText(['Altes Haus']);await expect(research.locator('[data-doc]')).toHaveCount(2);
});

test('story cards keep the scene open, persist fields and assignments, recognize aliases and restore from trash',async({page})=>{
  await page.locator('[data-doc="scene"]').click();
  await newStoryCard(page,'figure','Mara');
  await page.locator('#storyAliases').fill('Heimkehrerin');await page.locator('#storyField-motivation').fill('Die Wahrheit über den Schlüssel finden.');
  await page.locator('[data-story-action="addField"]').click();await page.locator('#storyFieldName').fill('Lieblingsfarbe');await page.locator('#dialogSubmit').click();
  await page.locator('#storyCustom-0').fill('Blau');
  await page.locator('[data-story-action="renameField"]').click();await page.locator('#storyFieldName').fill('Augenfarbe');await page.locator('#dialogSubmit').click();
  await expect(page.locator('label[for="storyCustom-0"]')).toHaveText('Augenfarbe');await expect(page.locator('#storyCustom-0')).toHaveValue('Blau');
  await page.locator('[data-story-action="assign"]').click();await expect(page.locator('#storyAssigned')).toContainText('Mara');
  await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');
  const original=await page.evaluate(()=>(window as any).__test.docs.find((d:any)=>d.id==='scene').body);
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveText('Mara');
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');
  const cursor=await page.evaluate(()=>{const s=getSelection()!;return {anchor:s.anchorOffset,focus:s.focusOffset,text:s.anchorNode?.textContent,scroll:document.getElementById('editorPane')!.scrollTop}});
  await page.locator('.editor-sheet [data-story-ids]').click();await expect(page.locator('#storyTitle')).toHaveValue('Mara');
  expect(await page.evaluate(()=>{const s=getSelection()!;return {anchor:s.anchorOffset,focus:s.focusOffset,text:s.anchorNode?.textContent,scroll:document.getElementById('editorPane')!.scrollTop}})).toEqual(cursor);
  expect(await page.evaluate(()=>(window as any).__test.docs.find((d:any)=>d.id==='scene').body)).toBe(original);
  await page.locator('[data-doc="scene2"]').click();await page.locator('[data-story-action="assign"]').click();
  await expect(page.locator('[data-story-action="scene"]')).toHaveCount(2);
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' Die Heimkehrerin wartet.');
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveText('Heimkehrerin');
  await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  await page.evaluate(()=>sessionStorage.setItem('testSavedProject',JSON.stringify((window as any).__test.project)));await page.reload();
  await page.locator('[data-doc="scene2"]').click();await page.locator('[data-inspector="cards"]').click();await page.locator('#storyAssigned [data-story-action="open"]').click();
  await expect(page.locator('#storyField-motivation')).toHaveValue('Die Wahrheit über den Schlüssel finden.');await expect(page.locator('#storyCustom-0')).toHaveValue('Blau');
  await expect(page.locator('[data-story-action="scene"]')).toHaveCount(2);
  await page.locator('[data-story-action="trash"]').click();await page.locator('#dialogSubmit').click();await expect(page.locator('#storyAssigned')).toContainText('nicht verfügbar');
  await expect(page.locator('[data-story-group="story-figure"] [data-doc]')).toHaveCount(0);
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(0);
  await page.locator('[data-action="showTrash"]').click();await page.locator('[data-restore-doc]').click();
  await expect(page.locator('[data-story-group="story-figure"] .row-label')).toHaveText(['Mara']);
  await page.locator('[data-doc="scene2"]').click();await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveText('Heimkehrerin');
  await newStoryCard(page,'place','Haus am See');await page.locator('#storyField-atmosphere').fill('Still und verlassen.');await page.locator('[data-story-action="assign"]').click();
  await page.locator('#storySearch').fill('Haus');await expect(page.locator('#storyList [data-story-action="open"]')).toHaveCount(1);
  await page.locator('#storyFilter').selectOption('figure');await expect(page.locator('#storyList')).toContainText('Keine passenden');
  await page.locator('#storyFilter').selectOption('place');await expect(page.locator('#storyList')).toContainText('Haus am See');
  await page.setViewportSize({width:960,height:540});await page.locator('[data-action="theme"]').click();
  await page.screenshot({path:'artifacts/storycards-compact-dark.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.getElementById('notebook')!.scrollWidth<=document.getElementById('notebook')!.clientWidth)).toBe(true);
});

test('ambiguous names, explicit links and recognition toggle preserve text and editor undo',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await newStoryCard(page,'figure','Mara');
  await newStoryCard(page,'figure','Andere Mara');await page.locator('#storyAliases').fill('Mara');
  await page.locator('.editor-sheet [data-story-ids]').click();await expect(page.locator('#storyCardsPanel')).toContainText('Name mehrdeutig');
  await page.locator('#storyList [data-story-action="open"]').filter({hasText:'Andere Mara'}).click();
  await page.locator('#storyField-notes').fill('Diese Notiz bleibt beim Umschalten erhalten.');
  await page.locator('#storyRecognition').uncheck();await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(0);
  await expect(page.locator('#storyField-notes')).toHaveValue('Diese Notiz bleibt beim Umschalten erhalten.');
  await page.locator('#storyRecognition').check();await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(1);
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+End');await page.keyboard.type(' Verweis');
  await page.keyboard.press('Control+Shift+ArrowLeft');await page.locator('[data-story-action="link"]').click();
  await expect(page.locator('.editor-sheet a')).toHaveText('Verweis');
  await page.locator('.editor-sheet a').click();await expect(page.locator('#storyTitle')).toHaveValue('Andere Mara');await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');
  await page.locator('.editor-sheet .tiptap').click();await page.keyboard.press('Control+z');await expect(page.locator('.editor-sheet a')).toHaveCount(0);
  await expect(page.locator('.editor-sheet .tiptap')).toContainText('Verweis');
  await page.locator('#storyTitle').fill('Neue Mara');await page.locator('#storyAliases').fill('');
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(1);
  await page.locator('.editor-sheet [data-story-ids]').click();await expect(page.locator('#storyTitle')).toHaveValue('Mara');
  await page.locator('#storyList [data-story-action="open"]').filter({hasText:'Neue Mara'}).click();await expect(page.locator('#storyField-notes')).toHaveValue('Diese Notiz bleibt beim Umschalten erhalten.');
});

test('story cards retain edits on save failure and enforce read-only access',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await newStoryCard(page,'figure','Mara');
  await page.evaluate(()=>(window as any).__test.failSave=true);
  await page.locator('#storyField-conflict').fill('Diese Eingabe muss bleiben.');await page.keyboard.press('Control+s');
  await expect(page.locator('#saveState')).toContainText('fehlgeschlagen');
  await page.locator('[data-doc="scene2"]').click();await expect(page.locator('#documentTitle')).toHaveValue('Das Haus am See');
  await expect(page.locator('#storyField-conflict')).toHaveValue('Diese Eingabe muss bleiben.');
  await page.evaluate(()=>(window as any).__test.failSave=false);await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  await page.evaluate(()=>{const p=(window as any).__test.project;p.readOnly=true;sessionStorage.setItem('testSavedProject',JSON.stringify(p))});await page.reload();
  await page.locator('[data-doc="scene"]').click();await page.locator('[data-inspector="cards"]').click();await page.locator('#storyList button').click();
  await expect(page.locator('#storyField-conflict')).toHaveValue('Diese Eingabe muss bleiben.');await expect(page.locator('#storyField-conflict')).toBeDisabled();
  await expect(page.locator('[data-story-action="newFigure"]')).toBeDisabled();await expect(page.locator('[data-story-action="trash"]')).toBeDisabled();
  await expect(page.locator('[data-action="newStoryFigure"]')).toBeDisabled();await expect(page.locator('[data-action="newStoryPlace"]')).toBeDisabled();
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(1);
});

test('story name decorations follow combined editors, keyboard navigation and project changes',async({page})=>{
  await page.locator('[data-doc="scene"]').click();await newStoryCard(page,'figure','Mara');
  await page.locator('[data-doc="chapter"]').click();await page.locator('#combined').check();
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(1);
  const second=page.locator('.editor-sheet .tiptap[aria-label="Text: Ein unerwarteter Brief"]');
  await second.click();await page.keyboard.press('Control+End');await page.keyboard.type(' Mara wartet.');
  await expect(page.locator('#documentTitle')).toHaveValue('Ein unerwarteter Brief');await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(2);
  await page.locator('#storyDetected button').focus();await page.keyboard.press('Enter');await expect(page.locator('#storyTitle')).toHaveValue('Mara');
  await expect(page.locator('#documentTitle')).toHaveValue('Ein unerwarteter Brief');
  await page.locator('#storyTitle').fill('Andere Figur');await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(0);
  await page.locator('#storyTitle').fill('Mara');await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(2);
  await page.locator('#storyDetail').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/storycards-desktop-light.png'});
  await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
  await page.evaluate(()=>{const test=(window as any).__test;test.project.id='other-project';for(let i=test.docs.length-1;i>=0;i--)if(test.docs[i].meta.storyCard)test.docs.splice(i,1);document.querySelector<HTMLElement>('[data-action="open"]')!.click()});
  await expect(page.locator('#documentTitle')).toHaveValue('Manuskript');await page.locator('[data-doc="scene"]').click();
  await expect(page.locator('.editor-sheet [data-story-ids]')).toHaveCount(0);await expect(page.locator('#storyList')).toContainText('Keine passenden Karten');
});
async function networkFixture(page:any,count=4,edgeCount=0){
  await page.evaluate(({count,edgeCount}:any)=>{
    const p=(window as any).__test.project,id=(n:number)=>n.toString(16).padStart(32,'0');
    for(let i=1;i<=count;i++)p.documents.push({id:id(i),title:['Mara','Jonas','Hafenstadt','Kompass'][i-1]??'Karte '+i,parentId:'research',position:i-1,kind:'text',body:JSON.stringify({type:'doc',content:[{type:'paragraph'}]}),meta:{storyCard:{type:i===3?'place':i===4?'item':'figure',aliases:[],fields:i<3?{relationships:'Bisherige freie Beziehungsnotiz'}:{}}},revision:0,words:0});
    if(edgeCount)p.settings.relationshipNetwork={edges:Array.from({length:edgeCount},(_,n)=>({id:id(n+1000),fromId:id(n%count+1),toId:id((n+1)%count+1),label:'Verbindung '+n,direction:n%2?'mutual':'directed',notes:'Notiz'})),positions:{}};
    sessionStorage.setItem('testSavedProject',JSON.stringify(p));
  },{count,edgeCount});await page.reload();await page.locator('[data-view="relationships"]').click();await expect(page.locator('.network-card')).toHaveCount(count);
}
const networkId=(n:number)=>n.toString(16).padStart(32,'0');
async function networkConnect(page:any,from:number,to:number,label:string,direction='directed'){
  await page.locator('#networkView [data-network-action="new"]').click();await page.locator('#relationship-fromId').selectOption(networkId(from));await page.locator('#relationship-toId').selectOption(networkId(to));await page.locator('#relationship-label').fill(label);await page.locator('#relationship-direction').selectOption(direction);await page.locator('#relationship-notes').fill('Beispielnotiz');await page.locator('#relationshipForm [type="submit"]').click();await expect(page.locator('#relationshipForm')).toHaveCount(0);
}
test('relationships connect all card types, edit cards, keep manuscript unchanged and survive reopen with keyboard positions',async({page})=>{
  await networkFixture(page);const before=await page.evaluate(()=>JSON.stringify((window as any).__test.docs.filter((d:any)=>d.parentId!=='research')));
  await networkConnect(page,1,2,'vertraut');await networkConnect(page,1,3,'wohnt in');await networkConnect(page,2,4,'verbunden','mutual');await expect(page.locator('.network-edge')).toHaveCount(3);
  await page.locator(`[data-network-card="${networkId(1)}"] .network-card-open`).click();await expect(page.locator('#storyRelationships')).toContainText('vertraut');await expect(page.locator('#storyField-relationships')).toHaveValue('Bisherige freie Beziehungsnotiz');await page.locator('#storyTitle').fill('Mara Berg');await page.keyboard.press('Control+s');await expect(page.locator('[data-view="relationships"]')).toHaveClass('active');
  const positionX=await page.locator(`[data-network-card="${networkId(1)}"]`).evaluate(el=>parseFloat(getComputedStyle(el).left));const handle=page.locator(`[data-network-move="${networkId(1)}"]`);await handle.focus();await handle.press('ArrowRight');await handle.press('Enter');
  await expect.poll(()=>page.evaluate(()=>(window as any).__test.project.settings.relationshipNetwork.positions['1'.padStart(32,'0')]?.x)).toBe(positionX+10);
  expect(await page.evaluate(()=>JSON.stringify((window as any).__test.docs.filter((d:any)=>d.parentId!=='research')))).toBe(before);expect(await page.evaluate(()=>(window as any).__test.proofTraffic)).toEqual([]);
  await page.evaluate(()=>sessionStorage.setItem('testSavedProject',JSON.stringify((window as any).__test.project)));await page.reload();await page.locator('[data-view="relationships"]').click();await expect(page.locator('.network-edge')).toHaveCount(3);await expect(page.locator(`[data-network-card="${networkId(1)}"]`)).toHaveCSS('left',`${positionX+10}px`);
});
test('relationships retain failed forms, block switches until cancel, and retry failed position saves',async({page})=>{
  await networkFixture(page);await page.locator('#networkView [data-network-action="new"]').click();await page.locator('#relationship-toId').selectOption(networkId(2));await page.locator('#relationship-label').fill('vertraut');
  await page.evaluate(()=>{(window as any).__test.failSettings=true});await page.locator('#relationshipForm [type="submit"]').click();await expect(page.locator('#relationshipError')).toContainText('Einstellungen');await expect(page.locator('#relationship-label')).toHaveValue('vertraut');
  await page.locator('[data-view="write"]').click();await expect(page.locator('[data-view="relationships"]')).toHaveClass('active');await expect(page.locator('#toast')).toContainText('Beziehung speichern');await page.locator('#relationshipEditor [data-network-action="cancel"]').click();
  const handle=page.locator(`[data-network-move="${networkId(1)}"]`);await handle.focus();await handle.press('ArrowDown');await handle.press('Enter');await expect(page.locator('[data-network-action="retry"]')).toBeVisible();await handle.focus();await handle.press('ArrowDown');await handle.press('Escape');await expect(page.locator('[data-network-action="retry"]')).toBeVisible();await expect(page.locator(`[data-network-card="${networkId(1)}"]`)).toHaveCSS('top','50px');
  await page.evaluate(()=>{(window as any).__test.failSettings=false});await page.locator('[data-network-action="retry"]').click();await expect(page.locator('[data-network-action="retry"]')).toHaveCount(0);await expect(page.locator(`[data-network-card="${networkId(1)}"]`)).toHaveCSS('top','50px');
});
test('relationships search and neighbors retain navigation state, escape cancels movement, and removal keeps cards',async({page})=>{
  await networkFixture(page,4,3);await page.locator('#networkSearch').fill('Mara');await page.locator('#networkSearchResults button').click();await page.locator('#networkNeighbors').check();await expect(page.locator('.network-card')).toHaveCount(2);
  const node=page.locator(`[data-network-card="${networkId(1)}"]`),left=await node.evaluate(el=>getComputedStyle(el).left);const handle=page.locator(`[data-network-move="${networkId(1)}"]`);await handle.focus();await handle.press('ArrowRight');await handle.press('Escape');await expect(node).toHaveCSS('left',left);
  await page.locator('[data-view="write"]').click();await page.locator('[data-view="relationships"]').click();await expect(page.locator('#networkNeighbors')).toBeChecked();await expect(page.locator('.network-card')).toHaveCount(2);
  await page.locator('.network-edge').click();await page.locator('#relationshipEditor [data-network-action="remove"]').click();await page.locator('#dialogSubmit').click();await expect(page.locator('.network-edge')).toHaveCount(0);await page.locator('#networkNeighbors').uncheck();await expect(page.locator('.network-card')).toHaveCount(4);
});
test('relationships hide trashed endpoints and restore connections, and read-only navigation remains available',async({page})=>{
  await networkFixture(page,4,3);await page.locator(`[data-doc="${networkId(2)}"]`).click({button:'right'});await page.locator('#contextTrash').click();await page.locator('#dialogSubmit').click();await expect(page.locator('.network-card')).toHaveCount(3);await expect(page.locator('.network-edge')).toHaveCount(1);
  await page.locator(`[data-network-card="${networkId(1)}"] .network-card-open`).click();await expect(page.locator('#storyRelationships')).toContainText('nicht verfügbar');
  await page.evaluate(()=>{const t=(window as any).__test;t.docs.find((d:any)=>d.id==='2'.padStart(32,'0')).deleted=false;t.project.readOnly=true;sessionStorage.setItem('testSavedProject',JSON.stringify(t.project))});await page.reload();await page.locator('[data-view="relationships"]').click();await expect(page.locator('.network-edge')).toHaveCount(3);await expect(page.locator('#networkView [data-network-action="new"]')).toBeDisabled();await expect(page.locator('.network-move').first()).toBeDisabled();await page.locator('.network-edge').first().click();await expect(page.locator('#relationshipForm [type="submit"]')).toBeDisabled();await page.locator('#relationshipEditor [data-network-action="cancel"]').click();await page.locator('[data-network-action="in"]').click();
});
test('relationships support 200 cards and 400 edges in light and narrow dark layouts',async({page})=>{
  await networkFixture(page,200,400);await expect(page.locator('.network-card')).toHaveCount(200);await expect(page.locator('.network-edge')).toHaveCount(400);await page.screenshot({path:'artifacts/relationships-light.png'});
  await page.locator('#networkSearch').fill('Mara');await page.locator('#networkSearchResults button').click();await page.locator('#networkNeighbors').check();await page.locator('[data-action="theme"]').click();await page.setViewportSize({width:1050,height:800});await page.screenshot({path:'artifacts/relationships-dark.png'});await expect(page.locator('#networkView')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('relationships drag with mouse, cancel with Escape and discard failed position changes',async({page})=>{
  await networkFixture(page);const node=page.locator(`[data-network-card="${networkId(2)}"]`),handle=page.locator(`[data-network-move="${networkId(2)}"]`);
  const original=await node.evaluate(el=>({x:parseFloat(getComputedStyle(el).left),y:parseFloat(getComputedStyle(el).top)}));
  const drag=async()=>{await handle.scrollIntoViewIfNeeded();const r=(await handle.boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+30,r.y+r.height/2+20,{steps:3})};
  await drag();await page.keyboard.press('Escape');await page.mouse.up();await expect(node).toHaveCSS('left',original.x+'px');
  await drag();await page.mouse.up();await expect.poll(()=>page.evaluate(()=>(window as any).__test.project.settings.relationshipNetwork?.positions['2'.padStart(32,'0')]?.x??0)).toBeGreaterThan(original.x);
  const saved=await node.evaluate(el=>getComputedStyle(el).left);await page.evaluate(()=>(window as any).__test.failSettings=true);
  await handle.focus();await handle.press('ArrowRight');await handle.press('Enter');await expect(page.locator('[data-network-action="discardPositions"]')).toBeVisible();await page.locator('[data-network-action="discardPositions"]').click();await expect(node).toHaveCSS('left',saved);await page.locator('[data-view="write"]').click();await expect(page.locator('[data-view="write"]')).toHaveClass('active');
});

test('relationships preserve simultaneous card and other settings edits and reset on a project switch',async({page})=>{
  await networkFixture(page);await page.locator(`[data-network-card="${networkId(1)}"] .network-card-open`).click();
  await page.locator('#storyRelationships [data-network-action="new"]').click();await page.locator('#relationship-toId').selectOption(networkId(2));await page.locator('#relationship-label').fill('vertraut');
  await page.evaluate(()=>(window as any).__test.settingsDelay=500);await page.locator('#relationshipForm [type="submit"]').click();await expect(page.locator('#relationship-label')).toBeDisabled();
  await page.locator('#storyField-notes').fill('Gleichzeitig geänderte Kartennotiz');await page.keyboard.press('Control+s');
  await page.evaluate(()=>{const p=(window as any).__test.project;p.settings.wordTarget=12345;p.title='Neuer Projekttitel'});
  await expect(page.locator('#relationshipForm')).toHaveCount(0);await expect(page.locator('#storyField-notes')).toHaveValue('Gleichzeitig geänderte Kartennotiz');
  expect(await page.evaluate(()=>(window as any).__test.project.settings.wordTarget)).toBe(12345);expect(await page.evaluate(()=>(window as any).__test.project.title)).toBe('Neuer Projekttitel');
  await page.locator('#networkNeighbors').check();await page.locator('#networkView [data-network-action="new"]').click();await page.locator('#relationship-toId').selectOption(networkId(3));await page.locator('#relationship-label').fill('wohnt in');await page.locator('#relationshipForm [type="submit"]').click();await expect(page.locator('#relationship-label')).toBeDisabled();
  await page.evaluate(()=>{const t=(window as any).__test;t.project.id='other-project';t.project.settings={};t.docs.splice(5)});
  await expect(page.locator('#relationshipError')).toContainText('Projekt wurde gewechselt');await expect(page.locator('#relationship-label')).toHaveValue('wohnt in');
  await page.locator('#relationshipEditor [data-network-action="cancel"]').click();await page.evaluate(()=>document.querySelector<HTMLElement>('[data-action="open"]')!.click());await page.locator('[data-view="relationships"]').click();await expect(page.locator('.network-card')).toHaveCount(0);await expect(page.locator('#networkNeighbors')).not.toBeChecked();await expect(page.locator('#networkSearch')).toHaveValue('');expect(await page.evaluate(()=>(window as any).__test.project.settings.relationshipNetwork)).toBeUndefined();
});

test('relationships edit parallel connections and prevent duplicates with long names in a narrow notebook',async({page})=>{
  await networkFixture(page);await networkConnect(page,1,2,'vertraut');await networkConnect(page,1,2,'ist verwandt mit','mutual');await expect(page.locator('.network-edge')).toHaveCount(2);
  const line=await page.locator('.network-hit').first().evaluate(el=>{const path=el as unknown as SVGPathElement;for(let i=1;i<10;i++){const p=path.getPointAtLength(path.getTotalLength()*i/10).matrixTransform(path.getScreenCTM()!);if(document.elementFromPoint(p.x,p.y)===path)return {x:p.x,y:p.y}}return null});expect(line).not.toBeNull();await page.mouse.click(line!.x,line!.y);await expect(page.locator('#relationshipForm')).toBeVisible();await page.locator('#relationshipEditor [data-network-action="cancel"]').click();
  await page.locator('.network-edge').filter({hasText:'vertraut'}).click();await page.locator('#relationship-notes').fill('Vertrauen mit Einschränkungen');await page.locator('#relationshipForm [type="submit"]').click();await expect(page.locator('#relationshipForm')).toHaveCount(0);
  await page.locator('#networkView [data-network-action="new"]').click();await page.locator('#relationship-fromId').selectOption(networkId(1));await page.locator('#relationship-toId').selectOption(networkId(2));await page.locator('#relationship-label').fill(' vertraut ');await page.locator('#relationshipForm [type="submit"]').click();await expect(page.locator('#relationshipError')).toContainText('bereits');await page.locator('#relationshipEditor [data-network-action="cancel"]').click();
  await page.locator(`[data-network-card="${networkId(1)}"] .network-card-open`).click();await page.locator('#storyTitle').fill('Mara aus dem Haus am alten Hafen mit einem langen Namen');await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');await expect(page.locator('#storyRelationships')).toContainText('Mara aus dem Haus am alten Hafen mit einem langen Namen');
  await page.setViewportSize({width:1100,height:800});await page.locator('[data-network-action="fit"]').click();await page.locator('#storyRelationships').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/relationships-example-light.png'});expect(await page.locator('#notebook').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.locator('[data-action="theme"]').click();await page.screenshot({path:'artifacts/relationships-example-dark.png'});
});
