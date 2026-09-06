import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const body=(text:string)=>JSON.stringify({type:'doc',content:[{type:'paragraph',content:text?[{type:'text',text}]:[]}]});
    const docs:any[]=[{id:'manuscript',title:'Manuskript',parentId:null,position:0,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'research',title:'Recherche',parentId:null,position:1,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'chapter',title:'Kapitel 1 · Ankunft',parentId:'manuscript',position:0,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'scene',title:'Das Haus am See',parentId:'chapter',position:0,kind:'text',body:body('Der Morgen lag still über dem See. Mara blieb am Gartentor stehen. In ihrer Manteltasche lag der Schlüssel.'),meta:{synopsis:'Mara kehrt an den Ort ihrer Kindheit zurück. Ein alter Schlüssel führt sie zu einer offenen Frage.',status:'Entwurf',tags:'Mara, Heimkehr',color:'#b77d4e'},revision:0,words:21},{id:'scene2',title:'Ein unerwarteter Brief',parentId:'chapter',position:1,kind:'text',body:body('Auf dem Küchentisch lag ein Umschlag.'),meta:{synopsis:'Ein Brief verändert alles.',status:'Idee'},revision:0,words:6}];
    const project:any={id:'test',title:'Ein neuer Morgen',settings:{wordTarget:80000},documents:docs,readOnly:false,filePath:'test.schreibprojekt'};
    const listeners:Function[]=[];const snapshots:any[]=[];const clone=(x:any)=>JSON.parse(JSON.stringify(x));
    (window as any).__test={project,docs,failSave:false,saveDelay:0,snapshots,proofDelay:0,proofCalls:[],premiumConnected:false,listeners};
    Object.defineProperty(window,'chrome',{configurable:true,value:{webview:{addEventListener:(_type:string,listener:Function)=>listeners.push(listener),postMessage:async({id,action,args}:any)=>{
      try{
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
        else if(action==='snapshots')result=clone(snapshots.filter(s=>s.documentId===args.id));
        else if(action==='settings'){project.title=args.title;project.settings=args.settings;result=clone(project)}
        else if(action==='search')result=docs.filter(d=>d.body.includes(args.query)||d.title.includes(args.query)).map(d=>({...d,excerpt:'Gefundener Text'}));
        for(const l of listeners)l({data:{id,ok:true,result}});
      }catch(e:any){for(const l of listeners)l({data:{id,ok:false,error:e.message}})}
    }}}});
  });
  await page.goto('http://127.0.0.1:4177/index.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#workspace')).toBeVisible();
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
  await page.keyboard.press('Control+End');for(let i=0;i<5;i++)await page.keyboard.press('Shift+ArrowLeft');
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
