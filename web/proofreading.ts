import {Editor, Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';
import {closeHistory} from '@tiptap/pm/history';
import {diffChars} from 'diff';
import {escapeHtml as h} from './logic.mjs';
import {proofBlocks, proofRange} from './proofreading.mjs';

const key=new PluginKey('proofreading');
const categories:Record<string,string>={spelling:'Rechtschreibung',grammar:'Grammatik',punctuation:'Zeichensetzung',style:'Stil'};
type Options={rpc:(action:string,args?:any)=>Promise<any>,project:()=>any,editor:()=>Editor|null,saveSettings:()=>Promise<void>,modal:(title:string,body:string,button?:string)=>Promise<FormData|null>};
type Finding={issue:any,from:number,to:number,id:number};

export class Proofreading {
  private panel=document.getElementById('proofPanel')!;
  private engine='local'; private language='de-DE'; private model=''; private style=false; private automatic=false;
  private running=false; private request=0; private timer:any; private selectedRange:{from:number,to:number}|null=null;
  private checkedEditor:Editor|null=null; private snapshot:any=null; private findings:Finding[]=[];
  private account:any={connected:false,models:[]}; private projectId='';
  extension=Extension.create({name:'proofreading',addProseMirrorPlugins:()=>[new Plugin({key,state:{init:()=>DecorationSet.empty,apply:(tr,old)=>{
    const ranges=tr.getMeta(key);if(ranges)return DecorationSet.create(tr.doc,ranges.map((r:Finding)=>Decoration.inline(r.from,r.to,{class:`proof-mark proof-${r.issue.category}`,'data-proof-id':String(r.id)})));
    return tr.docChanged?DecorationSet.empty:old;
  }},props:{decorations:state=>key.getState(state),handleClick:(_view,_pos,event)=>{
    const mark=(event.target as HTMLElement).closest<HTMLElement>('[data-proof-id]');
    if(!mark)return false;this.panel.querySelector<HTMLElement>(`[data-finding="${mark.dataset.proofId}"]`)?.scrollIntoView({block:'nearest'});return false;
  }}})]});
  constructor(private options:Options) {
    this.panel.innerHTML=`<div class="field"><label for="proofLanguage">Sprache</label><select id="proofLanguage"><option value="de-DE">Deutsch (Deutschland)</option><option value="de-AT">Deutsch (Österreich)</option><option value="de-CH">Deutsch (Schweiz)</option></select></div>
      <div class="field"><label for="proofEngine">Prüfverfahren</label><select id="proofEngine"><option value="local">Lokal · LanguageTool</option><option value="premium">LanguageTool Premium · online</option><option value="codex">ChatGPT-Abo · Codex</option></select></div>
      <div id="proofAccount"></div><div class="field hidden" id="proofModelField"><label for="proofModel">KI-Modell</label><select id="proofModel"></select></div>
      <label class="proof-option"><input type="checkbox" id="proofStyle"> Auch Stilhinweise anzeigen</label>
      <label class="proof-option" id="proofAutoLabel"><input type="checkbox" id="proofAuto"> Lokal nach Eingabepause prüfen</label>
      <p class="muted" id="proofRecipient"></p><div class="proof-actions"><button id="proofRun" class="primary">Abschnitt prüfen</button><button id="proofCancel" class="hidden">Abbrechen</button></div>
      <p id="proofStatus" role="status" aria-live="polite">Bereit.</p><div id="proofResults"></div>
      <details class="proof-dictionary"><summary>Projektwörterbuch</summary><div class="field"><label for="proofWords">Ein Begriff pro Zeile</label><textarea id="proofWords" rows="4"></textarea></div><button id="proofSaveWords">Wörterbuch speichern</button></details>`;
    this.el('proofRun').addEventListener('click',()=>void this.run());
    this.el('proofCancel').addEventListener('click',()=>{clearTimeout(this.timer);this.request++;void this.options.rpc('proofCancel').catch(()=>{});this.status('Prüfung wird abgebrochen …')});
    this.el('proofEngine').addEventListener('change',()=>{this.engine=this.input('proofEngine').value;this.invalidate();this.refreshControls();void this.loadStatus()});
    this.el('proofModel').addEventListener('change',()=>{this.model=this.input('proofModel').value;this.invalidate()});
    this.el('proofStyle').addEventListener('change',()=>{this.style=this.input('proofStyle').checked;this.invalidate()});
    this.el('proofAuto').addEventListener('change',()=>{this.automatic=this.input('proofAuto').checked;this.changed(this.options.editor())});
    this.el('proofLanguage').addEventListener('change',()=>void this.changeLanguage());
    this.el('proofSaveWords').addEventListener('click',()=>void this.saveWords().catch(e=>this.status(e.message,true)));
    this.panel.addEventListener('pointerenter',()=>this.refreshControls());
    this.panel.addEventListener('focusin',()=>this.refreshControls());
    this.panel.addEventListener('click',event=>{const el=(event.target as HTMLElement).closest<HTMLElement>('[data-proof-action]');if(el)void this.action(el.dataset.proofAction!,Number(el.dataset.id),Number(el.dataset.replacement)).catch(e=>this.status(e.message,true))});
  }
  private el(id:string){return document.getElementById(id)!}
  private input(id:string){return this.el(id) as HTMLInputElement}
  private status(message:string,error=false){this.el('proofStatus').textContent=message;this.el('proofStatus').classList.toggle('error',error)}
  show() {
    const project=this.options.project();if(!project)return;
    if(this.projectId!==project.id){this.invalidate();this.projectId=project.id;this.language=['de-DE','de-AT','de-CH'].includes(project.settings.proofLanguage)?project.settings.proofLanguage:'de-DE';this.input('proofLanguage').value=this.language}
    this.captureSelection();
    this.input('proofWords').value=this.dictionary().join('\n');this.input('proofWords').disabled=project.readOnly;this.input('proofSaveWords').disabled=project.readOnly;
    this.refreshControls();void this.loadStatus();
  }
  private refreshControls() {
    this.el('proofAutoLabel').classList.toggle('hidden',this.engine!=='local');this.el('proofModelField').classList.toggle('hidden',this.engine!=='codex');
    const ed=this.options.editor();const blocks=ed?proofBlocks(ed.state.doc,this.selectedRange?.from,this.selectedRange?.to):[];
    const count=blocks.reduce((n,b)=>n+b.text.length,0);
    this.el('proofRecipient').textContent=this.engine==='local'?'Die Prüfung bleibt auf diesem Rechner.':`${count.toLocaleString('de-DE')} Zeichen werden beim Start an ${this.engine==='premium'?'LanguageTool':'OpenAI (ChatGPT-Abo)'} gesendet.`;
    this.el('proofRun').textContent=this.selectedRange?'Markierung prüfen':'Abschnitt prüfen';this.input('proofRun').disabled=this.running||!ed;
    this.el('proofCancel').classList.toggle('hidden',!this.running);
  }
  private async loadStatus() {
    const engine=this.engine;this.el('proofAccount').textContent='Verfügbarkeit wird geprüft …';
    try {
      const status=await this.options.rpc(engine==='codex'?'proofCodexStatus':'proofStatus');if(engine!==this.engine)return;
      if(engine==='local')this.el('proofAccount').innerHTML=`<p class="muted">${status.localAvailable?'Lokale Prüfung verfügbar.':'Lokale Prüfung fehlt. Einrichtung über scripts/install-proofreading.ps1.'}</p>`;
      if(engine==='premium')this.el('proofAccount').innerHTML=`<p class="muted">${status.premiumConnected?'Premium-Zugang gespeichert.':'Noch kein Premium-Konto verbunden.'}</p><button data-proof-action="premiumConnect">${status.premiumConnected?'Zugang ändern':'Konto verbinden'}</button> ${status.premiumConnected?'<button data-proof-action="premiumDisconnect">Trennen</button>':''}`;
      if(engine==='codex'){
        this.account=status;this.el('proofAccount').innerHTML=`<p class="muted">${status.connected?`Verbunden: ${h(status.email)} · ${h(status.plan)}. Es gelten die Kontingente deines Abos.`:'Mit dem vorhandenen ChatGPT-Abo anmelden.'}</p><button data-proof-action="codexLogin">${status.connected?'Konto wechseln':'Mit ChatGPT anmelden'}</button> <button data-proof-action="codexRefresh">Status aktualisieren</button> ${status.connected?'<button data-proof-action="codexLogout">Trennen</button>':''}`;
        const models=status.models??[];if(!models.some((m:any)=>m.id===this.model))this.model=models[0]?.id??'';
        this.el('proofModel').innerHTML=models.map((m:any)=>`<option value="${h(m.id)}" ${this.model===m.id?'selected':''}>${h(m.name||m.id)}</option>`).join('');
      }
    } catch(e:any){if(engine===this.engine){this.el('proofAccount').textContent=e.message;this.account={connected:false,models:[]};this.el('proofModel').innerHTML=''}}
  }
  private async changeLanguage() {
    this.invalidate();const project=this.options.project(),next=this.input('proofLanguage').value;
    if(!project||project.readOnly){this.input('proofLanguage').value=this.language;this.status('Die Projektsprache kann im Schreibschutz nicht geändert werden.',true);return}
    const previous=project.settings.proofLanguage;project.settings.proofLanguage=next;
    try{await this.options.saveSettings();this.language=next;this.options.editor()?.view.dom.setAttribute('lang',next);this.status('Prüfsprache gespeichert.')}catch(e:any){project.settings.proofLanguage=previous;this.input('proofLanguage').value=this.language;this.status(e.message,true)}
  }
  private async saveWords(extra?:string) {
    const project=this.options.project();if(!project||project.readOnly)throw new Error('Projekt ist schreibgeschützt.');
    const previous=project.settings.proofDictionary;const words=[...new Set((extra?[...this.dictionary(),extra]:this.input('proofWords').value.split('\n')).map((w:string)=>w.trim()).filter(Boolean))];
    if(words.length>5000||words.some(w=>w.length>100)){this.status('Höchstens 5.000 Begriffe mit jeweils 100 Zeichen.',true);return}
    project.settings.proofDictionary=words;
    try{await this.options.saveSettings();this.input('proofWords').value=words.join('\n');this.findings=this.findings.filter(f=>!this.allowed(f.issue));this.paint();this.renderResults();this.status('Projektwörterbuch gespeichert.')}catch(e:any){project.settings.proofDictionary=previous;this.status(e.message,true)}
  }
  private dictionary():string[]{const value=this.options.project()?.settings.proofDictionary;return Array.isArray(value)?value.filter(w=>typeof w==='string'):[]}
  private allowed(issue:any){return issue.category==='spelling'&&this.dictionary().some(w=>w.normalize('NFC')===issue.original.normalize('NFC'))}
  private invalidate() {
    clearTimeout(this.timer);this.request++;this.findings=[];this.paint();this.checkedEditor=null;this.snapshot=null;this.el('proofResults').innerHTML='';
  }
  changed(ed:Editor|null) {
    this.invalidate();this.selectedRange=null;this.status('Text geändert. Bitte erneut prüfen.');
    if(ed&&this.automatic&&this.engine==='local'&&!this.panel.classList.contains('hidden')){
      const check=()=>{if(this.panel.classList.contains('hidden'))return;if(this.running)this.timer=setTimeout(check,1500);else void this.run(true)};
      this.timer=setTimeout(check,1500);
    }
    this.refreshControls();
  }
  captureSelection(){
    const ed=this.options.editor(),selection=window.getSelection();
    if(!ed||!selection?.anchorNode||!selection.focusNode||!ed.view.dom.contains(selection.anchorNode)||!ed.view.dom.contains(selection.focusNode))return;
    const anchor=ed.view.posAtDOM(selection.anchorNode,selection.anchorOffset),focus=ed.view.posAtDOM(selection.focusNode,selection.focusOffset);
    this.selectedRange=anchor===focus?null:{from:Math.min(anchor,focus),to:Math.max(anchor,focus)};
  }
  selectionChanged(ed:Editor){if(ed===this.options.editor()&&ed.view.hasFocus())this.captureSelection()}
  reset(){this.invalidate();this.selectedRange=null;this.status('Bereit.');this.refreshControls()}
  private paint(){if(this.checkedEditor&&!this.checkedEditor.isDestroyed)this.checkedEditor.view.dispatch(this.checkedEditor.state.tr.setMeta(key,this.findings))}
  private renderResults() {
    const readOnly=this.options.project()?.readOnly;
    this.el('proofResults').innerHTML=this.findings.map(f=>`<article class="proof-finding" data-finding="${f.id}"><button class="proof-location" data-proof-action="locate" data-id="${f.id}">${h(f.issue.original)}</button><small>${h(categories[f.issue.category]??'Hinweis')} · ${this.engine==='local'?'Lokal':this.engine==='premium'?'LanguageTool Premium':'KI'}</small><p>${h(f.issue.message)}</p><div class="proof-actions">${f.issue.replacements.map((r:string,i:number)=>`<button ${readOnly?'disabled':''} data-proof-action="replace" data-id="${f.id}" data-replacement="${i}">${h(r||'Entfernen')}</button>`).join('')}<button data-proof-action="ignore" data-id="${f.id}">Ignorieren</button>${f.issue.category==='spelling'?`<button ${readOnly?'disabled':''} data-proof-action="allow" data-id="${f.id}">Wort erlauben</button>`:''}</div></article>`).join('');
  }
  async run(auto=false) {
    if(this.running)return;
    const ed=this.options.editor();if(!ed||ed.isDestroyed){this.status('Bitte einen Textabschnitt öffnen.',true);return}
    const range=auto?null:this.selectedRange;const blocks=proofBlocks(ed.state.doc,range?.from,range?.to);if(!blocks.length){this.status('Kein Text zum Prüfen vorhanden.');return}
    this.invalidate();const request=this.request,project=this.options.project(),snapshot=ed.state.doc;this.running=true;this.refreshControls();this.status('Text wird geprüft …');
    try {
      const response=await this.options.rpc('proofCheck',{engine:this.engine,language:project.settings.proofLanguage??'de-DE',model:this.model,style:this.style,blocks:blocks.map(({id,text})=>({id,text}))});
      if(request!==this.request||ed.isDestroyed||!ed.state.doc.eq(snapshot)||this.options.project()?.id!==project.id){this.status('Text oder Prüfauswahl geändert. Ergebnisse verworfen.');return}
      this.checkedEditor=ed;this.snapshot=snapshot;this.findings=[];
      for(const issue of response.issues??[]){const span=proofRange(blocks,issue);if(!span||!categories[issue.category]||typeof issue.message!=='string'||!Array.isArray(issue.replacements)||!issue.replacements.every((r:any)=>typeof r==='string')||(!this.style&&issue.category==='style')||this.allowed(issue))continue;this.findings.push({id:this.findings.length,issue,...span})}
      this.paint();this.renderResults();this.status(`${this.findings.length} Hinweise. ${this.engine==='codex'?'KI-Vorschläge bitte sorgfältig prüfen.':''}`);
    } catch(e:any){this.status(e.message,true)}
    finally{this.running=false;this.refreshControls()}
  }
  private async action(action:string,id:number,replacement:number) {
    if(action==='premiumConnect'){
      const form=await this.options.modal('LanguageTool Premium verbinden','<p>Verbindung über deinen LanguageTool-Zugriffsschlüssel. Zum Prüfen des Zugangs wird nur ein kurzer Beispielsatz gesendet.</p><div class="field"><label for="ltEmail">E-Mail</label><input type="email" id="ltEmail" name="email" autocomplete="username" required></div><div class="field"><label for="ltKey">Zugriffsschlüssel</label><input type="password" id="ltKey" name="key" autocomplete="off" required></div><p>Den Schlüssel findest du in den LanguageTool-Kontoeinstellungen unter Zugriffsschlüssel.</p>','Verbinden');
      this.input('ltKey').value='';
      if(form){this.status('Premium-Zugang wird geprüft …');await this.options.rpc('proofPremiumConnect',{username:String(form.get('email')),key:String(form.get('key'))});this.status('Premium-Konto verbunden.');await this.loadStatus()}return;
    }
    if(action==='premiumDisconnect'){await this.options.rpc('proofPremiumDisconnect');await this.loadStatus();return}
    if(action==='codexLogin'){await this.options.rpc('proofCodexLogin');this.status('Anmeldung im Browser abschließen, dann „Status aktualisieren“ wählen.');return}
    if(action==='codexRefresh'){await this.loadStatus();return}
    if(action==='codexLogout'){await this.options.rpc('proofCodexLogout');await this.loadStatus();return}
    const finding=this.findings.find(f=>f.id===id),ed=this.checkedEditor;if(!finding||!ed||ed.isDestroyed)return;
    if(!ed.state.doc.eq(this.snapshot)){this.invalidate();this.status('Der Text hat sich geändert. Bitte erneut prüfen.',true);return}
    if(action==='locate'){ed.commands.setTextSelection({from:finding.from,to:finding.to});ed.commands.focus();return}
    if(action==='allow'){await this.saveWords(finding.issue.original);return}
    if(action==='ignore'){this.findings=this.findings.filter(f=>f.id!==id);this.paint();this.renderResults();return}
    if(action==='replace'){
      if(this.options.project()?.readOnly||!ed.isEditable)throw new Error('Projekt ist schreibgeschützt.');
      const text=finding.issue.replacements[replacement];if(typeof text!=='string')return;
      let pos=finding.from;const tr=closeHistory(ed.state.tr);
      for(const part of diffChars(finding.issue.original,text)){if(part.removed)tr.delete(pos,pos+part.value.length);else if(part.added){tr.insertText(part.value,pos);pos+=part.value.length}else pos+=part.value.length}
      ed.view.dispatch(tr);ed.commands.focus();this.status('Korrektur übernommen. Rückgängig mit Strg+Z. Bitte erneut prüfen.');
    }
  }
}
