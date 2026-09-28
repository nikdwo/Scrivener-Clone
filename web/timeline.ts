import {escapeHtml as h} from './logic.mjs';
import {isScene,isStoryCard,cardLabels} from './storycards.mjs';
import {formatPoint,validateTimeline,timelineData,layoutLane,pointRange,minutePoint,editTimeline,timelineScenes} from './timeline.mjs';

type Options={project:()=>any;generation:()=>number;runAction:<T>(work:()=>T|Promise<T>)=>Promise<T>;current:()=>any;selected:()=>string;visible:()=>boolean;changed:(d:any)=>void;
  flush:()=>Promise<void>;saveSettings:()=>Promise<void>;select:(id:string)=>Promise<void>;openText:(id:string)=>Promise<void>;
  getDoc:(id:string)=>Promise<any>;modal:(title:string,body:string,button?:string)=>Promise<FormData|null>;error:(message:string)=>void;inspector:()=>void};
export class Timeline {
  private filters={strand:'',figure:'',place:'',item:''};
  private zoom=1;private scroll=0;private top=0;private busy=false;
  private drafts=new Map<string,{values:string[];error:string}>();
  private geometry={low:0,high:1439,width:120};
  private extent:{low:number;high:number}|null=null;
  private gesture:any=null;private suppressClick=false;private scrollFrame=0;
  constructor(private options:Options){
    let width=0;
    new ResizeObserver(entries=>{const next=Math.round(entries[0].contentRect.width);if(next!==width){width=next;this.update()}}).observe(document.getElementById('editorPane')!);
  }
  reset(){this.cancelDrag();this.extent=null;this.filters={strand:'',figure:'',place:'',item:''};this.zoom=1;this.scroll=0;this.top=0;this.drafts.clear()}
  assertValid(){const draft=this.drafts.values().next().value;if(draft)throw new Error(draft.error+' Bitte die Zeitangaben im Notizbuch abschließen.');}
  remember(){const scroll=document.getElementById('timelineScroll');if(scroll){this.scroll=scroll.scrollLeft;this.top=document.getElementById('editorPane')!.scrollTop}}
  update(){if(!this.gesture&&this.options.visible()&&document.getElementById('timelineView'))this.render()}
  private button(action:string,label:string,id='',disabled=false){return `<button type="button" data-timeline-action="${action}" data-id="${h(id)}" ${disabled?'disabled':''}>${h(label)}</button>`}
  private async settings(next:any){
    if(this.busy)throw new Error('Die Zeitstrahleinstellungen werden noch gespeichert.');
    const p=this.options.project();if(p.readOnly)throw new Error('Dieses Projekt ist schreibgeschützt.');
    await this.options.flush();if(this.options.project().id!==p.id)throw new Error('Das Projekt wurde gewechselt.');
    const previous=p.settings.timeline;p.settings.timeline=next;this.busy=true;
    try{await this.options.saveSettings()}catch(e){p.settings.timeline=previous;throw e}
    finally{this.busy=false;if(this.options.project()?.id===p.id){this.update();this.options.inspector()}}
  }
  async setup(){
    const p=this.options.project();if(p.settings.timeline||p.readOnly)return;
    const form=await this.options.modal('Zeitstrahl einrichten',`<p>Die Zeitbasis gilt für das gesamte Projekt und bleibt nach dem Einrichten fest.</p><div class="field"><label for="timelineBasis">Zeitbasis</label><select id="timelineBasis" name="basis"><option value="relative">Relative Tage (Tag 1, Tag 2 …)</option><option value="calendar">Kalenderdaten</option></select></div><p class="muted">Tag 0 und negative Tage sind möglich. Uhrzeiten sind optional. Eine spätere Umrechnung ist in dieser Version nicht vorgesehen.</p>`,'Zeitstrahl einrichten');
    if(!form)return;if(this.options.project().id!==p.id)throw new Error('Das Projekt wurde gewechselt.');
    await this.settings({basis:String(form.get('basis')),strands:[]});
  }
  private async strand(action:string,id:string){
    const p=this.options.project(),config=p.settings.timeline;if(!config||p.readOnly)return;
    const next=JSON.parse(JSON.stringify(config)),entry=next.strands.find((s:any)=>s.id===id);
    if(action==='deleteStrand'){
      if(p.documents.some((d:any)=>d.meta.timeline?.strandId===id))throw new Error('Dieser Handlungsstrang ist noch zugeordnet, möglicherweise im Papierkorb.');
      if(!await this.options.modal('Handlungsstrang löschen',`<p>„${h(entry?.name)}“ löschen?</p>`,'Löschen'))return;
      next.strands=next.strands.filter((s:any)=>s.id!==id);
    }else{
      const form=await this.options.modal(entry?'Handlungsstrang umbenennen':'Handlungsstrang anlegen',`<div class="field"><label for="timelineStrandName">Name</label><input id="timelineStrandName" name="name" maxlength="200" required value="${h(entry?.name??'')}"></div>`);
      if(!form)return;const name=String(form.get('name')).trim();if(!name)throw new Error('Bitte einen Namen eingeben.');
      if(entry)entry.name=name;else next.strands.push({id:crypto.randomUUID().replaceAll('-',''),name});
    }
    if(this.options.project().id!==p.id)throw new Error('Das Projekt wurde gewechselt.');await this.settings(next);
  }
  private wire(target:HTMLElement){
    for(const button of target.querySelectorAll<HTMLButtonElement>('[data-timeline-action]'))button.addEventListener('click',()=>{
      if(this.suppressClick)return;
      const action=button.dataset.timelineAction!,id=button.dataset.id!;
      void this.options.runAction(async()=>{
        if(action==='setup')await this.setup();
        else if(action==='select')await this.options.select(id);
        else if(action==='text')await this.options.openText(id);
        else if(['newStrand','renameStrand','deleteStrand'].includes(action))await this.strand(action,id);
        else if(action==='manage')await this.manage();
        else {this.cancelDrag();this.remember();if(action==='fit')this.extent=null;const previous=this.zoom;this.zoom=action==='fit'?1:Math.max(1,Math.min(64,this.zoom*(action==='in'?2:.5)));this.scroll=action==='fit'?0:this.scroll*this.zoom/previous;this.render(false)}
      }).catch(e=>this.options.error(e.message));
    });
  }
  private async manage(){
    const p=this.options.project();
    const promise=this.options.modal('Handlungsstränge',`<div id="timelineStrands">${p.settings.timeline.strands.map((s:any)=>`<div class="timeline-strand-entry"><strong>${h(s.name)}</strong><div>${this.button('renameStrand','Umbenennen',s.id,p.readOnly)}${this.button('deleteStrand','Löschen',s.id,p.readOnly||p.documents.some((d:any)=>d.meta.timeline?.strandId===s.id))}</div></div>`).join('')||'<p>Noch keine Handlungsstränge angelegt.</p>'}<p class="muted">Vor dem Löschen alle Zuordnungen entfernen, auch bei Szenen im Papierkorb.</p>${this.button('newStrand','Handlungsstrang anlegen','',p.readOnly)}</div>`,'Schließen');
    // Close the shared dialog before opening its next form.
    document.getElementById('timelineStrands')!.querySelectorAll<HTMLButtonElement>('[data-timeline-action]').forEach(button=>button.addEventListener('click',()=>{
      const dialog=document.getElementById('dialog') as HTMLDialogElement;
      dialog.addEventListener('close',()=>void this.options.runAction(()=>this.strand(button.dataset.timelineAction!,button.dataset.id!)).catch(e=>this.options.error(e.message)),{once:true});dialog.close('cancel');
    }));await promise;
  }
  render(remember=true){
    if(this.gesture)return;
    if(remember)this.remember();const p=this.options.project(),config=p.settings.timeline,target=document.getElementById('editorPane')!;
    const focused=document.activeElement as HTMLElement,focusId=focused?.dataset.timelineScene;
    if(!config){target.innerHTML=`<section id="timelineView" class="empty-state"><h2>Wann spielt deine Geschichte?</h2><p>Ordne Szenen zeitlich ein und verfolge parallele Handlungen.</p>${this.button('setup','Zeitstrahl einrichten','',p.readOnly)}${p.readOnly?'<p>Dieses Projekt ist schreibgeschützt.</p>':''}</section>`;this.wire(target);return}
    const strands=config.strands.map((s:any)=>[s.id,s.name]);strands.push(['none','Ohne Handlungsstrang']);
    for(const d of p.documents){const id=d.meta.timeline?.strandId;if(id&&!strands.some((s:any)=>s[0]===id))strands.push([id,'Nicht verfügbarer Handlungsstrang'])}
    const select=(key:string,label:string,entries:string[][])=>{
      if(this.filters[key]&&!entries.some(e=>e[0]===this.filters[key]))this.filters[key]='';
      return `<div class="field"><label for="timelineFilter-${key}">${label}</label><select id="timelineFilter-${key}" data-timeline-filter="${key}"><option value="">Alle</option>${entries.map(([id,name])=>`<option value="${h(id)}" ${this.filters[key]===id?'selected':''}>${h(name)}</option>`).join('')}</select></div>`;
    };
    const filterHtml=select('strand','Handlungsstrang',strands)+['figure','place','item'].map(type=>select(type,cardLabels[type],p.documents.filter((d:any)=>isStoryCard(d)&&!d.deleted&&d.meta.storyCard.type===type).map((d:any)=>[d.id,d.title]))).join('');
    const data=timelineData(p.documents,config,this.filters),style=getComputedStyle(target),width=Math.max(120,target.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-410)*this.zoom;
    if(this.extent){data.low=Math.min(data.low,this.extent.low);data.high=Math.max(data.high,this.extent.high)}
    this.geometry={low:data.low,high:data.high,width};
    const date=(minute:number)=>{
      const day=Math.floor(minute/1440),clock=((Math.floor(minute)%1440)+1440)%1440;
      const label=config.basis==='relative'?'Tag '+day:new Date(day*86400000).toISOString().slice(0,10).split('-').reverse().join('.');
      return label+(data.high-data.low<=7*1440?' · '+String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0'):'');
    };
    const label=(event:any)=>formatPoint(event.scene.meta.timeline.start,config.basis)+(event.end?' → '+formatPoint(event.scene.meta.timeline.end,config.basis):'');
    const sceneButton=(d:any,time:string)=>`<button type="button" class="timeline-scene ${d.id===this.options.selected()?'selected':''}" data-timeline-scene="${h(d.id)}" data-timeline-drag="move" data-timeline-action="select" data-id="${h(d.id)}" aria-pressed="${d.id===this.options.selected()}" title="${h(d.title+' · '+time+' · Ziehen verschiebt; Leertaste startet Tastaturverschiebung')}"><strong>${h(d.title)}</strong><small>${h(time)}</small></button>`;
    const grip=(id:string,edge:string)=>`<button type="button" class="timeline-grip ${edge}" data-timeline-drag="${edge}" data-id="${h(id)}" aria-label="${edge==='start'?'Beginn':'Ende'} verschieben" ${p.readOnly?'disabled':''}></button>`;
    const tickCount=Math.max(2,Math.min(7,Math.floor(width/150)+1));
    const ticks=Array.from({length:tickCount},(_,i)=>`<span style="left:${i*width/(tickCount-1)}px">${h(date(data.low+(data.high-data.low)*i/(tickCount-1)))}</span>`).join('');
    target.innerHTML=`<section id="timelineView"><div class="timeline-toolbar"><h2>Zeitstrahl</h2><span class="muted">${data.count} Szenen · ${config.basis==='relative'?'Relative Tage':'Kalenderdaten'}</span>${this.button('manage','Handlungsstränge','',this.busy)}${this.button('fit','Gesamtansicht')}${this.button('in','Vergrößern','',this.zoom>=64)}${this.button('out','Verkleinern','',this.zoom<=1)}</div><div class="timeline-filters">${filterHtml}</div><p class="muted">Alle Manuskriptszenen · Auswahl öffnet rechts die Details. Gestrichelte Grenzen sind tagesgenau; ihre Uhrzeit ist offen.</p><div id="timelineScroll" class="timeline-scroll" tabindex="0" role="region" aria-label="Zeitachse, horizontal scrollbar"><div class="timeline-axis" style="width:${width+410}px"><div class="timeline-ticks" style="width:${width}px">${ticks}</div></div>${data.lanes.map((lane:any)=>{
      const events=layoutLane(lane.events,data.low,data.high,width);
      return `<section class="timeline-lane" data-timeline-lane="${h(lane.id)}" aria-label="${h(lane.name)}" style="width:${width+410}px"><h3>${h(lane.name)}</h3><div class="timeline-track">${events.map((event:any)=>`<div class="timeline-row" data-timeline-row="${h(event.scene.id)}" data-order="${event.order}"><div class="timeline-event ${event.end?'duration':'instant'}" data-timeline-event="${h(event.scene.id)}" style="left:${event.left}px;top:0"><div class="timeline-span" data-timeline-drag="move" data-id="${h(event.scene.id)}" style="width:${event.span}px">${grip(event.scene.id,'start')}${grip(event.scene.id,'end')}${event.start.approximate?`<span class="timeline-uncertain start" style="width:${Math.min(event.span,event.startWidth)}px"></span>`:''}${event.end?.approximate?`<span class="timeline-uncertain end" style="width:${Math.min(event.span,event.endWidth)}px"></span>`:''}</div>${sceneButton(event.scene,label(event))}</div></div>`).join('')||'<p class="muted timeline-empty">Keine zeitlich eingeordnete Szene.</p>'}</div></section>`;
    }).join('')}</div><h3>Noch nicht zeitlich eingeordnet</h3><div class="timeline-unplanned">${data.unplanned.map((d:any)=>sceneButton(d,'Ohne Beginn')).join('')||'<p class="muted">Keine ungeplanten Szenen für diese Filter.</p>'}</div></section>`;
    this.wire(target);this.wireDragging(target);for(const el of target.querySelectorAll<HTMLSelectElement>('[data-timeline-filter]'))el.addEventListener('change',()=>{this.cancelDrag();this.extent=null;this.filters[el.dataset.timelineFilter!]=el.value;this.scroll=0;this.render(false);(document.getElementById(el.id) as HTMLElement)?.focus({preventScroll:true})});
    document.getElementById('timelineScroll')!.scrollLeft=this.scroll;target.scrollTop=this.top;
    if(focusId)target.querySelector<HTMLElement>(`[data-timeline-scene="${CSS.escape(focusId)}"]`)?.focus({preventScroll:true});
  }
  cancelDrag(){
    cancelAnimationFrame(this.scrollFrame);this.scrollFrame=0;
    const g=this.gesture;if(!g)return;this.gesture=null;g.preview?.remove();g.tip?.remove();g.placeholder?.remove();
    document.querySelectorAll('.timeline-drop-lane').forEach(el=>el.classList.remove('timeline-drop-lane'));
    if(g.started){this.suppressClick=true;setTimeout(()=>this.suppressClick=false,0)}
  }
  private beginDrag(handle:HTMLElement,x:number,y:number,keyboard=false){
    const p=this.options.project();if(p.readOnly||this.busy)return false;
    this.assertValid();this.cancelDrag();
    const id=handle.dataset.id!,scene=p.documents.find((d:any)=>d.id===id&&!d.deleted);if(!scene)return false;
    const value=structuredClone(scene.meta.timeline??{}),mode=value.start?handle.dataset.timelineDrag!:'place';
    const point=value.start?pointRange(value[mode==='end'?'end':'start']??value.start,p.settings.timeline.basis):null,baseMinute=point?(mode==='end'?point.high:point.low):this.geometry.low;
    const anchor=this.minuteAt(x);
    this.gesture={p,owner:this.options.generation(),id,value,mode,handle,x,y,originX:x,originY:y,anchor,lastX:x,lastMinute:anchor,delta:0,baseMinute,minute:baseMinute,
      strand:value.strandId??'none',order:timelineScenes(p.documents).findIndex((d:any)=>d.id===id),keyboard,started:keyboard,next:null};
    if(keyboard)this.previewDrag();return true;
  }
  private minuteAt(x:number){
    const track=document.querySelector<HTMLElement>('.timeline-track')!;
    return Math.round(this.geometry.low+(x-track.getBoundingClientRect().left)*(this.geometry.high-this.geometry.low)/this.geometry.width);
  }
  private previewDrag(){
    const g=this.gesture;if(!g)return;
    if(!g.preview){g.preview=document.createElement('div');g.preview.className='timeline-drag-preview';document.getElementById('timelineView')!.append(g.preview);g.tip=document.createElement('div');g.tip.className='timeline-drag-tip';g.tip.setAttribute('role','status');document.body.append(g.tip)}
    const basis=g.p.settings.timeline.basis;
    try{
      g.next=editTimeline(g.value,basis,g.mode,g.mode==='move'?g.delta:g.minute,g.strand);
      const {start,end}=validateTimeline(g.next,basis),lane=document.querySelector<HTMLElement>(`[data-timeline-lane="${g.strand}"]`);
      if(!lane)throw new Error('Zum Einordnen auf eine Handlungsbahn ziehen.');
      if(g.strand!=='none'&&!g.p.settings.timeline.strands.some((s:any)=>s.id===g.strand)&&g.strand!==g.value.strandId)throw new Error('Dieser Handlungsstrang ist nicht verfügbar.');
      document.querySelectorAll('.timeline-drop-lane').forEach(el=>el.classList.remove('timeline-drop-lane'));lane.classList.add('timeline-drop-lane');
      const track=lane.querySelector<HTMLElement>('.timeline-track')!,scale=this.geometry.width/(this.geometry.high-this.geometry.low);
      let row=track.querySelector<HTMLElement>(`[data-timeline-row="${CSS.escape(g.id)}"]`);
      if(row){g.placeholder?.remove();g.placeholder=null}
      else{
        if(g.placeholder?.parentElement!==track){
          g.placeholder?.remove();g.placeholder=document.createElement('div');g.placeholder.className='timeline-row timeline-drag-row';
          const following=[...track.querySelectorAll<HTMLElement>('[data-timeline-row]')].find(el=>Number(el.dataset.order)>g.order);
          track.insertBefore(g.placeholder,following??null);
        }
        row=g.placeholder;
      }
      row!.append(g.preview);
      g.preview.style.cssText=`position:absolute;left:${(start.low-this.geometry.low)*scale}px;top:0;width:${Math.max(4,((end?.high??start.high)-start.low)*scale)}px`;
      const position=formatPoint(minutePoint(g.keyboard||g.fine?g.mode==='end'?end.high:start.low:g.cursorMinute??g.minute,basis),basis);
      g.tip.textContent=`Position: ${position}\nBeginn: ${formatPoint(g.next.start,basis)}${g.next.end?'\nEnde: '+formatPoint(g.next.end,basis):''}\n${lane.getAttribute('aria-label')} · Escape bricht ab${g.keyboard?' · Pfeiltasten ändern, Enter übernimmt':g.fine?' · Feinziehen: 1 Pixel = 1 Minute':' · Umschalt: minutengenau feinziehen'}`;
      g.tip.classList.remove('error');
    }catch(e:any){g.next=null;g.tip.textContent=e.message+' · Escape bricht ab';g.tip.classList.add('error')}
    g.tip.style.left=Math.max(8,Math.min(window.innerWidth-310,g.x+18))+'px';g.tip.style.top=Math.max(8,Math.min(window.innerHeight-g.tip.offsetHeight-8,g.y+20))+'px';
  }
  private pointerDrag(x:number,y:number,fine=false){
    const g=this.gesture;if(!g||g.keyboard)return;g.x=x;g.y=y;
    if(!g.started&&Math.hypot(x-g.originX,y-g.originY)<(fine?1:4))return;g.started=true;
    g.cursorMinute=this.minuteAt(x);g.delta+=fine?x-g.lastX:g.cursorMinute-g.lastMinute;
    g.lastX=x;g.lastMinute=g.cursorMinute;g.fine=fine;g.minute=(g.mode==='start'||g.mode==='end'?g.baseMinute:g.anchor)+g.delta;
    if(g.mode==='move'||g.mode==='place'){
      const lane=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-timeline-lane]');
      if(lane)g.strand=lane.dataset.timelineLane;
    }
    this.previewDrag();
    if(!this.scrollFrame)this.scrollFrame=requestAnimationFrame(()=>this.dragScroll());
  }
  private dragScroll(){
    this.scrollFrame=0;const g=this.gesture,scroll=document.getElementById('timelineScroll');if(!g||g.keyboard||!g.started||!scroll)return;
    const rect=scroll.getBoundingClientRect(),direction=g.x<rect.left+36?-1:g.x>rect.right-36?1:0;
    if(direction){
      if(direction<0&&scroll.scrollLeft<=1||direction>0&&scroll.scrollLeft+scroll.clientWidth>=scroll.scrollWidth-1){
        const extra=100,scale=this.geometry.width/(this.geometry.high-this.geometry.low);
        if(direction<0){
          this.geometry.low-=extra/scale;
          document.querySelectorAll<HTMLElement>('.timeline-event,.timeline-ticks span').forEach(el=>el.style.left=(parseFloat(el.style.left)+extra)+'px');
        }else this.geometry.high+=extra/scale;
        this.geometry.width+=extra;
        document.querySelectorAll<HTMLElement>('.timeline-axis,.timeline-lane').forEach(el=>el.style.width=(this.geometry.width+410)+'px');
        if(direction<0)scroll.scrollLeft+=extra;
        this.extent={low:this.geometry.low,high:this.geometry.high};
      }
      scroll.scrollLeft+=direction*12;
    }
    const pane=document.getElementById('editorPane')!,paneRect=pane.getBoundingClientRect();if(g.y>paneRect.bottom-35)pane.scrollTop+=10;else if(g.y<paneRect.top+35)pane.scrollTop-=10;
    this.pointerDrag(g.x,g.y,g.fine);
  }
  private async finishDrag(){
    const g=this.gesture;if(!g)return;const next=g.next,started=g.started;this.cancelDrag();
    if(!started)return;if(!next){this.render();return}
    try{
      if(this.options.generation()!==g.owner||g.p.readOnly)return;
      await this.options.flush();if(this.options.generation()!==g.owner)return;
      const d=await this.options.getDoc(g.id);if(this.options.generation()!==g.owner)return;
      if(d.deleted||JSON.stringify(d.meta.timeline??{})!==JSON.stringify(g.value))throw new Error('Die Szenenzeiten wurden inzwischen geändert. Bitte erneut ziehen.');
      if(JSON.stringify(next)!==JSON.stringify(g.value)){d.meta.timeline=next;this.options.changed(d);this.options.inspector();await this.options.flush()}
      this.options.inspector();
    }catch(e:any){this.options.error(e.message)}
    finally{if(this.options.generation()===g.owner&&this.options.visible())this.render()}
  }
  private wireDragging(target:HTMLElement){
    const root=target.querySelector<HTMLElement>('#timelineView')!;
    root.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;const handle=(event.target as HTMLElement).closest<HTMLElement>('[data-timeline-drag]');if(!handle)return;
      try{if(this.beginDrag(handle,event.clientX,event.clientY)){handle.setPointerCapture(event.pointerId);handle.focus({preventScroll:true});event.preventDefault()}}catch(e:any){this.options.error(e.message)}
    });
    root.addEventListener('pointermove',event=>this.pointerDrag(event.clientX,event.clientY,event.shiftKey));
    root.addEventListener('pointerup',()=>{void this.options.runAction(()=>this.finishDrag()).catch(e=>this.options.error(e.message))});
    root.addEventListener('pointercancel',()=>{this.cancelDrag();this.render()});
    root.addEventListener('lostpointercapture',()=>{if(this.gesture&&!this.gesture.keyboard){this.cancelDrag();this.render()}});
    root.addEventListener('keydown',event=>{
      const handle=(event.target as HTMLElement).closest<HTMLElement>('[data-timeline-drag]');
      if(event.key==='Escape'&&this.gesture){event.preventDefault();event.stopPropagation();this.cancelDrag();this.render();return}
      if(!handle)return;
      if(event.key===' '&&!this.gesture){event.preventDefault();const r=handle.getBoundingClientRect();try{this.beginDrag(handle,r.left,r.bottom,true)}catch(e:any){this.options.error(e.message)}return}
      const g=this.gesture;if(!g?.keyboard)return;
      if(event.key==='Enter'||event.key===' '){event.preventDefault();void this.options.runAction(()=>this.finishDrag()).catch(e=>this.options.error(e.message));return}
      if(event.key==='Tab'){this.cancelDrag();return}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        const step=(event.shiftKey?60:1)*(event.key==='ArrowLeft'?-1:1);g.delta+=step;g.minute+=step;
      }else if(g.mode==='move'||g.mode==='place'){
        const ids=[...root.querySelectorAll<HTMLElement>('[data-timeline-lane]')].map(el=>el.dataset.timelineLane!),index=ids.indexOf(g.strand);
        g.strand=ids[Math.max(0,Math.min(ids.length-1,index+(event.key==='ArrowUp'?-1:1)))];
      }
      this.previewDrag();
    });
  }
  inspector(target:HTMLElement,d:any){
    const p=this.options.project();if(!isScene(d,p.documents))return;
    const section=document.createElement('section');section.className='timeline-details';target.append(section);
    const config=p.settings.timeline,disabled=p.readOnly||this.busy;
    if(!config){section.innerHTML='<h3>Zeit &amp; Handlung</h3>'+this.button('setup','Zeitstrahl einrichten','',disabled);this.wire(section);return}
    const value=d.meta.timeline??{},draft=this.drafts.get(d.id),values=draft?.values??[value.start?.day??'',value.start?.time??'',value.end?.day??'',value.end?.time??'',value.strandId??''];
    const input=(id:string,label:string,value:any,type:string)=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${h(value)}" type="${type}" ${type==='text'?'inputmode="numeric"':''} ${disabled?'disabled':''}></div>`;
    const strands=config.strands.map((s:any)=>[s.id,s.name]);if(values[4]&&!strands.some((s:any)=>s[0]===values[4]))strands.push([values[4],'Nicht verfügbar – bitte neu zuordnen']);
    section.innerHTML=`<h3>Zeit &amp; Handlung</h3><p class="muted">${config.basis==='relative'?'Relative Tage, auch 0 und negative Tage':'Kalenderdaten'} · Uhrzeiten sind optional.</p>${input('timelineStartDay','Beginn – '+(config.basis==='relative'?'Tag':'Datum'),values[0],config.basis==='relative'?'text':'date')}${input('timelineStartTime','Beginn – Uhrzeit',values[1],'time')}${input('timelineEndDay','Ende – '+(config.basis==='relative'?'Tag':'Datum')+' (optional)',values[2],config.basis==='relative'?'text':'date')}${input('timelineEndTime','Ende – Uhrzeit',values[3],'time')}<div class="field"><label for="timelineSceneStrand">Handlungsstrang</label><select id="timelineSceneStrand" ${disabled?'disabled':''}><option value="">Ohne Handlungsstrang</option>${strands.map(([id,name]:string[])=>`<option value="${h(id)}" ${id===values[4]?'selected':''}>${h(name)}</option>`).join('')}</select></div><p id="timelineFieldError" class="error" role="status">${h(draft?.error??'')}</p><div class="timeline-detail-actions">${this.button('newStrand','Handlungsstrang anlegen','',disabled)}${this.button('text','Text öffnen',d.id)}</div>`;
    this.wire(section);
    const inputs=[...section.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')];
    for(const input of inputs)input.addEventListener('input',()=>{
      if(this.options.project()?.id!==p.id||p.readOnly)return;
      const values=inputs.map(el=>el.value),next:any={};let error='';
      try{
        const point=(day:string,time:string)=>{
          if(!day){if(time)throw new Error('Eine Uhrzeit benötigt einen Tag oder ein Datum.');return null}
          if(config.basis==='relative'&&!/^-?\d+$/.test(day))throw new Error('Bitte einen ganzen relativen Tag angeben.');
          return {day:config.basis==='relative'?Number(day):day,...(time?{time}:{})};
        };
        if(inputs.some(el=>!el.validity.valid))throw new Error('Bitte die Zeitangabe vollständig eingeben.');
        const start=point(values[0],values[1]),end=point(values[2],values[3]);if(start)next.start=start;if(end)next.end=end;if(values[4])next.strandId=values[4];
        validateTimeline(next,config.basis);this.drafts.delete(d.id);
        if(Object.keys(next).length)d.meta.timeline=next;else delete d.meta.timeline;
        this.options.changed(d);
      }catch(e:any){error=e.message;this.drafts.set(d.id,{values,error})}
      section.querySelector('#timelineFieldError')!.textContent=error;
      inputs.forEach(el=>el.setAttribute('aria-invalid',String(!!error)));
    });
  }
}
