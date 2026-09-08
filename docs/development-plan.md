# Local development baseline and priorities

Updated September 8, 2026.

Subsequent implementation: the owner requested 3D heart and catheter models. That foundation is now implemented; see [3d-anatomy.md](3d-anatomy.md). The baseline observations below describe the initial import, before that feature was added.

Mobile follow-up: a dedicated phone study layout, persistent pacing controls, and pointer-handling improvements are implemented; see [mobile.md](mobile.md). Hosted phone access is now available; see [deployment.md](deployment.md).

## Product direction confirmed with the owner

- Primary audience: EP fellows practicing diagnostic studies.
- Next milestone: more realistic diagnostic EP with distinct AVNRT, AVRT, and AT cases.
- The owner has not yet tested the prototype enough to identify specific usability problems.
- No existing GitHub repository or Cloudflare project exists for this app. Both will be new when hosting is requested.
- The imported original specification describes earlier ambitions; it is reference material, not authorization to implement every proposed feature.

## Baseline

The workspace initially matched every file in `ep-lab-source.zip`. It contains a React/TypeScript/Vite frontend, an inline simulation Web Worker, and an optional Cloudflare API for session storage. There is no Git repository yet.

Validation performed locally:

- Installed the pinned dependencies with `npm ci`.
- All 14 existing engine, signal, and API tests passed.
- `npm run build` passed, including TypeScript checking and standalone HTML generation.
- Started the Vite development server at http://127.0.0.1:5173/.
- Browser spot check: application loaded; default atrial pacing produced the expected model display of 190 bpm / 315 ms; acquisition paused; frozen review opened; caliper mode enabled.

This was a browser spot check, not completion of the supplied automated browser smoke suite. Caliper dragging/accuracy, save/import/export/replay, responsive breakpoints, and offline behavior still need browser verification. Passing software tests does not establish physiological validity.

## What exists

- Nine synthetic recording channels, sweep/gain/filter controls, fixed schematic catheters.
- HRA/RVA pacing with an S1 train and optional S2, output/width controls, capture and refractory behavior.
- Frozen review, labeled measurements, procedure log, diagnosis selection, and activation ladder.
- IndexedDB saves, JSON exchange, and command-based replay.
- Two parameter variants of one simplified slow–fast AVNRT substrate.

AVRT and AT are diagnosis choices but have no independent simulated mechanisms. Ablation and device navigation open roadmap dialogs. Cloud storage bindings are not configured.

## Proposed implementation order

1. **Establish a diagnostic-study reference baseline.** Walk through induction, noninduction, failed capture, ventricular pacing, measurements, and replay with the owner. Record intended responses and identify waveform/timing discrepancies before extending physiology.
2. **Separate mechanism, case, and interpretation logic.** The engine currently assumes one dual-pathway network. Define explicit case mechanisms and causal event contracts; extract case-specific debrief logic from the main UI. Keep replay deterministic and version saved sessions when behavior changes.
3. **Add distinct AVRT and focal AT cases.** Implement their conduction networks and signal activation sequences, with documented limitations and reviewed acceptance scenarios. Each case must behave differently in response to interventions, not just display a different diagnosis.
4. **Expand diagnostic maneuvers and evidence.** Prioritize maneuver coverage with the owner once the initial cases are testable. Candidate work includes incremental pacing, automated extrastimulus scanning, and ventricular pacing analysis. Debriefs should connect assertions to identifiable events and measured intervals.
5. **Prepare GitHub and Cloudflare hosting.** Establish version control, build/test automation, and an initial hosted preview once requested. Existing deployment configuration is a starting point; live deployment and storage have not been verified here.

## Specific engineering observations to address

- `src/App.tsx` combines UI, session validation, cloud requests, and diagnosis scoring. Extracting case interpretation and session validation will reduce duplication as cases grow.
- Current evidence checks infer AH prolongation from seeing both fast/slow conduction labels, and short VA from a count of retrograde atrial events. They do not verify the learner's measurements or a maneuver-specific interval change.
- Mechanism reveal and scoring are hardcoded to AVNRT. Loading a saved study also immediately unlocks the mechanism; decide how replay should behave in an unknown-case exercise.
- Frozen review renders only three channels, limiting simultaneous review of HRA and CS signals.
- The current-case badge is hardcoded to `01` even when the second case is selected.
- The recording buffer is bounded, but the engine retains its entire event history and repeatedly scans it for metrics. Assess long-study performance before longer exercises are added.
- Replay saves physiology commands and measurements, but not the complete recording/display history. Filter settings restart at the standard band.

## Decisions to make during the next case-design session

- Which AVRT and focal AT variants should be the first teaching cases?
- Which three diagnostic maneuvers must behave convincingly for the first fellow-facing release?
- Should unknown-case mode hide substrate hints until diagnosis commitment?

No physiology or product behavior was changed during this initial review.

## September 8 · five-case learning release

Implemented and deployed the five-case foundational teaching set and an introductory tour. See `cases-and-learning.md` for model scope, rubric, and verification. The original AVNRT variant remains available for legacy replay. The next clinical priority is faculty review of the five mechanisms and refinement/validation of discriminating pacing maneuvers; full CTI mapping and AF ablation remain future modules.
