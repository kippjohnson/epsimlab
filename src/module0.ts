export const MODULE_ZERO_VERSION=1;
export type Checkpoint={id:string;prompt:string;options:string[];answer:number;explanation:string};
export type FoundationLesson={id:string;title:string;subtitle:string;goal:string;points:{title:string;text:string}[];exercise:string;checks:Checkpoint[]};
export const FOUNDATION_LESSONS:FoundationLesson[]=[
 {id:'signals',title:'Read the signals',subtitle:'Surface ECG and local electrograms',goal:'Recognize where a signal comes from before deciding what it means.',points:[
  {title:'An electrical investigation',text:'An EP study records electrical activity from inside the heart and uses pacing to test how impulses travel. In this lab, the catheters are already in place. Begin by asking which chamber is active, when it activates, and what changes after an intervention.'},
  {title:'One clock, several viewpoints',text:'II and V1 are surface ECG leads: they reflect the combined electrical activity of the heart. Intracardiac electrograms sample activity near catheter electrodes. HRA records the high right atrium; His recordings can show atrial (A), His bundle (H), and ventricular (V) deflections; CS samples along the coronary sinus; RV records the right ventricle.'},
  {title:'Identify, then compare',text:'Follow a deflection across neighboring channels at the same time. A large ventricular far-field signal can appear on an atrial recording. Size alone does not identify a chamber. Check catheter location, sequence, and relation to the surface ECG. Gain changes height; sweep speed changes horizontal spacing, not the underlying interval.'}
 ],exercise:'Select A, H, and V below. Then inspect the same sequence on the simulator’s His rows. Real electrograms may overlap or have several components.',checks:[
  {id:'signals-clock',prompt:'Two deflections line up vertically on different channels. What does that tell you?',options:['They occur at the same displayed time.','They must come from the same chamber.','They must have the same amplitude.'],answer:0,explanation:'The recording rows share a horizontal time axis. Simultaneous deflections may represent different local or far-field signals.'},
  {id:'signals-gain',prompt:'Increasing gain makes a deflection taller. What changed?',options:['Conduction became faster.','The display scale changed.','The tissue captured.'],answer:1,explanation:'Gain changes displayed amplitude. It does not change activation timing or establish capture.'}
 ]},
 {id:'intervals',title:'Measure the intervals',subtitle:'AH, HV, PQ / PR, and RR',goal:'Choose the correct beginning and end of each measurement.',points:[
  {title:'AH and HV',text:'AH runs from local atrial onset on the His recording to His onset and mainly reflects AV nodal conduction. HV runs from His onset to the earliest ventricular activation, usually assessed at the earliest surface QRS onset. Do not substitute a late local ventricular peak for that onset.'},
  {title:'PQ is also called PR',text:'The surface PR interval starts at P-wave onset and ends at QRS onset, whether the QRS begins with a Q wave or an R wave. It includes conduction before the local A as well as AH and HV. In this aligned teaching example, PR = PA + AH + HV. PA is P onset to local A onset.'},
  {title:'RR, AA, VV, and VA',text:'RR measures successive R peaks. For a regular rhythm, rate in beats/min = 60,000 ÷ RR in milliseconds. Measure AA and VV separately when chamber rates differ. VA runs from a specified ventricular reference to atrial onset; name the atrial site and ventricular reference when comparing measurements.'}
 ],exercise:'Try the delay presets. Notice how both an AH delay and an HV delay can lengthen PR. The surface interval alone does not localize the delay.',checks:[
  {id:'intervals-pr',prompt:'PA is 30 ms, AH is 90 ms, and HV is 45 ms. What is PR in this aligned example?',options:['135 ms','165 ms','800 ms'],answer:1,explanation:'30 + 90 + 45 = 165 ms. AH + HV alone omits the time from P onset to the local atrial signal.'},
  {id:'intervals-rr',prompt:'A regular rhythm has an RR interval of 800 ms. What is its rate?',options:['48 beats/min','80 beats/min','75 beats/min'],answer:2,explanation:'60,000 ÷ 800 = 75 beats/min. An irregular rhythm needs assessment over multiple cycles.'}
 ]},
 {id:'pacing',title:'Ask a question with pacing',subtitle:'Capture, drive trains, and extrastimuli',goal:'Distinguish a delivered pulse from a successful tissue response.',points:[
  {title:'Start with capture',text:'The pacing artifact marks a stimulus, not necessarily an activation. Capture means tissue depolarized in response. Confirm the local response and its timing before interpreting what happened downstream. In the live lab, output and pulse width affect capture; tissue refractoriness also matters.'},
  {title:'S1 and S2',text:'S1 is a regular drive train. S2 is an extra stimulus coupled to the last S1; a smaller S1–S2 interval makes it more premature. Incremental pacing uses progressively faster trains. Programmed stimulation changes extrastimulus timing to probe conduction and refractoriness.'},
  {title:'Plan the comparison',text:'Choose a pacing chamber and a question. Atrial pacing tests forward conduction and may initiate tachycardia. Ventricular pacing can explore conduction back to the atrium. Record before, during, and after pacing. A change in the ventricular clock is only informative if the ventricular stimuli actually captured.'}
 ],exercise:'Shorten S1–S2 and toggle S2 capture in this timing sketch. The capture switch is illustrative: it does not calculate a refractory period. Use the real stimulator to test capture in a case.',checks:[
  {id:'pacing-capture',prompt:'You see a pacing artifact without a corresponding local activation. What can you conclude?',options:['The stimulus captured.','Tachycardia has been entrained.','A stimulus was delivered; capture is not established.'],answer:2,explanation:'Verify the tissue response. Neither an artifact nor a faster programmed rate proves capture or entrainment.'},
  {id:'pacing-s2',prompt:'After a 500 ms S1 train, S2 changes from 350 ms to 280 ms. What changed?',options:['The extra stimulus is delivered earlier after the last S1.','The entire S1 train is now 280 ms.','Output increased.'],answer:0,explanation:'S1–S2 is the coupling interval of the extra stimulus. The drive train and stimulus output have not changed.'}
 ]},
 {id:'conduction',title:'Follow conduction in both directions',subtitle:'Delays, block, and retrograde activation',goal:'Describe a timing pattern without treating it as a diagnosis.',points:[
  {title:'Localize the delay',text:'With otherwise comparable recordings, a longer AH with unchanged HV places the added delay before His activation. A longer HV places added delay after His activation. Faster atrial pacing often lengthens AV nodal conduction: this is decremental conduction. These sliders set intervals directly; they do not model rate-dependent recovery.'},
  {title:'Follow the missing event',text:'An A without a following H or V suggests block before the recorded His signal. An A followed by H without a V suggests block distal to that recorded His signal. First confirm signal quality and exclude missed or unrelated activations. A long interval and a blocked impulse are different observations.'},
  {title:'Look at the atrial sequence after V',text:'Retrograde means conduction from ventricle toward atrium. A concentric sequence has early septal atrial activity; an eccentric sequence has earlier activity away from the septum, such as distal CS in a left-sided return pattern. Concentric does not prove AVNRT, and eccentric does not prove AVRT. Pacing site, anatomy, and other mechanisms affect the sequence.'}
 ],exercise:'Compare forward delay and block, then switch to retrograde patterns. VA here means V onset to the earliest displayed A. A longer VA shifts all atrial markers without changing their order.',checks:[
  {id:'conduction-delay',prompt:'AH lengthens from 90 to 200 ms while HV stays 45 ms. Where is the added delay?',options:['After the recorded His signal.','Before His activation, predominantly the AV nodal region.','It cannot affect PR.'],answer:1,explanation:'AH lengthened while HV did not. This supports added pre-His delay when the recording sites and references are comparable.'},
  {id:'conduction-retro',prompt:'Distal CS atrial activation is earlier than septal atrial activation after V. What is the best initial description?',options:['An eccentric retrograde atrial sequence.','AVNRT is proven.','A left accessory pathway must sustain the rhythm.'],answer:0,explanation:'Describe the sequence first. It can suggest a return route, but proving the route and its role in tachycardia needs additional evidence.'}
 ]},
 {id:'scenarios',title:'Build a diagnostic explanation',subtitle:'Five patterns to take into the lab',goal:'Link each hypothesis to observations and a useful next step.',points:[
  {title:'A repeatable approach',text:'Identify atrial and ventricular activity. Compare regularity, AA, VV, and their relationship. Describe the atrial sequence. Choose a controlled maneuver, verify capture, then compare the response. Write down what you observed separately from the mechanism you infer.'},
  {title:'Carry the question into a case',text:'These short examples introduce the five existing studies. They are authored teaching presentations, not rules that diagnose every patient with the same pattern. Open a case, gather its evidence, and use the diagnostic worksheet for feedback.'}
 ],exercise:'Work through the five examples below. A supported hypothesis is the beginning of an investigation, not the end.',checks:[
  {id:'scenario-avnrt',prompt:'A premature atrial beat markedly prolongs AH and initiates a regular, short-VA tachycardia. Which hypothesis deserves investigation?',options:['Slow–fast AVNRT','AF, based only on the fast rate','No mechanism can involve the AV node'],answer:0,explanation:'This teaching pattern supports dual AV nodal physiology and possible AVNRT. An AH jump or short VA alone does not prove the tachycardia mechanism.'},
  {id:'scenario-avrt',prompt:'Regular tachycardia has distal-CS-first retrograde atrial activity. What is a useful next question?',options:['Can amplitude alone identify the diagnosis?','Does an accessory return route participate in the tachycardia?','Can the sequence alone prove AVRT?'],answer:1,explanation:'The pattern raises an accessory-pathway hypothesis. Participation needs additional pacing evidence; the current AVRT case illustrates a left-sided return pattern, not a complete clinical proof.'},
  {id:'scenario-at',prompt:'During confirmed ventricular capture, the atrial rhythm keeps its own cycle length in the focal AT teaching case. What does that support?',options:['The atrial driver continues independently of the paced ventricular clock.','Ventricular pacing failed because A did not follow.','Every supraventricular tachycardia has been excluded.'],answer:0,explanation:'Separate the chamber clocks. This is evidence for an independent atrial driver in this case; a single response is not a universal diagnostic algorithm.'},
  {id:'scenario-flutter',prompt:'Atrial cycles are 240 ms and ventricular cycles are 480 ms. What is the conduction relationship?',options:['1:1 conduction at 250 beats/min','2:1 conduction with a ventricular rate of 125 beats/min','Complete AV dissociation is proven'],answer:1,explanation:'Two atrial cycles fit into each ventricular cycle. 60,000 ÷ 480 = 125. This fits the flutter teaching case, but does not establish CTI dependence.'},
  {id:'scenario-af',prompt:'Ventricular timing is irregular. What else should you examine before favoring AF?',options:['Only the largest QRS amplitude.','Whether a single RR is normal.','Atrial organization and the pattern across multiple cycles.'],answer:2,explanation:'Irregular VV alone is insufficient. The AF case combines variable atrial timing and disorganized local activity with an irregular ventricular response.'}
 ]}
];
export const FOUNDATION_CHECKS=FOUNDATION_LESSONS.flatMap(l=>l.checks);
export type FoundationAnswers=Record<string,number>;
export function completedLessons(answers:FoundationAnswers){return FOUNDATION_LESSONS.filter(l=>l.checks.every(q=>answers[q.id]===q.answer)).map(l=>l.id);}
export function cleanFoundationAnswers(value:unknown):FoundationAnswers|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const result:FoundationAnswers={};
 for(const [key,answer] of Object.entries(value)){
  const q=FOUNDATION_CHECKS.find(q=>q.id===key);
  if(!q||!Number.isInteger(answer)||typeof answer!=='number'||answer<0||answer>=q.options.length)return null;
  result[key]=answer;
 }
 return result;
}
export type ForwardSettings={ah:number;hv:number;rr:number;block:'none'|'nodal'|'distal'};
export function forwardTiming({ah,hv,rr,block}:ForwardSettings){
 const pa=30,a=pa,h=block==='nodal'?null:a+ah,v=h===null||block==='distal'?null:h+hv;
 return {p:0,a,h,v,pa,pr:v,rr:v===null?null:rr,rate:v===null?null:60000/rr};
}
export type RetrogradePattern='concentric'|'eccentric'|'absent';
export function retrogradeTiming(pattern:RetrogradePattern,va:number){
 if(pattern==='absent')return [];
 const sites=pattern==='concentric'?[['Septal A',0],['CS proximal',15],['CS distal',55],['HRA',35]] as const:[['Septal A',60],['CS proximal',35],['CS distal',0],['HRA',80]] as const;
 return sites.map(([site,delay])=>({site,t:va+delay}));
}
export function pacingTiming(s1:number,s2:number,capture:boolean){return Array.from({length:5},(_,i)=>({label:i===4?'S2':'S1',t:i===4?3*s1+s2:i*s1,captured:i!==4||capture}));}
