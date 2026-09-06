import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedDocuments,plainText,wordCount,escapeHtml,matchesCollection} from '../web/logic.mjs';
import {Schema} from '@tiptap/pm/model';
import {proofBlocks,proofRange} from '../web/proofreading.mjs';
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
