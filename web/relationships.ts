import {escapeHtml as h} from './logic.mjs';
import {cardLabels} from './storycards.mjs';
import {emptyNetwork,liveCards,networkData,arrangeCards,edgePaths,validateEdge} from './relationships.mjs';

type Options={project:()=>any;visible:()=>boolean;openCard:(id:string)=>Promise<void>;show:()=>void;
  runAction:<T>(work:()=>T|Promise<T>)=>Promise<T>;
  save:(network:any)=>Promise<void>;modal:(title:string,body:string,button?:string)=>Promise<FormData|null>;error:(message:string)=>void};
export class Relationships {
  private selected='';private neighbors=false;private zoom:number|null=null;private scroll={x:0,y:0};private query='';
  private draft:any=null;private original='';private positions:Record<string,{x:number,y:number}>={};private pending:Promise<void>|null=null;
  private editor=document.getElementById('relationshipEditor')!;private gesture:{id:string;before:{x:number,y:number};unsaved?:{x:number,y:number}}|null=null;
  private layout:Record<string,{x:number,y:number}>={};
  private positionOriginal:Record<string,{x:number,y:number}>={};
  constructor(private options:Options){}
  private network(){return this.options.project()?.settings.relationshipNetwork??emptyNetwork()}
  private cards(){return liveCards(this.options.project()?.documents??[])}
  private dirty(){return this.draft&&JSON.stringify(this.draft)!==this.original}
  private fail(e:any){this.options.error(e.message??String(e))}
  reset(){this.selected='';this.neighbors=false;this.zoom=null;this.scroll={x:0,y:0};this.query='';this.draft=null;this.positions={};this.positionOriginal={};this.layout={};this.gesture=null;this.pending=null;this.renderEditor()}
  remember(){const el=document.getElementById('networkViewport');if(el)this.scroll={x:el.scrollLeft,y:el.scrollTop}}
  async beforeLeave(){
    if(this.pending)await this.pending;
    if(this.gesture)await this.finishMove();
    if(Object.keys(this.positions).length)throw new Error('Kartenpositionen sind noch nicht gespeichert. Bitte im Beziehungsnetz erneut speichern oder die Verschiebung verwerfen.');
    if(this.dirty()){this.options.show();throw new Error('Bitte die offene Beziehung speichern oder mit Abbrechen verwerfen.');}
    if(this.draft){this.draft=null;this.renderEditor()}
  }
  private button(action:string,label:string,id='',disabled=false){return `<button type="button" data-network-action="${action}" data-id="${h(id)}" ${disabled?'disabled':''}>${h(label)}</button>`}
  private description(e:any){const docs=this.options.project().documents;const name=(id:string)=>{const d=docs.find((d:any)=>d.id===id);return (d?.title??'Unbekannte Karte')+(d&&!d.deleted?'':' (nicht verfügbar)')};return `${name(e.fromId)} ${e.direction==='mutual'?'↔':'→'} ${e.label} ${e.direction==='mutual'?'↔':'→'} ${name(e.toId)}`}
  mount(target:HTMLElement,id:string){
    target.dataset.relationshipCard=id;
    const edges=this.network().edges.filter((e:any)=>e.fromId===id||e.toId===id);
    target.innerHTML=`<h4>Verknüpfte Karten</h4><div class="story-list">${edges.map((e:any)=>this.button('edge',this.description(e),e.id)).join('')||'<p class="muted">Noch keine Beziehungen.</p>'}</div>${this.button('new','Beziehung anlegen',id,this.options.project().readOnly)}`;this.wire(target);
  }
  async openCard(id:string){await this.beforeLeave();this.selected=id;await this.options.openCard(id);this.render()}
  async edit(id='',fromId=''){
    await this.beforeLeave();const p=this.options.project();if(p.readOnly&& !id)return;
    const existing=this.network().edges.find((e:any)=>e.id===id);
    if(id&&!existing)throw new Error('Die Beziehung ist nicht verfügbar.');
    this.draft=existing?structuredClone(existing):{id:crypto.randomUUID().replaceAll('-',''),fromId:fromId||this.selected||this.cards()[0]?.id||'',toId:'',label:'',direction:'directed',notes:''};
    this.original=JSON.stringify(this.draft);this.options.show();this.renderEditor();this.editor.scrollIntoView({block:'start'});this.editor.querySelector<HTMLElement>('select')?.focus();
  }
  private renderEditor(){
    this.editor.classList.toggle('hidden',!this.draft);if(!this.draft){this.editor.innerHTML='';return}
    const d=this.draft,disabled=this.options.project().readOnly||!!this.pending;
    const select=(key:string,title:string)=>{const cards=this.cards(),missing=d[key]&&!cards.some(c=>c.id===d[key]);return `<div class="field"><label for="relationship-${key}">${title}</label><select id="relationship-${key}" name="${key}" required ${disabled?'disabled':''}><option value="">Karte wählen</option>${missing?`<option selected value="${h(d[key])}">Nicht verfügbar (${h(d[key])})</option>`:''}${cards.map(c=>`<option value="${h(c.id)}" ${c.id===d[key]?'selected':''}>${h(c.title)} · ${h(cardLabels[c.meta.storyCard.type])}</option>`).join('')}</select></div>`};
    this.editor.innerHTML=`<form id="relationshipForm"><h3>Beziehung bearbeiten</h3>${select('fromId','Von')}${select('toId','Zu')}<div class="field"><label for="relationship-label">Beziehung</label><input id="relationship-label" name="label" maxlength="200" required value="${h(d.label)}" ${disabled?'disabled':''}></div><div class="field"><label for="relationship-direction">Richtung</label><select id="relationship-direction" name="direction" ${disabled?'disabled':''}><option value="directed">Gerichtet →</option><option value="mutual" ${d.direction==='mutual'?'selected':''}>Gegenseitig ↔</option></select></div><div class="field"><label for="relationship-notes">Notizen</label><textarea id="relationship-notes" name="notes" ${disabled?'disabled':''}>${h(d.notes)}</textarea></div><p id="relationshipError" role="alert"></p><div class="story-toolbar"><button type="submit" ${disabled?'disabled':''}>Speichern</button>${this.button('cancel','Abbrechen','',!!this.pending)}${this.network().edges.some((e:any)=>e.id===d.id)?this.button('remove','Beziehung entfernen',d.id,disabled):''}</div></form>`;
    this.editor.querySelector('form')!.addEventListener('input',()=>{for(const [key,value] of new FormData(this.editor.querySelector('form')!))this.draft[key]=String(value)});
    const owner=this.options.project().id;
    this.editor.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();void this.options.runAction(()=>this.saveEdge()).catch(error=>{if(owner!==this.options.project()?.id)return;this.renderEditor();const message=this.editor.querySelector('#relationshipError');if(message)message.textContent=error.message;this.fail(error)})});this.wire(this.editor);
  }
  private async persist(next:any){
    if(this.options.project().readOnly)throw new Error('Dieses Projekt ist schreibgeschützt.');
    if(this.pending)throw new Error('Das Beziehungsnetz wird noch gespeichert.');
    const owner=this.options.project().id;
    this.pending=this.options.save(next);this.renderEditor();
    try{await this.pending;if(owner!==this.options.project()?.id)throw new Error('Das Projekt wurde gewechselt.');}
    finally{if(owner===this.options.project()?.id){this.pending=null;this.renderEditor()}}
  }
  private async saveEdge(){
    const edge={...this.draft,label:this.draft.label.trim()},network=structuredClone(this.network());
    validateEdge(edge,network.edges,this.cards(),network.edges.find((e:any)=>e.id===edge.id));
    network.edges=network.edges.filter((e:any)=>e.id!==edge.id);network.edges.push(edge);
    network.positions=this.savedPositions();
    await this.persist(network);this.draft=null;this.renderEditor();this.render();this.options.show();
  }
  private async remove(id:string){
    const owner=this.options.project().id;
    if(!await this.options.modal('Beziehung entfernen','<p>Nur diese Verbindung entfernen? Beide Karten bleiben erhalten.</p>','Entfernen'))return;
    if(owner!==this.options.project()?.id)return;
    const next=structuredClone(this.network());next.edges=next.edges.filter((e:any)=>e.id!==id);await this.persist(next);this.draft=null;this.renderEditor();this.render();this.options.show();
  }
  update(){if(this.options.visible())this.render();const list=document.getElementById('storyRelationships');if(list?.dataset.relationshipCard)this.mount(list,list.dataset.relationshipCard)}
  render(remember=true){
    if(!this.options.visible())return;if(remember)this.remember();
    const p=this.options.project(),network=this.network(),all=this.cards();
    if(this.selected&&!all.some(c=>c.id===this.selected)){this.selected='';this.neighbors=false}
    const data=networkData(p.documents,network,this.selected,this.neighbors);
    const positions=arrangeCards(all,network.edges,{...this.layout,...network.positions,...this.positions});this.layout=positions;
    const routes=edgePaths(data.edges,positions);
    const width=Math.max(600,...data.cards.map(c=>positions[c.id].x+250),...routes.map(p=>p.x+110)),height=Math.max(350,...data.cards.map(c=>positions[c.id].y+150),...routes.map(p=>p.y+45));
    const pane=document.getElementById('editorPane')!;
    if(this.zoom===null)this.zoom=Math.max(.05,Math.min(1,(pane.clientWidth-35)/width,(pane.clientHeight-140)/height));
    const ro=p.readOnly,busy=!!this.pending;
    pane.innerHTML=`<section id="networkView"><div class="network-toolbar"><strong>Beziehungsnetz · ${data.cards.length} Karten · ${data.edges.length} Beziehungen</strong><div class="story-toolbar">${this.button('fit','Gesamtansicht')}${this.button('in','Vergrößern')}${this.button('out','Verkleinern')}${this.button('arrange','Neu anordnen','',ro||busy)}${this.button('new','Beziehung anlegen','',ro||busy||all.length<2)}</div><div class="network-search"><label for="networkSearch">Karte suchen</label><input id="networkSearch" type="search" value="${h(this.query)}"><div id="networkSearchResults" class="story-list"></div></div><label class="form-check"><input id="networkNeighbors" type="checkbox" ${this.neighbors?'checked':''} ${this.selected?'':'disabled'}> Nur direkte Verbindungen</label>${Object.keys(this.positions).length&&!this.gesture?`<div role="status">Positionen noch nicht gespeichert. ${this.button('retry','Erneut speichern','',busy)}${this.button('discardPositions','Verschiebung verwerfen','',busy)}</div>`:''}</div><p class="muted">Figuren, Orte und Gegenstände · Pfeile zeigen die Richtung. Verschiebegriff: Pfeiltasten, Eingabe zum Speichern, Escape zum Abbrechen.</p><div id="networkViewport" tabindex="0" aria-label="Beziehungsnetz, horizontal und vertikal scrollbar"><div style="width:${width*this.zoom}px;height:${height*this.zoom}px"><div id="networkCanvas" style="width:${width}px;height:${height}px;transform:scale(${this.zoom})"><svg id="networkLines" width="${width}" height="${height}" aria-hidden="true"></svg><div id="networkLabels"></div>${data.cards.map(c=>`<article class="network-card ${c.id===this.selected?'selected':''}" data-network-card="${h(c.id)}" style="left:${positions[c.id].x}px;top:${positions[c.id].y}px"><button class="network-card-open" type="button" data-network-action="card" data-id="${h(c.id)}"><small>${h(cardLabels[c.meta.storyCard.type])}</small><strong title="${h(c.title)}">${h(c.title)}</strong></button><button class="network-move" type="button" data-network-move="${h(c.id)}" aria-label="${h(c.title)} verschieben" ${ro||busy?'disabled':''}>✥</button></article>`).join('')}</div></div></div>${all.length?'':'<p>Noch keine Karten. Lege links eine Figur, einen Ort oder einen Gegenstand an.</p>'}</section>`;
    this.draw(data.edges,positions,routes);this.wire(pane);const viewport=document.getElementById('networkViewport')!;viewport.scrollLeft=this.scroll.x;viewport.scrollTop=this.scroll.y;
    pane.querySelector('#networkSearch')!.addEventListener('input',e=>{this.query=(e.target as HTMLInputElement).value;this.search()});this.search();
    pane.querySelector('#networkNeighbors')!.addEventListener('change',e=>{this.neighbors=(e.target as HTMLInputElement).checked;this.render();document.querySelector(`[data-network-card="${this.selected}"]`)?.scrollIntoView({block:'center',inline:'center'})});
    for(const handle of pane.querySelectorAll<HTMLButtonElement>('[data-network-move]'))this.drag(handle,positions,data.edges);
  }
  private draw(edges:any[],positions:any,paths=edgePaths(edges,positions)){
    const svg=document.getElementById('networkLines');if(!svg)return;
    svg.innerHTML='<defs><marker id="networkArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>'+paths.map(p=>`<path class="network-hit" d="${p.path}" data-network-action="edge" data-id="${h(p.edge.id)}"/><path class="network-line" d="${p.path}" marker-end="url(#networkArrow)" ${p.edge.direction==='mutual'?'marker-start="url(#networkArrow)"':''}/>`).join('');
    this.wire(svg);const labels=document.getElementById('networkLabels')!;labels.innerHTML=paths.map(p=>`<button type="button" class="network-edge" data-network-action="edge" data-id="${h(p.edge.id)}" aria-label="${h(this.description(p.edge))}" title="${h(this.description(p.edge))}" style="left:${p.x}px;top:${p.y}px">${h(p.edge.label)} ${p.edge.direction==='mutual'?'↔':'→'}</button>`).join('');this.wire(labels);
  }
  private search(){const list=document.getElementById('networkSearchResults');if(!list)return;const q=this.query.trim().toLocaleLowerCase('de');list.innerHTML=q?this.cards().filter(c=>[c.title,...c.meta.storyCard.aliases].some(s=>s.toLocaleLowerCase('de').includes(q))).slice(0,30).map(c=>this.button('focus',`${c.title} · ${cardLabels[c.meta.storyCard.type]}`,c.id)).join('')||'<p>Keine Karte gefunden.</p>':'';this.wire(list)}
  private async focus(id:string){await this.openCard(id);this.zoom=Math.max(this.zoom??1,.75);this.render();document.querySelector(`[data-network-card="${id}"]`)?.scrollIntoView({block:'center',inline:'center'});document.querySelector<HTMLButtonElement>(`[data-network-card="${id}"] .network-card-open`)?.focus()}
  private wire(target:HTMLElement){for(const b of target.querySelectorAll<HTMLButtonElement>('[data-network-action]')){if(b.dataset.wired)continue;b.dataset.wired='true';b.addEventListener('click',()=>void this.options.runAction(()=>this.action(b.dataset.networkAction!,b.dataset.id!)).catch(e=>this.fail(e)))}}
  private async action(action:string,id:string){
    if(action==='cancel'){this.draft=null;this.renderEditor();return}
    if(action==='remove'){await this.remove(id);return}
    if(action==='edge'){await this.edit(id);return}
    if(action==='new'){await this.edit('',id);return}
    if(action==='card'){await this.openCard(id);return}
    if(action==='focus'){await this.focus(id);return}
    if(action==='retry'){await this.savePositions();return}
    if(action==='discardPositions'){Object.assign(this.layout,this.positionOriginal);this.positions={};this.positionOriginal={};this.render();return}
    if(action==='arrange'){await this.beforeLeave();const next=structuredClone(this.network());next.positions=arrangeCards(this.cards(),next.edges);await this.persist(next);this.zoom=null;this.scroll={x:0,y:0};this.render(false);return}
    this.remember();if(action==='fit'){this.zoom=null;this.scroll={x:0,y:0}}else{const previous=this.zoom??1;this.zoom=Math.max(.05,Math.min(3,previous*(action==='in'?1.25:.8)));this.scroll={x:this.scroll.x*this.zoom/previous,y:this.scroll.y*this.zoom/previous}}this.render(false);
  }
  private drag(handle:HTMLButtonElement,positions:any,edges:any[]){
    const id=handle.dataset.networkMove!,card=handle.closest<HTMLElement>('.network-card')!;
    let cleanup=()=>{};
    const begin=()=>{if(this.pending||this.dirty()||this.options.project().readOnly){this.options.error('Bitte zuerst die offene Änderung abschließen.');return false}this.gesture??={id,before:{...positions[id]},unsaved:this.positions[id]&&{...this.positions[id]}};this.positionOriginal[id]??={...positions[id]};return true};
    const move=(x:number,y:number)=>{const point={x:Math.max(0,Math.min(1_000_000,x)),y:Math.max(0,Math.min(1_000_000,y))};positions[id]=point;this.positions[id]=point;card.style.left=point.x+'px';card.style.top=point.y+'px';this.draw(edges,positions)};
    const cancel=()=>{cleanup();if(!this.gesture)return;positions[id]=this.gesture.before;this.layout[id]=this.gesture.before;if(this.gesture.unsaved)this.positions[id]=this.gesture.unsaved;else delete this.positions[id];this.gesture=null;this.render()};
    handle.addEventListener('pointerdown',event=>{if(event.button!==0||!begin())return;event.preventDefault();handle.focus();handle.setPointerCapture(event.pointerId);const start={x:event.clientX,y:event.clientY},before={...positions[id]};
      const motion=(e:PointerEvent)=>move(before.x+(e.clientX-start.x)/(this.zoom??1),before.y+(e.clientY-start.y)/(this.zoom??1));
      const stop=()=>{cleanup();if(this.gesture)void this.options.runAction(()=>this.finishMove()).catch(e=>this.fail(e))};
      cleanup=()=>{handle.removeEventListener('pointermove',motion);handle.removeEventListener('pointerup',stop);handle.removeEventListener('pointercancel',cancel);if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId)};
      handle.addEventListener('pointermove',motion);handle.addEventListener('pointerup',stop,{once:true});handle.addEventListener('pointercancel',cancel,{once:true});
    });
    handle.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();cancel();return}if(e.key==='Enter'&&this.gesture){e.preventDefault();void this.options.runAction(()=>this.finishMove()).catch(error=>this.fail(error));return}const shifts:Record<string,number[]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};if(shifts[e.key]){e.preventDefault();if(!begin())return;move(positions[id].x+shifts[e.key][0],positions[id].y+shifts[e.key][1])}});
    handle.addEventListener('blur',()=>{if(this.gesture?.id===id)void this.options.runAction(()=>this.finishMove()).catch(e=>this.fail(e))});
  }
  private async finishMove(){this.gesture=null;await this.savePositions()}
  private savedPositions(){const positions={...this.network().positions};for(const c of this.cards()){const point=this.positions[c.id]??this.layout[c.id];if(point)positions[c.id]={...point}}return positions}
  private async savePositions(){if(!Object.keys(this.positions).length)return;const next=structuredClone(this.network());next.positions=this.savedPositions();try{await this.persist(next);this.positions={};this.positionOriginal={}}finally{this.render()}}
}
