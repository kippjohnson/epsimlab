# Diagnostic curriculum · release 0.7

Ten advanced studies join the five foundational cases. Select **Cases → a study → Diagnostic maneuvers**. The controls operate on the running recording; commands, lesions and collected points reconstruct during saved-study replay. Engine version 0.4.0 uses a new reduced excitable network for advanced cases. Original cases retain their original engine and support older recordings.

| Study | First experiment | Observation to investigate |
| --- | --- | --- |
| Atypical AVNRT | VOP, then a captured H + 20 ms PVC | Longer ventricular return; no atrial advance with this PVC |
| Concealed septal AVRT | H + 20 ms PVC, VOP, para-Hisian comparison in sinus | Atrial advance, concentric return, pathway-mediated retrograde timing |
| His–Purkinje disease | Baseline HV, incremental atrial pacing | Prolonged HV; recorded His without conducted V |
| Manifest accessory pathway | Baseline and atrial S1/S2/S3 | Pre-excitation and competing pathway recovery |
| PJRT | VOP at different cycles, His-timed PVC | Slow, rate-dependent return; atrial resetting |
| Adenosine-sensitive focal AT | VOP before adenosine | Independent atrial clock despite later drug termination |
| Perimitral macroreentrant AT | Map and entrain annular vs bystander sites | Sequential local activation and different return intervals |
| RVOT ventricular arrhythmia | Map local activation and compare pace maps | Independent A/V clocks and early local activation |
| Fascicular VT | Local Purkinje potentials, entrainment, verapamil | Purkinje-related circuit signals and authored drug sensitivity |
| Scar-related monomorphic VT | Activation, voltage and entrainment at several sites | Circuit vs connected bystander; low voltage alone is insufficient |

## Pacing and interpretation

VOP and AOP offer cycle length, pulse count and output. Apex/base changes alter the reduced ventricular access delays. Incremental atrial pacing shortens successive intervals by 20 ms to a 220 ms floor. Programmed stimulation adds S2 and optional S3, with capture and refractoriness checked on each pulse.

His-timed PVC waits for an antegrade His event and delivers after the chosen delay. A timeout, absent capture, unstable baseline or recovered His prevents an affirmative interpretation. The worksheet checks the observed atrial timing response. A negative response is not a universal exclusion rule.

Para-Hisian pacing requires sinus rhythm in this implementation. Cardiovert first; compare His+RV and RV-only at the same cycle and location. The model records actual direct His capture. Direct atrial capture is an explicit invalid-comparison condition. A decremental or distant pathway may be masked by nodal conduction.

VOP analysis requires the final three captured pulses to causally accelerate A with stable S–A. It then reports the return sequence, RV-event-referenced PPI−TCL, S–A−VA and, when available, return AH change and corrected PPI. No universal diagnostic cutoffs are applied. Local entrainment similarly requires acceleration before displaying local PPI. Previous findings remain available for comparison. Prediction text is a temporary workspace prompt, not part of saved progress.

## Mapping and lesions

The **Mapping & endpoints** tab exposes seven named network locations and **MAP 1–2**, an additional selectable recording channel. Wait for local cycles after changing position, then collect a point. Each point retains local EGM timing relative to the nearest A (atrial cases) or V (ventricular cases), plus authored bipolar voltage. This nearest-cycle reference can wrap late activation into the following cycle; it is not a full unwrapped activation map.

Circuit-site versus bystander entrainment produces different local return times. Pace-map comparison uses all twelve authored surface templates and reports template similarity, not a validated clinical correlation score. It does not reconstruct patient-specific surface potentials.

Lesions accumulate contact × simulated exposure at the selected location. A complete lesion blocks the corresponding modeled substrate. The immediate compressed effect is a teaching convenience. Ring interruption removes the authored loop; a bystander lesion does not. **Assess current endpoint** checks ongoing rhythm and active drug confounding. **Repeat induction challenge** explicitly seeds the authored circuit to test substrate persistence; it does not establish clinical programmed noninducibility. Bidirectional mitral-line block, clinical lesion geometry, full wavefront fusion, and AF ablation are not implemented. Existing foundational CTI probes remain abstract directional calculations.

## Network and clinical limits

The queue represents atrium, AV node, His–Purkinje system, ventricle, accessory routes and fixed local circuit sites. Recovery, rate-dependent delays and competing arrival times determine accepted activations. The ring uses a single-front collision approximation: an accepted paced entry extinguishes the prior circulating front. This is not continuous 3D propagation. The anatomy viewer remains schematic with fixed diagnostic catheter positions.

Drug exposures are fixed teaching intervals, not dosing instructions or pharmacokinetic predictions. Adenosine-sensitive AT and RVOT conversion, perimitral ibutilide conversion and fascicular verapamil conversion are authored responses. Surface QRS morphologies are illustrative templates, not validated localization criteria. Clinical expert review is pending. The worksheet records selected evidence and practice; it is not a validated competency assessment.

## Validation

Automated tests cover all ten initial rhythms, differential His-timed PVC responses and absent capture, VOP gating and return intervals, para-Hisian capture modes, infra-His block, S3 timing, WPW pre-excitation, local activation/voltage, circuit vs bystander entrainment, lesion contact and site, drug responses, command validation, storage compatibility, deterministic mixed-command replay across frame sizes, and finite continuous signals across all 31 channels. The original case and treatment regression suites remain in place. Browser checks covered the 15-case library, PVC findings, scar entrainment, mapping collection, lesion reassessment, and caliper measurement at desktop and 390 × 844 sizes. The diagnostic recording stays visible while controls scroll.

## Source material

Original teaching text and model design were informed by these sources. Their clinical findings do not validate this simulator's numerical parameters.

- [Para-Hisian pacing original study](https://pubmed.ncbi.nlm.nih.gov/8790042/)
- [Ventricular pacing in SVT diagnosis](https://pubmed.ncbi.nlm.nih.gov/8269296/)
- [Adenosine-sensitive atrial tachycardia](https://pubmed.ncbi.nlm.nih.gov/7731878/)
- [Fascicular VT circuit investigation](https://pubmed.ncbi.nlm.nih.gov/9869526/)
- [2019 HRS/EHRA/APHRS/LAHRS ventricular arrhythmia ablation consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC6595359/)
