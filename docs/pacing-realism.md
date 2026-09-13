# Recording revisions · September 12, 2026

## Changes

- Captured RV myocardial stimuli generate a broad QRS instead of reusing native conduction. This now applies to the five foundational cases and RV pacing during the advanced VT cases. Failed stimuli do not create a ventricular activation. Atrial pacing retains the conducted ventricular morphology, including after VT conversion.
- Native QRS templates span about 90 ms; RV myocardial capture spans about 160 ms. The RVA template has negative V1 and inferior-lead QRS complexes, positive lateral complexes and discordant repolarization. His + RV capture uses a shorter, approximately 110 ms template. Ventricular escape has a broad template without a stimulus artifact.
- Stimulus events carry output, pulse width, pacing site and, where applicable, actual capture configuration. Artifacts appear on every recorded lead, with site-dependent amplitude/polarity and a short amplifier response before the recording filters. Subthreshold nonzero pulses still produce artifact; zero-output commands do not. Widths shorter than one 0.5 ms sample retain a distinct response.
- A separate STIM row displays square timing pulses in the live recording, frozen review, diagnostic workspace and treatment monitor. Pulse onset is time-aligned, but a five-pixel minimum width makes short pulses visible. The drawn square is not a pulse-duration measurement. Zero-output commands have a `0` marker. Ordinary stimulus markers do not reveal capture; annotated review can show it.
- Native and RV-paced T waves follow an empirical response to the preceding V–V interval. This prevents the same fixed repolarization template being used at every rate; it does not implement QT restitution or patient-specific repolarization.
- Signal amplitude brackets follow the actual display gain. Optional A/H/V labels use local catheter template landmarks, preserving the regional delay between distal CS and His atrial activity. Filtering can shift peaks by a few milliseconds. Network timestamps remain distinct from local waveform landmarks.
- An armed His-timed PVC is cancelled when another pacing protocol starts, preventing an unexpected additional ventricular stimulus.
- Interface instructions were shortened and repeated generic caveats moved to the model page. Maneuver-specific capture, entrainment and treatment limitations remain next to the relevant controls.

## Verification

78 automated tests pass, including all fifteen cases, capture and noncapture, stimulus output/width, advanced para-Hisian configuration, VT and escape morphology, finite samples and frame-boundary continuity. Tests preserve limb-lead voltage relationships and confirm identical samples/events at quarter, half and normal study speed. The filtered isolated-template checks measure approximately 88 ms native, 157 ms RV myocardial and 109 ms His + RV QRS durations using a consistent signal threshold; these are numerical checks of the authored templates, not clinical validation.

The production and standalone builds pass. Browser checks cover visible broad RV-paced QRS and lead artifacts, square STIM timing, frozen review/scrubbing, a 269 ms caliper measurement for a 270 ms screen displacement, and model-page access from the footer and Guide, direct hash loading, Back/Forward and Escape. The model page fits a 390 × 844 viewport without horizontal overflow. This is browser emulation, not physical-phone or clinical waveform validation.

## Remaining limits

The conduction engines remain reduced event networks. They do not solve continuous wavefronts, graded fusion/pseudofusion, variable stimulus-to-QRS latency or rate-dependent bundle-branch aberrancy. Surface morphology is not a diagnostic localization map. Intracardiac signals remain authored bipolar templates with local delays, not differences between spatially solved electrode potentials. Para-Hisian capture mode is selected and constrained by recovery; independently varying His and myocardial capture thresholds are not solved. Treatment responses and mapping sites remain case-specific teaching parameters.

Saved commands retain their event references, but these waveform changes alter the displayed samples. Recheck older saved measurements against the new tracing.

## Clinical references

The normal-versus-paced duration and morphology choices were checked against the [AHA/ACCF/HRS ECG standardization statement](https://www.ahajournals.org/doi/epdf/10.1161/CIRCULATIONAHA.108.191095), the [2023 HRS/APHRS/LAHRS pacing guideline](https://pmc.ncbi.nlm.nih.gov/articles/PMC10549836/) and a [primary study of RV pacing morphology](https://pubmed.ncbi.nlm.nih.gov/18439164/). The exact waveform coefficients and durations are simulator parameters and were not fitted to patient recordings.
