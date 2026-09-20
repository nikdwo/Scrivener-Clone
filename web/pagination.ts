import {Extension,Editor} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';

const key=new PluginKey('a4Pages');
const mm=96/25.4;
export const paper={width:210*mm,height:297*mm,margin:25*mm,gutter:24};
const stride=paper.height+paper.gutter,contentHeight=paper.height-2*paper.margin;
type Gap={pos:number;height:number;row?:number};
function spacer(height:number,row=0){
  const el=document.createElement(row?'tr':'span');el.className='a4-gap';el.setAttribute('aria-hidden','true');el.contentEditable='false';
  if(row){const cell=document.createElement('td');cell.colSpan=row;cell.style.cssText=`height:${height}px;padding:0;border:0;line-height:0`;el.append(cell)}
  else el.style.cssText=`display:block;height:${height}px;line-height:0;margin:0;padding:0;border:0;pointer-events:none`;
  return el;
}
export const pageExtension=Extension.create({name:'a4Pages',addProseMirrorPlugins:()=>[new Plugin({key,
  state:{init:()=>DecorationSet.empty,apply:(tr,old)=>{
    const gaps:Gap[]|undefined=tr.getMeta(key);return gaps?DecorationSet.create(tr.doc,gaps.map((g,i)=>Decoration.widget(g.pos,()=>spacer(g.height,g.row),{side:-1,key:`${i}-${g.pos}-${g.height}`,ignoreSelection:true}))):old.map(tr.mapping,tr.doc);
  }},props:{decorations:state=>key.getState(state)}
})]});

/** Measure a detached copy, then update view decorations once. The document and history never contain pages. */
export class Pagination {
  private sheet:HTMLElement|null=null;private editors:Editor[]=[];private request=0;private timer:any;
  private measure:HTMLElement|null=null;private observer:ResizeObserver;
  constructor(private pane:HTMLElement){this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(pane)}
  reset(){++this.request;clearTimeout(this.timer);this.measure?.remove();this.measure=null;this.sheet=null;this.editors=[]}
  mount(sheet:HTMLElement,editors:Editor[]){
    this.reset();this.sheet=sheet;this.editors=[...editors];sheet.classList.add('paginated');
    const flow=document.createElement('div');flow.className='a4-flow';flow.append(...sheet.childNodes);sheet.append(flow);
    const pages=document.createElement('div');pages.className='a4-pages';pages.setAttribute('aria-hidden','true');sheet.prepend(pages);
    sheet.addEventListener('load',()=>this.changed(),true);document.fonts.ready.then(()=>{if(this.sheet===sheet)this.changed()});this.fit();this.changed();
  }
  private fit(){if(!this.sheet)return;const css=getComputedStyle(this.pane),width=this.pane.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);this.sheet.style.zoom=String(Math.min(1,Math.max(.1,width/paper.width)))}
  changed(){if(!this.sheet)return;++this.request;clearTimeout(this.timer);this.timer=setTimeout(()=>void this.layout(),80)}
  private async layout(){
    const sheet=this.sheet,version=this.request;if(!sheet?.isConnected)return;
    if(this.editors.some(e=>e.view.composing)){this.timer=setTimeout(()=>void this.layout(),80);return}
    const states=this.editors.map(e=>e.state.doc),valid=()=>version===this.request&&sheet===this.sheet&&sheet.isConnected&&this.editors.every((e,i)=>!e.isDestroyed&&e.state.doc===states[i]);
    this.measure?.remove();const copy=sheet.cloneNode(true) as HTMLElement,host=document.createElement('div');this.measure=host;
    copy.classList.add('a4-measure');copy.style.zoom='1';copy.style.minHeight='0';copy.style.height='auto';copy.setAttribute('aria-hidden','true');copy.inert=true;
    const mapping=new Map<globalThis.Node,globalThis.Node>(),reverse=new Map<globalThis.Node,globalThis.Node>();
    const pair=(a:globalThis.Node,b:globalThis.Node)=>{mapping.set(b,a);reverse.set(a,b);for(let i=0;i<a.childNodes.length;i++)pair(a.childNodes[i],b.childNodes[i])};pair(sheet,copy);
    copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));copy.querySelectorAll('.a4-pages,.a4-gap').forEach(el=>el.remove());
    const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style');
    style.textContent=[...document.styleSheets].map(s=>[...s.cssRules].map(r=>r.cssText).join('\n')).join('\n');shadow.append(style,copy);
    document.body.append(host);sheet.dataset.pagination='busy';
    const textMap=new Map<Text,{editor:number;pos:number}>(),elementMap=new Map<Element,{editor:number;pos:number}>();
    const gaps:Gap[][]=this.editors.map(()=>[]),outside:{element:Element;height:number}[]=[];
    this.editors.forEach((editor,index)=>{
      const walker=document.createTreeWalker(editor.view.dom,NodeFilter.SHOW_TEXT);let node:Text|null;
      while(node=walker.nextNode() as Text|null){if(node.parentElement?.closest('.ProseMirror-widget,[data-footnote]'))continue;const clone=reverse.get(node) as Text;if(clone?.isConnected)textMap.set(clone,{editor:index,pos:editor.view.posAtDOM(node,0)})}
      editor.state.doc.descendants((node,pos)=>{if(node.isText)return;const dom=editor.view.nodeDOM(pos);const clone=dom&&reverse.get(dom);if(clone instanceof Element)elementMap.set(clone,{editor:index,pos})});
    });
    const top=()=>copy.getBoundingClientRect().top;
    const overflow=(r:DOMRect)=>{
      const y=r.top-top(),bottom=r.bottom-top(),page=Math.max(0,Math.floor(y/stride)),end=page*stride+paper.height-paper.margin;
      return bottom>end+.5?((page+1)*stride+paper.margin-y):0;
    };
    const add=(element:Element,height:number,row=0)=>{
      const at=elementMap.get(element),gap=spacer(height,row);element.before(gap);
      if(at)gaps[at.editor].push({pos:at.pos,height,row});else{const original=mapping.get(element);if(original instanceof Element)outside.push({element:original,height})}
    };
    try{
      // ponytail: remeasure after each break; incremental block caches only if large-document profiling warrants them.
      let slice=performance.now();
      while(valid()){
        let candidate:any=null;
        const consider=(c:any)=>{if(c.height>0&&(!candidate||c.rect.top<candidate.rect.top-.5))candidate=c};
        for(const row of copy.querySelectorAll('tr:not(.a4-gap)')){const rect=row.getBoundingClientRect();if(rect.height<=contentHeight&&elementMap.has(row)){const columns=Math.max(...[...row.closest('table')!.rows].filter(r=>!r.classList.contains('a4-gap')).map(r=>[...r.cells].reduce((sum,c)=>sum+c.colSpan,0)));consider({element:row,rect,height:overflow(rect),row:columns})}}
        for(const element of copy.querySelectorAll('img,.section-label,p,h1,h2,h3')){if(!element.matches('img,.section-label')&&element.textContent?.trim())continue;const rect=element.getBoundingClientRect();if(rect.height<=contentHeight)consider({element,rect,height:overflow(rect)})}
        const walker=document.createTreeWalker(copy.querySelector('.a4-flow')!,NodeFilter.SHOW_TEXT);let text:Text|null;
        while(text=walker.nextNode() as Text|null){
          if(!textMap.has(text)||!text.data.trim())continue;
          const range=document.createRange();range.selectNodeContents(text);
          for(const rect of range.getClientRects())if(rect.height>0&&rect.width>0){const height=overflow(rect);if(height>0){consider({node:text,rect,height});break}}
        }
        if(!candidate)break;
        const {element,node,rect,height,row}=candidate;
        if(element)add(element,height,row);
        else{
          // Locate the first UTF-16 position on the overflowing visual line, including marked text.
          const range=document.createRange();let lo=0,hi=node.length;
          while(lo<hi){const mid=Math.floor((lo+hi)/2);range.setStart(node,mid);range.setEnd(node,Math.min(node.length,mid+1));const r=range.getBoundingClientRect();if(r.top<rect.top-.5)lo=mid+1;else hi=mid}
          if(lo>=node.length)throw new Error('Eine Textzeile konnte nicht aufgeteilt werden.');
          const at=textMap.get(node)!,tail=node.splitText(lo);textMap.set(tail,{editor:at.editor,pos:at.pos+lo});
          tail.before(spacer(height));gaps[at.editor].push({pos:at.pos+lo,height});
        }
        if(performance.now()-slice>12){await new Promise(resolve=>setTimeout(resolve,0));slice=performance.now()}
      }
      if(!valid())return;
      const flow=copy.querySelector<HTMLElement>('.a4-flow')!,bottom=flow.getBoundingClientRect().bottom-top(),count=Math.max(1,Math.ceil((bottom+paper.gutter)/stride));
      const focus=document.activeElement,scroll=this.pane.scrollTop,active=this.editors.find(e=>e.view.dom.contains(focus));
      const caretTop=active?.view.coordsAtPos(active.state.selection.head).top;
      sheet.querySelectorAll('.a4-flow > .a4-gap').forEach(el=>el.remove());
      for(const {element,height} of outside)if(element.isConnected)element.before(spacer(height));
      this.editors.forEach((editor,i)=>editor.view.dispatch(editor.state.tr.setMeta(key,gaps[i]).setMeta('addToHistory',false)));
      sheet.style.minHeight=(count*stride-paper.gutter)+'px';
      sheet.querySelector('.a4-pages')!.innerHTML=Array.from({length:count},(_,i)=>`<div class="a4-paper" style="top:${i*stride}px"><span>${i+1}</span></div>${i<count-1?`<div class="a4-page-margin" style="top:${i*stride+paper.height-paper.margin}px"></div>`:''}`).join('');
      sheet.dataset.pages=String(count);sheet.dataset.pagination='ready';
      const behavior=this.pane.style.scrollBehavior;this.pane.style.scrollBehavior='auto';
      this.pane.scrollTop=scroll+(active&&caretTop!==undefined?active.view.coordsAtPos(active.state.selection.head).top-caretTop:0);this.pane.style.scrollBehavior=behavior;
      if(focus instanceof HTMLElement&&focus.isConnected&&document.activeElement!==focus)focus.focus({preventScroll:true});
    }catch(error){if(valid()){sheet.dataset.pagination='error';sheet.title='Seitenlayout: '+(error as Error).message;console.error(error)}}
    finally{host.remove();if(this.measure===host)this.measure=null}
  }
}
