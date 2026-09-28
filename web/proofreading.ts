import {Editor, Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';
import {closeHistory} from '@tiptap/pm/history';
import {diffChars} from 'diff';
import {escapeHtml as h} from './logic.mjs';
import {proofBlocks, proofRange} from './proofreading.mjs';
import {analyzeStyle, styleSettings} from './styleanalysis.mjs';
import {isStoryCard} from './storycards.mjs';

const key=new PluginKey('proofreading');
const categories:Record<string,string>={spelling:'Rechtschreibung',grammar:'Grammatik',punctuation:'Zeichensetzung',style:'Stil'};
const excerpt=(text:string)=>text.length>180?text.slice(0,180).replace(/[\uD800-\uDBFF]$/u,'')+'…':text;
type Options={rpc:(action:string,args?:any)=>Promise<any>,project:()=>any,editor:()=>Editor|null,saveSettings:()=>Promise<void>,modal:(title:string,body:string,button?:string)=>Promise<FormData|null>,runAction:<T>(work:()=>T|Promise<T>)=>Promise<T>};
type Finding={issue:any,from:number,to:number,id:number};

export class Proofreading {
  private panel=document.getElementById('proofPanel')!;
  private engine='local'; private language='de-DE'; private model=''; private style=false; private automatic=false;
  private running=false; private request=0; private timer:any; private selectedRange:{from:number,to:number}|null=null;
  private checkedEditor:Editor|null=null; private snapshot:any=null; private findings:Finding[]=[];
  private account:any={connected:false,models:[]}; private projectId='';
  private analysisSettings=styleSettings(null); private savingStyle=false; private analysisController:AbortController|null=null;
  private sentences:{from:number,to:number,words:number,fragment:boolean}[]=[]; private resultPage=0; private sentencePage=0;
  private activeEditor:Editor|null=null; private navigationRange:{from:number,to:number}|null=null;
  private namesSignature='';
  extension=Extension.create({name:'proofreading',addProseMirrorPlugins:()=>[new Plugin({key,state:{init:()=>DecorationSet.empty,apply:(tr,old)=>{
    const ranges=tr.getMeta(key);if(ranges)return DecorationSet.create(tr.doc,ranges.map((r:Finding)=>Decoration.inline(r.from,r.to,{class:`proof-mark proof-${r.issue.category}${r.issue.rule==='sentence-length'?' proof-long-sentence':''}`,'data-proof-id':String(r.id)})));
    return tr.docChanged?DecorationSet.empty:old;
  }},props:{decorations:state=>key.getState(state),handleClick:(_view,_pos,event)=>{
    const mark=(event.target as HTMLElement).closest<HTMLElement>('[data-proof-id]');
    if(!mark||_view!==this.checkedEditor?.view)return false;
    const index=this.findings.findIndex(f=>f.id===Number(mark.dataset.proofId));if(index<0)return false;
    this.resultPage=Math.floor(index/50);this.renderResults();this.panel.querySelector<HTMLElement>(`[data-finding="${mark.dataset.proofId}"]`)?.scrollIntoView({block:'nearest'});return false;
  }}})]});
  constructor(private options:Options) {
    this.panel.innerHTML=`<div class="field"><label for="proofLanguage">Sprache</label><select id="proofLanguage"><option value="de-DE">Deutsch (Deutschland)</option><option value="de-AT">Deutsch (Österreich)</option><option value="de-CH">Deutsch (Schweiz)</option></select></div>
      <div class="field"><label for="proofEngine">Prüfverfahren</label><select id="proofEngine"><option value="local">Lokal · LanguageTool</option><option value="style">Stilanalyse · lokal</option><option value="premium">LanguageTool Premium · online</option><option value="codex">ChatGPT-Abo · Codex</option></select></div>
      <div id="proofAccount"></div><div class="field hidden" id="proofModelField"><label for="proofModel">KI-Modell</label><select id="proofModel"></select></div>
      <label class="proof-option" id="proofStyleLabel"><input type="checkbox" id="proofStyle"> Auch Stilhinweise anzeigen</label>
      <fieldset id="styleOptions" class="hidden"><legend>Hinweise zur Überarbeitung</legend><label class="proof-option"><input type="checkbox" id="styleRepetitions" data-style-setting="repetitions"> Wortwiederholungen</label><label class="proof-option"><input type="checkbox" id="styleSentences" data-style-setting="sentences"> Satzlängen</label><label class="proof-option"><input type="checkbox" id="styleWording" data-style-setting="wording"> Füllwörter &amp; Floskeln</label></fieldset>
      <label class="proof-option" id="proofAutoLabel"><input type="checkbox" id="proofAuto"> Lokal nach Eingabepause prüfen</label>
      <p class="muted" id="proofRecipient"></p><div class="proof-actions"><button id="proofRun" class="primary">Abschnitt prüfen</button><button id="proofCancel" class="hidden">Abbrechen</button></div>
      <p id="proofStatus" role="status" aria-live="polite">Bereit.</p><div id="styleOverview"></div><div id="proofResults"></div>
      <details class="proof-dictionary" id="proofDictionary"><summary>Projektwörterbuch</summary><div class="field"><label for="proofWords">Ein Begriff pro Zeile</label><textarea id="proofWords" rows="4"></textarea></div><button id="proofSaveWords">Wörterbuch speichern</button></details>`;
    this.el('proofRun').addEventListener('click',()=>void this.run());
    this.el('proofCancel').addEventListener('click',()=>{clearTimeout(this.timer);this.request++;this.analysisController?.abort();if(this.engine!=='style')void this.options.rpc('proofCancel').catch(()=>{});this.status('Prüfung abgebrochen.')});
    this.el('proofEngine').addEventListener('change',()=>{if(this.running&&this.engine!=='style')void this.options.rpc('proofCancel').catch(()=>{});this.engine=this.input('proofEngine').value;this.invalidate();this.status('Bereit.');this.refreshControls();void this.loadStatus()});
    this.el('proofModel').addEventListener('change',()=>{this.model=this.input('proofModel').value;this.invalidate()});
    this.el('proofStyle').addEventListener('change',()=>{this.style=this.input('proofStyle').checked;this.invalidate()});
    this.el('proofAuto').addEventListener('change',()=>{if(this.engine==='style'){void this.options.runAction(()=>this.saveStyleSetting('automatic',this.input('proofAuto').checked)).catch(e=>this.status(e.message,true));return}this.automatic=this.input('proofAuto').checked;this.changed(this.options.editor())});
    this.el('styleOptions').addEventListener('change',event=>{const input=event.target as HTMLInputElement;if(input.dataset.styleSetting)void this.options.runAction(()=>this.saveStyleSetting(input.dataset.styleSetting!,input.checked)).catch(e=>this.status(e.message,true))});
    this.el('proofLanguage').addEventListener('change',()=>void this.options.runAction(()=>this.changeLanguage()).catch(e=>this.status(e.message,true)));
    this.el('proofSaveWords').addEventListener('click',()=>void this.options.runAction(()=>this.saveWords()).catch(e=>this.status(e.message,true)));
    this.panel.addEventListener('pointerenter',()=>this.refreshControls());
    this.panel.addEventListener('focusin',()=>this.refreshControls());
    this.panel.addEventListener('click',event=>{const el=(event.target as HTMLElement).closest<HTMLElement>('[data-proof-action]');if(el){const action=el.dataset.proofAction!,work=()=>this.action(action,Number(el.dataset.id),Number(el.dataset.replacement));void (action==='allow'?this.options.runAction(work):work()).catch(e=>this.status(e.message,true))}});
  }
  private el(id:string){return document.getElementById(id)!}
  private input(id:string){return this.el(id) as HTMLInputElement}
  private status(message:string,error=false){this.el('proofStatus').textContent=message;this.el('proofStatus').classList.toggle('error',error)}
  show() {
    const project=this.options.project();if(!project)return;
    if(this.projectId!==project.id){this.invalidate();this.selectedRange=null;this.navigationRange=null;this.projectId=project.id;this.analysisSettings=styleSettings(project.settings.styleAnalysis);this.language=['de-DE','de-AT','de-CH'].includes(project.settings.proofLanguage)?project.settings.proofLanguage:'de-DE';this.input('proofLanguage').value=this.language}
    this.activated(this.options.editor());
    this.cardsChanged();
    if(!this.savingStyle)this.analysisSettings=styleSettings(project.settings.styleAnalysis);
    this.captureSelection();
    this.input('proofWords').value=this.dictionary().join('\n');this.input('proofWords').disabled=project.readOnly;this.input('proofSaveWords').disabled=project.readOnly;
    this.refreshControls();void this.loadStatus();
  }
  private refreshControls() {
    const analysis=this.engine==='style',readOnly=!!this.options.project()?.readOnly;
    this.el('proofAutoLabel').classList.toggle('hidden',this.engine!=='local'&&!analysis);this.el('proofModelField').classList.toggle('hidden',this.engine!=='codex');
    this.el('proofAccount').classList.toggle('hidden',analysis);this.el('proofStyleLabel').classList.toggle('hidden',analysis);this.el('proofDictionary').classList.toggle('hidden',analysis);this.el('styleOptions').classList.toggle('hidden',!analysis);
    this.input('proofLanguage').disabled=readOnly;
    this.input('proofAuto').checked=analysis?this.analysisSettings.automatic:this.automatic;this.input('proofAuto').disabled=analysis&&(readOnly||this.savingStyle);
    this.el('styleOptions').querySelectorAll<HTMLInputElement>('[data-style-setting]').forEach(input=>{input.checked=this.analysisSettings[input.dataset.styleSetting!];input.disabled=readOnly||this.savingStyle});
    const ed=this.options.editor();const blocks=ed&&['premium','codex'].includes(this.engine)?proofBlocks(ed.state.doc,this.selectedRange?.from,this.selectedRange?.to):[];
    const count=blocks.reduce((n,b)=>n+b.text.length,0);
    this.el('proofRecipient').textContent=analysis?'Lokale Anregungen zur Überarbeitung, keine Fehlerbewertung. Kein Konto oder Prüfdienst erforderlich.':this.engine==='local'?'Die Prüfung bleibt auf diesem Rechner.':`${count.toLocaleString('de-DE')} Zeichen werden beim Start an ${this.engine==='premium'?'LanguageTool':'OpenAI (ChatGPT-Abo)'} gesendet.`;
    this.el('proofRun').textContent=(this.selectedRange?'Markierung':'Abschnitt')+(analysis?' analysieren':' prüfen');this.input('proofRun').disabled=this.running||this.savingStyle||!ed;
    this.el('proofCancel').classList.toggle('hidden',!this.running);
  }
  private async loadStatus() {
    if(this.engine==='style'){this.el('proofAccount').textContent='';return}
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
  private async saveStyleSetting(key:string,value:boolean) {
    const project=this.options.project();if(!project||project.readOnly||this.savingStyle){this.refreshControls();return}
    const previous=project.settings.styleAnalysis,oldSettings=this.analysisSettings;
    this.invalidate();this.savingStyle=true;this.analysisSettings={...this.analysisSettings,[key]:value};project.settings.styleAnalysis=this.analysisSettings;this.refreshControls();
    try{
      await this.options.saveSettings();
      if(this.options.project()?.id===project.id){this.status('Stilanalyse-Einstellungen gespeichert.');this.schedule(this.options.editor())}
    }catch(e:any){project.settings.styleAnalysis=previous;if(this.options.project()?.id===project.id){this.analysisSettings=oldSettings;this.status(e.message,true)}}
    finally{this.savingStyle=false;if(this.options.project()?.id!==project.id)this.analysisSettings=styleSettings(this.options.project()?.settings.styleAnalysis);this.refreshControls()}
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
    clearTimeout(this.timer);this.analysisController?.abort();this.request++;this.findings=[];this.sentences=[];this.resultPage=0;this.sentencePage=0;this.paint();this.checkedEditor=null;this.snapshot=null;this.el('proofResults').innerHTML='';this.el('styleOverview').innerHTML='';
  }
  changed(ed:Editor|null) {
    if(ed!==this.options.editor())return;
    this.invalidate();this.selectedRange=null;this.navigationRange=null;this.status('Text geändert. Bitte erneut prüfen.');
    this.schedule(ed);this.refreshControls();
  }
  private schedule(ed:Editor|null) {
    const automatic=this.engine==='style'?this.analysisSettings.automatic:this.engine==='local'&&this.automatic;
    if(ed&&automatic&&this.panel.getClientRects().length){
      const engine=this.engine;
      const check=()=>{if(!this.panel.getClientRects().length||this.engine!==engine||this.options.editor()!==ed)return;if(this.running||this.savingStyle)this.timer=setTimeout(check,1500);else void this.run(true)};
      this.timer=setTimeout(check,1500);
    }
  }
  activated(ed:Editor|null) {
    if(ed===this.activeEditor)return;
    this.activeEditor=ed;this.reset();
  }
  captureSelection(){
    const ed=this.options.editor(),selection=window.getSelection();
    if(ed&&this.navigationRange&&ed.state.selection.from===this.navigationRange.from&&ed.state.selection.to===this.navigationRange.to)return;
    if(!ed||!selection?.anchorNode||!selection.focusNode||!ed.view.dom.contains(selection.anchorNode)||!ed.view.dom.contains(selection.focusNode))return;
    const anchor=ed.view.posAtDOM(selection.anchorNode,selection.anchorOffset),focus=ed.view.posAtDOM(selection.focusNode,selection.focusOffset);
    this.navigationRange=null;this.selectedRange=anchor===focus?null:{from:Math.min(anchor,focus),to:Math.max(anchor,focus)};
  }
  selectionChanged(ed:Editor){if(ed===this.options.editor()&&ed.view.hasFocus()){this.activated(ed);this.captureSelection()}}
  reset(){this.invalidate();this.selectedRange=null;this.navigationRange=null;this.status('Bereit.');this.refreshControls()}
  cardsChanged(){
    const signature=JSON.stringify((this.options.project()?.documents??[]).filter(isStoryCard).map((d:any)=>[d.id,d.title,d.deleted,d.meta.storyCard.aliases]));
    if(signature===this.namesSignature)return;this.namesSignature=signature;
    if(this.engine==='style'){this.invalidate();this.schedule(this.options.editor())}
  }
  private paint(){if(this.checkedEditor&&!this.checkedEditor.isDestroyed)this.checkedEditor.view.dispatch(this.checkedEditor.state.tr.setMeta(key,this.findings))}
  private renderResults() {
    const readOnly=this.options.project()?.readOnly;
    this.resultPage=Math.min(this.resultPage,Math.max(0,Math.ceil(this.findings.length/50)-1));
    this.el('proofResults').innerHTML=this.findings.slice(this.resultPage*50,this.resultPage*50+50).map(f=>`<article class="proof-finding" data-finding="${f.id}" data-rule="${h(f.issue.rule)}"><button class="proof-location" data-proof-action="locate" data-id="${f.id}">${h(excerpt(f.issue.original))}</button><small>${h(categories[f.issue.category]??'Hinweis')} · ${this.engine==='local'||this.engine==='style'?'Lokal':this.engine==='premium'?'LanguageTool Premium':'KI'}</small><p>${h(f.issue.message)}</p><div class="proof-actions">${f.issue.replacements.map((r:string,i:number)=>`<button ${readOnly?'disabled':''} data-proof-action="replace" data-id="${f.id}" data-replacement="${i}">${h(r||'Entfernen')}</button>`).join('')}<button data-proof-action="ignore" data-id="${f.id}">Ignorieren</button>${f.issue.category==='spelling'?`<button ${readOnly?'disabled':''} data-proof-action="allow" data-id="${f.id}">Wort erlauben</button>`:''}</div></article>`).join('')+this.pages('results',this.resultPage,this.findings.length);
    this.renderOverview();
  }
  private pages(kind:string,page:number,count:number) {
    return count>50?`<div class="proof-actions"><button data-proof-action="${kind}Page" data-id="${page-1}" ${page===0?'disabled':''}>Zurück</button><span>Seite ${page+1} / ${Math.ceil(count/50)}</span><button data-proof-action="${kind}Page" data-id="${page+1}" ${(page+1)*50>=count?'disabled':''}>Weiter</button></div>`:'';
  }
  private renderOverview() {
    if(this.engine!=='style'||!this.analysisSettings.sentences||!this.sentences.length){this.el('styleOverview').innerHTML='';return}
    const maximum=this.sentences.reduce((n,s)=>Math.max(n,s.words),1);
    this.el('styleOverview').innerHTML=`<h4>Satzlängen · ${this.sentences.length} Sätze / Ausschnitte</h4><p class="muted">Ab 30 Wörtern lang, ab 45 sehr lang. Orientierung, keine Qualitätsnote.</p><ol class="style-sentences" start="${this.sentencePage*50+1}">${this.sentences.slice(this.sentencePage*50,this.sentencePage*50+50).map((s,i)=>`<li><button data-proof-action="sentence" data-id="${this.sentencePage*50+i}" class="${s.fragment?'fragment':s.words>=45?'very-long':s.words>=30?'long':''}"><span>${s.fragment?'Ausschnitt':'Satz'} ${this.sentencePage*50+i+1}: ${s.words} Wörter</span><span class="style-sentence-bar" aria-hidden="true" style="width:${Math.max(2,s.words/maximum*100)}%"></span></button></li>`).join('')}</ol>`+this.pages('sentences',this.sentencePage,this.sentences.length);
  }
  private locate(ed:Editor,range:{from:number,to:number}) {
    this.navigationRange={from:range.from,to:range.to};ed.commands.setTextSelection(this.navigationRange);ed.commands.focus();ed.commands.scrollIntoView();
  }
  async run(auto=false) {
    if(this.running)return;
    const ed=this.options.editor();if(!ed||ed.isDestroyed){this.status('Bitte einen Textabschnitt öffnen.',true);return}
    if(auto){this.selectedRange=null;this.navigationRange=null}
    const analysis=this.engine==='style',range=auto?null:this.selectedRange;const blocks=analysis?[]:proofBlocks(ed.state.doc,range?.from,range?.to);if(!analysis&&!blocks.length){this.status('Kein Text zum Prüfen vorhanden.');return}
    this.invalidate();const request=this.request,project=this.options.project(),snapshot=ed.state.doc;this.running=true;this.refreshControls();this.status(analysis?'Text wird analysiert …':'Text wird geprüft …');
    try {
      if(analysis){
        const controller=new AbortController();this.analysisController=controller;
        const result=await analyzeStyle(snapshot,{from:range?.from,to:range?.to,language:project.settings.proofLanguage??'de-DE',settings:this.analysisSettings,cards:project.documents,signal:controller.signal});
        if(request!==this.request||ed.isDestroyed||this.options.editor()!==ed||!ed.state.doc.eq(snapshot)||this.options.project()?.id!==project.id)return;
        this.checkedEditor=ed;this.snapshot=snapshot;this.findings=result.findings;this.sentences=result.sentences;this.paint();this.renderResults();this.status(this.sentences.length?`${this.findings.length} Stilhinweise. Formulierungen bitte im Kontext beurteilen.`:'Kein Fließtext zum Analysieren vorhanden.');return;
      }
      const response=await this.options.rpc('proofCheck',{engine:this.engine,language:project.settings.proofLanguage??'de-DE',model:this.model,style:this.style,blocks:blocks.map(({id,text})=>({id,text}))});
      if(request!==this.request||ed.isDestroyed||this.options.editor()!==ed||!ed.state.doc.eq(snapshot)||this.options.project()?.id!==project.id){this.status('Text oder Prüfauswahl geändert. Ergebnisse verworfen.');return}
      this.checkedEditor=ed;this.snapshot=snapshot;this.findings=[];
      for(const issue of response.issues??[]){const span=proofRange(blocks,issue);if(!span||!categories[issue.category]||typeof issue.message!=='string'||!Array.isArray(issue.replacements)||!issue.replacements.every((r:any)=>typeof r==='string')||(!this.style&&issue.category==='style')||this.allowed(issue))continue;this.findings.push({id:this.findings.length,issue,...span})}
      this.paint();this.renderResults();this.status(`${this.findings.length} Hinweise. ${this.engine==='codex'?'KI-Vorschläge bitte sorgfältig prüfen.':''}`);
    } catch(e:any){if(request===this.request)this.status(e.message,true)}
    finally{this.running=false;this.analysisController=null;this.refreshControls()}
  }
  private async action(action:string,id:number,replacement:number) {
    if(action==='resultsPage'){this.resultPage=id;this.renderResults();return}
    if(action==='sentencesPage'){this.sentencePage=id;this.renderOverview();return}
    if(action==='sentence'){
      const ed=this.checkedEditor,range=this.sentences[id];if(ed&&range&&ed===this.options.editor()&&!ed.isDestroyed&&ed.state.doc.eq(this.snapshot))this.locate(ed,range);return;
    }
    if(action==='premiumConnect'){
      const form=await this.options.modal('LanguageTool Premium verbinden','<p>Verbindung über deinen LanguageTool-Zugriffsschlüssel. Zum Prüfen des Zugangs wird nur ein kurzer Beispielsatz gesendet.</p><div class="field"><label for="ltEmail">E-Mail</label><input type="email" id="ltEmail" name="email" autocomplete="username" required></div><div class="field"><label for="ltKey">Zugriffsschlüssel</label><input type="password" id="ltKey" name="key" autocomplete="off" required></div><p>Den Schlüssel findest du in den LanguageTool-Kontoeinstellungen unter Zugriffsschlüssel.</p>','Verbinden');
      this.input('ltKey').value='';
      if(form){this.status('Premium-Zugang wird geprüft …');await this.options.rpc('proofPremiumConnect',{username:String(form.get('email')),key:String(form.get('key'))});this.status('Premium-Konto verbunden.');await this.loadStatus()}return;
    }
    if(action==='premiumDisconnect'){this.status('Premium-Konto wird getrennt …');await this.options.rpc('proofPremiumDisconnect');await this.loadStatus();this.status('Premium-Konto getrennt.');return}
    if(action==='codexLogin'){await this.options.rpc('proofCodexLogin');this.status('Anmeldung im Browser abschließen, dann „Status aktualisieren“ wählen.');return}
    if(action==='codexRefresh'){await this.loadStatus();return}
    if(action==='codexLogout'){await this.options.rpc('proofCodexLogout');await this.loadStatus();return}
    const finding=this.findings.find(f=>f.id===id),ed=this.checkedEditor;if(!finding||!ed||ed.isDestroyed)return;
    if(!ed.state.doc.eq(this.snapshot)){this.invalidate();this.status('Der Text hat sich geändert. Bitte erneut prüfen.',true);return}
    if(action==='locate'){if(ed===this.options.editor())this.locate(ed,finding);return}
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
