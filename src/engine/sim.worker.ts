import {Engine} from './Engine';
import {Synthesizer} from './signals';
import type {Command,Protocol} from './model';
let engine=new Engine();let synth=new Synthesizer();let paused=false;let pendingReplay:Command[]=[];let replayEnd=0;let pacingUntil=0;
function tick(duration=50){const start=engine.now;const previous=engine.events.length;
 while(pendingReplay.length&&pendingReplay[0].t<=start+duration){const cmd=pendingReplay.shift()!;engine.advance(cmd.t);if(cmd.type==='pace')pacingUntil=engine.pace(cmd.protocol);else{engine.stop();pacingUntil=0;}}
 engine.advance(start+duration);const recent=engine.events.slice(previous);const data=synth.render(start,engine.now,recent);
 postMessage({type:'frame',start,end:engine.now,data,events:recent,metrics:engine.metrics(),pacing:engine.now<pacingUntil,replay:replayEnd>engine.now},data.map(d=>d.buffer));
 if(replayEnd&&engine.now>=replayEnd){paused=true;replayEnd=0;postMessage({type:'replay-complete'});}
}
onmessage=(message)=>{const m=message.data;try{
 if(m.type==='init'){engine=new Engine(m.caseId);synth=new Synthesizer();paused=false;pendingReplay=[];replayEnd=0;pacingUntil=0;postMessage({type:'reset'});for(let i=0;i<120;i++)tick();}
 if(m.type==='pause')paused=m.value;
 if(m.type==='pace'){pacingUntil=engine.pace(m.protocol as Protocol);}
 if(m.type==='stop'){engine.stop();pacingUntil=0;}
 if(m.type==='band')synth.setBand(m.band);
 if(m.type==='snapshot')postMessage({type:'snapshot',snapshot:engine.snapshot()});
 if(m.type==='replay'){engine=new Engine(m.snapshot.caseId);synth=new Synthesizer();pendingReplay=[...m.snapshot.commands];const target=Math.min(m.snapshot.now,Math.max(0,(pendingReplay[0]?.t??6000)-1500));replayEnd=m.snapshot.now;pacingUntil=0;postMessage({type:'reset'});paused=false;while(engine.now<target)tick(Math.min(50,target-engine.now));}
 }catch(error){postMessage({type:'error',message:error instanceof Error?error.message:'Simulation error'});}};
setInterval(()=>{if(!paused)tick();},50);
