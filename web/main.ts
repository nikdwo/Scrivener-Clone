import { Editor, Node, Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import DOMPurify from 'dompurify';
import { diffWords } from 'diff';
import { EditorState } from '@tiptap/pm/state';
import { Proofreading } from './proofreading';
import { Updates } from './updates';
import { StoryCards } from './storycards';
import { isStoryCard } from './storycards.mjs';
import { escapeHtml as h, orderedDocuments, plainText, wordCount, matchesCollection } from './logic.mjs';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const webview = (window as any).chrome?.webview;
const pending = new Map<string, {resolve: Function,reject: Function}>();
let requestId = 0;
function rpc(action: string, args: any = {}): Promise<any> {
  if (!webview) return Promise.reject(new Error('Bitte Schreibatelier.exe starten. Diese Oberfläche benötigt die Windows-Anwendung.'));
  return new Promise((resolve,reject) => { const id = String(++requestId); pending.set(id,{resolve,reject}); webview.postMessage({id,action,args}); });
}
webview?.addEventListener('message', (event: any) => {
  const m = event.data;
  if (m.type === 'command') { void perform(m.action); return; }
  if (m.type === 'updateProgress') { updates.progress(m.percent); return; }
  const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
  m.ok ? p.resolve(m.result) : p.reject(new Error(m.error));
});

let project: any = null, selected = 'manuscript', view = 'write', inspector = 'details', active: Editor | null = null;
let editors: Editor[] = [], reference: Editor | null = null, preferences: any = {}, tools: any = {}, collection: any = null;
let storageDirectory = "Windows-Benutzerprofil / AppData / Local / Schreibatelier";
let combined = false, combinedLimit = 30, referenceId: string | null = null, saveTimer: any, searchTimer: any, saving: Promise<void> | null = null, serial = 0, sessionStart = 0;
let selectionRequest = 0, renderRequest = 0;
const cache = new Map<string,any>(), dirty = new Map<string,number>(), collapsed = new Set<string>();
const emptyBody = JSON.stringify({type:'doc',content:[{type:'paragraph'}]});
const proofreading=new Proofreading({rpc,project:()=>project,editor:()=>active,saveSettings:saveProjectSettings,modal});
const updates=new Updates(rpc,flush,async enabled=>{const previous=preferences.checkUpdatesAtStartup;preferences.checkUpdatesAtStartup=enabled;try{await rpc('preferences',preferences)}catch(e){preferences.checkUpdatesAtStartup=previous;throw e}});
const storyCards=new StoryCards({rpc,project:()=>project,scene:current,editor:()=>active,getDoc,changed,flush,refresh,modal,select,trash:trashDocument,saveSettings:saveProjectSettings,
  show:()=>{inspector='cards';document.body.classList.add('inspector-visible');renderInspector()},error:message=>toast(message,true)});

function toast(text: string, error = false) { $('toast').textContent=text; $('toast').classList.remove('hidden'); $('toast').classList.toggle('error',error); if (!error) setTimeout(()=>{$('toast').classList.add('hidden')},5000); }
function state(text: string, error = false) { $('saveState').textContent=text; $('saveState').classList.toggle('error',error); }
function inspectorMaxWidth() {
  const style=getComputedStyle($('workspace'));
  return Math.max(230,window.innerWidth-parseFloat(style.getPropertyValue('--sidebar-width'))-parseFloat(style.getPropertyValue('--editor-min-width')));
}
function updateInspectorSize(width?:number) {
  if(width!==undefined)$('workspace').style.setProperty('--inspector-width',`${Math.max(230,Math.min(inspectorMaxWidth(),width))}px`);
  const handle=$('inspectorResize');
  handle.setAttribute('aria-valuemax',String(inspectorMaxWidth()));
  const actualWidth=$('notebook').getBoundingClientRect().width;
  if(actualWidth)handle.setAttribute('aria-valuenow',String(Math.round(actualWidth)));
}
function saveInspectorSize() {
  preferences.inspectorWidth=Math.round($('notebook').getBoundingClientRect().width);
  void rpc('preferences',preferences).catch(e=>toast(e.message,true));
}
const inspectorResize=$('inspectorResize');
inspectorResize.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary)return;
  event.preventDefault();inspectorResize.focus();inspectorResize.setPointerCapture(event.pointerId);
  const startX=event.clientX,startWidth=$('notebook').getBoundingClientRect().width;
  document.body.classList.add('resizing-inspector');
  const move=(e:PointerEvent)=>updateInspectorSize(startWidth+startX-e.clientX);
  const stop=()=>{
    inspectorResize.removeEventListener('pointermove',move);
    document.body.classList.remove('resizing-inspector');saveInspectorSize();
  };
  inspectorResize.addEventListener('pointermove',move);
  inspectorResize.addEventListener('lostpointercapture',stop,{once:true});
});
inspectorResize.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const width=$('notebook').getBoundingClientRect().width;
  updateInspectorSize(event.key==='Home'?230:event.key==='End'?inspectorMaxWidth():width+(event.key==='ArrowLeft'?10:-10));
  saveInspectorSize();
});
new ResizeObserver(()=>updateInspectorSize()).observe($('notebook'));
window.addEventListener('resize',()=>updateInspectorSize());
function info(id = selected) { return project?.documents.find((d:any)=>d.id===id); }
function current() { return cache.get(selected); }
function parentForNew() { const d=info(); return d && !d.deleted && d.kind!=='asset' ? d.id : 'manuscript'; }
function aggregate() { return project ? orderedDocuments(project.documents,'manuscript',true).reduce((n:number,d:any)=>n+d.words,0) : 0; }
function updateStats() {
  if (!project) return;
  const d=current(); const text=d?.body ? plainText(d.body) : ''; const count=wordCount(text);
  $('wordCount').textContent=`${count.toLocaleString('de-DE')} Wörter · ${[...text].length.toLocaleString('de-DE')} Zeichen`;
  $('sessionCount').textContent=`Sitzung: ${aggregate()-sessionStart >= 0 ? '+' : ''}${(aggregate()-sessionStart).toLocaleString('de-DE')}${project.settings.sessionTarget?' / '+Number(project.settings.sessionTarget).toLocaleString('de-DE'):''}`;
  const target=Number(project.settings.wordTarget ?? 0); $('goalLabel').textContent=target ? `${aggregate().toLocaleString('de-DE')} / ${target.toLocaleString('de-DE')} Wörter` : 'Schreibziel setzen';
}
function setDocument(d:any) { const live=cache.get(d.id);if(live&&live!==d)Object.assign(live,d);else cache.set(d.id,d);const old=info(d.id); if(old) Object.assign(old,{...d,body:undefined}); else project.documents.push({...d,body:undefined}); }
function changed(d:any) {
  if(project.readOnly) return;
  d.words=wordCount(plainText(d.body ?? emptyBody)); setDocument(d); dirty.set(d.id,++serial);
  if(isStoryCard(d)){storyCards.invalidate();proofreading.cardsChanged()}
  state('Ungespeicherte Änderungen'); clearTimeout(saveTimer); saveTimer=setTimeout(()=>flush().catch(()=>{}),1000); updateStats();
}
async function flush():Promise<void> {
  clearTimeout(saveTimer);
  if(saving) { await saving; if(dirty.size) return flush(); return; }
  if(!dirty.size) return;
  const versions=new Map(dirty); const docs=[...versions.keys()].map(id=>JSON.parse(JSON.stringify(cache.get(id))));
  state('Wird gespeichert …');
  saving=(async()=>{
    try {
      const saved=await rpc('save',{documents:docs});
      for(const d of saved) { const live=cache.get(d.id); if(dirty.get(d.id)===versions.get(d.id)) { dirty.delete(d.id); setDocument(d); } else if(live) { live.revision=d.revision; setDocument(live); } }
      state(dirty.size ? 'Ungespeicherte Änderungen' : '✓ Alle Änderungen gespeichert'); renderTree(); updateStats();
    } catch(e:any) { state('Speichern fehlgeschlagen',true); toast(e.message+' Deine Eingabe bleibt im Editor.',true); throw e; }
  })();
  try { await saving; } finally { saving=null; }
}
setInterval(()=>{ if(dirty.size) void flush().catch(()=>{}); },5000);
async function getDoc(id:string) { if(!cache.has(id)) { const owner=project; const d=await rpc('document',{id});if(owner!==project)throw new Error('Das Projekt hat sich während des Ladens geändert.');cache.set(id,d); } return cache.get(id); }
async function refresh(next?:any) { await flush(); project=next ?? await rpc('state'); for(const d of project.documents) { const cached=cache.get(d.id); if(cached && cached.revision!==d.revision) cache.delete(d.id); } renderTree(); renderCollections(); updateStats(); storyCards.invalidate(); proofreading.cardsChanged(); }
function renderRecentProjects(entries:{title:string,filePath:string}[]=[]) {
  $('recentProjects').innerHTML=entries.slice(0,3).map(p=>`<li><button type="button" data-recent-project="${h(p.filePath)}" title="${h(p.filePath)}"><span>${h(p.title||p.filePath.split(/[\\/]/).pop())}</span><small>${h(p.filePath)}</small></button></li>`).join('');
  $('recentProjectsEmpty').classList.toggle('hidden',entries.length>0);
}
async function adopt(next:any) { if(!next) return; $('documentContextMenu').hidePopover(); destroyEditors(); storyCards.reset(); project=next; cache.clear(); dirty.clear(); selected='manuscript'; collection=null; sessionStart=aggregate(); $('welcome').classList.add('hidden'); $('workspace').classList.remove('hidden'); $('projectLabel').textContent=project.title; state(project.readOnly ? 'Schreibgeschützt' : '✓ Lokal gespeichert'); renderCollections(); await select(selected); }

function renderTree() {
  if(!project) return;
  const children=new Map<string,any[]>(); for(const d of project.documents) if(!d.deleted) { const key=isStoryCard(d)?'story-'+d.meta.storyCard.type:d.parentId ?? ''; const list=children.get(key) ?? []; list.push(d); children.set(key,list); }
  let html='';
  function render(parent:string,depth:number) { for(const d of (children.get(parent) ?? []).sort((a,b)=>a.position-b.position)) { const root=!d.parentId, has=(children.get(d.id)?.length ?? 0)>0;
    if(root)html+=`<section data-tree-root="${h(d.id)}" aria-label="${h(d.title)}">`;
    html+=`<div class="tree-row ${d.id===selected?'selected':''} ${root?'root':''}" data-doc="${h(d.id)}" draggable="${!root&&!isStoryCard(d)&&!project.readOnly}" tabindex="0" role="button" aria-label="${h(d.title)}" style="padding-left:${depth*14+3}px"><button class="tree-toggle" data-collapse="${h(d.id)}" aria-label="${collapsed.has(d.id)?'Aufklappen':'Zuklappen'}">${has?(collapsed.has(d.id)?'▸':'▾'):''}</button><span class="row-icon">${d.kind==='folder'?'▱':d.kind==='asset'?'◇':'≡'}</span><span class="row-label">${h(d.title)}</span>${d.words?`<span class="tree-words">${d.words}</span>`:''}</div>`;
    if(!collapsed.has(d.id)) render(d.id,depth+1);
    if(root)html+='</section>';
  }} render('',0);
  html+='<section class="tree-story-cards" aria-label="Figuren, Orte & Gegenstände"><h3>Figuren, Orte &amp; Gegenstände</h3>';
  for(const [type,title,create,action] of [['figure','Figuren','Figur anlegen','newStoryFigure'],['place','Orte','Ort anlegen','newStoryPlace'],['item','Gegenstände','Gegenstand anlegen','newStoryItem']]) {
    const id='story-'+type, count=children.get(id)?.length??0;
    html+=`<details data-story-group="${id}" ${collapsed.has(id)?'':'open'}><summary>${title} <span class="tree-words">${count}</span></summary>`;
    render(id,1);
    html+=`<button class="tree-create-card" data-action="${action}" ${project.readOnly?'disabled':''}>＋ ${create}</button></details>`;
  }
  $('tree').innerHTML=html+'</section>';
  $('trashCount').textContent=String(project.documents.filter((d:any)=>d.deleted).length);
}
$('tree').addEventListener('toggle',event=>{const group=event.target as HTMLDetailsElement,id=group.dataset.storyGroup;if(id)group.open?collapsed.delete(id):collapsed.add(id)},true);
function renderCollections() { $('collectionList').innerHTML=(project?.settings.collections ?? []).map((c:any,i:number)=>`<button class="collection-item ${collection===c?'active':''}" data-collection="${i}">◌ ${h(c.title)}</button>`).join(''); }
function destroyEditors() { proofreading.reset();editors.forEach(e=>e.destroy()); editors=[]; active=null; }
function extensions(documentId:string) {
  const Footnote=Node.create({name:'footnote',group:'inline',inline:true,atom:true,addAttributes(){return{id:{default:null},text:{default:''}}},parseHTML(){return[{tag:'span[data-footnote]'}]},renderHTML({HTMLAttributes}){return['span',mergeAttributes(HTMLAttributes,{'data-footnote':HTMLAttributes.id,'data-note':HTMLAttributes.text,class:'footnote',title:HTMLAttributes.text,contenteditable:'false'}),'']}});
  const Comment=Mark.create({name:'comment',inclusive:false,addAttributes(){return{id:{default:null},text:{default:''}}},parseHTML(){return[{tag:'span[data-comment]'}]},renderHTML({HTMLAttributes}){return['span',mergeAttributes(HTMLAttributes,{'data-comment':HTMLAttributes.id,'data-note':HTMLAttributes.text,class:'comment',title:HTMLAttributes.text}),0]}});
  const Script=Node.create({name:'script',group:'block',content:'inline*',addAttributes(){return{element:{default:'action'}}},parseHTML(){return[{tag:'p[data-element]'}]},renderHTML({HTMLAttributes}){return['p',{'data-element':HTMLAttributes.element},0]}});
  return [StarterKit.configure({link:{openOnClick:false,autolink:false}}),Image.configure({allowBase64:false}),TableKit.configure({table:{resizable:true}}),Highlight.configure({multicolor:true}),TextStyleKit,TextAlign.configure({types:['heading','paragraph']}),Subscript,Superscript,Footnote,Comment,Script,proofreading.extension,storyCards.extension(documentId)];
}
function makeEditor(element:HTMLElement,d:any,editable=true) {
  const editor=new Editor({element,extensions:extensions(d.id),content:JSON.parse(d.body ?? emptyBody),editable:editable&&!project.readOnly,
    editorProps:{attributes:{'aria-label':`Text: ${d.title}`,spellcheck:'true',lang:project.settings.proofLanguage??'de-DE'},transformPastedHTML:html=>DOMPurify.sanitize(html,{FORBID_TAGS:['img','iframe','script','style','object','embed'],FORBID_ATTR:['style','onerror','onclick']}),
      handleDOMEvents:{drop:(_view,event)=>{if((event as DragEvent).dataTransfer?.files.length){event.preventDefault();toast('Bilder bitte über „Bild“ importieren.');return true}return false}}},
    onUpdate:({editor})=>{d.body=JSON.stringify(editor.getJSON());changed(d);proofreading.changed(editor)},
    onFocus:()=>{if(editable){active=editor;proofreading.activated(editor);if(selected!==d.id){selected=d.id;$<HTMLInputElement>('documentTitle').value=d.title;renderTree();renderInspector()} }},
    onSelectionUpdate:()=>{if(editable){active=editor;proofreading.selectionChanged(editor)}updateFormatButtons()},
  });
  return editor;
}
async function select(id:string) {
  if(isStoryCard(info(id))&&!info(id).deleted){await storyCards.open(id);return}
  const request=++selectionRequest;await flush();const d=await getDoc(id);if(request!==selectionRequest)return;selected=id;collection=null;if(view==='trash')view='write';renderTree();
  $<HTMLInputElement>('documentTitle').value=d.title; $<HTMLInputElement>('documentTitle').disabled=project.readOnly||d.deleted;
  const ancestry=[]; let p=info(id); while(p){ancestry.unshift(p.title);p=info(p.parentId)} $('breadcrumb').textContent=ancestry.join(' / ');
  $('documentStatus').textContent=d.meta.status ?? 'Entwurf'; await renderView(); renderInspector(); updateStats();
}
function displayDocs() { if(collection) return project.documents.filter((d:any)=>!d.deleted&&matchesCollection(d,collection)); return orderedDocuments(project.documents.filter((d:any)=>!isStoryCard(d)),selected,false); }
async function renderView() {
  const request=++renderRequest;
  destroyEditors(); const pane=$('editorPane'); pane.innerHTML='';
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.view===view)); $('formatbar').classList.toggle('hidden',view!=='write');
  const d=await getDoc(selected);
  if(request!==renderRequest)return;
  if(d.deleted) { pane.innerHTML=`<div class="empty-state"><h2>Im Papierkorb</h2><p>Dieser Abschnitt bleibt gespeichert und kann wiederhergestellt werden.</p><button data-action="restoreDocument">Wiederherstellen</button></div>`; return; }
  if(collection || view==='board') { renderBoard(); return; }
  if(view==='outline') { renderOutline(); return; }
  if(d.kind==='asset') { renderAsset(pane,d); return; }
  const sheet=document.createElement('div'); sheet.className='editor-sheet'; pane.append(sheet);
  const list=combined ? orderedDocuments(project.documents.filter((d:any)=>!isStoryCard(d)),selected,true).filter((d:any)=>d.kind!=='asset') : [d];
  // Only requested sections are materialized, not the entire project.
  for(const item of list.slice(0,combinedLimit)) {
    const doc=await getDoc(item.id);if(request!==renderRequest)return; if(combined){const label=document.createElement('div');label.className='section-label';label.textContent=doc.title;sheet.append(label)}
    const el=document.createElement('div'); sheet.append(el); const editor=makeEditor(el,doc); editors.push(editor); if(item.id===selected)active=editor;
  }
  if(list.length>combinedLimit){const button=document.createElement('button');button.dataset.action='moreSections';button.textContent=`Weitere Abschnitte laden (${combinedLimit} von ${list.length})`;sheet.append(button)}
  if(!active) active=editors[0] ?? null; await renderReference();
}
function renderAsset(target:HTMLElement,d:any) {
  const id=d.meta.assetId, mime=d.meta.mime??'', src=`https://assets.schreibatelier.local/${encodeURIComponent(id)}`;
  let media=mime.startsWith('image/')?`<img class="asset-preview" src="${src}" alt="${h(d.title)}">`:mime.startsWith('audio/')?`<audio controls class="asset-preview" src="${src}"></audio>`:mime.startsWith('video/')?`<video controls class="asset-preview" src="${src}"></video>`:mime==='application/pdf'||mime==='text/html'?`<iframe title="${h(d.title)}" class="asset-frame" ${mime==='text/html'?'sandbox':''} src="${src}"></iframe>`:`<div class="empty-state">Für diesen Dateityp ist keine Vorschau verfügbar.</div>`;
  target.innerHTML=`<div class="board-toolbar"><span class="muted">${h(mime)}</span><button data-asset-download="${h(id)}">Original speichern …</button></div>${media}`;
}
function renderBoard() {
  const docs=displayDocs(); const free=!!project.settings.freeBoard;
  $('editorPane').innerHTML=`<div class="board-toolbar"><span class="muted">${docs.length} Karten · Doppelklick öffnet den Text</span><button data-action="toggleFreeBoard">${free?'Geordnet anordnen':'Freie Anordnung'}</button></div><div class="${free?'free-board':'card-grid'}">${docs.map((d:any,i:number)=>`<article class="board-card" tabindex="0" role="button" data-card="${h(d.id)}" draggable="${!free&&!project.readOnly}" style="border-top-color:${/^#[0-9a-f]{6}$/i.test(d.meta.color??'')?d.meta.color:'var(--warm)'};${free?`left:${Number(d.meta.cardX ?? (i%3)*225)}px;top:${Number(d.meta.cardY ?? Math.floor(i/3)*215)}px`:''}"><div class="eyebrow">${d.kind==='folder'?'KAPITEL':d.kind==='asset'?'RECHERCHE':'ABSCHNITT'} ${String(i+1).padStart(2,'0')}</div><h3>${h(d.title)}</h3><p>${h(d.meta.synopsis||'Raum für eine kurze Zusammenfassung …')}</p><div class="card-footer"><span>${h(d.meta.status||'Entwurf')}</span><span>${d.words} Wörter</span></div></article>`).join('')}</div>${docs.length?'':`<div class="empty-state"><h2>Platz für deine Ideen.</h2><p>Lege unter diesem Abschnitt Texte oder Ordner an. Hier werden daraus Karten.</p><button data-action="newDocument">Ersten Abschnitt anlegen</button></div>`}`;
  if(free) document.querySelectorAll<HTMLElement>('[data-card]').forEach(card=>{
    card.addEventListener('pointerdown',event=>{if(project.readOnly)return;const startX=event.clientX,startY=event.clientY,left=parseInt(card.style.left),top=parseInt(card.style.top);card.setPointerCapture(event.pointerId);let moved=false;
      const move=(e:PointerEvent)=>{moved=true;card.style.left=Math.max(0,left+e.clientX-startX)+'px';card.style.top=Math.max(0,top+e.clientY-startY)+'px'};
      const up=async()=>{card.removeEventListener('pointermove',move);card.removeEventListener('pointerup',up);if(moved){const d=await getDoc(card.dataset.card!);d.meta.cardX=parseInt(card.style.left);d.meta.cardY=parseInt(card.style.top);changed(d)}};
      card.addEventListener('pointermove',move);card.addEventListener('pointerup',up);
    });
  });
}
function renderOutline() {
  const docs=displayDocs(); $('editorPane').innerHTML=`<table class="outline-table"><thead><tr><th>Titel</th><th>Status</th><th>Zusammenfassung</th><th>Wörter</th><th>Ziel</th></tr></thead><tbody>${docs.map((d:any)=>`<tr tabindex="0" role="button" data-outline="${h(d.id)}"><td>${h(d.title)}</td><td><span class="status-pill">${h(d.meta.status||'Entwurf')}</span></td><td class="muted">${h((d.meta.synopsis??'').slice(0,90))}</td><td>${d.words}</td><td>${d.meta.target||'—'}</td></tr>`).join('')}</tbody></table>`;
}
async function renderReference() {
  reference?.destroy();reference=null; $('referencePane').classList.toggle('hidden',!referenceId);if(!referenceId)return;
  const d=await getDoc(referenceId); const pane=$('referencePane'); pane.innerHTML=`<div class="reference-head"><select id="referenceSelect" aria-label="Referenzabschnitt">${project.documents.filter((x:any)=>!x.deleted).map((x:any)=>`<option value="${h(x.id)}" ${x.id===referenceId?'selected':''}>${h(x.title)}</option>`).join('')}</select><button data-action="splitView" aria-label="Zweite Ansicht schließen">×</button></div><p class="muted">Leseansicht · zum Bearbeiten im Projektbaum öffnen</p><div id="referenceContent"></div>`;
  if(d.kind==='asset')renderAsset($('referenceContent'),d);else reference=makeEditor($('referenceContent'),d,false);
  $('referenceSelect').addEventListener('change',()=>{referenceId=$<HTMLSelectElement>('referenceSelect').value;void renderReference()});
}
function field(label:string,name:string,value:any='',type='text') { return `<div class="field"><label for="${name}">${h(label)}</label><input id="${name}" name="${name}" type="${type}" ${type==='number'?'step="any"':''} value="${h(value)}"></div>`; }
function area(label:string,name:string,value:any='') { return `<div class="field"><label for="${name}">${h(label)}</label><textarea id="${name}" name="${name}">${h(value)}</textarea></div>`; }
function renderInspector() {
  const d=current();if(!d)return;
  document.querySelectorAll<HTMLElement>('[data-inspector]').forEach(el=>el.classList.toggle('active',el.dataset.inspector===inspector));
  const target=$('inspectorContent');
  target.classList.toggle('hidden',inspector==='proof'||inspector==='cards');$('proofPanel').classList.toggle('hidden',inspector!=='proof');$('storyCardsPanel').classList.toggle('hidden',inspector!=='cards');
  if(inspector==='cards'){storyCards.show();return}
  if(inspector==='proof'){proofreading.show();return}
  if(inspector==='details') {
    target.innerHTML=area('Zusammenfassung','metaSynopsis',d.meta.synopsis)+`<div class="field-row"><div class="field"><label for="metaStatus">Status</label><select id="metaStatus">${['Idee','Entwurf','Überarbeitung','Fertig'].map(x=>`<option ${x===(d.meta.status||'Entwurf')?'selected':''}>${x}</option>`).join('')}</select></div>${field('Farbe','metaColor',d.meta.color||'#b77d4e','color')}</div>`+field('Schlagwörter','metaTags',d.meta.tags)+field('Wortziel','metaTarget',d.meta.target||'','number')+`<div class="field"><label>Eigene Metadaten</label><div id="customMeta">${Object.entries(d.meta.custom??{}).map(([k,v])=>`<div class="muted"><b>${h(k)}:</b> ${h(v)}</div>`).join('')}</div><button data-action="customMeta">Feld bearbeiten</button></div><div class="meta-stats"><div><small>Wörter</small><strong>${d.words}</strong></div><div><small>Zeichen</small><strong>${[...plainText(d.body??emptyBody)].length}</strong></div></div>`;
    for(const [id,key] of [['metaSynopsis','synopsis'],['metaStatus','status'],['metaColor','color'],['metaTags','tags'],['metaTarget','target']]) { const el=$(id) as HTMLInputElement;el.disabled=project.readOnly;el.addEventListener('input',()=>{d.meta[key]=key==='target'?Math.max(0,Number(el.value)):el.value;changed(d)}) }
  } else if(inspector==='notes') {
    target.innerHTML=area('Notizen zu diesem Abschnitt','metaNotes',d.meta.notes)+`<div class="field"><label>Kommentare & Fußnoten</label><div class="comment-list" id="commentList"></div></div>`;
    $<HTMLTextAreaElement>('metaNotes').disabled=project.readOnly;$('metaNotes').addEventListener('input',()=>{d.meta.notes=$<HTMLTextAreaElement>('metaNotes').value;changed(d)});
    const found:any[]=[];function walk(n:any){if(n.type==='footnote')found.push({kind:'Fußnote',...n.attrs});for(const m of n.marks??[])if(m.type==='comment'&&!found.some(f=>f.id===m.attrs.id))found.push({kind:'Kommentar',...m.attrs});for(const c of n.content??[])walk(c)}walk(JSON.parse(d.body??emptyBody));
    $('commentList').innerHTML=found.length?found.map(n=>`<button data-note-id="${h(n.id)}">${n.kind}: ${h(n.text)}</button>`).join(''):'<p class="muted">Hier erscheinen deine Textanmerkungen. Doppelklick im Text öffnet eine Anmerkung.</p>';
  } else {
    target.innerHTML=`<button class="primary" data-action="snapshot">Textstand sichern</button><p class="muted">Ein Textstand bewahrt Text und Notizen dieses Abschnitts. Projektsicherungen enthalten zusätzlich die gesamte Struktur und Recherche.</p><div id="snapshotList"></div>`;
    void rpc('snapshots',{id:selected}).then(list=>{if(inspector!=='snapshots')return;$('snapshotList').innerHTML=list.map((s:any)=>`<div class="snapshot"><strong>${h(s.title)}</strong><small>${new Date(s.created).toLocaleString('de-DE')}</small><div><button data-compare="${h(s.id)}">Vergleichen</button> <button data-restore-snapshot="${h(s.id)}">Wiederherstellen</button></div></div>`).join('')});
  }
}

async function modal(title:string,body:string,button='Übernehmen'):Promise<FormData|null> {
  const dialog=$<HTMLDialogElement>('dialog');if(dialog.open)await new Promise<void>(resolve=>{dialog.addEventListener('close',()=>resolve(),{once:true});dialog.close('cancel')});$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;$('dialogSubmit').textContent=button;
  document.querySelector('.dialog-actions [value="cancel"]')!.classList.toggle('hidden',button==='Schließen');dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'?new FormData($<HTMLFormElement>('dialogForm')):null),{once:true}));
}
async function textPrompt(title:string,label:string,value='',multiline=false) {const data=await modal(title,multiline?area(label,'value',value):field(label,'value',value));return data?String(data.get('value')):null}
async function requireWrite() { if(!project)throw new Error('Bitte zuerst ein Projekt öffnen.');if(project.readOnly)throw new Error('Dieses Projekt ist schreibgeschützt.');await flush(); }
async function addDocument(kind='text',template?:string) {
  await requireWrite();const name=await textPrompt(kind==='folder'?'Ordner anlegen':'Neuer Abschnitt','Titel',kind==='folder'?'Neues Kapitel':'Neuer Abschnitt');if(!name?.trim())return;
  const body=template ? JSON.stringify({type:'doc',content:template.split('\n').map(text=>({type:'paragraph',content:text?[{type:'text',text}]:[]}))}) : undefined;
  const d=await rpc('create',{parent:parentForNew(),title:name,kind,body});await refresh();setDocument(d);view='write';await select(d.id);
}
async function moveDocument(id:string,parent:string,index:number) {await requireWrite();await refresh(await rpc('move',{id,parent,index}));await renderView()}
async function trashDocument(id:string,owner=project?.id) {
  await requireWrite();
  if(project.id!==owner)throw new Error('Das Projekt hat sich geändert. Bitte den Eintrag erneut auswählen.');
  const d=info(id);if(!d||d.deleted)throw new Error('Der Eintrag ist nicht mehr verfügbar.');
  if(!d.parentId)throw new Error('Die festen Projektbereiche bleiben erhalten.');
  const affected=orderedDocuments(project.documents,id,true);
  if(!await modal('In den Papierkorb verschieben?',`<p>„${h(d.title)}“${affected.length>1?' und die '+(affected.length-1)+' Untereinträge bleiben':' bleibt'} im Papierkorb wiederherstellbar.</p>${isStoryCard(d)?'<p>Szenenzuordnungen bleiben erhalten.</p>':''}`,'In den Papierkorb'))return;
  if(project.id!==owner)throw new Error('Das Projekt hat sich geändert. Bitte den Eintrag erneut auswählen.');
  await requireWrite();if(project.id!==owner)throw new Error('Das Projekt hat sich geändert. Bitte den Eintrag erneut auswählen.');await refresh(await rpc('trash',{id,deleted:true}));
  if(referenceId&&info(referenceId)?.deleted){referenceId=null;await renderReference()}
  if(info(selected)?.deleted){
    let parent=d.parentId;while(info(parent)?.deleted||isStoryCard(info(parent)))parent=info(parent).parentId??'manuscript';
    await select(parent);
  }else if(view==='trash')await actions.showTrash();
  else if(view==='board'||view==='outline'||collection||(combined&&affected.some((d:any)=>!isStoryCard(d))))await renderView();
  renderInspector();toast(`„${d.title}“ wurde in den Papierkorb verschoben.`);
}
async function restoreDocument(id:string) {
  await requireWrite();await refresh(await rpc('trash',{id,deleted:false}));
  if(view==='trash'){await actions.showTrash();renderInspector()}else await select(id);
  toast('Eintrag wiederhergestellt.');
}
async function saveProjectSettings() {
  const owner=project.id,title=project.title,settings=JSON.parse(JSON.stringify(project.settings));await flush();
  if(project?.id!==owner)throw new Error('Das Projekt wurde gewechselt. Die Einstellungen wurden nicht übernommen.');
  const next=await rpc('settings',{projectId:owner,title,settings});if(project?.id===owner)await refresh(next);
}
function updateFormatButtons() {document.querySelectorAll<HTMLElement>('[data-format]').forEach(b=>b.classList.toggle('active',!!active?.isActive(b.dataset.format!)))}
async function setView(next:string) {await flush();view=next;await renderView()}

function findHits(doc:any,query:string) {
  const hits:{from:number,to:number}[]=[];
  doc.descendants((node:any,pos:number)=>{if(!node.isTextblock)return;const text=node.textBetween(0,node.content.size,'\n','\uFFFC');let at=0;while((at=text.indexOf(query,at))>=0){hits.push({from:pos+1+at,to:pos+1+at+query.length});at+=query.length}return false});
  return hits;
}
function replaceHits(state:any,hits:{from:number,to:number}[],replacement:string) {const tr=state.tr;for(const hit of [...hits].reverse())replacement?tr.insertText(replacement,hit.from,hit.to):tr.delete(hit.from,hit.to);return tr}
async function editNote(id:string) {
  if(!active)return;await requireWrite();const ed=active;let found:any;
  ed.state.doc.descendants((node,pos)=>{if(node.type.name==='footnote'&&node.attrs.id===id)found={kind:'Fußnote',text:node.attrs.text,pos};for(const mark of node.marks)if(mark.type.name==='comment'&&mark.attrs.id===id)found??={kind:'Kommentar',text:mark.attrs.text,pos}});
  if(!found)return;ed.commands.setTextSelection(found.pos);ed.commands.scrollIntoView();
  const form=await modal(found.kind+' bearbeiten',area('Text','noteText',found.text)+`<label class="form-check"><input name="remove" type="checkbox"> Anmerkung entfernen (Haupttext bleibt erhalten)</label>`);if(!form)return;
  const tr=ed.state.tr;const positions:any[]=[];ed.state.doc.descendants((node,pos)=>{if(node.type.name==='footnote'&&node.attrs.id===id)positions.push({node,pos});for(const mark of node.marks)if(mark.type.name==='comment'&&mark.attrs.id===id)positions.push({node,pos,mark})});
  for(const {node,pos,mark} of positions.reverse()){if(mark){tr.removeMark(pos,pos+node.nodeSize,mark);if(!form.has('remove'))tr.addMark(pos,pos+node.nodeSize,mark.type.create({...mark.attrs,text:String(form.get('noteText'))}))}else if(form.has('remove'))tr.delete(pos,pos+node.nodeSize);else tr.setNodeMarkup(pos,undefined,{...node.attrs,text:String(form.get('noteText'))})}
  ed.view.dispatch(tr);renderInspector();
}

async function output(preview=false) {
  await flush();if(!project)return;const defaults=project.settings.exportProfile??{};
  const descendants=orderedDocuments(project.documents,'manuscript',true).filter((d:any)=>d.kind!=='asset');
  const form=await modal(preview?'Druckvorschau erstellen':'Manuskript ausgeben',`<div class="field-row">${field('Titel','title',defaults.title||project.title)}${field('Autor/in','author',defaults.author||'')}</div><div class="field-row"><div class="field"><label for="format">Format</label><select id="format" name="format">${(preview?['pdf']:['docx','pdf','epub','rtf','odt','txt','md','html','opml','latex','fountain']).map(f=>`<option value="${f}" ${f===(defaults.format||'docx')?'selected':''}>${f.toUpperCase()}</option>`).join('')}</select></div><div class="field"><label for="paper">Papier</label><select name="paper" id="paper">${["a4","a5","letter"].map(p=>`<option value="${p}" ${p===(defaults.paper??"a4")?"selected":""}>${p.toUpperCase()}</option>`).join("")}</select></div>${field('Schriftgröße','fontSize',defaults.fontSize||11,'number')}</div><label class="form-check"><input type="checkbox" name="titles" ${defaults.includeTitles!==false?'checked':''}> Abschnittstitel ausgeben</label><label class="form-check"><input type="checkbox" name="toc" ${defaults.tableOfContents!==false?'checked':''}> Inhaltsverzeichnis erzeugen</label><label class="form-check"><input type="checkbox" name="comments" ${defaults.includeComments?'checked':''}> Kommentare als Anhang ausgeben</label><label class="form-check"><input type="checkbox" name="endnotes" ${defaults.endnotes?'checked':''}> Fußnoten gesammelt als Endnoten ausgeben</label><div class="field"><label>Abschnitte in Manuskriptreihenfolge</label><div class="dialog-body-scroll" style="max-height:180px">${descendants.map((d:any)=>`<label class="form-check"><input type="checkbox" name="docs" value="${h(d.id)}" ${d.meta.includeExport!==false?'checked':''}> ${h(d.title)} <span class="muted">${d.words} Wörter</span></label>`).join('')}</div></div><p class="muted">Die PDF-Vorschau verwendet dieselbe Satzpipeline wie der PDF-Export. Kommentare werden auf Wunsch in einem eigenen Anhang ausgegeben. In TXT und Fountain bleiben nur Textinhalte.</p>`,preview?'Vorschau öffnen':'Exportieren');
  if(!form)return;
  const options={format:String(form.get('format')),title:String(form.get('title')),author:String(form.get('author')),documentIds:form.getAll('docs'),includeComments:form.has('comments'),endnotes:form.has('endnotes'),includeTitles:form.has('titles'),tableOfContents:form.has('toc'),paper:String(form.get('paper')),fontSize:Number(form.get('fontSize')),font:'Libertinus Serif',separator:'* * *'};
  if(!options.documentIds.length)throw new Error('Bitte mindestens einen Abschnitt auswählen.');
  if(!project.readOnly){project.settings.exportProfile=options;await saveProjectSettings()}
  toast('Die Ausgabe wird erstellt …');const result=await rpc(preview?'preview':'export',{options});if(result){toast(preview?'PDF-Vorschau geöffnet.':`Export gespeichert: ${result.path}`);if(result.warnings?.length)await modal('Hinweise zur Ausgabe',result.warnings.map((w:string)=>`<p>${h(w)}</p>`).join(''),'Schließen')}
}

const actions:Record<string,()=>any>={
  updates:()=>updates.check(),
  new:async()=>{await flush();await adopt(await rpc('new'))},open:async()=>{await flush();await adopt(await rpc('open'))},save:async()=>{await flush();toast('Alle Änderungen sind gespeichert.')},
  moreSections:async()=>{await flush();combinedLimit+=30;await renderView()},
  inspectorToggle:()=>document.body.classList.toggle('inspector-visible'),
  proof:()=>{inspector='proof';document.body.classList.add('inspector-visible');renderInspector()},
  saveCopy:async()=>{await flush();const path=await rpc('saveCopy');if(path)toast('Projektkopie gespeichert: '+path)},
  restoreBackup:async()=>{await flush();await adopt(await rpc('restoreBackup'))},backup:async()=>{await flush();toast('Sicherung erstellt: '+await rpc('backup'))},
  close:async()=>{await flush();await rpc('close')},newDocument:()=>addDocument(),newFolder:()=>addDocument('folder'),
  write:()=>setView('write'),board:()=>setView('board'),outline:()=>setView('outline'),
  theme:async()=>{document.body.classList.toggle('dark');preferences.theme=document.body.classList.contains('dark')?'dark':'light';await rpc('preferences',preferences)},
  focus:()=>{document.body.classList.toggle('focus-mode');$('exitFocus').classList.toggle('hidden',!document.body.classList.contains('focus-mode'))},
  splitView:async()=>{referenceId=referenceId?null:selected;await renderReference()},
  import:async()=>{await requireWrite();const result=await rpc('import',{parent:parentForNew()});if(result){await refresh(result.project);await renderView();await modal('Import abgeschlossen',`<p>${result.count} Abschnitt(e) übernommen.</p><p class="muted">Originaldateien wurden nicht verändert. Komplexe Formatierung und nicht unterstützte Elemente können abweichen; bitte den importierten Text prüfen.</p>${result.warnings.map((w:string)=>`<p>${h(w)}</p>`).join('')}`,'Schließen')}},
  attach:async()=>{await requireWrite();const asset=await rpc('attach');if(!asset)return;const d=await rpc('create',{parent:'research',title:asset.info.name,kind:'asset',meta:{assetId:asset.info.id,mime:asset.info.mime}});await refresh();setDocument(d);view='write';await select(d.id)},
  insertImage:async()=>{if(!active)return;const ed=active;const asset=await rpc('attach',{imageOnly:true});if(asset)ed.chain().focus().setImage({src:asset.src,alt:asset.info.name}).run()},
  insertTable:()=>{active?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()},
  insertLink:async()=>{if(!active)return;const ed=active;const href=await textPrompt('Link einfügen','Adresse (https://… oder #Abschnitt-ID)',ed.getAttributes('link').href??'');if(href===null)return;if(!href)ed.chain().focus().unsetLink().run();else if(/^(https?:\/\/|mailto:|#)/i.test(href))ed.chain().focus().setLink({href}).run();else throw new Error('Bitte einen Web-, E-Mail- oder internen Link eingeben.')},
  insertFootnote:async()=>{if(!active)return;const ed=active;const text=await textPrompt('Fußnote einfügen','Text der Fußnote','',true);if(text?.trim())ed.chain().focus().insertContent({type:'footnote',attrs:{id:crypto.randomUUID(),text}}).run()},
  insertComment:async()=>{if(!active)return;const ed=active;if(ed.state.selection.empty)throw new Error('Bitte zuerst die Textstelle markieren.');const text=await textPrompt('Kommentar','Deine Anmerkung','',true);if(text?.trim()){ed.chain().focus().setMark('comment',{id:crypto.randomUUID(),text}).run();inspector='notes';renderInspector()}},
  snapshot:async()=>{await requireWrite();const title=await textPrompt('Textstand sichern','Bezeichnung','Vor Überarbeitung');if(title){await rpc('snapshot',{id:selected,title});inspector='snapshots';renderInspector();toast('Textstand gesichert.')}},
  restoreDocument:()=>restoreDocument(selected),
  showTrash:async()=>{await flush();destroyEditors();view='trash';$('formatbar').classList.add('hidden');const docs=project.documents.filter((d:any)=>d.deleted);$('editorPane').innerHTML=`<h2>Papierkorb</h2><p class="muted">Texte werden nicht endgültig gelöscht. Übergeordnete Ordner zuerst wiederherstellen.</p>${docs.map((d:any)=>`<div class="search-result"><h3>${h(d.title)}</h3><button data-restore-doc="${h(d.id)}" ${project.readOnly?'disabled':''}>Wiederherstellen</button></div>`).join('')||'<p class="muted">Der Papierkorb ist leer.</p>'}`},
  export:()=>output(),preview:()=>output(true),
  goals:async()=>{await requireWrite();const form=await modal('Dein Schreibziel',field('Manuskript – Wörter','target',project.settings.wordTarget??80000,'number')+field('Sitzung – Wörter','session',project.settings.sessionTarget??500,'number'));if(form){project.settings.wordTarget=Math.max(0,Number(form.get('target')));project.settings.sessionTarget=Math.max(0,Number(form.get('session')));await saveProjectSettings();updateStats()}},
  history:async()=>{const history=await rpc('history');await modal('Dein Schreibverlauf',`<p class="muted">Nettoänderung der Wortzahl pro Tag, einschließlich Löschungen.</p><table class="outline-table"><thead><tr><th>Tag</th><th>Wörter</th></tr></thead><tbody>${history.map((d:any)=>`<tr><td>${h(d.day)}</td><td>${d.words>0?'+':''}${d.words}</td></tr>`).join('')}</tbody></table>`,'Schließen')},
  toggleFreeBoard:async()=>{await requireWrite();project.settings.freeBoard=!project.settings.freeBoard;await saveProjectSettings();renderBoard()},
  newCollection:async()=>{await requireWrite();const form=await modal('Sammlung anlegen',field('Name','title','Meine Sammlung')+field('Suchbegriff in Titel oder Metadaten','query')+`<label class="form-check"><input type="checkbox" name="manual"> Nur den aktuellen Abschnitt aufnehmen</label>`);if(form){const c:any={title:String(form.get('title')),query:String(form.get('query'))};if(form.has('manual'))c.ids=[selected];project.settings.collections=[...(project.settings.collections??[]),c];await saveProjectSettings()}},
  customMeta:async()=>{await requireWrite();const form=await modal('Eigenes Metadatenfeld',field('Feldname','key')+field('Wert (leer zum Entfernen)','value'));if(form){const key=String(form.get('key')).trim(),value=String(form.get('value'));if(!key||['__proto__','constructor','prototype'].includes(key))throw new Error('Bitte einen gültigen Feldnamen eingeben.');const d=current();d.meta.custom??={};if(value)d.meta.custom[key]=value;else delete d.meta.custom[key];changed(d);renderInspector()}},
  templates:async()=>{const form=await modal('Aus einer Vorlage beginnen',`<div class="field"><label for="template">Vorlage</label><select name="template" id="template"><option value="figure">Figur</option><option value="place">Ort</option><option value="item">Gegenstand</option><option value="scene">Szene</option><option value="script">Drehbuch</option><option value="research">Recherche-Notiz</option>${(project.settings.templates??[]).map((t:any,i:number)=>`<option value="custom-${i}">${h(t.title)} (eigene Vorlage)</option>`).join('')}</select></div>`,'Abschnitt anlegen');if(!form)return;const k=String(form.get('template'));if(k==='figure'||k==='place'||k==='item'){await storyCards.create(k);return}if(k.startsWith('custom-')){await requireWrite();const t=project.settings.templates[Number(k.slice(7))];const name=await textPrompt('Eigene Vorlage','Titel',t.title);if(!name)return;const d=await rpc('create',{parent:parentForNew(),title:name,kind:t.kind,body:t.body,meta:t.meta});await refresh();setDocument(d);view='write';await select(d.id);return}const templates:Record<string,string>={figure:'Name\nRolle in der Geschichte\nWunsch und Motivation\nKonflikt\nBeziehungen\nEntwicklung',place:'Ort\nAtmosphäre\nBesondere Merkmale\nBedeutung für die Handlung',scene:'Perspektive\nOrt und Zeit\nZiel der Szene\nKonflikt\nWendepunkt',research:'Fragestellung\nQuelle und Datum\nErkenntnisse\nOffene Fragen',script:'INT. ORT - TAG\n\nHandlung\n\nFIGUR\nDialog'};await addDocument(k==='script'?'script':'text',templates[k])},
  newStoryFigure:()=>storyCards.create('figure'),newStoryPlace:()=>storyCards.create('place'),newStoryItem:()=>storyCards.create('item'),
  documentMenu:async()=>{if(!project)return;await modal('Abschnitt bearbeiten',`<div class="dialog-list">${[['saveTemplate','Als eigene Vorlage sichern'],['manageCollection','Sammlungen bearbeiten'],['duplicate','Duplizieren'],['moveDialog','Verschieben / Reihenfolge'],['splitDocument','Ab Cursor in neuen Abschnitt teilen'],['mergeDocument','Mit folgendem Abschnitt zusammenführen'],['addToCollection','Zur Sammlung hinzufügen'],['attach','Recherchedatei hinzufügen'],['trashDocument','In den Papierkorb verschieben']].map(([a,t])=>`<button type="button" data-menu-action="${a}">${t}</button>`).join('')}</div>`,'Schließen')},
  duplicate:async()=>{await requireWrite();const d=current();const created=await rpc('create',{parent:d.parentId??'manuscript',title:d.title+' – Kopie',kind:d.kind,body:d.body,meta:d.meta});await refresh();setDocument(created);await select(created.id)},
  moveDialog:async()=>{await requireWrite();const d=current();const form=await modal('Abschnitt verschieben',`<div class="field"><label for="parent">Ziel</label><select name="parent" id="parent">${project.documents.filter((x:any)=>!x.deleted&&x.kind!=='asset'&&x.id!==selected).map((x:any)=>`<option value="${x.id}" ${x.id===d.parentId?'selected':''}>${h(x.title)}</option>`).join('')}</select></div>${field('Position (1 = Anfang)','position',d.position+1,'number')}`);if(form)await moveDocument(selected,String(form.get('parent')),Number(form.get('position'))-1)},
  trashDocument:()=>trashDocument(selected),
  splitDocument:async()=>{await requireWrite();if(!active) return;const d=current(),ed=active,pos=ed.state.selection.from;const title=await textPrompt('Abschnitt teilen','Titel des neuen Abschnitts',d.title+' – Fortsetzung');if(!title)return;const tail=ed.state.doc.cut(pos).toJSON();const head=ed.state.doc.cut(0,pos).toJSON();if(!tail.content?.length)throw new Error('Am Dokumentende gibt es keinen weiteren Text.');await refresh(await rpc('split',{id:d.id,revision:d.revision,firstBody:JSON.stringify(head),secondBody:JSON.stringify(tail),title}));await select(selected)},
  mergeDocument:async()=>{await requireWrite();const d=current();const siblings=project.documents.filter((x:any)=>!x.deleted&&x.parentId===d.parentId&&x.kind!=='asset').sort((a:any,b:any)=>a.position-b.position);const next=siblings[siblings.findIndex((x:any)=>x.id===selected)+1];if(!next)throw new Error('Kein folgender Textabschnitt vorhanden.');if(!await modal('Abschnitte zusammenführen',`<p>„${h(next.title)}“ wird an „${h(d.title)}“ angehängt und anschließend in den Papierkorb verschoben. Beide Textstände bleiben erhalten.</p>`,'Zusammenführen'))return;const n=await getDoc(next.id);await refresh(await rpc('merge',{firstId:d.id,secondId:n.id,firstRevision:d.revision,secondRevision:n.revision}));await select(selected)},
  addToCollection:async()=>{await requireWrite();const list=(project.settings.collections??[]).filter((c:any)=>c.ids);if(!list.length)throw new Error('Bitte zuerst eine manuelle Sammlung anlegen.');const form=await modal('Zur Sammlung hinzufügen',`<div class="field"><label for="collection">Sammlung</label><select name="collection" id="collection">${list.map((c:any,i:number)=>`<option value="${i}">${h(c.title)}</option>`).join('')}</select></div>`);if(form){const c=list[Number(form.get('collection'))];c.ids=[...new Set([...c.ids,selected])];await saveProjectSettings()}},
  find:async()=>{if(!active)return;await flush();const ed=active;const form=await modal('Suchen und Ersetzen',field('Suchen (Groß-/Kleinschreibung beachten)','find')+field('Ersetzen durch','replace')+`<div class="field"><label for="replaceScope">Aktion</label><select name="scope" id="replaceScope"><option value="find">Nächsten Treffer markieren</option><option value="section">Alle Treffer im Abschnitt ersetzen</option><option value="project">Alle Treffer im Projekt ersetzen</option></select></div><p class="muted">Suche im Haupttext, auch über Formatierungswechsel hinweg. Projektweite Ersetzungen sichern zuvor Textstände. Absatzgrenzen und Anmerkungen werden nicht durchsucht.</p>`,'Weiter');if(!form)return;const query=String(form.get('find'));if(!query)return;const replacement=String(form.get('replace')),scope=String(form.get('scope'));
    if(scope==='find'){const hits=findHits(ed.state.doc,query);const hit=hits.find(x=>x.from>=ed.state.selection.to)??hits[0];if(hit)ed.chain().focus().setTextSelection(hit).scrollIntoView().run();else toast('Keine Treffer.');return}
    await requireWrite();if(scope==='section'){const hits=findHits(ed.state.doc,query);ed.view.dispatch(replaceHits(ed.state,hits,replacement));toast(hits.length+' Treffer ersetzt.');return}
    const updates:any[]=[];let count=0;for(const item of project.documents.filter((d:any)=>!d.deleted&&d.kind!=='asset')){const d=await getDoc(item.id);const state=EditorState.create({schema:ed.schema,doc:ed.schema.nodeFromJSON(JSON.parse(d.body))});const hits=findHits(state.doc,query);if(hits.length){count+=hits.length;updates.push({...d,body:JSON.stringify(replaceHits(state,hits,replacement).doc.toJSON())})}}
    if(!count){toast('Keine Treffer.');return}if(!await modal('Projektweite Ersetzung',`<p>${count} Treffer in ${updates.length} Abschnitten ersetzen? Jeder vorherige Text wird als Textstand aufbewahrt.</p><p><b>${h(query)}</b> → <b>${h(replacement)||'(entfernen)'}</b></p>`,'Ersetzen'))return;for(const d of await rpc('replace',{documents:updates}))setDocument(d);await refresh();await renderView();toast(count+' Treffer ersetzt.');
  },
  typography:async()=>{if(!active)return;const ed=active;const form=await modal('Text gestalten',`<div class="field"><label for="fontFamily">Schrift</label><select name="family" id="fontFamily">${['Georgia','Segoe UI','Arial','Times New Roman','Consolas'].map(f=>`<option ${f===ed.getAttributes('textStyle').fontFamily?'selected':''}>${f}</option>`).join('')}</select></div>`+field('Schriftgröße (pt)','size',parseInt(ed.getAttributes('textStyle').fontSize)||13,'number')+field('Zeilenabstand','height',parseFloat(ed.getAttributes('textStyle').lineHeight)||1.85,'number')+field('Textfarbe','color','#26332f','color')+field('Markierungsfarbe','highlight','#f5dfa0','color')+`<label class="form-check"><input type="checkbox" name="applyColor"> Textfarbe anwenden</label><label class="form-check"><input type="checkbox" name="applyHighlight"> Auswahl farbig markieren</label><p class="muted">Diese Textformatierung bleibt im Projekt. Die Satzpipeline verwendet für Schrift und Seitenlayout das Ausgabeprofil.</p>`);if(form){const size=Number(form.get('size')),height=Number(form.get('height'));if(size<6||size>96||height<1||height>4)throw new Error('Schriftgröße: 6–96 pt; Zeilenabstand: 1–4.');const chain=ed.chain().focus().setFontFamily(String(form.get('family'))).setFontSize(size+'pt').setLineHeight(String(height));if(form.has('applyColor'))chain.setColor(String(form.get('color')));if(form.has('applyHighlight'))chain.setHighlight({color:String(form.get('highlight'))});chain.run()}},
  internalLink:async()=>{if(!active)return;const ed=active;const form=await modal('Abschnitt verknüpfen',`<div class="field"><label for="linkTarget">Zielabschnitt</label><select name="target" id="linkTarget">${project.documents.filter((d:any)=>!d.deleted).map((d:any)=>`<option value="${h(d.id)}">${h(d.title)}</option>`).join('')}</select></div>`);if(!form)return;const id=String(form.get('target'));if(ed.state.selection.empty)ed.chain().focus().insertContent({type:'text',text:info(id).title,marks:[{type:'link',attrs:{href:'#'+id}}]}).run();else ed.chain().focus().setLink({href:'#'+id}).run()},
  saveTemplate:async()=>{await requireWrite();const d=current();if(d.kind==='asset')throw new Error('Vorlagen sind für Textabschnitte vorgesehen.');const title=await textPrompt('Als eigene Vorlage sichern','Vorlagenname',d.title);if(!title)return;project.settings.templates=[...(project.settings.templates??[]),{title,kind:d.kind,body:d.body,meta:JSON.parse(JSON.stringify(d.meta))}];await saveProjectSettings();toast('Vorlage unter „Vorlagen“ verfügbar.')},
  manageCollection:async()=>{await requireWrite();const list=project.settings.collections??[];if(!list.length)throw new Error('Noch keine Sammlungen vorhanden.');const form=await modal('Sammlungen bearbeiten',`<div class="field"><label for="collectionEdit">Sammlung</label><select id="collectionEdit" name="index">${list.map((c:any,i:number)=>`<option value="${i}">${h(c.title)}</option>`).join('')}</select></div><div class="field"><label for="collectionAction">Aktion</label><select id="collectionAction" name="action"><option value="rename">Umbenennen</option><option value="query">Suchbegriff ändern (dynamisch)</option><option value="remove">Aktuellen Abschnitt entfernen (manuell)</option><option value="delete">Sammlung löschen; Texte bleiben erhalten</option></select></div>`+field('Neuer Name oder Suchbegriff','value'));if(!form)return;const index=Number(form.get('index')),c=list[index],action=String(form.get('action')),value=String(form.get('value')).trim();if(action==='delete')list.splice(index,1);else if(action==='remove'){if(!c.ids)throw new Error('Diese Sammlung ist dynamisch.');c.ids=c.ids.filter((id:string)=>id!==selected)}else if(action==='query'){delete c.ids;c.query=value}else if(value)c.title=value;else throw new Error('Bitte einen Namen eingeben.');collection=null;await saveProjectSettings();await renderView()},
  moreFormat:async()=>{await modal('Weitere Textwerkzeuge',`<div class="dialog-list"><button type="button" data-menu-action="typography">Schrift, Größe, Zeilenabstand und Farben</button><button type="button" data-menu-action="internalLink">Verweis auf einen Abschnitt</button></div><div class="format-grid" style="margin-top:15px">${[['undo','Rückgängig'],['redo','Wiederholen'],['toggleSuperscript','Hochgestellt'],['toggleSubscript','Tiefgestellt'],['addRowAfter','Tabellenzeile hinzufügen'],['deleteRow','Tabellenzeile löschen'],['addColumnAfter','Tabellenspalte hinzufügen'],['deleteColumn','Tabellenspalte löschen'],['deleteTable','Tabelle löschen'],['clearNodes','Absatzformat zurücksetzen']].map(([a,t])=>`<button type="button" data-editor-command="${a}">${t}</button>`).join('')}</div><div class="field" style="margin-top:20px"><label>Drehbuchelement</label><select id="scriptElement"><option value="action">Handlung</option><option value="scene">Szenenüberschrift</option><option value="character">Figur</option><option value="dialogue">Dialog</option><option value="parenthetical">Regieanweisung</option><option value="transition">Übergang</option></select><button type="button" data-action="applyScript">Anwenden</button></div>`,'Schließen')},
  applyScript:()=>{const element=$<HTMLSelectElement>('scriptElement').value;$<HTMLDialogElement>('dialog').close('cancel');active?.chain().focus().setNode('script',{element}).run()},
  settings:async()=>{const form=await modal('Einstellungen',`<p class="muted">Projekte werden lokal gespeichert. Online-Sprachprüfungen senden den ausgewählten Text erst nach deinem Start an den gewählten Anbieter. Konverter werden nur für Import und Ausgabe gestartet.</p>${field('Pandoc – vollständiger Programmpfad','pandoc',tools.pandoc??preferences.pandoc??'')}${field('Typst – vollständiger Programmpfad','typst',tools.typst??preferences.typst??'')}<p class="muted">Automatisches Speichern: nach 1 Sekunde Pause, spätestens nach 5 Sekunden. Projektsicherungen: Öffnen und Schließen, die letzten 20 Sicherungen. Speicherort: ${h(storageDirectory)} / Backups.</p>${project?field('Projekttitel','projectTitle',project.title):''}`);if(form){preferences.pandoc=String(form.get('pandoc'));preferences.typst=String(form.get('typst'));await rpc('preferences',preferences);tools={pandoc:preferences.pandoc,typst:preferences.typst};if(project&&!project.readOnly){project.title=String(form.get('projectTitle'));await saveProjectSettings();$('projectLabel').textContent=project.title}}},
  help:async()=>{await modal('Willkommen im Schreibatelier',`<p>Lege links Kapitel und Abschnitte an. Schreibe in der Mitte und halte rechts Zusammenfassungen, Schlagwörter und Notizen fest.</p><p>Die Pinnwand und die Gliederung zeigen die Unterabschnitte deiner Auswahl. Verschieben ändert überall dieselbe Projektstruktur.</p><p><b>Strg+S</b> speichert sofort. <b>F11</b> öffnet den Fokusmodus. Unter „Stände“ sicherst du Fassungen einzelner Abschnitte; unter Datei sicherst du das gesamte Projekt.</p><p>Recherchedateien fügst du über das Abschnittsmenü hinzu. Die zweite Ansicht bleibt zum Nachschlagen schreibgeschützt.</p><p>Über „Exportieren“ wählst du Texte und Ausgabeformat. Für DOCX, RTF, ODT, HTML, Markdown und EPUB brauchst du Pandoc; PDF benötigt außerdem Typst. Die Anwendung arbeitet ohne Konto.</p>`,'Schließen')},
  licenses:async()=>{const text=await rpc('licenses');await modal('Lizenzen und Herkunft',`<pre class="license-text">${h(text)}</pre>`,'Schließen')},
};
async function perform(action:string) {try{await actions[action]?.()}catch(e:any){toast(e.message,true)}}

const documentContextMenu=$('documentContextMenu'),contextTrash=$<HTMLButtonElement>('contextTrash');
let contextDocument='',contextProject='',contextOrigin:HTMLElement|null=null;
function openDocumentContext(event:MouseEvent|KeyboardEvent) {
  const row=(event.target as HTMLElement).closest<HTMLElement>('#tree [data-doc],[data-card],[data-outline],[data-story-action="open"]');
  if(!row)return;
  const id=row.dataset.doc??row.dataset.card??row.dataset.outline??row.dataset.id!,d=info(id);
  if(!d||d.deleted)return;
  event.preventDefault();contextDocument=id;contextProject=project.id;contextOrigin=row;
  $('documentContextTitle').textContent=d.title;
  contextTrash.disabled=project.readOnly||!d.parentId;
  $('documentContextHint').textContent=project.readOnly?'Dieses Projekt ist schreibgeschützt.':!d.parentId?'Die festen Projektbereiche bleiben erhalten.':'';
  documentContextMenu.showPopover();
  const rect=row.getBoundingClientRect(),x=event instanceof MouseEvent&&event.clientX?event.clientX:rect.left+12,y=event instanceof MouseEvent&&event.clientY?event.clientY:rect.bottom;
  documentContextMenu.style.left=Math.max(8,Math.min(x,innerWidth-documentContextMenu.offsetWidth-8))+'px';
  documentContextMenu.style.top=Math.max(8,Math.min(y,innerHeight-documentContextMenu.offsetHeight-8))+'px';
  (contextTrash.disabled?documentContextMenu:contextTrash).focus({preventScroll:true});
}
document.addEventListener('contextmenu',openDocumentContext);
document.addEventListener('keydown',event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))openDocumentContext(event)});
documentContextMenu.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();documentContextMenu.hidePopover();contextOrigin?.focus({preventScroll:true})}
  else if(event.key==='Tab')documentContextMenu.hidePopover();
  else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(!contextTrash.disabled)contextTrash.focus()}
});
contextTrash.addEventListener('click',()=>{
  const id=contextDocument,owner=contextProject;documentContextMenu.hidePopover();
  void trashDocument(id,owner).catch(e=>toast(e.message,true)).finally(()=>{
    const row=document.querySelector<HTMLElement>(`#tree [data-doc="${CSS.escape(info(id)?.deleted?selected:id)}"]`);row?.focus({preventScroll:true});
  });
});

document.addEventListener('pointerdown',event=>{if((event.target as HTMLElement).closest('[data-action="proof"],[data-inspector="proof"],[data-inspector="cards"],[data-story-action="link"]'))event.preventDefault()});
document.addEventListener('click',event=>{
  const el=event.target as HTMLElement;
  const recent=el.closest<HTMLButtonElement>('[data-recent-project]');if(recent){recent.disabled=true;void(async()=>{await flush();await adopt(await rpc('openRecent',{path:recent.dataset.recentProject}))})().catch(e=>toast(e.message,true)).finally(()=>{recent.disabled=false});return}
  const link=el.closest<HTMLAnchorElement>('.tiptap a');if(link){event.preventDefault();const href=link.getAttribute('href')??'';if(href.startsWith('#')){const id=href.slice(1);if(info(id)&&!info(id).deleted){if(!isStoryCard(info(id)))view='write';void select(id).catch(e=>toast(e.message,true))}else toast('Der verknüpfte Abschnitt ist nicht verfügbar.',true)}else if(/^(https?:\/\/|mailto:)/i.test(href))window.open(href,'_blank','noopener');return}
  const noteItem=el.closest<HTMLElement>('[data-note-id]');if(noteItem){void editNote(noteItem.dataset.noteId!).catch(e=>toast(e.message,true));return}
  const menu=el.closest<HTMLElement>('[data-menu-action]');if(menu){const dialog=$<HTMLDialogElement>('dialog');dialog.addEventListener('close',()=>{void perform(menu.dataset.menuAction!)},{once:true});dialog.close('cancel');return}
  const cmd=el.closest<HTMLElement>('[data-editor-command]');if(cmd){const c=cmd.dataset.editorCommand!;$<HTMLDialogElement>('dialog').close('cancel');(active?.chain().focus() as any)?.[c]?.().run();return}
  const action=el.closest<HTMLElement>('[data-action]');if(action){void perform(action.dataset.action!);return}
  const viewButton=el.closest<HTMLElement>('[data-view]');if(viewButton){void setView(viewButton.dataset.view!).catch(e=>toast(e.message,true));return}
  const tab=el.closest<HTMLElement>('[data-inspector]');if(tab){inspector=tab.dataset.inspector!;renderInspector();return}
  const collapse=el.closest<HTMLElement>('[data-collapse]');if(collapse){const id=collapse.dataset.collapse!;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);renderTree();return}
  const doc=el.closest<HTMLElement>('[data-doc]');if(doc){void select(doc.dataset.doc!).catch(e=>toast(e.message,true));return}
  const collect=el.closest<HTMLElement>('[data-collection]');if(collect){void flush().then(()=>{collection=project.settings.collections[Number(collect.dataset.collection)];renderBoard();renderCollections()});return}
  const fmt=el.closest<HTMLElement>('[data-format]');if(fmt&&active){const format=fmt.dataset.format!;const chain=active.chain().focus();if(['left','center','right','justify'].includes(format))chain.setTextAlign(format).run();else(chain as any)['toggle'+format[0].toUpperCase()+format.slice(1)]?.().run();updateFormatButtons();return}
  const asset=el.closest<HTMLElement>('[data-asset-download]');if(asset){void rpc('exportAsset',{id:asset.dataset.assetDownload}).catch(e=>toast(e.message,true));return}
  const result=el.closest<HTMLElement>('[data-result]');if(result){view='write';void select(result.dataset.result!);return}
  const restore=el.closest<HTMLElement>('[data-restore-doc]');if(restore){void restoreDocument(restore.dataset.restoreDoc!).catch(e=>toast(e.message,true));return}
  const compare=el.closest<HTMLElement>('[data-compare]');if(compare){void(async()=>{await flush();const snapshots=await rpc('snapshots',{id:selected});const s=snapshots.find((x:any)=>x.id===compare.dataset.compare);await modal('Änderungen seit „'+s.title+'“',`<p class="muted">Vergleich des Haupttexts: rot entfernt, grün ergänzt. Formatierung und Fußnoten werden hier nicht verglichen.</p><div class="diff dialog-body-scroll">${diffWords(plainText(s.body),plainText(current().body)).map(p=>`<${p.added?'ins':p.removed?'del':'span'}>${h(p.value)}</${p.added?'ins':p.removed?'del':'span'}>`).join('')}</div>`,'Schließen')})().catch(e=>toast(e.message,true));return}
  const restoreSnapshot=el.closest<HTMLElement>('[data-restore-snapshot]');if(restoreSnapshot){void(async()=>{await requireWrite();if(await modal('Textstand wiederherstellen','<p>Der aktuelle Text wird zuvor als eigener Stand gesichert.</p>','Wiederherstellen')){setDocument(await rpc('restoreSnapshot',{id:selected,snapshotId:restoreSnapshot.dataset.restoreSnapshot}));await select(selected)}})().catch(e=>toast(e.message,true));return}
});
document.addEventListener('dblclick',event=>{
  const el=event.target as HTMLElement;const card=el.closest<HTMLElement>('[data-card],[data-outline]');if(card){view='write';void select(card.dataset.card??card.dataset.outline!);return}
  const note=el.closest<HTMLElement>('.editor-sheet [data-footnote],.editor-sheet [data-comment]');if(note)void editNote(note.dataset.footnote??note.dataset.comment!).catch(e=>toast(e.message,true));
});
$('documentTitle').addEventListener('input',()=>{const d=current();if(d){d.title=$<HTMLInputElement>('documentTitle').value;changed(d)}});
$('combined').addEventListener('change',()=>{combined=$<HTMLInputElement>('combined').checked;void flush().then(renderView).catch(e=>toast(e.message,true))});
$('paragraphStyle').addEventListener('change',()=>{if(!active)return;const style=$<HTMLSelectElement>('paragraphStyle').value;const chain=active.chain().focus();if(style==='p')chain.setParagraph().run();else if(style==='quote')chain.toggleBlockquote().run();else chain.setHeading({level:Number(style[1]) as any}).run()});
$('projectSearch').addEventListener('input',()=>{clearTimeout(searchTimer);const query=$<HTMLInputElement>('projectSearch').value;searchTimer=setTimeout(()=>{void(async()=>{await flush();if(!query){await renderView();return}const result=await rpc('search',{query});destroyEditors();$('formatbar').classList.add('hidden');$('editorPane').innerHTML=`<h2>Suche nach „${h(query)}“</h2><p class="muted">${result.length} Treffer (maximal 500)</p>${result.map((d:any)=>`<article class="search-result" data-result="${h(d.id)}" role="button" tabindex="0"><h3>${h(d.title)}</h3><p>${h(d.excerpt)}</p></article>`).join('')}`})().catch(e=>toast(e.message,true))},250)});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void perform('save')}
  if(event.key==='F11'){event.preventDefault();void perform('focus')}
  if(event.key==='Escape'&&document.body.classList.contains('focus-mode'))void perform('focus');
  if(event.key==='Enter'&&(event.target as HTMLElement).matches('[data-doc],[data-result]'))(event.target as HTMLElement).click();
  if(event.key==='Enter'&&(event.target as HTMLElement).matches('[data-card],[data-outline]'))(event.target as HTMLElement).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
});
let dragged='';
document.addEventListener('dragstart',event=>{const el=(event.target as HTMLElement).closest<HTMLElement>('[data-doc],[data-card]');if(el){dragged=el.dataset.doc??el.dataset.card!;event.dataTransfer?.setData('text/schreibatelier',dragged)}});
document.addEventListener('dragover',event=>{if(dragged&&(event.target as HTMLElement).closest('[data-doc],[data-card]')){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move'}});
document.addEventListener('drop',event=>{const target=(event.target as HTMLElement).closest<HTMLElement>('[data-doc],[data-card]');if(!target||!dragged)return;event.preventDefault();const source=dragged;dragged='';const id=target.dataset.doc??target.dataset.card!;if(id===source)return;const d=info(id);const parent=target.dataset.card?d.parentId:d.id;const index=target.dataset.card?d.position:project.documents.filter((x:any)=>x.parentId===parent).length;void moveDocument(source,parent,index).catch(e=>toast(e.message,true))});
document.addEventListener('dragend',()=>dragged='');

async function integrationCardCheck(checks:string[]) {
  const waitFor=async(check:()=>boolean)=>{for(let attempt=0;attempt<100;attempt++){if(check())return;await new Promise(resolve=>setTimeout(resolve,50))}throw new Error('Kartenansicht wurde nicht rechtzeitig aktualisiert.')};
  let card=project.documents.find((d:any)=>d.meta.nativeStoryCheck==='figure'), scene=project.documents.find((d:any)=>d.meta.nativeStoryCheck==='scene');
  if(card&&scene){
    const persisted=await rpc('document',{id:card.id});
    if(persisted.meta.storyCard.aliases[0]!=='Heimkehrerin'||persisted.meta.custom.Prüfung!=='Gespeichert'||!scene.meta.storyCardIds.includes(card.id))throw new Error('Karten aus dem vorherigen Programmstart fehlen.');
    checks.push('Karten und Zuordnungen aus vorherigem Programmstart geladen');
  } else {
    card=await rpc('create',{parent:'research',title:'Mara Berg',kind:'text',meta:{nativeStoryCheck:'figure',storyCard:{type:'figure',aliases:[],fields:{}},custom:{Prüfung:'Gespeichert'}}});
    scene=await rpc('create',{parent:'manuscript',title:'Native Kartenszene',kind:'text',body:JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Mara Berg ist die Heimkehrerin.'}]}]}),meta:{nativeStoryCheck:'scene'}});
    await refresh();
  }
  view='write';await select(scene.id);await storyCards.open(card.id);await waitFor(()=>!!document.getElementById('storyAliases'));
  $<HTMLTextAreaElement>('storyAliases').value='Heimkehrerin';$('storyAliases').dispatchEvent(new Event('input',{bubbles:true}));
  $<HTMLTextAreaElement>('storyField-motivation').value='Die Wahrheit finden.';$('storyField-motivation').dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector<HTMLButtonElement>('[data-story-action="assign"]')!.click();await flush();
  await waitFor(()=>document.querySelectorAll('.editor-sheet [data-story-ids]').length===2);
  if(selected!==scene.id)throw new Error('Kartenöffnung hat die Szene gewechselt.');
  checks.push('Figurenkarte und Alias im Notizbuch → Namenserkennung → SQLite');
  const filePath=project.filePath;await adopt(await rpc('openRecent',{path:filePath}));await select(scene.id);await storyCards.open(card.id);
  await waitFor(()=>document.querySelectorAll('.editor-sheet [data-story-ids]').length===2&&$<HTMLTextAreaElement>('storyField-motivation')?.value==='Die Wahrheit finden.');
  if(!current().meta.storyCardIds.includes(card.id))throw new Error('Szenenzuordnung wurde nicht gespeichert.');
  checks.push('Projekt wieder geöffnet: Kartenfelder, Alias und Szenenzuordnung erhalten');
  let extraScene=project.documents.find((d:any)=>d.meta.nativeStoryCheck==='extra-scene');
  if(!extraScene){extraScene=await rpc('create',{parent:'manuscript',title:'Orts- und Gegenstandsprüfung',kind:'text',body:JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Haus am See ist das Seehaus. Der Silberschlüssel ist der Hausschlüssel.'}]}]}),meta:{nativeStoryCheck:'extra-scene'}});await refresh()}
  const extraIds:string[]=[];
  for(const [type,title,alias,field,value] of [['place','Haus am See','Seehaus','atmosphere','Still und verlassen.'],['item','Silberschlüssel','Hausschlüssel','owner','Mara']]) {
    let extra=project.documents.find((d:any)=>d.meta.nativeStoryCheck===type);
    if(extra){
      if(extra.meta.storyCard.aliases[0]!==alias||extra.meta.storyCard.fields[field]!==value||!extraScene.meta.storyCardIds?.includes(extra.id))throw new Error('Kartenwerte aus vorherigem Start fehlen: '+type);
      checks.push(type+'-Karte und Zuordnung aus vorherigem Programmstart geladen');
    }else{extra=await rpc('create',{parent:'research',title,kind:'text',meta:{nativeStoryCheck:type,storyCard:{type,aliases:[],fields:{}}}});await refresh()}
    extraIds.push(extra.id);await select(extraScene.id);await storyCards.open(extra.id);
    await waitFor(()=>$<HTMLInputElement>('storyTitle')?.value===title);
    $<HTMLTextAreaElement>('storyAliases').value=alias;$('storyAliases').dispatchEvent(new Event('input',{bubbles:true}));
    $<HTMLTextAreaElement>('storyField-'+field).value=value;$('storyField-'+field).dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector<HTMLButtonElement>('[data-story-action="assign"]')!.click();await flush();
  }
  await adopt(await rpc('openRecent',{path:filePath}));await select(extraScene.id);await storyCards.open(extraIds[1]);
  await waitFor(()=>document.querySelectorAll('.editor-sheet [data-story-ids]').length===4&&$<HTMLTextAreaElement>('storyField-owner')?.value==='Mara');
  if(!extraIds.every(id=>current().meta.storyCardIds?.includes(id)))throw new Error('Orts- oder Gegenstandszuordnung fehlt.');
  checks.push('Orts- und Gegenstandskarten → Namenserkennung → SQLite → Wiederöffnen');
  await rpc('integrationCapture',{phase:'cards'});
}
async function integrationStyleCheck(checks:string[]) {
  const waitFor=async(predicate:()=>boolean)=>{for(let i=0;i<200&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,50));if(!predicate())throw new Error('Stilanalyse: Wartezeit überschritten. '+$('proofStatus').textContent)};
  let d=project.documents.find((d:any)=>d.meta.nativeStyleCheck);
  if(d){
    const saved=project.settings.styleAnalysis;
    if(!saved||saved.repetitions!==false||saved.sentences!==false||saved.wording!==true||saved.automatic!==false)throw new Error('Stileinstellungen aus vorherigem Programmstart fehlen.');
    checks.push('Stileinstellungen aus vorherigem Programmstart geladen');
  }else{
    const text='Das Fenster steht offen. Das Fenster klappert eigentlich.\n'+Array.from({length:30},(_,i)=>'Wort'+i).join(' ')+'.';
    d=await rpc('create',{parent:'manuscript',title:'Native Stilanalyse',kind:'text',body:JSON.stringify({type:'doc',content:text.split('\n').map(text=>({type:'paragraph',content:[{type:'text',text}]}))}),meta:{nativeStyleCheck:true}});await refresh();
  }
  await select(d.id);actions.proof();$<HTMLSelectElement>('proofEngine').value='style';$('proofEngine').dispatchEvent(new Event('change',{bubbles:true}));
  const set=async(id:string,value:boolean)=>{if($<HTMLInputElement>(id).checked!==value){$(id).click();await waitFor(()=>!$<HTMLButtonElement>('proofRun').disabled);if($('proofStatus').classList.contains('error'))throw new Error($('proofStatus').textContent!)} };
  await set('styleRepetitions',true);await set('styleSentences',true);await set('styleWording',true);await set('proofAuto',false);
  const before=(await rpc('document',{id:d.id})).body;await proofreading.run();
  for(const rule of ['repetition','wording','sentence-length'])if(!document.querySelector(`[data-rule="${rule}"]`))throw new Error('Stilhinweis fehlt: '+rule);
  if(document.querySelectorAll('#styleOverview [data-proof-action="sentence"]').length!==3)throw new Error('Satzübersicht unvollständig.');
  document.querySelector<HTMLButtonElement>('[data-rule="wording"] .proof-location')!.click();
  if(active!.state.doc.textBetween(active!.state.selection.from,active!.state.selection.to)!=='eigentlich')throw new Error('Stilfundstelle falsch.');
  if($('proofRun').textContent!=='Abschnitt analysieren')throw new Error('Navigation hat Prüfumfang geändert.');
  if((await rpc('document',{id:d.id})).body!==before)throw new Error('Stilanalyse hat gespeicherten Text verändert.');
  await rpc('integrationCapture',{phase:'style'});
  await set('styleRepetitions',false);await set('styleSentences',false);
  const filePath=project.filePath;await adopt(await rpc('openRecent',{path:filePath}));await select(d.id);actions.proof();
  if($<HTMLInputElement>('styleRepetitions').checked||$<HTMLInputElement>('styleSentences').checked||!$<HTMLInputElement>('styleWording').checked)throw new Error('Stileinstellungen nach erneutem Öffnen fehlen.');
  await proofreading.run();if(document.querySelectorAll('.proof-finding').length!==1||!document.querySelector('[data-rule="wording"]'))throw new Error('Gespeicherte Kategorien nicht angewendet.');
  checks.push('Lokale Stilanalyse → drei Kategorien → Navigation → unveränderter Text → SQLite-Einstellungen → Wiederöffnen');
}
async function integrationCheck() {
  const checks:string[]=[];
  try {const reopened=await rpc('openRecent',{path:project.filePath});if(reopened.id!==project.id)throw new Error('Zuletzt geöffnet: falsches Projekt');checks.push('Zuletzt geöffnet → Projektzugriff');const d=await rpc('create',{parent:'manuscript',title:'Native Editorprüfung',kind:'text'});await refresh();setDocument(d);await select(d.id);active!.commands.setContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Grüße aus dem Windows-Editor.',marks:[{type:'bold'}]},{type:'footnote',attrs:{id:'native-note',text:'Eine echte Fußnote.'}}]}]});await flush();const saved=await rpc('document',{id:d.id});if(!saved.body.includes('Windows-Editor'))throw new Error('Speichern fehlgeschlagen');checks.push('Editor → Bridge → SQLite');if(!saved.body.includes('footnote'))throw new Error('Fußnote fehlt');checks.push('Fußnote und Formatierung');await rpc('integrationCapture',{phase:'editor'});
    active!.commands.insertContentAt(active!.state.doc.content.size-1,' Ein Feler. Ich habe ein Apfel gegessen.');await flush();actions.proof();await proofreading.run();
    if(!document.querySelector('.proof-finding'))throw new Error('Lokale Sprachprüfung: '+$('proofStatus').textContent);
    const correction=[...document.querySelectorAll<HTMLButtonElement>('[data-proof-action="replace"]')].find(b=>b.textContent==='Fehler');if(!correction)throw new Error('Lokaler Korrekturvorschlag fehlt');correction.click();await flush();
    if(!plainText((await rpc('document',{id:d.id})).body).includes('Ein Fehler.'))throw new Error('Sprachkorrektur nicht gespeichert');active!.commands.undo();await flush();
    if(!plainText((await rpc('document',{id:d.id})).body).includes('Ein Feler.'))throw new Error('Korrektur-Undo fehlgeschlagen');await proofreading.run();await rpc('integrationCapture',{phase:'proof'});checks.push('Lokale Sprachprüfung → Markierung → Korrektur → SQLite → Undo');
    const proofAvailability=await rpc('proofStatus');
    for(const [engine,action,phase] of [['premium','premiumConnect','proof-premium'],['codex','codexLogin','proof-chatgpt']]){
      if(engine==='codex'&&!proofAvailability.codexAvailable)continue;
      const selector=`[data-proof-action="${action}"]`;$<HTMLSelectElement>('proofEngine').value=engine;$('proofEngine').dispatchEvent(new Event('change',{bubbles:true}));
      for(let attempt=0;attempt<300&&!document.querySelector(selector);attempt++)await new Promise(resolve=>setTimeout(resolve,100));
      if(!document.querySelector<HTMLElement>(selector)?.getClientRects().length)throw new Error('Kontoanmeldung nicht sichtbar: '+$('proofAccount').textContent);
      await rpc('integrationCapture',{phase});checks.push(engine+'-Anmeldeknopf im Windows-Programm sichtbar');
    }
    for(const [mime,phase] of [['application/pdf','pdf'],['text/html','html']]){const asset=project.documents.find((x:any)=>x.meta.mime===mime);if(asset){view='write';await select(asset.id);await new Promise(resolve=>setTimeout(resolve,1200));await rpc('integrationCapture',{phase});checks.push(phase+'-Rechercheansicht geladen')}}await setView('board');await select('manuscript');if(!$('editorPane').textContent?.includes(d.title))throw new Error('Pinnwand fehlt');checks.push('Gemeinsame Pinnwanddaten');await rpc('preferences',preferences);checks.push('Einstellungen gespeichert');await integrationCardCheck(checks);await integrationStyleCheck(checks);await rpc('integrationResult',{ok:true,checks});}catch(e:any){await rpc('integrationResult',{ok:false,error:e.message,checks})}
}
void rpc('ready').then(async result=>{preferences=result.preferences??{};tools=result.tools??{};storageDirectory=result.storageDirectory??storageDirectory;renderRecentProjects(result.recentProjects??[]);document.body.classList.toggle('dark',preferences.theme==='dark');if(Number.isFinite(preferences.inspectorWidth))updateInspectorSize(preferences.inspectorWidth);if(result.project)await adopt(result.project);if(result.updateInfo){updates.configure(result.updateInfo,preferences.checkUpdatesAtStartup!==false);if(!result.integrationTest&&preferences.checkUpdatesAtStartup!==false)void updates.check(true)}if(result.integrationTest)await integrationCheck()}).catch(e=>{state('Start fehlgeschlagen',true);toast(e.message,true)});
