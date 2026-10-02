# Physiology audit — release 0.8, engine 0.5

This revision addresses reproducible signal and pacing defects. It is not a claim of patient-level fidelity or clinical validation. No patient recordings were used to fit the model.

## Findings and changes

| Finding in the previous implementation | Revised behavior | Verification |
| --- | --- | --- |
| Intracardiac channels largely repeated a scaled two-Gaussian deflection, with the same local ventricular timing during conduction and RV pacing. | Bipoles subtract two compact, delayed electrode potentials. Local A, H and V signals have separate widths and amplitudes; far-field signals are broader and smaller. RV pacing activates the RV channel before the septal and CS ventricular signals. | Causal support, bipolar area, direction/polarity reversal, near/far-field width, local activation order, filter and frame-continuity tests. |
| Typical and atypical nodal reentry used a sinus-like atrial recording sequence. | Nodal return is explicitly concentric/His-region first; lateral accessory return remains distal-CS first. The atrial surface component also changes for retrograde activation. | Event-source and catheter-landmark tests in typical AVNRT, atypical AVNRT and lateral AVRT. |
| Fast atrial pacing in foundational non-AVNRT cases used a constant nodal delay until a binary ERP blocked. | A history-dependent recovery curve increases delay as the preceding nodal exit approaches the next input. At sufficiently fast drive, progressive delay leads to block and then recovery. | At 240 ms HRA drive after AVRT conversion, conducted nodal intervals progressively lengthen, a captured A fails to conduct, and the next conducted interval shortens. |
| Foundational diagnostic controls discarded the maneuver identity, provided no findings report, and ignored RV location; the engine's incremental fallback did not decrement intervals. | These cases retain diagnostic commands, produce capture/entrainment findings, honor apex/base access, and support actual incremental timing plus His-timed PVCs. | Command replay, selected-site latency, stimulus intervals, PVC cancellation/noncapture, and longer-train AVNRT entrainment/termination tests. |
| Advanced and foundational strength-duration thresholds differed for the same tissue. | Both use the same rheobase/chronaxie equation. Pacing a fully lesioned mapping site does not claim capture. | Output × width matrix across both networks and lesioned-site noncapture test. |
| Return-sequence analysis kept only two activations after the paced V, truncating V–A–A–V. Para-Hisian S–A could include an unrelated sinus A. A later intervention could retroactively invalidate an already completed observation. | Retain the sequence through ventricular return; require causal retrograde A for para-Hisian timing; invalidate only interventions within the observation window. Failed/undelivered stimulation does not become a negative diagnostic finding. | Independently authored event fixtures rather than relying only on the engine's own generated rhythms. |
| New physiology could silently change an older study's replay and saved measurements. | New studies use engine 0.5. Version 0.4 replays use frozen physiology, analysis and signal generators; resaves preserve their version. Earlier versions keep the previous release's compatibility behavior. | All-case legacy event comparison and worker-level sample equality/resave checks. |

## Parameter choices and boundaries

The new electrode potentials are compact illustrative kernels, not extracellular potentials solved from tissue geometry. The bipole spacing is a time separation, not measured catheter geometry. Polarity is a fixed projection for each modeled activation direction. Healthy rhythms repeat deterministically; AF adds deterministic local fractionation. Selected scar sites have delayed low-amplitude components, and fascicular mapping has a sharp Purkinje component followed by a broader component. These appearances do not establish voltage cutoffs or localization criteria.

For the foundational single AV node, recovery is elapsed time from the prior scheduled nodal exit to the current nodal input. The illustrative delay is `95 + round(250 × max(0, exp(-recovery/100) - exp(-205/100)))` ms before drug scaling, with block below 65 ms recovery. These constants preserve the baseline cases while allowing progressive delay/block during faster drive. They are not clinical fitted values. Full facilitation, long-term fatigue, concealed penetration, dual-pathway restitution and spatial wavefront collision remain incomplete. Typical AVNRT retains its two-pathway induction circuit and gains coupling-dependent fast-path delay and a retrograde His route for ventricular input.

A captured ventricular beat does not automatically establish atrial entrainment. In particular, early pulses of a train may fail in refractory myocardium, AT may continue independently, and sufficiently rapid pacing can terminate the modeled reentry. Reports gate PPI and return-sequence interpretation on capture plus stable causal acceleration. The model does not implement every clinical V–A–A–V mechanism; the analyzer now preserves that sequence when it is present rather than silently truncating it.

The existing surface QRS templates, simplified flutter/AF drivers, discrete mapping sites, lesion and drug kinetics, selected para-Hisian capture configurations, and lack of graded fusion/pseudofusion remain limitations. These changes do not justify a promise of error-free or clinically validated behavior.

## Reference basis

These primary studies support the qualitative design principles, not the chosen numerical coefficients:

- [Hwang et al., multiple factors influencing bipolar EGM morphology (2019)](https://pubmed.ncbi.nlm.nih.gov/30951529/): electrode orientation, conduction velocity and catheter configuration affect width and amplitude.
- [Lin et al., AV nodal recovery properties (1997)](https://pubmed.ncbi.nlm.nih.gov/9359546/): conduction delay depends on the preceding His-to-atrial recovery interval.
- [Talajic et al., dynamic AV nodal properties (1991)](https://pubmed.ncbi.nlm.nih.gov/1877657/): recovery, facilitation and fatigue are distinct; the present reduced model does not implement them all.
- [Kadish and Morady, responses to overdrive pacing (1993)](https://pubmed.ncbi.nlm.nih.gov/8269296/): interpretation depends on chamber/circuit response and pacing conditions.
- [Hirao et al., para-Hisian pacing (1996)](https://pubmed.ncbi.nlm.nih.gov/8790042/): distinguish conduction changes associated with loss of His capture and exclude direct atrial capture.
- [Kaneko et al., V–A–A–V in fast–slow AVNRT (2017)](https://pubmed.ncbi.nlm.nih.gov/28606635/): a return sequence is not a universal mechanism classifier.

## Review procedure

1. Compare baseline and induced recordings with the same gain, sweep, filters and time window.
2. Induce typical AVNRT using HRA 500 ms × 8 + S2 280 ms. Confirm sustained 315 ms rhythm and septal-first A. Try a 20-beat RV train at 285 ms, then repeat at 230 ms from a fresh induced rhythm; assess actual capture and response.
3. In lateral AVRT, compare apex/base VOP at 270 ms and inspect the last entrained A, return sequence and S–A values.
4. Cardiovert the foundational AVRT case, then deliver HRA 240 ms × 30. Inspect progressive AH and captured atrial beats that do not conduct.
5. In para-Hisian pacing, compare like-for-like capture and exclude direct atrial capture or unstable His capture.
6. Replay a version 0.4 study and verify it retains historical physiology and recordings. Reset starts the revised model.

The repository's automated checks cover engine behavior, all fifteen cases, deterministic replay, actual worker messages, signal filtering, waveform continuity, API storage and account isolation. They are software regression checks, not a substitute for electrophysiologist review of the synthetic traces.
