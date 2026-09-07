import {Extension, Editor} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet, EditorView} from '@tiptap/pm/view';
import {cardFields, cardLabels, cardMatches, isStoryCard, inManuscript, isScene} from './storycards.mjs';
import {escapeHtml as h} from './logic.mjs';

type Options = {
  project:()=>any; scene:()=>any; editor:()=>Editor|null; getDoc:(id:string)=>Promise<any>;
  changed:(d:any)=>void; flush:()=>Promise<void>; refresh:(project?:any)=>Promise<void>;
  rpc:(action:string,args?:any)=>Promise<any>; modal:(title:string,body:string,button?:string)=>Promise<FormData|null>;
  show:()=>void; select:(id:string)=>Promise<void>; trash:(id:string)=>Promise<void>; error:(message:string)=>void; saveSettings:()=>Promise<void>;
  beforeLeave:()=>Promise<void>;mountRelationships:(target:HTMLElement,id:string)=>void;
};
type Hit = {from:number;to:number;name:string;ids:string[]};
const key = new PluginKey('storyCards');
const label = (d:any) => cardLabels[d.meta.storyCard.type];

export class StoryCards {
  private panel = document.getElementById('storyCardsPanel')!;
  private openId:string|null = null;
  private opened:any = null;
  private choices:string[] = [];
  private query = '';
  private filter = '';
  private request = 0;
  private projectId = '';
  private reveal = false;
  private views = new Map<EditorView,{id:string;refresh:()=>void}>();
  constructor(private options:Options) {
    this.panel.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-story-action]');
      if (button) void this.action(button.dataset.storyAction!, button.dataset.id ?? '').catch(e=>this.options.error(e.message));
    });
  }
  private cards() { return (this.options.project()?.documents ?? []).filter((d:any)=>isStoryCard(d)&&!d.deleted); }
  private scene() { const p=this.options.project(), d=this.options.scene();return p&&isScene(d,p.documents)?d:null; }
  private writable() { if(!this.options.project()||this.options.project().readOnly)throw new Error('Dieses Projekt ist schreibgeschützt.'); }
  private button(action:string,text:string,id='',disabled=false) {
    return `<button type="button" data-story-action="${action}" data-id="${h(id)}" ${disabled?'disabled':''}>${h(text)}</button>`;
  }
  private cardButton(d:any) { return this.button('open',`${d.title} · ${label(d)}`,d.id); }
  reset() { this.request++;this.openId=null;this.opened=null;this.choices=[];this.query='';this.filter='';this.projectId=''; }
  invalidate() { for(const value of this.views.values())value.refresh(); }

  extension(id:string) {
    const owner=this;
    return Extension.create({name:'storyCards',addProseMirrorPlugins:()=>[new Plugin({key,
      state:{init:()=>DecorationSet.empty,apply:(tr,old)=>{
        const hits:Hit[]|undefined=tr.getMeta(key);
        if(hits)return DecorationSet.create(tr.doc,hits.map(hit=>Decoration.inline(hit.from,hit.to,{
          class:'story-name','data-story-ids':hit.ids.join(','),title:'Karte öffnen: '+hit.name,
        },{ids:hit.ids})));
        return tr.docChanged?DecorationSet.empty:old;
      }},
      props:{decorations:state=>key.getState(state),handleDOMEvents:{mousedown:(_view,event)=>{
        if((event.target as HTMLElement).closest('[data-story-ids]')){event.preventDefault();return true}return false;
      },click:(_view,event)=>{
        const mark=(event.target as HTMLElement).closest<HTMLElement>('[data-story-ids]');
        if(!mark)return false;
        event.preventDefault();owner.openChoices(mark.dataset.storyIds!.split(','));return true;
      }}},
      view:view=>{
        let timer:ReturnType<typeof setTimeout>;
        const refresh=()=>{
          clearTimeout(timer);
          if(view.isDestroyed)return;
          view.dispatch(view.state.tr.setMeta(key,[]).setMeta('addToHistory',false));
          timer=setTimeout(()=>{
            if(view.isDestroyed)return;
            const p=owner.options.project(), d=p?.documents.find((d:any)=>d.id===id);
            const hits=p&&p.settings.recognizeCardNames!==false&&!isStoryCard(d)&&inManuscript(d,p.documents)?cardMatches(view.state.doc,owner.cards()):[];
            view.dispatch(view.state.tr.setMeta(key,hits).setMeta('addToHistory',false));
            owner.renderMatches();
          },250);
        };
        owner.views.set(view,{id,refresh});
        timer=setTimeout(refresh,0);
        return {update:(view,previous)=>{if(!view.state.doc.eq(previous.doc))refresh()},destroy:()=>{clearTimeout(timer);owner.views.delete(view)}};
      },
    })]});
  }
  openChoices(ids:string[]) {
    void this.choose(ids).catch(e=>this.options.error(e.message));
  }
  private async choose(ids:string[]) {
    await this.options.beforeLeave();
    const live=ids.filter(id=>this.cards().some((d:any)=>d.id===id));
    if(!live.length){this.options.error('Die Karte ist nicht verfügbar.');return}
    this.openId=live.length===1?live[0]:null;this.choices=live.length>1?live:[];this.reveal=true;this.options.show();
  }
  async open(id:string) { await this.options.beforeLeave();this.openId=id;this.choices=[];this.reveal=true;this.options.show(); }
  show() { void this.render().catch(e=>this.options.error(e.message)); }
  private async render() {
    const p=this.options.project();if(!p)return;
    if(this.projectId&&this.projectId!==p.id)this.reset();this.projectId=p.id;
    const request=++this.request, scene=this.scene(), disabled=p.readOnly;
    const open=this.openId?p.documents.find((d:any)=>d.id===this.openId):null;
    const card=open&&isStoryCard(open)&&!open.deleted?await this.options.getDoc(open.id):null;
    if(request!==this.request||p.id!==this.options.project()?.id)return;
    this.opened=card;
    this.panel.innerHTML=`<div class="story-toolbar">${this.button('newFigure','Figur anlegen','',disabled)}${this.button('newPlace','Ort anlegen','',disabled)}${this.button('newItem','Gegenstand anlegen','',disabled)}</div>
      <label class="form-check"><input id="storyRecognition" type="checkbox" ${p.settings.recognizeCardNames!==false?'checked':''} ${disabled?'disabled':''}> Namen automatisch erkennen</label>
      <section><h3>Dieser Szene zugeordnet</h3><div id="storyAssigned" class="story-list"></div></section>
      <section><h3>Im Text erkannt</h3><div id="storyDetected" class="story-list"></div></section>
      ${this.choices.length?`<section id="storyChoices"><h3>Name mehrdeutig – Karte wählen</h3><div class="story-list">${this.choices.map(id=>this.cards().find((d:any)=>d.id===id)).filter(Boolean).map(d=>this.cardButton(d)).join('')}</div></section>`:''}
      <div id="storyDetail">${card?this.detail(card,disabled):this.openId?'<p class="muted">Diese Karte ist im Papierkorb oder nicht verfügbar.</p>':''}</div>
      <section><h3>Alle Karten</h3><div class="field"><label for="storySearch">Karten durchsuchen</label><input id="storySearch" type="search" value="${h(this.query)}"></div>
      <div class="field"><label for="storyFilter">Kartentyp</label><select id="storyFilter"><option value="">Alle Kartentypen</option><option value="figure" ${this.filter==='figure'?'selected':''}>Figuren</option><option value="place" ${this.filter==='place'?'selected':''}>Orte</option><option value="item" ${this.filter==='item'?'selected':''}>Gegenstände</option></select></div><div id="storyList" class="story-list"></div></section>`;
    this.panel.querySelector('#storyAssigned')!.innerHTML=scene?(scene.meta.storyCardIds??[]).map((id:string)=>{
      const d=p.documents.find((d:any)=>d.id===id), available=d&&isStoryCard(d)&&!d.deleted;
      return `<div class="story-assignment">${available?this.cardButton(d):`<span>${h(d?.title??'Unbekannte Karte')} (nicht verfügbar)</span>`}${this.button('unassign','Zuordnung entfernen',id,disabled)}</div>`;
    }).join('')||'<p class="muted">Noch keine Karten zugeordnet.</p>':'<p class="muted">Öffne einen Textabschnitt im Manuskript, um Karten zuzuordnen.</p>';
    this.panel.querySelector<HTMLInputElement>('#storySearch')!.addEventListener('input',e=>{this.query=(e.target as HTMLInputElement).value;this.renderList()});
    this.panel.querySelector<HTMLSelectElement>('#storyFilter')!.addEventListener('change',e=>{this.filter=(e.target as HTMLSelectElement).value;this.renderList()});
    this.panel.querySelector('#storyRecognition')!.addEventListener('change',()=>void this.toggleRecognition().catch(e=>this.options.error(e.message)));
    if(card){this.bindFields(card);this.options.mountRelationships(this.panel.querySelector('#storyRelationships')!,card.id)}
    this.renderList();this.renderMatches();
    if(this.reveal){this.panel.querySelector(this.choices.length?'#storyChoices':'#storyDetail')?.scrollIntoView({block:'start'});this.reveal=false}
  }
  private detail(d:any,disabled:boolean) {
    const card=d.meta.storyCard, scene=this.scene();
    const input=(id:string,title:string,value:string,multiline=true)=>`<div class="field"><label for="${id}">${h(title)}</label>${multiline?`<textarea id="${id}" ${disabled?'disabled':''}>${h(value)}</textarea>`:`<input id="${id}" maxlength="500" required value="${h(value)}" ${disabled?'disabled':''}>`}</div>`;
    return `<section class="story-detail"><div class="story-toolbar"><h3>${label(d)} bearbeiten</h3>${this.button('close','Karte schließen')}</div>
      ${input('storyTitle','Name',d.title,false)}${input('storyAliases','Alternative Namen (ein Name pro Zeile)',card.aliases.join('\n'))}
      <div class="story-toolbar">${this.button('assign','Dieser Szene zuordnen',d.id,disabled||!scene||(scene.meta.storyCardIds??[]).includes(d.id))}${this.button('link','Markierten Text verknüpfen',d.id,disabled||!scene)}</div>
      ${Object.entries(cardFields[card.type]).map(([key,title])=>input('storyField-'+key,String(title),card.fields[key]??'')).join('')}
      <div id="storyRelationships"></div>
      <h4>Eigene Felder</h4>${Object.entries(d.meta.custom??{}).map(([name,value],i)=>`<div class="story-custom">${input('storyCustom-'+i,name,String(value))}${this.button('renameField','Feld umbenennen',String(i),disabled)}${this.button('removeField','Feld entfernen',String(i),disabled)}</div>`).join('')}
      ${this.button('addField','Eigenes Feld hinzufügen','',disabled)}
      <h4>Zugeordnete Szenen</h4><div class="story-list">${this.options.project().documents.filter((s:any)=>isScene(s,this.options.project().documents)&&(s.meta.storyCardIds??[]).includes(d.id)).map((s:any)=>this.button('scene',s.title,s.id)).join('')||'<p class="muted">Noch keine Szenen zugeordnet.</p>'}</div>
      ${this.button('trash','Karte in den Papierkorb',d.id,disabled)}</section>`;
  }
  private bindFields(d:any) {
    const bind=(id:string,update:(value:string)=>void)=>this.panel.querySelector<HTMLInputElement>('#'+id)!.addEventListener('input',e=>{
      if(this.options.project().readOnly)return;
      const input=e.target as HTMLInputElement;
      if(id==='storyTitle'&&!input.value.trim()){input.setCustomValidity('Bitte einen Namen eingeben.');input.reportValidity();return}
      if(id==='storyAliases'&&input.value.split('\n').some(s=>s.trim().length>500)){input.setCustomValidity('Ein Name darf höchstens 500 Zeichen enthalten.');input.reportValidity();return}
      input.setCustomValidity('');update(input.value);this.options.changed(d);this.renderList();
    });
    bind('storyTitle',value=>d.title=value.trim());
    bind('storyAliases',value=>d.meta.storyCard.aliases=[...new Set(value.split('\n').map(s=>s.trim()).filter(Boolean))]);
    for(const name of Object.keys(cardFields[d.meta.storyCard.type]))bind('storyField-'+name,value=>d.meta.storyCard.fields[name]=value);
    Object.keys(d.meta.custom??{}).forEach((name,i)=>bind('storyCustom-'+i,value=>d.meta.custom={...d.meta.custom,[name]:value}));
  }
  private renderList() {
    const list=this.panel.querySelector('#storyList');if(!list)return;
    const query=this.query.toLocaleLowerCase('de');
    list.innerHTML=this.cards().filter((d:any)=>(!this.filter||d.meta.storyCard.type===this.filter)&&[d.title,...d.meta.storyCard.aliases].some((s:string)=>s.toLocaleLowerCase('de').includes(query)))
      .sort((a:any,b:any)=>a.title.localeCompare(b.title,'de')||a.id.localeCompare(b.id)).map((d:any)=>this.cardButton(d)).join('')||'<p class="muted">Keine passenden Karten.</p>';
  }
  private renderMatches() {
    const target=this.panel.querySelector('#storyDetected');if(!target)return;
    const editor=this.options.editor(), view=editor?.view, entry=view?this.views.get(view):null;
    if(!view||!entry||this.options.project()?.settings.recognizeCardNames===false){target.innerHTML='<p class="muted">Keine aktiven Namenstreffer.</p>';return}
    const ids=new Set<string>();
    for(const decoration of (key.getState(view.state) as DecorationSet).find())for(const id of decoration.spec.ids)ids.add(id);
    target.innerHTML=[...ids].map(id=>this.cards().find((d:any)=>d.id===id)).filter(Boolean).map(d=>this.cardButton(d)).join('')||'<p class="muted">Keine bekannten Namen erkannt.</p>';
  }
  private async toggleRecognition() {
    this.writable();const p=this.options.project(), previous=p.settings.recognizeCardNames;
    p.settings.recognizeCardNames=this.panel.querySelector<HTMLInputElement>('#storyRecognition')!.checked;
    try {await this.options.saveSettings()}catch(e){p.settings.recognizeCardNames=previous;this.show();throw e}finally{this.invalidate()}
  }
  async create(type:'figure'|'place'|'item') {
    this.writable();await this.options.flush();
    const form=await this.options.modal(cardLabels[type]+' anlegen','<div class="field"><label for="storyNewName">Name</label><input id="storyNewName" name="name" maxlength="500" required></div>','Karte anlegen');
    const title=String(form?.get('name')??'').trim();if(!form||!title)return;
    const d=await this.options.rpc('create',{parent:'research',title,kind:'text',meta:{storyCard:{type,aliases:[],fields:{}},custom:{}}});
    await this.options.refresh();await this.open(d.id);
  }
  private async action(action:string,id:string) {
    await this.options.beforeLeave();
    if(action==='open'){await this.open(id);return}
    if(action==='close'){this.openId=null;this.show();return}
    if(action==='scene'){await this.options.select(id);return}
    if(action==='newFigure'||action==='newPlace'){await this.create(action==='newFigure'?'figure':'place');return}
    if(action==='newItem'){await this.create('item');return}
    this.writable();
    const scene=this.scene(), d=this.opened;
    if(action==='assign'||action==='unassign'){
      if(!scene)throw new Error('Bitte einen Textabschnitt im Manuskript öffnen.');
      if(action==='assign'&&!this.cards().some((d:any)=>d.id===id))throw new Error('Die Karte ist nicht verfügbar.');
      scene.meta.storyCardIds=action==='assign'?[...new Set([...(scene.meta.storyCardIds??[]),id])]:(scene.meta.storyCardIds??[]).filter((value:string)=>value!==id);
      this.options.changed(scene);this.show();return;
    }
    if(action==='link'){
      const editor=this.options.editor();
      if(!scene||!editor||editor.state.selection.empty)throw new Error('Bitte zuerst den Namen im Manuskript markieren.');
      if(!this.cards().some((d:any)=>d.id===id))throw new Error('Die Karte ist nicht verfügbar.');
      editor.chain().focus().setLink({href:'#'+id}).run();return;
    }
    if(!d||d.deleted)throw new Error('Die Karte ist nicht verfügbar.');
    if(action==='trash'){await this.options.trash(d.id);return}
    const entries=Object.entries(d.meta.custom??{}), old=entries[Number(id)];
    if(action==='addField'||action==='renameField'){
      const form=await this.options.modal(action==='addField'?'Eigenes Feld hinzufügen':'Feld umbenennen',`<div class="field"><label for="storyFieldName">Feldname</label><input id="storyFieldName" name="name" maxlength="500" required value="${h(action==='renameField'?old?.[0]??'':'')}"></div>`);
      if(!form)return;const name=String(form.get('name')).trim();if(!name)throw new Error('Bitte einen Feldnamen eingeben.');
      if(Object.hasOwn(d.meta.custom??{},name)&&!(action==='renameField'&&old?.[0]===name))throw new Error('Dieses Feld existiert bereits.');
      if(action==='addField')entries.push([name,'']);else entries[Number(id)]=[name,old[1]];
    }else if(action==='removeField'){
      if(!old)return;
      if(!await this.options.modal('Feld entfernen',`<p>Das Feld „${h(old[0])}“ und sein Inhalt werden entfernt.</p>`,'Entfernen'))return;
      entries.splice(Number(id),1);
    }else return;
    d.meta.custom=Object.fromEntries(entries);this.options.changed(d);this.show();
  }
}
