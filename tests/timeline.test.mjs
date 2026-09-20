import test from 'node:test';
import assert from 'node:assert/strict';
import {pointRange,validateTimeline,formatPoint,timelineData,layoutLane,timelineScenes,minutePoint,editTimeline} from '../web/timeline.mjs';

test('drag edits use minutes for all scenes and preserve duration across midnight',()=>{
  const basis='relative',value={start:{day:-1,time:'23:30'},end:{day:0,time:'01:00'},strandId:'a'.repeat(32)};
  const moved=editTimeline(value,basis,'move',60,'none');assert.deepEqual(moved,{start:{day:0,time:'00:30'},end:{day:0,time:'02:00'}});
  assert.equal(value.start.day,-1);assert.equal(editTimeline(value,basis,'end',120).end.time,'02:00');
  assert.throws(()=>editTimeline(value,basis,'end',-60));
  const mixed={start:{day:1,time:'12:00'},end:{day:2}};
  assert.deepEqual(editTimeline(mixed,basis,'move',1),{start:{day:1,time:'12:01'},end:{day:3,time:'00:00'}});
  const daily={start:{day:1},end:{day:1}};
  assert.deepEqual(editTimeline(daily,basis,'move',-1),{start:{day:0,time:'23:59'},end:{day:1,time:'23:58'}});
  assert.deepEqual(editTimeline(daily,basis,'start',1441),{start:{day:1,time:'00:01'},end:{day:1,time:'23:59'}});
  assert.deepEqual(editTimeline(daily,basis,'end',2878),{start:{day:1,time:'00:00'},end:{day:1,time:'23:58'}});
  assert.deepEqual(daily,{start:{day:1},end:{day:1}});
  assert.deepEqual(editTimeline({start:{day:1}},basis,'move',1),{start:{day:1,time:'00:01'}});
  assert.deepEqual(editTimeline({start:{day:1}},basis,'end',3*1440+700),{start:{day:1,time:'00:00'},end:{day:3,time:'11:40'}});
  assert.deepEqual(editTimeline({},basis,'place',-1,'none'),{start:{day:-1,time:'23:59'}});
  assert.equal(minutePoint(-1,basis).time,'23:59');assert.throws(()=>minutePoint(Infinity,basis));
  const leap=pointRange({day:'2024-02-29',time:'23:59'},'calendar').low;
  assert.deepEqual(editTimeline({start:{day:'2024-02-29',time:'23:59'}},'calendar','move',1),{start:{day:'2024-03-01',time:'00:00'}});
  assert.deepEqual(editTimeline({start:{day:'2024-02-29'},end:{day:'2024-02-29'}},'calendar','move',1),{start:{day:'2024-02-29',time:'00:01'},end:{day:'2024-03-01',time:'00:00'}});
  assert.equal(minutePoint(leap,'calendar').day,'2024-02-29');
  assert.throws(()=>minutePoint(pointRange({day:'9999-12-31'},'calendar').high+1,'calendar'));
});

const a='a'.repeat(32),b='b'.repeat(32),card='c'.repeat(32),config={basis:'relative',strands:[{id:a,name:'Mara'},{id:b,name:'Suche'}]};
const scene=(id,position,timeline={},extra={})=>({id,parentId:'manuscript',kind:'text',position,title:id,meta:{timeline,...extra}});
test('timeline dates and precision use civil time, including leap days, midnight and negative days',()=>{
  assert.equal(pointRange({day:-1,time:'23:59'},'relative').low,-1);
  assert.equal(pointRange({day:0,time:'00:00'},'relative').low,0);
  assert.equal(pointRange({day:'2024-03-01'},'calendar').low-pointRange({day:'2024-02-29'},'calendar').low,1440);
  assert.equal(pointRange({day:'2024-03-31'},'calendar').low-pointRange({day:'2024-03-30'},'calendar').low,1440);
  assert.equal(pointRange({day:'0001-01-01'},'calendar').high-pointRange({day:'0001-01-01'},'calendar').low,1439);
  assert.equal(formatPoint({day:1},'relative'),'Tag 1 · tagesgenau');
  for(const day of ['2023-02-29','2024-02-30','0000-01-01','2024-1-1'])assert.throws(()=>pointRange({day},'calendar'));
  for(const day of [1.2,'1',NaN,2147483648])assert.throws(()=>pointRange({day},'relative'));
  for(const time of ['24:00','1:00','12:60','',null])assert.throws(()=>pointRange({day:1,time},'relative'));
});
test('timeline validates only known precision and rejects malformed values',()=>{
  validateTimeline({start:{day:1,time:'23:00'},end:{day:1}},'relative');
  validateTimeline({start:{day:1},end:{day:1,time:'00:00'}},'relative');
  for(const value of [[],true,{end:{day:1}},{start:{day:1},end:{day:0}},{start:{day:1,time:'12:00'},end:{day:1,time:'11:59'}},{start:{day:1,extra:0}},{strandId:'invalid'},{start:null}])assert.throws(()=>validateTimeline(value,'relative'));
  for(const day of ['0001-01-01','9999-12-31']){
    const data=timelineData([scene('edge',0,{start:{day,time:'23:59'}})],{basis:'calendar',strands:[]});
    assert.equal(data.low,pointRange({day},'calendar').low);assert.equal(data.high,pointRange({day},'calendar').high);
  }
});
test('timeline uses manuscript order, durable AND filters and no deleted/research/card scenes',()=>{
  const docs=[scene('late',0,{start:{day:3},strandId:b}),scene('early',1,{start:{day:1},strandId:a},{storyCardIds:[card]}),scene('same',2,{start:{day:1},strandId:a}),scene('unknown',3),{...scene('trash',4),deleted:true},{...scene('note',5),parentId:'research'},scene('figure',6,{}, {storyCard:{type:'figure'}})];
  const before=JSON.stringify(docs),data=timelineData(docs,config);
  assert.deepEqual(timelineScenes(docs).map(d=>d.id),['late','early','same','unknown']);
  assert.deepEqual(data.lanes[0].events.map(e=>e.scene.id),['early','same']);assert.deepEqual(data.unplanned.map(d=>d.id),['unknown']);
  assert.equal(timelineData(docs,config,{strand:a,figure:card}).count,1);
  assert.equal(timelineData(docs,config,{strand:b,figure:card}).count,0);
  assert.equal(timelineData(docs,config,{figure:card,place:'missing'}).count,0);
  assert.equal(JSON.stringify(docs),before);
});
test('timeline stacks overlaps including labels, supports missing strands and 1000 sparse scenes',()=>{
  const docs=Array.from({length:1000},(_,i)=>scene('s'+i,i,{start:{day:i*10000},strandId:i%2?a:b}));
  const data=timelineData(docs,config);assert.equal(data.count,1000);assert.equal(data.lanes.length,3);
  const overlapping=timelineData([scene('a',0,{start:{day:1},end:{day:3},strandId:a}),scene('b',1,{start:{day:2},strandId:a}),scene('c',2,{start:{day:5},strandId:a})],config);
  const layout=layoutLane(overlapping.lanes[0].events,overlapping.low,overlapping.high,2400);
  assert.deepEqual(layout.map(e=>e.row),[0,1,0]);assert.ok(layout[0].startWidth>0);
  assert.match(timelineData([scene('gone',0,{start:{day:1},strandId:card})],config).lanes.at(-1).name,/Nicht verfügbar/);
});
