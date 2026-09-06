import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedDocuments,plainText,wordCount,escapeHtml,matchesCollection} from '../web/logic.mjs';
import {Schema} from '@tiptap/pm/model';
import {proofBlocks,proofRange} from '../web/proofreading.mjs';
import {cardMatches,isStoryCard,isScene} from '../web/storycards.mjs';
test('canonical outline order, exclusion of trash, cycle protection',()=>{
 const docs=[{id:'root',parentId:null,position:0},{id:'b',parentId:'root',position:1},{id:'a',parentId:'root',position:0},{id:'c',parentId:'a',position:0},{id:'trash',parentId:'root',position:2,deleted:true}];
 assert.deepEqual(orderedDocuments(docs,'root').map(d=>d.id),['a','c','b']);
 assert.throws(()=>orderedDocuments([{id:'a',parentId:'b',position:0},{id:'b',parentId:'a',position:0}],'a'));
});
test('plain text and Unicode statistics exclude footnotes',()=>{const body={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Grüße, Welt. Ein neuer Anfang.'},{type:'footnote',attrs:{text:'Zusatz'}}]}]};assert.equal(plainText(body),'Grüße, Welt. Ein neuer Anfang.');assert.equal(wordCount(plainText(body)),5)});
test('collection membership and HTML boundary',()=>{assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');assert.ok(matchesCollection({title:'Mara',meta:{status:'Entwurf'}},{query:'entwurf'}));assert.ok(!matchesCollection({id:'1'},{ids:['2']}))});

test('proofreading chunks preserve Unicode positions and protect inline atoms',()=>{
 const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'inline*'},text:{group:'inline'},footnote:{inline:true,group:'inline',atom:true}}});
 const paragraph=schema.node('paragraph',null,[schema.text('a'.repeat(7999)+'😀 Feler'),schema.node('footnote'),schema.text(' Ende')]);
 const doc=schema.node('doc',null,[paragraph,schema.node('paragraph',null,[schema.text('Weiter')])]),blocks=proofBlocks(doc);
 assert.equal(blocks[0].text.length,7999);assert.ok(blocks[1].text.startsWith('😀'));assert.equal(blocks[0].text+blocks[1].text,paragraph.textBetween(0,paragraph.content.size,'','\ufffc'));
 const range=proofRange(blocks,{block:1,offset:3,length:5,original:'Feler'});assert.equal(doc.textBetween(range.from,range.to),'Feler');
 assert.deepEqual(proofBlocks(doc,range.from,range.to).map(b=>b.text),['Feler']);
 assert.equal(proofRange(blocks,{block:1,offset:8,length:1,original:'\ufffc'}),null);assert.equal(proofRange(blocks,{block:1,offset:3,length:5,original:'falsch'}),null);
});

test('story names match longest whole names across formatting, with ambiguity and protected boundaries',()=>{
 const schema=new Schema({
   nodes:{doc:{content:'block+'},paragraph:{group:'block',content:'inline*'},codeBlock:{group:'block',content:'text*'},text:{group:'inline'},footnote:{inline:true,group:'inline',atom:true},hardBreak:{inline:true,group:'inline'}},
   marks:{bold:{},link:{attrs:{href:{}}}},
 });
 const card=(id,title,aliases=[])=>({id,title,meta:{storyCard:{type:'figure',aliases,fields:{}}}});
 const cards=[card('a','Anna',['Ännchen']),card('b','Anna Berg'),card('c','Anna'),card('d','Mara'),{...card('deleted','Weg'),deleted:true}];
 const p=(...content)=>schema.node('paragraph',null,content);
 const doc=schema.node('doc',null,[p(schema.text('😀 Anna'),schema.text(' Berg'),schema.text(' Annabelle anna Ännchen. Ma'),schema.text('ra',[schema.mark('bold')]),schema.text(' Weg')),
   p(schema.text('Anna')),p(schema.text('Anna',[schema.mark('link',{href:'#else'})])),schema.node('codeBlock',null,[schema.text('Mara')]),
   p(schema.text('Ma'),schema.node('footnote'),schema.text('ra')),p(schema.text('Ma'),schema.node('hardBreak'),schema.text('ra')),
   p(schema.text('Ma')),p(schema.text('ra'))]);
 const hits=cardMatches(doc,cards);
 assert.deepEqual(hits.map(h=>[h.name,h.ids]),[['Anna Berg',['b']],['Ännchen',['a']],['Mara',['d']],['Anna',['a','c']]]);
 for(const hit of hits)assert.equal(doc.textBetween(hit.from,hit.to),hit.name);
 assert.equal(JSON.stringify(doc.toJSON()).includes('story-name'),false);
 assert.deepEqual(cardMatches(doc,[]),[]);
 const docs=[{id:'manuscript'},{id:'research'},{id:'scene',parentId:'manuscript',kind:'text'},...cards];
 assert.equal(isScene(docs[2],docs),true);assert.equal(isScene({...docs[2],deleted:true},docs),false);
});

test('item names and aliases use the same references as figures and places',()=>{
 const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*'},text:{}}});
 const item={id:'key',title:'Silberschlüssel',kind:'text',parentId:'manuscript',meta:{storyCard:{type:'item',aliases:['Hausschlüssel'],fields:{owner:'Mara'}}}};
 const figure={id:'figure',title:'Silberschlüssel',meta:{storyCard:{type:'figure',aliases:[],fields:{}}}};
 const doc=schema.node('doc',null,[schema.node('paragraph',null,[schema.text('Silberschlüssel und Hausschlüssel, keine Hausschlüsselkopie.')])]);
 assert.equal(isStoryCard(item),true);assert.equal(isScene(item,[{id:'manuscript'},item]),false);
 assert.deepEqual(cardMatches(doc,[item,figure]).map(h=>[h.name,h.ids]),[['Silberschlüssel',['key','figure']],['Hausschlüssel',['key']]]);
 assert.equal(isStoryCard({...item,meta:{storyCard:{type:'unknown'}}}),false);
});
