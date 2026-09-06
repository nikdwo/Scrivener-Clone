import test from 'node:test';
import assert from 'node:assert/strict';
import {Schema} from '@tiptap/pm/model';
import {analyzeStyle, styleSettings, wordingPhrases} from '../web/styleanalysis.mjs';

const schema=new Schema({nodes:{doc:{content:'block*'},paragraph:{group:'block',content:'inline*'},heading:{group:'block',content:'inline*'},codeBlock:{group:'block',content:'text*'},text:{group:'inline'},footnote:{inline:true,group:'inline',atom:true,attrs:{text:{default:''}}},hardBreak:{inline:true,group:'inline'},image:{group:'block',atom:true}},marks:{bold:{},code:{},comment:{attrs:{text:{default:''}}},link:{attrs:{href:{}}}}});
const p=(...parts)=>schema.node('paragraph',null,parts.map(part=>typeof part==='string'?schema.text(part):part));
const doc=(...paragraphs)=>schema.node('doc',null,paragraphs.map(paragraph=>typeof paragraph==='string'?p(paragraph):paragraph));
const rule=(result,name)=>result.findings.filter(f=>f.issue.rule===name);
const sentence=n=>Array.from({length:n},(_,i)=>'Wort'+i).join(' ')+'.';

test('style repetition respects exact words, Unicode, 40-word distance and adjacent sentences',async()=>{
  let result=await analyzeStyle(doc('😀 Fenster offen. Das FENSTER klappert. Fensterscheibe fehlt.','Äpfel fallen. A\u0308pfel rollen.'));
  assert.deepEqual(rule(result,'repetition').map(f=>f.issue.original),['FENSTER','A\u0308pfel']);
  result=await analyzeStyle(doc('Fenster. Ein Satz. Fenster.'));
  assert.equal(rule(result,'repetition').length,0);
  for(const distance of [40,41]){
    result=await analyzeStyle(doc('Fenster '+Array(distance-1).fill('ein').join(' ')+' Fenster.'));
    assert.equal(rule(result,'repetition').length,distance===40?1:0);
  }
  assert.equal(rule(await analyzeStyle(doc('Diese haben ihre Sachen. Diese haben ihre Sachen.')),'repetition').filter(f=>['Diese','ihre'].includes(f.issue.original)).length,0);
});

test('style ignores full known names and aliases but retains other repetitions',async()=>{
  const cards=[{title:'Mara Berg',meta:{storyCard:{type:'figure',aliases:['Heimkehrerin']}}},{title:'Seehaus',meta:{storyCard:{type:'place',aliases:[]}}},{title:'Schlüssel',meta:{storyCard:{type:'item',aliases:[]}}}];
  const result=await analyzeStyle(doc('Mara Berg im Seehaus hält den Schlüssel. Mara Berg im Seehaus hält den Schlüssel. Heimkehrerin. Heimkehrerin. Fenster Fenster.'),{cards});
  assert.deepEqual(rule(result,'repetition').map(f=>f.issue.original),['hält','Fenster']);
  assert.equal(rule(await analyzeStyle(doc('Mara Mara.'),{cards}),'repetition').length,1);
  assert.equal(rule(await analyzeStyle(doc('Seehaus Seehaus.'),{cards:cards.map(c=>({...c,deleted:true}))}),'repetition').length,1);
});

test('style ranges span formatting and skip structural boundaries and annotation contents',async()=>{
  const tree=doc(p('😀 Fen',schema.text('ster',[schema.mark('bold')]),' Fenster eigent',schema.text('lich',[schema.mark('bold')]),schema.node('footnote',{text:'eigentlich eigentlich'}),' Fenster'),
    schema.node('heading',null,[schema.text('Fenster eigentlich')]),p('Fenster'),
    schema.node('codeBlock',null,[schema.text('eigentlich eigentlich')]),p('Fenster'),
    p(schema.text('eigentlich',[schema.mark('code')]),' Fenster'),schema.node('image'),p('Fenster'),
    p('Fenster',schema.node('hardBreak'),'Fenster'),
    p(schema.text('Text',[schema.mark('comment',{text:'eigentlich'})])));
  const before=JSON.stringify(tree.toJSON()),result=await analyzeStyle(tree);
  assert.equal(rule(result,'wording').length,1);
  assert.equal(rule(result,'repetition').length,2); // First paragraph and the two adjacent final paragraphs.
  for(const finding of result.findings)assert.equal(tree.textBetween(finding.from,finding.to),finding.issue.original);
  assert.equal(JSON.stringify(tree.toJSON()),before);
});

test('style sentence thresholds include 30 and 45 and do not split at 8000 characters',async()=>{
  for(const count of [29,30,44,45]){
    const result=await analyzeStyle(doc(sentence(count)));
    assert.deepEqual(result.sentences.map(s=>s.words),[count]);
    assert.equal(rule(result,'sentence-length').length,count>=30?1:0);
    if(count===45)assert.match(rule(result,'sentence-length')[0].issue.message,/Sehr langer/);
  }
  const long=Array.from({length:45},(_,i)=>'Wort'+i+'a'.repeat(200)).join(' ')+'.';
  const result=await analyzeStyle(doc(long));
  assert.equal(result.sentences.length,1);assert.equal(result.sentences[0].words,45);
});

test('style German sentence boundaries handle abbreviations, dialogue, dates and numbers',async()=>{
  for(const first of ['Dr. Weber wartet.', 'Das ist z. B. ein Fall.', 'Am 3. September ging Mara.', 'Prof. A. Weber liest d. h. schweigend.', 'Der Wert ist 3,14.', '„Kommst du?“, fragte Mara.', 'Er wartet ...']){
    const tree=doc(first+' Dann geht es weiter.'),result=await analyzeStyle(tree);
    assert.deepEqual(result.sentences.map(s=>tree.textBetween(s.from,s.to)),[first,'Dann geht es weiter.']);
  }
  assert.equal((await analyzeStyle(doc('„Ja!“ „Nein?“'))).sentences.length,2);
});

test('style selection cuts are fragments, preserve UTF-16 ranges and suppress length warnings',async()=>{
  const text='😀 '+sentence(50),tree=doc(text),from=1+text.indexOf('Wort5 '),to=1+text.indexOf('Wort45 ');
  const result=await analyzeStyle(tree,{from,to});
  assert.equal(result.sentences.length,1);assert.equal(result.sentences[0].fragment,true);
  assert.equal(rule(result,'sentence-length').length,0);
  assert.equal((await analyzeStyle(tree,{from:1,to:1+text.length})).sentences[0].fragment,false);
});

test('style wording uses whole tokens, whitespace across formatting and all German variants',async()=>{
  for(const language of ['de-DE','de-AT','de-CH']){
    const result=await analyzeStyle(doc(wordingPhrases.join('; ')+'.'),{language});
    assert.equal(rule(result,'wording').length,wordingPhrases.length);
  }
  const result=await analyzeStyle(doc('Uneigentlichkeit. quasimäßig. Zum jetzigen Zeitpunkt ist das im Grunde genommen klar. An und, für sich.'),{});
  assert.deepEqual(rule(result,'wording').map(f=>f.issue.original),['Zum jetzigen Zeitpunkt','im Grunde genommen']);
  assert.deepEqual(rule(await analyzeStyle(doc(p('im ',schema.text('Grunde',[schema.mark('bold')]),' genommen'))),'wording').map(f=>f.issue.original),['im Grunde genommen']);
});

test('style settings defaults, empty input and disabled categories',async()=>{
  assert.deepEqual(styleSettings({automatic:'true',wording:false}),{automatic:false,repetitions:true,sentences:true,wording:false});
  assert.deepEqual(await analyzeStyle(doc()),{findings:[],sentences:[]});
  const result=await analyzeStyle(doc('Fenster Fenster eigentlich. '+sentence(40)),{settings:{repetitions:false,sentences:false,wording:false}});
  assert.equal(result.findings.length,0);assert.equal(result.sentences.length,2);
});

test('style rejects oversized input and yields to cancellation without returning partial results',async()=>{
  await assert.rejects(analyzeStyle(doc('a'.repeat(1_000_001))),/Million/);
  const controller=new AbortController();let yielded=false;
  const pending=analyzeStyle(doc(...Array(2500).fill('Fenster Fenster eigentlich.')),{signal:controller.signal});
  setTimeout(()=>{yielded=true;controller.abort()},0);
  await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(yielded,true);
  await assert.rejects(analyzeStyle(doc('Text'),{language:'en-US'}),/Deutsch/);
});
