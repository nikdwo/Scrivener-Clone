import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

const root=process.cwd(),directory=path.join(root,'.work','usability-native',randomUUID()),projectFile=path.join(directory,'Testprojekt.schreibprojekt');
const application=path.join(root,'artifacts','Schreibatelier-testing-usability','app','Schreibatelier.exe');
await mkdir(directory,{recursive:true});
let saved;
async function bridge(page,action,args={}){
  return page.evaluate(({action,args})=>new Promise((resolve,reject)=>{
    const id='native-'+crypto.randomUUID(),api=window.chrome.webview;
    const cleanup=()=>{clearTimeout(timer);api.removeEventListener('message',receive)};
    const receive=event=>{if(event.data.id!==id)return;cleanup();event.data.ok?resolve(event.data.result):reject(new Error(event.data.error))};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Bridge-Zeitlimit: '+action))},20000);
    api.addEventListener('message',receive);api.postMessage({id,action,args});
  }),{action,args});
}
async function run(restart){
  const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const child=spawn(application,['--integration-test','--integration-inspect',projectFile],{cwd:directory,windowsHide:true,env:{...process.env,DOTNET_GCHeapHardLimit:'10000000',WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`},stdio:'ignore'});
  let exited=false;child.on('exit',()=>exited=true);let browser,page;const phase=restart?'restart':'first',checks=[],errors=[];
  try{
    for(let i=0;i<200&&!browser;i++){if(exited)throw new Error('Die Testanwendung wurde vorzeitig beendet.');try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:1000})}catch{await delay(100)}}
    if(!browser)throw new Error('WebView2-Testzugriff nicht erreichbar.');
    for(let i=0;i<100&&!page;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('https://app.schreibatelier.local'));if(!page)await delay(100)}
    if(!page)throw new Error('Anwendungsoberfläche nicht gefunden.');
    page.on('pageerror',error=>errors.push(error.message));await expect(page.locator('#workspace')).toBeVisible();
    await expect(page).toHaveTitle('Schreibatelier – Testversion Schreibansicht & Zeitstrahl');
    let p=await bridge(page,'state');
    if(!restart){
      await page.locator('[data-action="newFolder"]').click();await page.locator('#value').fill('Prüfkapitel');await page.locator('#value').press('Enter');await expect(page.locator('#dialog')).toBeHidden();await expect(page.locator('#documentTitle')).toHaveValue('Prüfkapitel');
      await expect(page.locator('.folder-overview')).toBeVisible();await page.locator('[data-action="folderText"]').click();await page.locator('.editor-sheet .tiptap').fill('Der eigene Ordnertext bleibt erhalten.');await page.keyboard.press('Control+s');await expect(page.locator('#saveState')).toContainText('Alle Änderungen gespeichert');
      await page.locator('[data-action="folderOverview"]').click();await page.locator('[data-action="newDocument"]').first().click();await page.locator('#value').fill('A4-Testtext');await page.locator('#value').press('Enter');await expect(page.locator('#documentTitle')).toHaveValue('A4-Testtext');
      const text='Mara blickt auf den Hafen und erzählt Jonas von ihrer Reise. '.repeat(230);await page.locator('.editor-sheet .tiptap').fill(text);await page.keyboard.press('Control+s');
      await expect(page.locator('.editor-sheet')).toHaveAttribute('data-pagination','ready',{timeout:30000});expect(Number(await page.locator('.editor-sheet').getAttribute('data-pages'))).toBeGreaterThan(2);
      await page.locator('[data-action="newFolder"]').click();await page.locator('#value').fill('Abgebrochener Ordner');await page.keyboard.press('Escape');await expect(page.locator('#tree')).not.toContainText('Abgebrochener Ordner');
      await page.locator('[data-action="newStoryFigure"]').click();await page.locator('#storyNewName').fill('Mara');await page.locator('#storyNewName').press('Enter');await expect(page.locator('#storyTitle')).toHaveValue('Mara');
      p=await bridge(page,'state');const scene=p.documents.find(d=>d.title==='A4-Testtext'),folder=p.documents.find(d=>d.title==='Prüfkapitel'),figure=p.documents.find(d=>d.title==='Mara');
      const strands=[{id:randomUUID().replaceAll('-',''),name:'Heimkehr'},{id:randomUUID().replaceAll('-',''),name:'Die Suche'}];
      await bridge(page,'settings',{projectId:p.id,title:p.title,settings:{...p.settings,timeline:{basis:'relative',strands}},baseTitle:p.title,baseSettings:p.settings});
      const d=await bridge(page,'document',{id:scene.id});d.meta.timeline={start:{day:1,time:'09:00'},end:{day:1,time:'12:00'},strandId:strands[0].id};d.meta.storyCardIds=[figure.id];await bridge(page,'save',{documents:[d]});
      await bridge(page,'create',{parent:folder.id,title:'Zweite Szene',kind:'text',meta:{timeline:{start:{day:1},end:{day:2},strandId:strands[1].id}}});
      await page.reload();await expect(page.locator('.folder-overview')).toBeVisible();await expect(page.locator(`[data-folder-entry="${scene.id}"]`)).toHaveText('A4-Testtext');
      await page.locator(`[data-folder-entry="${folder.id}"]`).click();await page.locator('[data-action="folderText"]').click();await expect(page.locator('.editor-sheet .tiptap')).toHaveText('Der eigene Ordnertext bleibt erhalten.');
      await page.locator(`[data-doc="${scene.id}"]`).click();await expect(page.locator('.editor-sheet')).toHaveAttribute('data-pagination','ready');
      await page.locator('#editorPane').evaluate(el=>el.scrollTop=700);await bridge(page,'integrationCapture',{phase:'editor'});await page.screenshot({path:path.join(root,'artifacts','usability-native-a4.png')});
      await page.locator('[data-action="theme"]').click();await page.locator('#paragraphStyle').click();await page.screenshot({path:path.join(root,'artifacts','usability-native-dropdown.png')});await page.keyboard.press('Escape');
      await expect(page.locator('#paragraphStyle option').first()).toHaveCSS('color','rgb(0, 0, 0)');await expect(page.locator('#paragraphStyle option').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
      const before=await bridge(page,'state'),body=(await bridge(page,'document',{id:scene.id})).body;
      await page.locator('[data-view="timeline"]').click();const button=page.locator(`[data-timeline-scene="${scene.id}"]`);await button.focus();await button.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');await expect(page.locator('.timeline-drag-tip')).toContainText('09:01');await page.keyboard.press('Enter');
      await expect.poll(async()=>(await bridge(page,'document',{id:scene.id})).meta.timeline.start.time).toBe('09:01');
      const grip=page.locator(`[data-timeline-event="${scene.id}"] [data-timeline-drag="end"]`);await grip.focus();await grip.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect.poll(async()=>(await bridge(page,'document',{id:scene.id})).meta.timeline.end.time).toBe('12:02');
      await button.focus();await button.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
      const rect=await button.boundingBox();await page.mouse.move(rect.x+40,rect.y+20);await page.mouse.down();await page.mouse.move(rect.x+65,rect.y+20,{steps:5});await expect(page.locator('.timeline-drag-tip')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();
      await page.locator('#timelineFilter-figure').selectOption(figure.id);await expect(page.locator('[data-timeline-scene]')).toHaveCount(1);await bridge(page,'integrationCapture',{phase:'timeline'});
      const final=await bridge(page,'document',{id:scene.id});expect(final.body).toBe(body);expect(final.meta.timeline).toEqual({start:{day:1,time:'09:01'},end:{day:1,time:'12:02'},strandId:strands[1].id});
      p=await bridge(page,'state');expect(p.documents.map(d=>[d.id,d.parentId,d.position])).toEqual(before.documents.map(d=>[d.id,d.parentId,d.position]));
      saved={scene:scene.id,folder:folder.id,body,timeline:final.meta.timeline,order:p.documents.map(d=>[d.id,d.parentId,d.position])};
      checks.push('Ordner, Text und Figur per echter Enter-Eingabe angelegt; Escape verwirft','A4-Seiten mit echtem WebView2-Editor, Ordnertext und dunkle Auswahlliste','Zeitstrahl: Verschieben, Randgriff, Bahnwechsel, Mausvorschau und Escape','SQLite speichert neue Zeiten bei unverändertem Text und unveränderter Reihenfolge');
    }else{
      const d=await bridge(page,'document',{id:saved.scene});expect(d.body).toBe(saved.body);expect(d.meta.timeline).toEqual(saved.timeline);expect(p.documents.map(d=>[d.id,d.parentId,d.position])).toEqual(saved.order);
      await page.locator(`[data-folder-entry="${saved.folder}"]`).click();await page.locator('[data-action="folderText"]').click();await expect(page.locator('.editor-sheet .tiptap')).toHaveText('Der eigene Ordnertext bleibt erhalten.');
      await page.locator(`[data-doc="${saved.scene}"]`).click();await expect(page.locator('.editor-sheet')).toHaveAttribute('data-pagination','ready',{timeout:30000});await expect(page.locator('body')).toHaveClass(/dark/);
      await page.locator('[data-view="timeline"]').click();await expect(page.locator(`[data-timeline-scene="${saved.scene}"]`)).toContainText('09:01');checks.push('Vollständiger Programmneustart: Ordnertext, Manuskripttext, Zeiten, Bahnzuordnung, Reihenfolge und Farbschema erhalten');
    }
    expect(errors).toEqual([]);
    await bridge(page,'integrationResult',{ok:true,checks}).catch(error=>{if(!page.isClosed())throw error});
    for(let i=0;i<100&&!exited;i++)await delay(100);if(!exited)throw new Error('Testanwendung beendet sich nicht.');
    const result=JSON.parse(await readFile(path.join(directory,'.work','app-test','result.json'),'utf8'));if(!result.ok)throw new Error(JSON.stringify(result));
    await writeFile(path.join(root,'artifacts',`usability-native-${phase}.json`),JSON.stringify({...result,projectFile},null,2));console.log(`PASS Native ${phase}: ${checks.join('; ')}`);
  }catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(root,'artifacts',`usability-native-${phase}-failure.png`)}).catch(()=>{});throw error}
  finally{if(browser)await browser.close().catch(()=>{});if(!exited)child.kill();}
}
await run(false);await run(true);
