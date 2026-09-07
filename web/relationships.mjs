import {isStoryCard} from './storycards.mjs';
export const nodeSize={width:200,height:86};
export const emptyNetwork=()=>({edges:[],positions:{}});
export const liveCards=documents=>documents.filter(d=>isStoryCard(d)&&!d.deleted).sort((a,b)=>a.title.localeCompare(b.title,'de')||a.id.localeCompare(b.id));
export function edgeKey(e){const pair=e.direction==='mutual'?[e.fromId,e.toId].sort():[e.fromId,e.toId];return JSON.stringify([...pair,e.direction,e.label.trim()]);}
export function validateEdge(edge,edges,cards,previous){
  if(!edge.fromId||!edge.toId||edge.fromId===edge.toId)throw new Error('Bitte zwei unterschiedliche Karten auswählen.');
  if(!['directed','mutual'].includes(edge.direction)||!edge.label.trim()||edge.label.trim().length>200)throw new Error('Bitte eine Beziehung mit höchstens 200 Zeichen benennen.');
  for(const field of ['fromId','toId'])if((!previous||previous[field]!==edge[field])&&!cards.some(c=>c.id===edge[field]))throw new Error('Eine ausgewählte Karte ist nicht verfügbar.');
  if(edges.some(e=>e.id!==edge.id&&edgeKey(e)===edgeKey(edge)))throw new Error('Diese Beziehung besteht bereits.');
}
export function networkData(documents,network=emptyNetwork(),selected='',neighbors=false){
  let cards=liveCards(documents);const available=new Set(cards.map(c=>c.id));
  let edges=network.edges.filter(e=>available.has(e.fromId)&&available.has(e.toId));
  if(neighbors&&available.has(selected)){const ids=new Set([selected]);for(const e of edges)if(e.fromId===selected||e.toId===selected){ids.add(e.fromId);ids.add(e.toId)}cards=cards.filter(c=>ids.has(c.id));edges=edges.filter(e=>ids.has(e.fromId)&&ids.has(e.toId))}
  return {cards,edges};
}
export function arrangeCards(cards,edges,existing={}){
  const positions=structuredClone(existing),ids=new Set(cards.map(c=>c.id)),adj=new Map(cards.map(c=>[c.id,new Set()]));
  for(const e of edges)if(ids.has(e.fromId)&&ids.has(e.toId)){adj.get(e.fromId).add(e.toId);adj.get(e.toId).add(e.fromId)}
  const visited=new Set(),groups=[],isolated=[];
  for(const c of cards){if(visited.has(c.id))continue;if(!adj.get(c.id).size){isolated.push(c.id);visited.add(c.id);continue}const group=[c.id];visited.add(c.id);for(let i=0;i<group.length;i++)for(const id of adj.get(group[i]))if(!visited.has(id)){visited.add(id);group.push(id)}groups.push(group)}
  if(isolated.length)groups.push(isolated);
  let row=Object.values(positions).reduce((n,p)=>Math.max(n,Math.ceil((p.y+nodeSize.height)/170)),0);
  for(const group of groups){const missing=group.filter(id=>!positions[id]);for(let i=0;i<missing.length;i++)positions[missing[i]]={x:40+(i%4)*290,y:40+(row+Math.floor(i/4))*170};if(missing.length)row+=Math.ceil(missing.length/4)+1}
  return positions;
}
export function edgePaths(edges,positions){
  const obstacles=Object.values(positions);
  const groups=new Map();for(const e of edges){const key=[e.fromId,e.toId].sort().join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)}
  const paths=[];for(const group of groups.values())group.sort((a,b)=>a.id.localeCompare(b.id)).forEach((edge,i)=>{
    const a=positions[edge.fromId],b=positions[edge.toId];if(!a||!b)return;
    const ax=a.x+100,ay=a.y+43,bx=b.x+100,by=b.y+43,dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy)||1;
    const side=edge.fromId<edge.toId?1:-1,offset=(i-(group.length-1)/2)*132*side;
    const boundary=(x,y)=>1/Math.max(Math.abs(x)/108,Math.abs(y)/51,0.0001);
    const start=boundary(dx,dy),end=boundary(-dx,-dy),x1=ax+dx*start,y1=ay+dy*start,x2=bx-dx*end,y2=by-dy*end;
    let cx=0,cy=0,x=0,y=0;
    // ponytail: bounded greedy label placement; replace only if larger dense networks need routed edges.
    for(let attempt=0;attempt<200;attempt++){
      const shift=offset+(attempt%2?1:-1)*Math.ceil(attempt/2)*160;
      cx=(ax+bx)/2-(dy/length||(!dx?1:0))*shift;cy=(ay+by)/2+dx/length*shift;
      x=(x1+2*cx+x2)/4;y=(y1+2*cy+y2)/4;
      if(x>=100&&y>=32&&!obstacles.some(p=>x+95>p.x-8&&x-95<p.x+208&&y+27>p.y-8&&y-27<p.y+94)&&!paths.some(p=>Math.abs(x-p.x)<190&&Math.abs(y-p.y)<54))break;
    }
    paths.push({edge,path:`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,x,y});
  });return paths;
}
