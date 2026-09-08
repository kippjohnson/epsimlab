import test from 'node:test';
import assert from 'node:assert/strict';
import {FOUNDATION_LESSONS,FOUNDATION_CHECKS,cleanFoundationAnswers,completedLessons,forwardTiming,pacingTiming,retrogradeTiming} from '../src/module0.ts';

test('forward intervals include PA and distinguish pre-His from post-His delay',()=>{
 const baseline=forwardTiming({ah:90,hv:45,rr:800,block:'none'});
 assert.equal(baseline.pr,165);assert.equal(baseline.rate,75);
 const nodal=forwardTiming({ah:200,hv:45,rr:800,block:'none'}),distal=forwardTiming({ah:90,hv:90,rr:800,block:'none'});
 assert.equal(nodal.h!-baseline.h!,110);assert.equal(nodal.v!-nodal.h!,45);
 assert.equal(distal.h,baseline.h);assert.equal(distal.pr,210);
 for(const ah of [50,300])for(const hv of [30,100])for(const rr of [600,1200]){
  const t=forwardTiming({ah,hv,rr,block:'none'});assert.ok(t.v!<rr);assert.equal(t.pr,30+ah+hv);
 }
});
test('block removes downstream events and does not invent a ventricular rate',()=>{
 const nodal=forwardTiming({ah:90,hv:45,rr:800,block:'nodal'}),distal=forwardTiming({ah:90,hv:45,rr:800,block:'distal'});
 assert.equal(nodal.a,30);assert.equal(nodal.h,null);assert.equal(nodal.v,null);assert.equal(nodal.rate,null);
 assert.equal(distal.h,120);assert.equal(distal.v,null);assert.equal(distal.pr,null);assert.equal(distal.rr,null);
});
test('retrograde sequence and VA are independent, with no fictitious A during absent conduction',()=>{
 const earliest=(events:ReturnType<typeof retrogradeTiming>)=>events.reduce((a,b)=>a.t<b.t?a:b);
 assert.equal(earliest(retrogradeTiming('concentric',80)).site,'Septal A');
 assert.equal(earliest(retrogradeTiming('eccentric',80)).site,'CS distal');
 for(const pattern of ['concentric','eccentric'] as const){
  const first=retrogradeTiming(pattern,40),second=retrogradeTiming(pattern,250);
  assert.deepEqual(second.map((e,i)=>e.t-first[i].t),[210,210,210,210]);
  assert.equal(earliest(second).t,250);
 }
 assert.deepEqual(retrogradeTiming('absent',80),[]);
});
test('S2 is coupled to the last S1 and lack of capture does not remove the stimulus',()=>{
 const train=pacingTiming(500,280,true);assert.deepEqual(train.map(s=>s.t),[0,500,1000,1500,1780]);
 const changed=pacingTiming(500,180,false);assert.deepEqual(changed.slice(0,4),train.slice(0,4));
 assert.equal(changed[4].t,1680);assert.equal(changed[4].captured,false);assert.equal(changed[4].label,'S2');
});
test('completion requires every correct response in a lesson and validation rejects forged checks',()=>{
 assert.equal(new Set(FOUNDATION_CHECKS.map(q=>q.id)).size,FOUNDATION_CHECKS.length);
 const correct=Object.fromEntries(FOUNDATION_CHECKS.map(q=>[q.id,q.answer]));
 assert.deepEqual(completedLessons(correct),FOUNDATION_LESSONS.map(l=>l.id));
 const missing={...correct};delete missing['signals-clock'];assert.ok(!completedLessons(missing).includes('signals'));
 assert.deepEqual(cleanFoundationAnswers(correct),correct);
 for(const invalid of [null,[],{'made-up':0},{'signals-clock':3},{'signals-clock':-1},{'signals-clock':'0'},{'signals-clock':1.5}])assert.equal(cleanFoundationAnswers(invalid),null);
 assert.deepEqual(completedLessons({}),[]);
});
