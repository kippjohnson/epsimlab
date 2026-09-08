export const DRUGS={
 adenosine:{name:'Adenosine',duration:8000,description:'Transient AV nodal block. Can interrupt AVNRT / orthodromic AVRT; atrial activity continues in the AT, flutter and AF cases.',limit:'This AT is adenosine-insensitive; some clinical ATs terminate. Sinus-node effects, bronchospasm and pre-excited AF are not modeled.'},
 esmolol:{name:'Esmolol',duration:60000,description:'Temporary AV nodal slowing and increased nodal refractoriness; slows ventricular response without eliminating an atrial driver.',limit:'A fixed teaching exposure. Blood pressure, contractility, dose titration and drug interactions are not modeled.'},
 isoproterenol:{name:'Isoproterenol',duration:60000,description:'Accelerates sinus activity and shortens nodal conduction and recovery. Use pacing to reassess inducibility.',limit:'Induction is still timing-dependent; catecholamines do not guarantee inducibility. No dose-response or hemodynamic model.'},
 ibutilide:{name:'Ibutilide',duration:60000,description:'A delayed rhythm-conversion example for flutter and AF, with conversion after 10 simulated seconds.',limit:'Conversion is deterministic in these two cases. QT prolongation, torsades, monitoring and real pharmacokinetics are not simulated.'}
} as const;
export type DrugId=keyof typeof DRUGS;
export const TARGETS=[
 {id:'slow-pathway',name:'Inferior nodal extension',short:'Slow pathway',position:[-.38,.06,.48],hint:'Inferior septal region near the CS ostium. Modification removes the modeled slow limb; test inducibility afterward.'},
 {id:'left-ap',name:'Left lateral annulus',short:'Left accessory pathway',position:[1.14,.42,-.38],hint:'The AVRT case has a concealed left lateral return connection. Test retrograde conduction with ventricular pacing.'},
 {id:'atrial-focus',name:'High lateral RA',short:'Atrial focus',position:[-1.6,1.25,.2],hint:'The focal AT case originates here. Observe for recurrence after suppressing the driver.'},
 {id:'cti-annular',name:'CTI · annular end',short:'CTI 1',position:[-.65,.08,.57],hint:'One of three connected segments in the simplified CTI line.'},
 {id:'cti-mid',name:'CTI · middle',short:'CTI 2',position:[-.84,-.12,.48],hint:'Leaving any conducting segment allows the authored flutter driver to continue.'},
 {id:'cti-caval',name:'CTI · caval end',short:'CTI 3',position:[-1.03,-.32,.32],hint:'Complete the line, then test conduction from both sides. Termination alone is not the endpoint.'},
 {id:'his-risk',name:'His region · avoid',short:'His region',position:[.04,.2,.48],hint:'Energy at this site can injure normal AV conduction. This model produces persistent AV block with a slow ventricular escape.'}
] as const;
export type TargetId=typeof TARGETS[number]['id'];
export const CTI_TARGETS:TargetId[]=['cti-annular','cti-mid','cti-caval'];
export type EndpointTest='induction'|'va'|'cti-clockwise'|'cti-counterclockwise';
export type TherapyAction={type:'drug';drug:DrugId}|{type:'cardiovert'}|{type:'cancel-shock'}|{type:'ablate';target:TargetId;power:number;duration:number;contact:number}|{type:'stop-ablation'}|{type:'test';test:EndpointTest};
export interface TherapyState {drugs:{id:DrugId;until:number}[];lesions:Partial<Record<TargetId,number>>;rf:null|{target:TargetId;start:number;end:number;power:number;contact:number};shockPending:boolean;tests:{direction:string;blocked:boolean;delay:number;t:number}[];avBlock:boolean;lastConversion:number|null}
export const EMPTY_THERAPY:TherapyState={drugs:[],lesions:{},rf:null,shockPending:false,tests:[],avBlock:false,lastConversion:null};
export function validTherapy(action:unknown):action is TherapyAction{
 if(!action||typeof action!=='object')return false;const a=action as Record<string,unknown>;
 if(a.type==='drug')return typeof a.drug==='string'&&Object.hasOwn(DRUGS,a.drug);
 if(['cardiovert','cancel-shock','stop-ablation'].includes(a.type as string))return true;
 if(a.type==='test')return ['induction','va','cti-clockwise','cti-counterclockwise'].includes(a.test as string);
 return a.type==='ablate'&&TARGETS.some(t=>t.id===a.target)&&typeof a.power==='number'&&Number.isFinite(a.power)&&a.power>=20&&a.power<=40&&typeof a.duration==='number'&&Number.isInteger(a.duration)&&a.duration>=5&&a.duration<=30&&typeof a.contact==='number'&&Number.isFinite(a.contact)&&a.contact>=0&&a.contact<=1;
}
