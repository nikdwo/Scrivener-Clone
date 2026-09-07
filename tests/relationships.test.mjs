import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeCards,networkData,edgePaths,validateEdge,edgeKey} from '../web/relationships.mjs';
const id=n=>n.toString(16).padStart(32,'0');
const card=(n,type='figure')=>({id:id(n),title:'Karte '+n,meta:{storyCard:{type,aliases:[],fields:{}}}});
const edge=(n,from,to,label='vertraut',direction='directed')=>({id:id(n),fromId:id(from),toId:id(to),label,direction,notes:''});
test('relationships preserve direction, reject duplicate pairs and accept distinct labels and unavailable unchanged endpoints',()=>{
 const cards=[card(1),card(2,'place'),card(3,'item')],a=edge(10,1,2),b=edge(11,2,1);
 validateEdge(a,[],cards);validateEdge(b,[a],cards);
 assert.throws(()=>validateEdge({...a,id:id(12),label:' vertraut '},[a],cards));
 assert.throws(()=>validateEdge(edge(12,1,1),[],cards));assert.throws(()=>validateEdge(edge(12,1,9),[],cards));
 validateEdge({...a,toId:id(9)},[],cards,{...a,toId:id(9)});
 assert.equal(edgeKey({...a,direction:'mutual'}),edgeKey({...b,direction:'mutual'}));
 validateEdge(edge(13,1,2,'kennt'),[a],cards);assert.throws(()=>validateEdge(edge(14,1,2,' '.repeat(2)),[],cards));
});
test('network hides trash edges, restores them, and filters immediate neighbors across all card types',()=>{
 const cards=[card(1),card(2),card(3,'place'),card(4,'item')],network={edges:[edge(10,1,2),edge(11,2,3),edge(12,3,4)],positions:{}};
 assert.equal(networkData(cards,network,id(1),true).cards.length,2);
 cards[1].deleted=true;assert.equal(networkData(cards,network).edges.length,1);cards[1].deleted=false;assert.equal(networkData(cards,network).edges.length,3);
});
test('stable grouped layout preserves existing positions and separates parallel and opposing links',()=>{
 const cards=[card(1),card(2),card(3)],edges=[edge(10,1,2),edge(11,2,1),edge(12,1,2,'kennt')];
 const positions=arrangeCards(cards,edges);assert.deepEqual(arrangeCards(cards,edges),positions);
 const extended=arrangeCards([...cards,card(4)],edges,positions);assert.deepEqual(extended[id(1)],positions[id(1)]);assert.equal(new Set(Object.values(extended).map(p=>JSON.stringify(p))).size,4);
 const paths=edgePaths(edges,positions);assert.equal(new Set(paths.map(p=>p.path)).size,3);assert.equal(new Set(paths.map(p=>p.y)).size,3);
 const network={edges,positions};const before=JSON.stringify(network);networkData(cards,network);edgePaths(edges,positions);assert.equal(JSON.stringify(network),before);
});
test('200 cards and 400 edges have bounded layout with no per-day or simulation work',()=>{
 const cards=Array.from({length:200},(_,n)=>card(n+1)),edges=Array.from({length:400},(_,n)=>edge(n+1000,n%200+1,(n+1)%200+1,'Beziehung '+n));
 const positions=arrangeCards(cards,edges);assert.equal(Object.keys(positions).length,200);assert.equal(edgePaths(edges,positions).length,400);assert.equal(networkData(cards,{edges,positions}).cards.length,200);
});
