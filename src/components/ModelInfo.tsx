import {useEffect} from 'react';
import {ENGINE_VERSION} from '../engine/model';
import './model-info.css';

const mechanisms=[
 ['AVNRT','Fast and slow AV nodal routes have different conduction and recovery times. A premature atrial beat can block in the fast route and initiate reentry through the slow route.'],
 ['AVRT','An accessory connection returns ventricular activation to the atrium. The foundational case uses a concealed left-sided pathway; advanced cases include septal, decremental and antegrade pathways.'],
 ['Focal AT','An atrial source runs independently of the ventricle. The foundational focus continues through ventricular pacing; the advanced drug-sensitive case has a different treatment response.'],
 ['Flutter','A periodic atrial driver and ordered catheter delays represent an organized rhythm. AV nodal recovery determines which atrial activations conduct. This case does not contain a spatial CTI reentry circuit.'],
 ['AF','Seeded irregular local atrial events produce changing atrial signals. AV nodal recovery and variable conduction produce an irregular ventricular response. Individual fibrillatory wavefronts are not simulated.'],
 ['Advanced studies','Small networks add local recovery, competing arrivals and selected mapping sites for conduction disease, atrial circuits and ventricular arrhythmias. Each case supports a defined set of pacing responses.'],
] as const;

export function ModelInfo(){
 useEffect(()=>{const previous=document.title;document.title='How the model works · EPsimLab';return()=>{document.title=previous;};},[]);
 return <article className="model-info">
  <div className="model-intro"><p className="model-kicker">EPsimLab · Engine {ENGINE_VERSION}</p><p>EPsimLab links an electrical timing model to generated ECG and intracardiac signals. You can change pacing, observe conduction and compare the response with the baseline rhythm.</p></div>

  <section aria-labelledby="model-timing-title"><h3 id="model-timing-title">From impulse to recording</h3><ol className="model-flow">
   <li><strong>1. An impulse starts</strong><p>A sinus beat, arrhythmia driver or pacing stimulus enters the network at a recorded time.</p></li>
   <li><strong>2. Tissue responds</strong><p>Conduction delays and tissue recovery determine whether the next region activates or blocks.</p></li>
   <li><strong>3. Signals are drawn</strong><p>Each activation contributes a waveform to the surface and catheter recordings, with lead-specific amplitude and delay.</p></li>
  </ol><p>The network stores atrial, nodal, His and ventricular events and their causes. Advanced cases add local events. The activation ladder displays those relationships after you submit a diagnosis.</p></section>

  <section aria-labelledby="model-pacing-title"><h3 id="model-pacing-title">Pacing and capture</h3><p>Output, pulse width and tissue refractoriness determine capture. A nonzero stimulus delivered below threshold or into refractory tissue still produces an artifact, but it does not start a new activation. At zero output the STIM row marks the command without a pacing artifact or capture.</p><dl className="model-definitions">
   <div><dt>STIM trace</dt><dd>A square pulse marks each nonzero stimulus. Its onset shares the recording time axis. Very short pulses are drawn at least five pixels wide so they remain visible. Read the actual duration from the stimulator settings; the displayed width is not a pulse-width measurement.</dd></div>
   <div><dt>Pacing artifact</dt><dd>The same pulse appears across the surface and intracardiac leads, with amplitude and polarity that vary by recording site. Filters shape the brief artifact; it is separate from the cardiac response.</dd></div>
   <div><dt>Paced QRS</dt><dd>The surface templates use approximately 90 ms for native QRS, 160 ms for RV myocardial pacing and 110 ms for His + RV capture. Atrial pacing preserves the conducted QRS when ventricular activation still arrives through the His–Purkinje route. Other ventricular activation patterns use separate templates.</dd></div>
  </dl><p>Confirm local capture before interpreting a pacing response. Entrainment also requires the relevant chamber to follow the train; a captured pulse alone is insufficient. Para-Hisian capture configuration is selected in the controls and constrained by tissue recovery; separate His and myocardial capture thresholds are not calculated.</p></section>

  <section aria-labelledby="model-mechanisms-title"><h3 id="model-mechanisms-title">How the rhythms are represented</h3><dl className="model-mechanisms">{mechanisms.map(([name,description])=><div key={name}><dt>{name}</dt><dd>{description}</dd></div>)}</dl></section>

  <section aria-labelledby="model-signals-title"><h3 id="model-signals-title">What the waveforms can show</h3><p>The ECG and electrograms use authored waveform templates. Surface morphology reflects the activation route; catheter signals combine local activity with smaller far-field components. These waveforms are not calculated from a continuous electrical field through the heart and torso. Repolarization after native and RV-paced beats follows a simple cycle-length response, not a patient-specific QT model.</p><div className="model-specs"><div><strong>2,000 Hz</strong><span>Sampling · one sample every 0.5 ms</span></div><div><strong>0.5–150 Hz</strong><span>Surface ECG filter</span></div><div><strong>30–500 Hz</strong><span>Intracardiac filter · optional 100–300 Hz</span></div></div><p>Filtering and recording-site delays affect deflection shape and peak timing. Measure from consistent landmarks on the same channels. A/H/V annotations mark approximate local His-channel template landmarks. Filtering can shift the visible peaks by a few milliseconds, and network event times can differ from those local landmarks. Each signal row includes a labeled amplitude calibration mark (0.5 mV, or 0.1 mV at high gain). The STIM timing trace bypasses the physiological signal filters.</p><p>Study speed scales the shared simulation clock, including pacing and treatment. Sweep changes the amount of time shown. Neither changes the measured intervals.</p></section>

  <section aria-labelledby="model-treatment-title"><h3 id="model-treatment-title">Mapping and treatment</h3><p>Anatomy and catheter locations are schematic. Mapping uses a small set of assigned sites, local timings and voltages. It does not reconstruct a patient’s electroanatomic map.</p><p>Drug effects, cardioversion responses and lesion thresholds are specified for each case. RF effects accumulate with contact and exposure over compressed time; lesions persist until the study is reset. These controls do not predict a clinical dose, lesion size or treatment success.</p></section>

  <section className="model-boundaries" aria-labelledby="model-limits-title"><h3 id="model-limits-title">Where interpretation stops</h3><ul>
   <li>Continuous spatial propagation, wavefront collision and graded fusion or pseudofusion are not resolved. A selected capture state does not reproduce every possible mixed QRS.</li>
   <li>Timing, geometry and voltage are case parameters. A familiar-looking tracing does not validate a clinical cutoff or localization rule.</li>
   <li>A negative maneuver may reflect its timing or site. It does not exclude every clinical variant of a mechanism.</li>
   <li>Hemodynamics, patient-specific drug responses and a complete procedural risk model are outside the simulation.</li>
  </ul><p>EPsimLab is an educational simulator under development. Its cases have not been clinically validated for patient diagnosis or treatment. Case debriefs describe the limits that matter for that study.</p></section>

  <section aria-labelledby="model-replay-title"><h3 id="model-replay-title">Repeatable studies</h3><p>Cases run from fixed parameters and seeded variation. Saved studies store the case, timestamped interventions and measurements; replay rebuilds the study from those commands. Display settings can change how a trace looks without changing its underlying event times. Software updates can change waveform templates; recheck older saved measurements against the current tracing.</p></section>
 </article>;
}
