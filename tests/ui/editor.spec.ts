import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const body=(text:string)=>JSON.stringify({type:'doc',content:[{type:'paragraph',content:text?[{type:'text',text}]:[]}]});
    const docs:any[]=[{id:'manuscript',title:'Manuskript',parentId:null,position:0,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'research',title:'Recherche',parentId:null,position:1,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'chapter',title:'Kapitel 1 · Ankunft',parentId:'manuscript',position:0,kind:'folder',body:body(''),meta:{},revision:0,words:0},{id:'scene',title:'Das Haus am See',parentId:'chapter',position:0,kind:'text',body:body('Der Morgen lag still über dem See. Mara blieb am Gartentor stehen. In ihrer Manteltasche lag der Schlüssel.'),meta:{synopsis:'Mara kehrt an den Ort ihrer Kindheit zurück. Ein alter Schlüssel führt sie zu einer offenen Frage.',status:'Entwurf',tags:'Mara, Heimkehr',color:'#b77d4e'},revision:0,words:21},{id:'scene2',title:'Ein unerwarteter Brief',parentId:'chapter',position:1,kind:'text',body:body('Auf dem Küchentisch lag ein Umschlag.'),meta:{synopsis:'Ein Brief verändert alles.',status:'Idee'},revision:0,words:6}];
    const project:any={id:'test',title:'Ein neuer Morgen',settings:{wordTarget:80000},documents:docs,readOnly:false,filePath:'test.schreibprojekt'};
    const listeners:Function[]=[];const snapshots:any[]=[];const clone=(x:any)=>JSON.parse(JSON.stringify(x));
    (window as any).__test={project,docs,failSave:false,saveDelay:0,snapshots};
    Object.defineProperty(window,'chrome',{configurable:true,value:{webview:{addEventListener:(_type:string,listener:Function)=>listeners.push(listener),postMessage:async({id,action,args}:any)=>{
      try{
        let result:any=null;
        if(action==='ready')result={project:clone(project),tools:{},preferences:{}};
        else if(action==='state')result=clone(project);
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
