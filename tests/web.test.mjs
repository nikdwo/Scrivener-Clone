import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedDocuments,plainText,wordCount,escapeHtml,matchesCollection} from '../web/logic.mjs';
test('canonical outline order, exclusion of trash, cycle protection',()=>{
 const docs=[{id:'root',parentId:null,position:0},{id:'b',parentId:'root',position:1},{id:'a',parentId:'root',position:0},{id:'c',parentId:'a',position:0},{id:'trash',parentId:'root',position:2,deleted:true}];
 assert.deepEqual(orderedDocuments(docs,'root').map(d=>d.id),['a','c','b']);
 assert.throws(()=>orderedDocuments([{id:'a',parentId:'b',position:0},{id:'b',parentId:'a',position:0}],'a'));
});
test('plain text and Unicode statistics exclude footnotes',()=>{const body={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Grüße, Welt. Ein neuer Anfang.'},{type:'footnote',attrs:{text:'Zusatz'}}]}]};assert.equal(plainText(body),'Grüße, Welt. Ein neuer Anfang.');assert.equal(wordCount(plainText(body)),5)});
test('collection membership and HTML boundary',()=>{assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');assert.ok(matchesCollection({title:'Mara',meta:{status:'Entwurf'}},{query:'entwurf'}));assert.ok(!matchesCollection({id:'1'},{ids:['2']}))});
