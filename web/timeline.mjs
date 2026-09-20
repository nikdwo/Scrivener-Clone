import {orderedDocuments} from './logic.mjs';
import {isStoryCard} from './storycards.mjs';

export function pointRange(point, basis) {
  let day;
  if (!point || Object.keys(point).some(k=>!['day','time'].includes(k))) throw new Error('Ungültige Zeitangabe.');
  if (basis==='relative') {
    day=point.day;
    if (!Number.isInteger(day)||day< -2147483648||day>2147483647) throw new Error('Bitte einen ganzen relativen Tag angeben.');
  } else if (basis==='calendar') {
    const value=point.day;
    if (typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000')) throw new Error('Bitte ein gültiges Kalenderdatum angeben.');
    const date=new Date(value+'T00:00:00Z');
    if (!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value) throw new Error('Bitte ein gültiges Kalenderdatum angeben.');
    day=date.getTime()/86400000;
  } else throw new Error('Bitte zuerst die Zeitbasis einrichten.');
  let low=day*1440;
  if (!Object.hasOwn(point,'time')) return {low,high:low+1439,approximate:true};
  if (typeof point.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(point.time)) throw new Error('Bitte eine Uhrzeit zwischen 00:00 und 23:59 angeben.');
  const [hours,minutes]=point.time.split(':').map(Number);low+=hours*60+minutes;
  return {low,high:low,approximate:false};
}
export function validateTimeline(value,basis) {
  if (!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['start','end','strandId'].includes(k))) throw new Error('Ungültige Szenenzeiten.');
  if (Object.hasOwn(value,'strandId')&&!/^[a-f\d]{32}$/i.test(value.strandId)) throw new Error('Ungültiger Handlungsstrang.');
  if (value.end&&!value.start) throw new Error('Ein Ende benötigt einen Beginn.');
  const start=Object.hasOwn(value,'start')?pointRange(value.start,basis):null;
  const end=Object.hasOwn(value,'end')?pointRange(value.end,basis):null;
  if(end&&start&&end.high<start.low)throw new Error('Das Ende darf nicht vor dem Beginn liegen.');
  return {start,end};
}
export function formatPoint(point,basis) {
  if(!point)return 'Ohne Zeitangabe';
  const label=basis==='relative'?'Tag '+point.day:point.day.split('-').reverse().join('.');
  return label+(point.time?' · '+point.time:' · tagesgenau');
}
export function minutePoint(minute,basis) {
  if(!Number.isFinite(minute))throw new Error('Ungültige Zeitposition.');
  minute=Math.round(minute);const day=Math.floor(minute/1440),clock=minute-day*1440;
  if(basis==='calendar'&&(day< -719162||day>2932896))throw new Error('Das Datum liegt außerhalb von Jahr 1 bis 9999.');
  const point={day:basis==='relative'?day:new Date(day*86400000).toISOString().slice(0,10),time:String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0')};
  pointRange(point,basis);return point;
}
// Move receives a delta; resize/place receive an absolute minute on the project axis.
export function editTimeline(value,basis,mode,minute,strand) {
  const next=structuredClone(value),ranges=validateTimeline(value,basis);
  if(mode==='place')next.start=minutePoint(minute,basis);
  else if(mode==='move'){
    if(!ranges.start)throw new Error('Dieser Abschnitt hat noch keinen Beginn.');
    const delta=Math.round(minute);
    next.start=minutePoint(ranges.start.low+delta,basis);
    if(ranges.end)next.end=minutePoint(ranges.end.high+delta,basis);
  }else if(mode==='start'||mode==='end'){
    if(!ranges.start)throw new Error('Dieser Abschnitt hat noch keinen Beginn.');
    next.start=minutePoint(ranges.start.low,basis);
    next.end=minutePoint(ranges.end?.high??ranges.start.high,basis);
    next[mode]=minutePoint(minute,basis);
  }else throw new Error('Unbekannte Zeitänderung.');
  if(strand!==undefined){if(strand==='none')delete next.strandId;else next.strandId=strand}
  validateTimeline(next,basis);return next;
}
export function timelineScenes(documents) {
  return orderedDocuments(documents.filter(d=>!isStoryCard(d)),'manuscript').filter(d=>['text','script'].includes(d.kind));
}
export function timelineData(documents,config,filters={}) {
  const all=timelineScenes(documents), order=new Map(all.map((d,i)=>[d.id,i]));
  const scenes=all.filter(d=>(!filters.strand|| (d.meta.timeline?.strandId??'none')===filters.strand)&&
    [filters.figure,filters.place,filters.item].every(id=>!id||(d.meta.storyCardIds??[]).includes(id)));
  const events=[],unplanned=[];
  for(const scene of scenes) {
    const value=scene.meta.timeline??{}, {start,end}=validateTimeline(value,config.basis);
    if(!start){unplanned.push(scene);continue}
    events.push({scene,start,end,low:start.low,high:end?.high??start.high,order:order.get(scene.id)});
  }
  events.sort((a,b)=>a.low-b.low||a.order-b.order);
  const lanes=config.strands.map(s=>({...s,events:[]}));lanes.push({id:'none',name:'Ohne Handlungsstrang',events:[]});
  const byId=new Map(lanes.map(l=>[l.id,l]));
  for(const event of events){const id=event.scene.meta.timeline?.strandId??'none';if(!byId.has(id)){const lane={id,name:'Nicht verfügbarer Handlungsstrang',events:[]};byId.set(id,lane);lanes.push(lane)}byId.get(id).events.push(event)}
  const low=events.length?Math.floor(events[0].low/1440)*1440:0;let high=low+1439;
  for(const e of events)high=Math.max(high,Math.floor(e.high/1440)*1440+1439);
  return {lanes:lanes.filter(l=>!filters.strand||l.id===filters.strand),unplanned,low,high,count:scenes.length};
}
export function layoutLane(events,low,high,width) {
  const rows=[],scale=width/Math.max(1,high-low);
  // ponytail: scan occupied subrows; replace with a heap if thousands of simultaneous scenes become a measured bottleneck.
  return events.map(event=>{
    const left=(event.low-low)*scale,span=Math.max(2,(event.high-event.low)*scale),occupied=Math.max(220,span)+12;
    let row=rows.findIndex(right=>right<=left);if(row<0)row=rows.length;rows[row]=left+occupied;
    return {...event,left,span,row,startWidth:event.start.approximate?Math.max(2,1439*scale):0,endWidth:event.end?.approximate?Math.max(2,1439*scale):0};
  });
}
