import {localActivationPeak as previousActivationPeak} from '../engine/legacy/signals';
import {ENGINE_VERSION} from '../engine/model';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {CHANNELS,displayChannels,localActivationPeak} from '../engine/signals';
import {stimulusOutput,stimulusWidth} from '../engine/pacingSignals';
import type {LabEvent} from '../engine/model';
import type {Recording,Measurement} from '../store';
import './traces.css';

interface Props {recording:Recording;end:number|null;sweep:number;gain:number;gains:number[];onGain?:(index:number)=>void;calipers:boolean;onMeasure:(m:Measurement)=>void;compact?:boolean;annotations?:boolean;selected?:string;visibleChannels?:string[]}
const AXIS_HEIGHT=24,STIM_HEIGHT=32;
const STIM_DESCRIPTION='Stimulus timing. Squares mark nonzero pulses, whether or not they capture. Pulse widths are shown at a minimum of 5 pixels for visibility; use the programmed pulse width, not the square width, for duration. Zero-output commands are marked 0.';

export function Traces({recording,end,sweep,gain,gains,onGain,calipers,onMeasure,compact=false,annotations=false,visibleChannels}:Props){
 const channels=visibleChannels?displayChannels(visibleChannels):compact?[0,4,8]:CHANNELS.map((_,i)=>i);
 const channelKey=channels.join(',');
 const activePointer=useRef<number|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null),wrap=useRef<HTMLDivElement>(null);
 const bounds=useRef({start:0,end:0,width:1,height:1,left:0});
 const drag=useRef<{start:number;end:number;channel:number}|null>(null);
 const landmarks=useRef(new WeakMap<LabEvent,Map<number,number>>());
 const [measurement,setMeasurement]=useState<number|null>(null);
 const latest=useRef({end,sweep,gain,gains,calipers,annotations,channels});
 latest.current={end,sweep,gain,gains,calipers,annotations,channels};

 useEffect(()=>{
  let frame=0,lastPaint=0;
  const draw=(stamp=performance.now())=>{
   const cv=canvas.current;if(!cv||!wrap.current)return;
   const w=wrap.current.clientWidth,h=wrap.current.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
   if(!w||!h||document.hidden||stamp-lastPaint<32){frame=requestAnimationFrame(draw);return;}
   lastPaint=stamp;
   if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
   const ctx=cv.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);
   ctx.fillStyle='#14181e';ctx.fillRect(0,0,w,h);
   const p=latest.current,channels=p.channels;
   const duration=w/(p.sweep*3.2)*1000,finish=p.end??recording.end,start=finish-duration;
   bounds.current={start,end:finish,width:w,height:h,left:cv.getBoundingClientRect().left};
   const px=(t:number)=>(t-start)/duration*w;
   const signalHeight=h-AXIS_HEIGHT-STIM_HEIGHT,row=signalHeight/channels.length;
   const samples=Math.max(1,Math.ceil(duration/w*2));
   const minor=p.sweep>=100?50:100;
   for(let t=Math.ceil(start/minor)*minor;t<finish;t+=minor){
    const x=px(t);ctx.strokeStyle=t%500===0?'#2a323d':'#1d242d';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(Math.round(x)+.5,0);ctx.lineTo(Math.round(x)+.5,h);ctx.stroke();
    if(t%500===0){ctx.fillStyle='#9dabbc';ctx.font='10px ui-monospace, monospace';ctx.fillText((t/1000).toFixed(1)+'s',x+5,h-7);}
   }
   channels.forEach((ch,index)=>{
    const y=row*(index+.5),combinedGain=p.gain*(p.gains[ch]??1),scale=row*.32*combinedGain;
    ctx.strokeStyle='#222a34';ctx.beginPath();ctx.moveTo(0,row*(index+1));ctx.lineTo(w,row*(index+1));ctx.stroke();
    ctx.save();ctx.beginPath();ctx.rect(0,index*row,w,row);ctx.clip();
    ctx.strokeStyle=CHANNELS[ch].color;ctx.lineWidth=1.1;ctx.beginPath();
    for(let x=0;x<w;x++){
     const t=start+x/w*duration;let lo=Infinity,hi=-Infinity;
     for(let k=0;k<samples;k++){const value=recording.value(ch,t+k*.5);lo=Math.min(lo,value);hi=Math.max(hi,value);}
     if(x===0)ctx.moveTo(x,y-hi*scale);else ctx.lineTo(x,y-hi*scale);
     if(samples>1)ctx.lineTo(x,y-lo*scale);
    }
    ctx.stroke();
    // The calibration follows the exact scale used above, including per-row gain.
    const mv=combinedGain>2?.1:.5,calHeight=mv*scale,x=w-8;
    ctx.strokeStyle='#8b9ba9';ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(x-4,y);ctx.lineTo(x,y);ctx.lineTo(x,y-calHeight);ctx.lineTo(x-4,y-calHeight);ctx.stroke();
    ctx.fillStyle='#8b9ba9';ctx.font='8px ui-monospace, monospace';ctx.textAlign='right';ctx.fillText(String(mv),x-6,y-calHeight/2+3);ctx.textAlign='left';
    ctx.restore();
   });

   // A separate command trace prevents the square pulse from being read as an EGM.
   const stimBase=signalHeight+25,stimTop=signalHeight+14;
   ctx.fillStyle='#191e25';ctx.fillRect(0,signalHeight,w,STIM_HEIGHT);
   ctx.strokeStyle='#657485';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,stimBase);ctx.lineTo(w,stimBase);ctx.stroke();
   const stimuli=recording.events.filter(e=>e.kind==='stimulus'&&e.t+stimulusWidth(e)>=start&&e.t<finish);
   for(const e of stimuli){
    const x=px(e.t),pulsePixels=Math.max(5,px(e.t+stimulusWidth(e))-x),output=stimulusOutput(e);
    const color=p.annotations?(e.captured?'#79dcc0':'#e58c88'):'#d1b58b';
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.font='9px ui-monospace, monospace';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(x,stimBase);
    if(output>0){ctx.lineTo(x,stimTop);ctx.lineTo(x+pulsePixels,stimTop);ctx.lineTo(x+pulsePixels,stimBase);}
    else ctx.lineTo(x,stimBase-3);
    ctx.stroke();
    ctx.fillText(output===0?'0':['S2','S3'].includes(e.label)?e.label:'S',x+2,signalHeight+10);
    if(p.annotations){
     ctx.globalAlpha=.3;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,signalHeight);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    }
   }

   if(p.annotations){
    const hisRow=['HISd','HISp','HIS23'].map(id=>channels.findIndex(ch=>CHANNELS[ch].id===id)).find(index=>index>=0);
    if(hisRow!==undefined){
     const ch=channels[hisRow];
     for(const e of recording.events){
      if(e.kind!=='activation'||!['A','H','V'].includes(e.node??'')||e.t<start-180||e.t>finish)continue;
      let cached=landmarks.current.get(e);if(!cached){cached=new Map();landmarks.current.set(e,cached);}
      let t=cached.get(ch);if(t===undefined){t=recording.engineVersion===ENGINE_VERSION?localActivationPeak(ch,e):previousActivationPeak(ch,e);cached.set(ch,t);}
      if(t<start||t>finish)continue;
      ctx.fillStyle=e.node==='A'?'#6bb6ff':e.node==='H'?'#f1c267':'#69d7aa';ctx.font='10px ui-monospace, monospace';
      ctx.fillText(e.node!,px(t)+2,row*hisRow+11);
     }
    }
   }
   if(drag.current){
    const a=px(drag.current.start),b=px(drag.current.end);ctx.fillStyle='#9bbbdc18';ctx.fillRect(Math.min(a,b),0,Math.abs(b-a),h-AXIS_HEIGHT);
    ctx.strokeStyle='#9bbbdc';ctx.lineWidth=1;
    for(const x of [a,b]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h-AXIS_HEIGHT);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(a,22);ctx.lineTo(b,22);ctx.stroke();
   }
   frame=requestAnimationFrame(draw);
  };
  draw();return()=>cancelAnimationFrame(frame);
 },[recording,compact]);
 useEffect(()=>{activePointer.current=null;drag.current=null;setMeasurement(null);},[channelKey]);
 useEffect(()=>{if(!calipers){activePointer.current=null;drag.current=null;setMeasurement(null);}},[calipers]);
 const cancelDrag=()=>{if(activePointer.current!==null){activePointer.current=null;drag.current=null;setMeasurement(null);}};
 const position=(clientX:number)=>{const b=bounds.current;return Math.round(b.start+Math.max(0,Math.min(b.width,clientX-b.left))/b.width*(b.end-b.start));};
 return <div className={'trace-viewport '+(compact?'compact':'')}><div className={'traces '+(compact?'compact':'')} style={{'--trace-min-height':(channels.length*44+AXIS_HEIGHT+STIM_HEIGHT)+'px'} as CSSProperties}>
  <div className="channel-labels">
   {channels.map(ch=><button key={ch} type="button" title={onGain?'Cycle channel gain. Bracket values are in mV.':CHANNELS[ch].label} onClick={()=>onGain?.(ch)} style={{color:CHANNELS[ch].color}}><span>{CHANNELS[ch].label}</span><small>{(gains[ch]??1)*gain}×</small></button>)}
   <div className="stim-channel-label" title={STIM_DESCRIPTION} aria-label={STIM_DESCRIPTION}><span>STIM</span><small>timing</small></div>
   <span className="unit-label" title="Amplitude calibration brackets are in mV. The STIM row shows command timing only.">mV</span>
  </div>
  <div className={'trace-plot '+(calipers?'measuring':'')} ref={wrap}>
   <canvas ref={canvas} role="img" aria-label={'Recordings: '+channels.map(ch=>CHANNELS[ch].label).join(', ')+'. STIM shows pulse timing. Amplitude brackets are in mV. Enable calipers to measure time intervals.'}
    onPointerDown={e=>{
     if(!calipers||activePointer.current!==null||!e.isPrimary)return;
     const y=e.clientY-e.currentTarget.getBoundingClientRect().top,signalHeight=bounds.current.height-AXIS_HEIGHT-STIM_HEIGHT;
     if(y>=bounds.current.height-AXIS_HEIGHT)return;
     activePointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);
     const t=position(e.clientX),rowIndex=Math.max(0,Math.floor(y/(signalHeight/channels.length)));
     const channel=y>=signalHeight?-1:channels[Math.min(channels.length-1,rowIndex)];
     drag.current={start:t,end:t,channel};setMeasurement(0);
    }}
    onPointerMove={e=>{if(!calipers||!drag.current||activePointer.current!==e.pointerId)return;drag.current.end=position(e.clientX);setMeasurement(Math.abs(drag.current.end-drag.current.start));}}
    onPointerUp={e=>{
     if(!calipers||!drag.current||activePointer.current!==e.pointerId)return;
     activePointer.current=null;const d=drag.current;d.end=position(e.clientX);setMeasurement(Math.abs(d.end-d.start));
     if(Math.abs(d.end-d.start)>2)onMeasure({id:crypto.randomUUID(),start:Math.min(d.start,d.end),end:Math.max(d.start,d.end),label:'Interval',channel:d.channel===-1?'STIM':CHANNELS[d.channel].label});
    }}
    onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}/>
   {calipers&&measurement!==null&&<div className="caliper-readout">Δ {measurement} ms <button aria-label="Clear calipers" onClick={()=>{drag.current=null;setMeasurement(null);}}>×</button></div>}
  </div>
 </div></div>;
}
