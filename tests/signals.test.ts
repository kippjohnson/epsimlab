import test from 'node:test';import assert from 'node:assert/strict';
import {Synthesizer,FS} from '../src/engine/signals.ts';
import {Engine} from '../src/engine/Engine.ts';
function samples(band:'standard'|'narrow',chunk:number){const engine=new Engine();const synth=new Synthesizer(band);const data:number[][]=Array.from({length:9},()=>[]);for(let start=0;start<1600;start+=chunk){const old=engine.events.length;engine.advance(start+chunk);const block=synth.render(start,start+chunk,engine.events.slice(old));block.forEach((x,i)=>data[i].push(...x));}return data;}
test('signal samples are finite, have correct rate, and preserve frame-boundary continuity',()=>{const a=samples('standard',50),b=samples('standard',100);for(let ch=0;ch<9;ch++){assert.equal(a[ch].length,FS*1.6);assert.ok(a[ch].every(Number.isFinite));assert.deepEqual(a[ch],b[ch]);}});
test('intracardiac filter changes waveforms while surface ECG is unchanged',()=>{const a=samples('standard',50),b=samples('narrow',50);assert.deepEqual(a[0],b[0]);assert.notDeepEqual(a[4],b[4]);const energy=(x:number[])=>x.reduce((s,v)=>s+v*v,0);assert.ok(energy(b[4])<energy(a[4]));});
