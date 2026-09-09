# EPSimLab — diagnostic simulator preview

A working React/TypeScript application with fifteen deterministic teaching scenarios, intracardiac recordings, programmed stimulation, calipers, evidence-based diagnosis, and session replay. Cloudflare Workers serves the application; Better Auth and D1 provide user accounts and private study storage.

## Website and simulator

Landing page: [epsimlab.com](https://epsimlab.com). Source: [kippjohnson/epsimlab](https://github.com/kippjohnson/epsimlab).

Open [EPSimLab](https://app.epsimlab.com) in Safari or another modern browser. Deployed September 8, 2026, including five diagnostic cases, a guided introduction, 3D anatomy, and the mobile study workspace. Release 0.7 adds ten advanced cases, diagnostic pacing, discrete-site activation and voltage mapping, pace-map comparison, and lesion reassessment. The treatment lab includes drugs, synchronized cardioversion, and teaching ablation. Module 0 provides five foundational lessons, interactive timing diagrams, thirteen knowledge checks, and private account learning progress. Guests can explore every case; saving or exporting progress requires an account.

## Open immediately

Open `release/ep-lab.html` in a modern desktop browser. It is a self-contained build with no external fonts, libraries, or network dependencies. This portable build supports exploration; sign in on the hosted application to save or export progress. For a hosted preview, serve `dist/` over HTTP or deploy to Cloudflare.

The application has been built and inspected locally in a browser. The 3D viewer has been checked at desktop and mobile sizes, including camera controls, catheter selection, and transparency. The full standalone browser smoke suite and physiological expert validation remain pending.

## Develop

Use Node.js 24 or later (the test runner uses Node's TypeScript transformation).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`npm run build` creates `dist/` for hosting and `release/ep-lab.html` for a portable standalone preview. All dependencies are pinned and a lockfile is included. A service worker caches the hosted application for offline use after the first successful load. API requests are never cached.

## Module 0 and guided learning

Open [Module 0 · EP foundations](https://app.epsimlab.com/#module-0) or select its button above the study. It covers signal interpretation; AH, HV, PQ/PR, and RR; pacing; forward delay and block; retrograde patterns; and five diagnostic scenarios. Diagrams are independent timing sketches and do not alter the live engine. All thirteen checks provide retry feedback. Correct answers complete a lesson; completion records practice, not clinical competency.

Guests keep answers only in memory for the current session. Signed-in learners can explicitly save answers to D1 with **Save progress**, then restore them on another device. Switching accounts clears the prior learner’s answers. The API validates question IDs and answers, derives completion, and scopes reads and writes to the authenticated user. Apply `0002_learning_progress.sql` before deploying release 0.5. See [Module 0 implementation notes](docs/module-0.md).

## Guided learning and case library

Select **Take a guided tour** for seven steps through the actual workspace: the purpose of an EP study, catheters, signal rows, intervals, pacing, frozen evidence, and diagnosis. Actions open the corresponding controls without resetting the case. **Guide** also offers a searchable glossary and educational sources.

**Guided** mode shows a case coach with observations to make and an appropriate action. **Challenge** hides the coach and diagnosis labels in the case chooser. Five foundational scenarios cover AVNRT, orthodromic AVRT, focal AT, typical flutter, and AF; this is a foundational teaching selection rather than a prevalence ranking. Cases 2–5 begin during the clinical rhythm. Flutter and AF open at slower sweep speeds to show more cycles.

Each worksheet checks selected observations against retained events. Two key observations are required and unsupported selections are identified individually. Feedback is fixed when submitted so it does not change as acquisition continues. Scoring is educational, not a validated assessment rubric. See [case definitions and validation](docs/cases-and-learning.md).

## Advanced diagnostic curriculum

Ten additional cases cover atypical AVNRT, septal AVRT, His–Purkinje disease, manifest pre-excitation, PJRT, adenosine-sensitive AT, perimitral atrial reentry, RVOT arrhythmia, fascicular VT, and scar-related VT. Open **Cases**, select a study, then **Diagnostic maneuvers**. The workspace includes VOP/AOP, His-timed PVCs, para-Hisian capture comparisons, incremental atrial pacing, S3, local entrainment, mapping, and compressed teaching lesions. Guided mode asks for a prediction and offers an explanation after the intervention.

See [diagnostic curriculum and model boundaries](docs/diagnostic-curriculum.md) for case-specific workflows, validation, and the distinction between reduced network responses and clinical mapping.

## First study

1. Observe sinus rhythm on nine channels.
2. Deliver the default HRA train: S1 500 ms × 8, S2 280 ms, 5 mA, 1 ms.
3. Observe the induced tachycardia. The AVNRT case produces a model cycle length of 315 ms.
4. Freeze a segment. Use calipers to measure AH, HV, VA, or TCL, and label the measurements.
5. Commit a diagnosis with supporting observations, then view the causal activation ladder.
6. Sign in or create an account to save (with a local copy) or export the session. Replay reconstructs the physiology from timestamped pacing commands.

Space pauses/resumes. F freezes a review segment. Click a channel label to cycle its gain. Changing the intracardiac filter genuinely changes the signal; the surface filter remains 0.5–150 Hz. Frozen traces preserve their captured filter output.

## Slow-motion study

Use **Study speed** beside the live recording controls or in the diagnostic and treatment workspaces. Choose **¼×**, **½×**, **1×**, or **5×**. The selection applies to signals, pacing, drug effects, cardioversion synchronization, ablation timers, and replay. At ¼×, one simulated second takes four seconds to watch.

Measured intervals and displayed heart rate retain their simulated values: a 400 ms cycle still measures 400 ms. Sweep independently controls the horizontal recording scale. Changing speed does not resume a paused study or alter frozen evidence. The speed stays selected when opening another case; refreshing the app starts at 1×.

## Treatment lab

Select **Treat rhythm** above the recording or **Ablate** in navigation. Live II/His/RV signals remain visible while scrolling treatment controls. Drug challenges include adenosine, esmolol, isoproterenol, ibutilide, and verapamil with explicit model durations and limitations. Synchronized cardioversion waits for a modeled R peak; it does not remove the underlying substrate.

RF ablation supports slow-pathway modification, a concealed left lateral accessory connection, a focal RA driver, and a three-segment CTI line. Choose a target in the 3D view or selector, adjust power/duration/contact, deliver or stop RF, and test the result. Incomplete contact produces less tissue effect, a CTI gap maintains conduction, and His-region injury causes AV block with a ventricular escape. CTI directional probes are abstract conduction calculations, not a full differential-pacing recording. AF ablation is not implemented.

These are original teaching demonstrations, not prescribing or procedural guidance. Drug kinetics and lesion thresholds are deliberately simplified. Treatments, tests, and interruption commands persist in study snapshots and replay with engine version 0.4.0. Original-case 0.3.0, 0.2.0 and eligible 0.1.0 studies remain supported. See [treatment model and verification](docs/treatment-lab.md).

## Current implementation

- React interface, responsive layouts, interactive schematic 3D heart and fixed catheter models.
- TypeScript event scheduler running in an inline Web Worker.
- Stable event order, tissue refractoriness, two AV nodal pathways, shared pathway recovery, and paced capture.
- Programmable HRA/RV pacing, S1 trains and optional S2/S3, output and width, stop control.
- 2 kHz synthetic signals with stateful causal high/low-pass biquads.
- Selectable 12-lead surface ECG, 18 catheter bipolar channels, and a local mapping channel; gain, sweep scale, frozen review, calipers, named measurements.
- Procedural event log, diagnosis/evidence submission, causal ladder.
- IndexedDB saves, JSON import/export, deterministic command replay.
- Hosted offline caching and standalone offline build.
- Open account registration, optional administrator invitations, protected owner administration, session management, and private D1 study storage.

## Mobile use

Phones use separate Recordings, Pacing, and Anatomy views with persistent pause, pacing, and freeze controls. The bottom navigation keeps cases, saved studies, and help within reach. Larger screens retain the full lab layout. See `docs/mobile.md` for workflow and verification details.

The localhost development address only works on this computer. For phone access, use [the hosted HTTPS demo](https://app.epsimlab.com).

## 3D heart and catheters

The Heart & catheters panel now contains a Three.js scene with four chamber surfaces, major vessels, valve annuli, and HRA, His, coronary sinus, and RV catheters. Catheters have individual metallic electrode rings (four poles each, ten for CS).

- Drag to rotate; scroll or pinch to zoom. Zoom buttons are also available.
- Use anterior, posterior, and right/left oblique camera presets, or reset the view.
- Adjust Heart opacity down to zero to inspect the catheters alone; toggle labels as needed.
- Select a catheter by clicking its shaft, tip, label, or the catheter buttons. HRA/RVA selection updates the stimulator. His/CS remain recording-only.
- Expand the panel for a larger workspace. Escape closes it.
- Focus the canvas and use arrow keys to rotate, plus/minus to zoom, and Home to restore the current preset.
- After mechanism reveal, chamber and electrode highlights follow the existing A/H/V events. Reduced-motion preferences suppress these activity flashes.

Geometry is generated locally; no remote model downloads or runtime CDN are required. WebGL failure falls back to the original 2D schematic. See `docs/3d-anatomy.md` for implementation boundaries and validation.

## Model limitations

This is an educational software prototype with expert validation pending. It is not a validated assessment instrument or a clinical decision system.

The visible library contains AVNRT, orthodromic AVRT, focal AT, typical flutter, and AF. AVNRT retains a dual-pathway graph; AVRT adds a V-to-A return limb. AT and flutter use focal/periodic atrial drivers. AF uses seeded irregular local atrial activations and variable AV nodal recovery. Flutter does not implement a spatial CTI circuit; AF does not simulate distributed wavefronts. Each debrief explains what its observations cannot establish. The old AVNRT parameter variant remains available through saved-session replay. Waveforms are causal phenomenological templates, not a spatial volume-conductor solution. The sinus source uses a simplified suppression rule. The graph does not yet model full restitution, all forms of concealed penetration, detailed tissue collision, or all responses to ventricular overdrive pacing. Published maneuver cutoffs are not used as automatic classifiers.

The anatomical display uses original procedural 3D chamber surfaces and vessels. It is schematic rather than a segmented anatomical mesh; its coordinates are illustrative and are not calibrated for fluoroscopy. Catheters are at fixed sites. Pacing from His/CS, full 12-lead morphology, free navigation, measured activation mapping, AF ablation, and device implantation are not implemented. The treatment lab supports discrete RF sites with a simplified lesion model; device implantation remains a roadmap item.

Waveforms retain a 180-second rolling buffer; frozen review copies the buffer. Saved sessions contain physiology commands and caliper measurements, not the full waveform archive or historical filter/gain settings. Replay starts with the standard filter. The debrief checks selected observations against the simplified model history and is not a validated clinical rubric. A short VA interval or AH jump alone must not be generalized into a universal diagnostic rule.

## Cloudflare deployment

The production Worker uses Workers Static Assets, a dedicated D1 database (`ep-lab-accounts`), and a private Better Auth signing secret. No Cloudflare credentials or signing secrets are embedded in the app. API requests are not cached.

```sh
npm test
npm run build
npm run db:migrate:remote
npm run deploy:all
```

For local account development, keep a separate `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://127.0.0.1:8787`, and `DEV_ORIGIN=http://127.0.0.1:5173` in ignored `.dev.vars`. Then run `npm run db:migrate:local`, `npm run dev:api`, and `npm run dev` in separate terminals. Vite proxies `/api` to the local Worker.

See [account design and administration](docs/accounts.md) and [deployment details](docs/deployment.md). The previous optional anonymous bearer-sync endpoint is retired on account-enabled instances. Existing account records and saved studies are preserved. Old JSON exports can still be imported. The app now lives on a new origin, so old browser-local files do not automatically move across domains.

`wrangler.jsonc` deploys the simulator at `app.epsimlab.com`. `wrangler.landing.jsonc` deploys the static landing page at `epsimlab.com`, with `www` redirected to the canonical domain. The old Worker URL redirects to the app. GitHub Actions runs tests, builds, and deployment dry-runs; live publishing uses the authorized local Wrangler login.

## Architecture for later procedures

`src/engine/model.ts` defines tissue regions with stable anatomical identities, electrodes, lesions, and implanted leads. These contracts are extension points, not functioning procedure simulators.

Recommended next milestones:

1. Expert review of traces, pacing responses, calipers, and case assumptions; browser QA.
2. Refine conduction restitution and validate diagnostic maneuvers across the five mechanisms.
3. Position-dependent sensing/capture, measured mapping, and a reviewed anatomical coordinate system.
4. Extend the current abstract CTI line to spatial propagation, differential pacing, lesion recovery, and durable block validation.
5. Dual-chamber pacemaker lead placement, fixation, electrical testing, and timing logic.

## Validation

`npm test` runs 42 tests (including a real-D1 account integration suite) covering baseline timing, induction at several phases, a noninducing protocol, parameter variants, failed capture, pulse-width effects, stimulus cancellation, deterministic replay, input validation, waveform frame continuity, actual filter effects, API token isolation/validation, distinct case physiology, case-specific scoring, AF determinism, and old/new session compatibility. The account suite also covers invitation replay and concurrent activation, role escalation attempts, CSRF, owner protections, private studies, forced password replacement, session revocation, and request limits. Worker bundling was checked with `wrangler deploy --dry-run`.

For browser checks install Playwright and Chromium in your development environment, then run `node scripts/browser-smoke.mjs`. It checks the standalone build, induction, calipers, save/replay, and viewport overflow. The original automated smoke suite has not yet been run locally. Separate manual browser checks of the 3D feature are described in `docs/3d-anatomy.md`.

## Reference basis

- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare application architecture: https://developers.cloudflare.com/use-cases/web-apps/
- Michaud et al. ventricular pacing criteria and their cohort: https://pubmed.ncbi.nlm.nih.gov/11583898/
- V-A-A-V exceptions in AVNRT: https://pubmed.ncbi.nlm.nih.gov/28606635/
- Short VA intervals in AVRT: https://pubmed.ncbi.nlm.nih.gov/27477208/
- openCARP extracellular-potential recovery and assumptions: https://opencarp.org/documentation/examples/02_ep_tissue/07_extracellular

Licensing of this project's source has not been selected. Dependency licenses are retained in their packages; React/React DOM and Lucide are MIT-licensed. No real patient data, commercial recording screenshots, or third-party anatomy meshes are included.
