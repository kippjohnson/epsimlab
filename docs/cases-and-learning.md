# Five-case teaching library · 0.2.0

This is a foundational selection of common EP teaching presentations, not an epidemiological ranking of the five most frequent referrals. No patient data or third-party guideline tables are included. Clinical expert review remains pending.

| Case | Initial state | Implemented behavior | Main observations |
| --- | --- | --- | --- |
| The narrow-complex mystery | Sinus rhythm, 800 ms | Existing dual-pathway AV nodal graph; atrial S1 500 × 8 + S2 280 induces 315 ms reentry | Modeled AH prolongation and short VA |
| The return route | Tachycardia, 300 ms | A → AV node → His → V → retrograde accessory pathway → A; 140 ms model V-to-A return | Longer VA and distal-before-proximal CS atrial sequence |
| An atrial rhythm of its own | Tachycardia, 420 ms | Non-resetting focal atrial driver; antegrade AV conduction, no retrograde VA conduction | Stable atrial clock despite captured ventricular pacing |
| Two atrial beats, one pulse | Atrial 240 ms, ventricular 480 ms | Periodic atrial driver, ordered catheter delays, AV nodal refractoriness producing 2:1 conduction | Rapid organized A–A and V–V twice A–A |
| A rhythm without a metronome | Irregular atrial/ventricular activity | Seeded local atrial timing, changing catheter delays/fractionation, variable AV nodal recovery | Irregular local atrial signals and variable V–V |

## Boundaries of interpretation

AVNRT/AVRT are simplified event networks. The AT driver does not reproduce all automatic, triggered, or reentrant AT responses. Flutter represents the timing of a typical-flutter scenario; it does not implement a spatial CTI loop or validate entrainment/localization. AF uses a phenomenological local activation model, not distributed atrial wavefronts. Synthetic waveforms include catheter/template delays and are not a spatial forward solution.

A long VA, short VA, AH prolongation, eccentric sequence, or irregular ventricular rhythm is not independently diagnostic. Feedback explicitly separates the observed pattern from proof of the intended clinical mechanism. The treatment lab now adds authored drug responses, synchronized cardioversion, and selected RF substrates (see treatment-lab.md). Formal diagnostic maneuvers, validated cutoffs, AF ablation, and implantation remain future work.

## Learning workflow

- Seven-step tour: purpose → catheters → rows → timing → pacing → evidence → explanation.
- Tour actions navigate/highlight the actual workspace and can pause/caliper, freeze, or open the worksheet. They do not reset the study. “Back to tour” returns from the selected panel.
- Guided mode adds a case-specific question, three investigation prompts, and an action. Challenge hides coaching and diagnosis names in the chooser.
- Searchable glossary covers EP study, A/H/V, electrograms, catheter names, intervals, cycle length, pacing/capture, S1/S2, refractoriness, directions, mechanisms, and recording controls.
- Educational sources are linked from Guide. All teaching text is original.
- Flutter opens at 50 mm/s and AF at 25 mm/s so more cycles are visible. Case selection returns the phone to Recordings.

## Evidence and persistence

`src/teaching.ts` defines case goals, protocols, explanations, model limitations, and observation checks. Checks use the retained live buffer (up to 180 seconds). The learner selects observations; the app checks both required observations and flags unsupported selections. Results are fixed at submission, not recalculated as live time advances. This is not a validated clinical scoring instrument.

AH checks follow causal activation ancestry. VA, A–A, V–V, and conduction ratios use measured event times. The AT independence check requires an actual series of ventricular stimuli with several captured beats, an unchanged atrial clock before/during pacing, and a changed ventricular pattern; failed capture alone cannot establish independence. CS sequence and AF morphology checks use metadata that also drives the signal synthesizer.

Engine version 0.3.0 supports new treatment commands and retains compatibility with 0.2.0 pacing-only studies. Both support all six stored case IDs (five visible plus legacy `avnrt-02`). Version 0.1.0 sessions are accepted only for the original AVNRT IDs, whose physiology and signal behavior are retained. Import, local load, and optional cloud write enforce compatibility. New-session cloud round-trips preserve the engine version. Saved studies retain commands and measurements; tour state and diagnosis submissions are not archived.

## Verification · September 8, 2026

- 24 automated tests pass: original baseline/induction/capture/filter/API checks plus new mechanisms, catheter timing, scoring positives/negatives, AF determinism, all-case signal frame continuity, replay with differing time chunks, and session compatibility.
- TypeScript and production/standalone builds pass. Wrangler asset/Worker dry-run passes. The existing large-JS-chunk warning remains because the app includes its Three.js viewer and standalone build support.
- Browser interaction checks: all seven tour steps/actions, five-case chooser, AVRT/AT/flutter/AF worksheets with supported evidence, AT ventricular pacing, glossary search, Challenge mode, AF save/load, and responsive overflow checks. Phone-size emulation is not a substitute for physical iPhone testing.
- Physical device performance and expert assessment of the tracings remain for faculty review.

## Educational reading

- [American Heart Association: Electrophysiology studies](https://www.heart.org/en/health-topics/arrhythmia/symptoms-diagnosis--monitoring-of-arrhythmia/electrophysiology-studies)
- [Cleveland Clinic: AVNRT](https://my.clevelandclinic.org/health/diseases/22923-avnrt)
- [Cleveland Clinic: Atrial tachycardia](https://my.clevelandclinic.org/health/diseases/21800-atrial-tachycardia)
- [Cleveland Clinic: Atrial flutter](https://my.clevelandclinic.org/health/diseases/22885-atrial-flutter)
- [HRS: 2024 AF ablation consensus overview](https://www.hrsonline.org/resource/2024-ehra-hrs-aphrs-lahrs-expert-consensus-statement-on-catheter-and-surgical-ablation-of-atrial-fibrillation/)

These sources inform general teaching concepts; the authored model constants and rubric are not quoted clinical recommendations or validation results.

Public deployment smoke check also confirmed AVNRT induction at 315 ms/190 bpm with supported evidence, AF default sweep at 25 mm/s, and a working tour-to-expanded-3D flow at 390 px. No production browser warnings or errors were reported during those checks. Local 320 px tour and 1440 px desktop checks showed no horizontal overflow.
