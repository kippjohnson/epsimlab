# EP Lab Simulator — Technical Specification (v0.1 draft)

Browser-based simulator for intracardiac electrogram acquisition and interpretation.

---

## 1. Product definition

**One sentence:** A browser application that reproduces the signal environment of an EP lab — catheter placement, multichannel EGM recording, and pacing maneuvers — so a learner can diagnose arrhythmia mechanism the way it is actually done at the table.

**Primary user:** EP fellow or general cardiology fellow in the months before EP training. Secondary: EP nurses/techs, industry mappers, IM residents doing an EP elective.

**What this is NOT (v1):** Not an ablation simulator. Not a haptic/manual-dexterity trainer. Not a device (pacemaker/ICD) programming trainer. Not patient-specific. Those are separate products that share the engine later.

**Core loop:**
1. Case loads with unknown mechanism.
2. User places catheters (RA, His, RV, CS ± mapping catheter).
3. User observes baseline EGMs, measures intervals.
4. User runs pacing maneuvers from a menu.
5. Engine responds with physiologically correct EGMs.
6. User commits to a diagnosis + supporting evidence.
7. Debrief: ground-truth mechanism animated in 3D, with the user's maneuvers replayed against the correct interpretation.

---

## 2. Domain primer — what the EP lab physically is

This section is the part you asked me to fill in. It defines the objects the software must model.

### 2.1 Signal chain

```
catheter electrodes → junction box → patient interface / amplifier
  → recording system → display + storage
                    ↓
              stimulator (paces through the same catheters)
```

Commercial recording systems: Boston Scientific LabSystem Pro, Abbott EP-WorkMate, GE CardioLab. The UI should be recognizably in this family (channel stack, calipers, on-screen stimulator panel) without cloning any one product's trade dress.

### 2.2 Acquisition parameters to expose as user-adjustable controls

| Parameter | Typical value | Notes |
|---|---|---|
| Sampling rate | 1000–4000 Hz | 1 kHz sufficient for v1; 2 kHz if you want clean His at 200 mm/s |
| Bipolar intracardiac filter | 30–500 Hz | High-pass removes far-field/repolarization; this is *why* bipolar looks sharp |
| Unipolar intracardiac filter | 0.05–500 Hz | Preserves QS vs rS morphology — needed for unipolar pace-mapping and earliest-activation calls |
| Surface ECG filter | 0.05–100/150 Hz (diagnostic) | Distinct from 0.5–40 Hz monitor mode |
| Notch | 50/60 Hz optional | Teach that notch distorts sharp deflections |
| Sweep speed | 25 / 50 / 100 / 200 mm/s | 100 standard; 200 for AP localization and His timing; 25–50 for induction/observation |
| Gain | per channel, mV/cm | |

**Design point:** filter and sweep-speed settings must genuinely change the rendered waveform. A large fraction of real EGM misinterpretation is filter- and sweep-speed-driven. If your simulator renders a fixed picture regardless of these knobs, you lose the single most transferable lesson.

### 2.3 Standard diagnostic catheter set ("four-wire study")

| Catheter | Poles | Position | What it records |
|---|---|---|---|
| HRA | quad | RA appendage / high lateral RA | atrial timing near sinus node |
| His (HBE) | quad or deca | septal tricuspid annulus, superior | A, H, V — the anchor channel |
| RVA | quad | RV apex | V; ventricular pacing site |
| CS | deca (or duodeca) | coronary sinus, CS 1-2 distal = lateral mitral annulus → CS 9-10 proximal = os | LA and LV activation sequence |
| Halo / duodecapolar | 20 pole | around tricuspid annulus | flutter activation sequence |
| Mapping/ablation | quad, 3.5 mm irrigated tip | roving | high-resolution local EGM |

Access: femoral vein (usually right, often bilateral). CS from femoral, IJ, or subclavian. Transseptal puncture for left-sided access. Arterial access + retrograde aortic for LV.

**Electrode geometry matters for the EGM math:** ring electrodes ~1 mm wide, interelectrode spacing 2–5 mm on conventional catheters; 1 mm spacing on high-density grids. Bipolar EGM amplitude and width are strongly dependent on this spacing and on wavefront direction relative to the bipole axis. Model this explicitly — it is a real and teachable phenomenon (a bipole records nothing from a wavefront traveling perpendicular to its axis).

### 2.4 Baseline intervals (normal ranges)

| Interval | Normal | Meaning |
|---|---|---|
| PA | 20–60 ms | intra-atrial conduction |
| AH | 50–120 ms | AV nodal conduction — highly autonomically modulated |
| His duration | 15–25 ms | |
| HV | 35–55 ms | His-Purkinje; fixed, not rate-dependent |

Plus the derived measures a study reports: sinus cycle length, AV Wenckebach cycle length, AVN ERP, AERP, VERP, VA block cycle length, and presence/absence of dual AV nodal physiology.

### 2.5 Voltage thresholds (for the mapping module, phase 2)

- **Ventricular bipolar:** >1.5 mV normal, 0.5–1.5 mV border zone, <0.5 mV dense scar (Marchlinski criteria).
- **Atrial bipolar:** thresholds vary by series; commonly <0.5 mV low-voltage, <0.1 mV scar. Flag this in-app as less standardized than ventricular.

---

## 3. Simulation architecture — the central design decision

You have two viable engines. I recommend a hybrid, and I want to be explicit about why.

### Option A — Reaction-diffusion (monodomain) on a 3D mesh

Solve a cell model (Fenton-Karma 3-variable; or OVVR/ten Tusscher for ventricle, Courtemanche for atrium) coupled by diffusion, then compute extracellular potential at electrode positions.

- **Pro:** reentry, entrainment, resetting, block, and fibrillatory conduction all *emerge* rather than being scripted. Physically honest.
- **Pro:** it is proven feasible in a browser. Fenton's group at Georgia Tech built Abubu.js, a WebGL library that runs Fenton-Karma and OVVR cardiac tissue models on a consumer GPU in real time, including 3D MRI-segmented human heart structures. Their *Science Advances* 2019 paper reports monodomain simulation at ~1/3 real time on a single Titan-V.
- **Con:** you cannot guarantee that a given case produces the textbook answer. A PPI−TCL of 118 ms in a case you meant to be AVRT is a pedagogical failure, not an interesting finding.
- **Con:** parameterizing a case to produce, say, "typical slow-fast AVNRT with 2:1 infra-Hisian block" requires solver expertise per case. Content authoring becomes research work.

### Option B — Discrete conduction graph (functional model)

Represent the heart as a directed graph of conduction elements. Nodes = anatomic sites (sinus node, crista, CS os, fast pathway, slow pathway, His, RBB, LBB, accessory pathway, isthmus segments) with state: refractory period (with restitution), conduction velocity (with decremental properties), and anisotropy. Propagate activation events through the graph with a discrete-event scheduler.

- **Pro:** deterministic and *authorable*. You can construct a case with exactly the intended mechanism and confirm every maneuver gives the correct answer.
- **Pro:** trivially fast; runs on any device.
- **Con:** AF and polymorphic VT are not naturally representable.
- **Con:** it can only teach what you put in it.

### Recommended: hybrid, graph-primary

**Layer 1 — Conduction graph (the truth model).** Drives all timing, all maneuver responses, all diagnostic criteria. This is what a fellow is actually learning: the logic of activation sequences and intervals.

**Layer 2 — Eikonal front on the 3D mesh (the visual + spatial model).** Given activation times at graph nodes, solve a fast-marching eikonal problem on the surface mesh to get a continuous activation-time field. This gives you (a) the 3D propagation animation and (b) the *spatial* dependence of EGM timing and morphology, so that moving the catheter 5 mm changes the signal correctly.

**Layer 3 — Reaction-diffusion (optional, later).** Reserve for AF, VF, and spiral-wave demonstrations where emergent chaos *is* the lesson. Run in a WebGL/WebGPU compute shader following the Abubu.js approach. Sandbox this in a separate "mechanism playground" mode, not in the graded case engine.

This split lets you ship a correct, useful product on Layer 1+2 while keeping the physics ambition alive.

---

## 4. EGM synthesis

This is the heart of the app and deserves its own module with its own tests.

### 4.1 Forward model

For a source-surface formulation, the unipolar extracellular potential at electrode position **r** is approximated as a weighted sum over mesh elements of a current-dipole layer:

```
φ(r, t) = (1 / 4πσ) ∫∫  [ ∇Vm(r', t) · (r − r') / |r − r'|³ ] dS'
```

Practical implementation:
1. Precompute activation time `τ(x)` per mesh vertex from the eikonal solve.
2. Assign each vertex a transmembrane template `Vm(t − τ(x))` — an upstroke plus plateau plus repolarization. For bipolar (30–500 Hz filtered) output, only the upstroke term survives, which is a large simplification you can exploit.
3. `φ(r,t) = Σ_faces  w_face(r) · dVm/dt (t − τ_face)`, with `w_face` the solid-angle-weighted geometric factor.
4. Bipolar EGM = `φ(r_pole1) − φ(r_pole2)`.
5. Apply the channel's digital filter (Butterworth, matching the user's filter setting).
6. Add far-field ventricular signal, respiratory baseline wander, 50/60 Hz interference, and configurable white noise. Add catheter-motion artifact if contact is unstable.

### 4.2 Properties this model must reproduce (write these as unit tests)

- Bipolar amplitude → 0 as the wavefront direction approaches perpendicular to the bipole axis.
- Unipolar morphology: **QS** at the site of earliest activation, **rS** with the R growing as you move away.
- Fractionated, low-amplitude, long-duration signals in scar/border zone.
- His deflection: sharp, 15–25 ms, only recordable in a narrow anatomic window — moving the catheter 3 mm loses it. This is realistic and worth teaching.
- Far-field A on a ventricular catheter near the annulus; far-field V on a CS catheter.
- Pacing stimulus artifact with saturation/blanking that hides the local EGM for ~20–40 ms — the reason you cannot always see local capture.
- Filter-dependent morphology change (§2.2).

### 4.3 Surface ECG

Generate 12-lead ECG from the same activation field via a lead-field matrix (precomputed Lead Field for the torso model; a coarse Gabor-Nelson or fixed dipole-to-lead transfer matrix is adequate for v1). The surface QRS morphology must be consistent with the intracardiac activation — this is what makes pre-excitation, aberrancy, and pace-mapping teachable.

---

## 5. Anatomy and catheters

### 5.1 Meshes needed

- RA with tricuspid annulus, crista terminalis, cavotricuspid isthmus, CS os, Eustachian ridge, SVC/IVC
- LA with 4 PVs, mitral annulus, LA appendage, roof, septum
- RV, LV with outflow tracts, papillary muscles
- Conduction system as a 1D tree embedded in the meshes (AVN, His, bundle branches, fascicles, Purkinje network)
- CS as a tubular path with tributaries
- Femoral/IVC/SVC vascular path for catheter routing

**Sourcing:** openCARP (opencarp.org) publishes modeling resources including openly licensed bi-atrial and ventricular meshes, universal ventricular/atrial coordinate systems (Cobiveco, Bayer UVC), and an EHRA/EACVI-aligned atrial segmentation pipeline. Start there rather than commissioning geometry. Check each mesh's license individually before shipping.

### 5.2 Catheter model

Kinematic, not FEM. Model each catheter as a **Cosserat rod / piecewise-constant-curvature** chain, constrained to lie inside the vessel/chamber lumen with penalty-based collision. Controls to expose:

- advance / retract
- rotate (torque, with modeled shaft wind-up so rotation is not instantaneous at the tip)
- deflect (1- or 2-plane knob, per catheter type)
- sheath position

Derived state: tip position, electrode positions, contact vector, contact force (simulate a SmartTouch-style readout), stability.

### 5.3 Fluoroscopy view

**Do not skip this.** Catheter positioning is taught in **RAO 30°** and **LAO 40°**, and a fellow who learns positions only in a rotatable 3D view will not transfer to the lab. Render simulated fluoro as an orthographic/perspective projection with radiopaque catheters, faint cardiac silhouette, and a cine/store control. Track and display **fluoroscopy time and dose** — and score on it.

---

## 6. Recording system UI

- Vertically stacked channel display: 12 surface leads (or a subset: I, II, V1, V6) + up to 20 intracardiac channels.
- Per-channel: label, gain, filter, color, show/hide, reorder.
- Rendering: WebGL or Canvas 2D with a ring buffer and incremental blit. At 1 kHz × 30 channels you are writing 30k samples/s — do not re-render the full trace each frame.
- **Calipers**: click-drag, snap-to-deflection, multi-caliper, delta display. Non-negotiable.
- Freeze/review pane alongside the live pane (real systems have this; it is how you measure during tachycardia).
- Sweep speed and page/scroll modes.
- Annotation and "store segment" for the debrief.
- **Ladder diagram tool**: user draws A/AVN/V tiers with conduction lines; auto-graded against the engine's ground truth. This is the single highest-value pedagogical feature you can add that no existing product does well.

### Stimulator panel

- Drive train S1: cycle length, number of beats (typically 8)
- S2/S3/S4 coupling intervals with decrement step (10 ms standard)
- Output (mA) and pulse width (ms) — with real capture thresholds, so sub-threshold output fails to capture
- Burst pacing, continuous incremental/decremental pacing
- Site selector (any electrode pair on any catheter)
- Synchronized vs. asynchronous delivery

### Pharmacology

Isoproterenol (dose-dependent effect on sinus rate, AVN conduction, inducibility), adenosine (transient AV block; unmasks pre-excitation; terminates AVNRT/AVRT, usually not AT), atropine, verapamil, procainamide (for HV prolongation / Brugada provocation).

---

## 7. Maneuver library

Each maneuver is an engine operation with a defined observable output and a scoring rubric.

### Baseline
- Interval measurement (PA, AH, HV)
- Atrial incremental pacing → AV Wenckebach CL
- Atrial extrastimulus → AVN ERP, **dual AVN physiology** (≥50 ms AH jump for a 10 ms decrement in A1A2), echo beats
- Ventricular incremental pacing → VA block CL, decremental vs. non-decremental VA, concentric vs. eccentric
- Ventricular extrastimulus → VERP, retrograde conduction pattern

### SVT differentiation (the core of the game)

| Maneuver | Finding | Interpretation |
|---|---|---|
| Ventricular overdrive pacing, response on cessation | **V-A-V** | AVNRT or AVRT |
| | **V-A-A-V** | atrial tachycardia |
| PPI − TCL from RV apex | **>115 ms** | AVNRT |
| | **<115 ms** | ORT via septal AP |
| SA − VA | **>85 ms** | AVNRT |
| | **<85 ms** | ORT via septal AP |
| Septal VA during tachycardia | **<70 ms** (intracardiac) | AVNRT; essentially excludes AVRT |
| His-refractory PVC | advances/delays A, or terminates without A | accessory pathway present |
| ΔHA (pacing − tachycardia) | positive | AVNRT (cutoffs vary by series — verify before hard-coding) |
| Para-Hisian pacing | nodal vs. extranodal response pattern | septal AP present/absent |
| Differential atrial pacing / ΔAH | | AT vs. AVNRT vs. AVRT |
| cPPI − TCL (AH-corrected) | ≥110 ms | AVNRT (corrects for pacing-induced AVN decrement) |
| Adenosine | terminates with AV block on the last beat | AVNRT/AVRT vs. AT |

The 115 ms and 85 ms thresholds come from Michaud et al., *JACC* 2001 (30 atypical AVNRT vs. 44 septal-AP ORT; complete separation in that cohort). **Build the engine so these emerge from circuit geometry and conduction times, not as hard-coded lookups.** If your AVRT case has a left-lateral pathway rather than septal, PPI−TCL should come out different, and the app should teach that the published cutoff was derived in septal pathways.

Note also that PPI−TCL is fragile in practice: TCL oscillation, non-capture, failure to entrain, termination during pacing, and decremental AVN conduction all corrupt it. Simulate these failure modes deliberately — a fellow who has only seen clean maneuvers is unprepared.

### Macroreentry / mapping
- Entrainment with concealed vs. manifest fusion
- PPI − TCL <30 ms = pacing site in circuit
- Stim-to-QRS (or stim-to-P) interval and its ratio to TCL → entrance/isthmus/exit zone
- Activation mapping, voltage mapping, propagation maps
- Pace mapping with 12-lead correlation score

---

## 8. Arrhythmia content library

Tier by build order.

**Tier 1 (MVP — narrow-complex):**
- Sinus tachycardia
- Typical AVNRT (slow-fast)
- Atypical AVNRT (fast-slow, slow-slow)
- ORT via concealed AP: left lateral, posteroseptal, right free wall
- Focal AT: crista, CS os, PV, tricuspid annulus
- CTI-dependent atrial flutter, counterclockwise and clockwise
- Junctional tachycardia (the classic AVNRT mimic — critical to include)

**Tier 2:**
- WPW: pre-excitation, antidromic AVRT, pre-excited AF, AP localization algorithms
- PJRT
- Atypical flutter: perimitral, roof-dependent
- Atrial fibrillation
- AV block localization (nodal vs. infra-Hisian), including the classic 2:1 block problem

**Tier 3 (wide-complex):**
- Idiopathic VT: RVOT/LVOT, fascicular (verapamil-sensitive)
- Scar-related reentrant VT with entrainment mapping
- Bundle branch reentrant VT
- SVT with aberrancy vs. VT

**Case authoring format:** every case is a declarative JSON/YAML file specifying graph topology, conduction parameters, refractory periods, restitution curves, and autonomic state. Ship a case-authoring tool. Content volume, not engine sophistication, will determine whether this product is useful.

---

## 9. Game / assessment layer

- **Case generator** samples mechanism + variant + randomized parameters within physiologic bounds, so cases are not memorizable.
- **Diagnosis commit:** user submits mechanism *and* selects the specific findings supporting it. Grade both. A right answer from wrong evidence should not score as a win.
- **Scoring dimensions:** diagnostic accuracy; maneuver efficiency (did you need 11 maneuvers?); maneuver appropriateness (did you run entrainment on a non-sustained rhythm?); measurement accuracy vs. ground truth; case time; fluoroscopy time/dose; complications (perforation from over-advancement, mechanical block from His catheter trauma, AV block).
- **Adaptive difficulty:** track per-mechanism and per-maneuver accuracy; weight case sampling toward weak areas.
- **Debrief mode:** replay with the ground-truth activation animated on the 3D model, synchronized to the EGM trace the user saw, with the ladder diagram drawn correctly.
- **Sandbox mode:** all mechanisms visible, parameters directly editable, no scoring. This is where you learn.

---

## 10. Technical stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript, strict | |
| UI | React | |
| 3D | Three.js via react-three-fiber | Mature, good mesh + instancing support |
| Simulation core | Rust → WebAssembly | The graph scheduler and eikonal solve want a real language; Rust/wasm gives determinism and speed, and lets the same core run headless in CI for regression tests |
| Tissue solver (phase 3) | WGSL compute shaders (WebGPU), WebGL2 fallback | Follows the Abubu.js precedent |
| Threading | Web Worker for the engine; SharedArrayBuffer ring buffer to the renderer | Keeps the UI at 60 fps independent of engine tick rate |
| Signal display | Canvas 2D with incremental rendering, or WebGL line batching | Profile both; Canvas2D is likely sufficient |
| State | Zustand | |
| Persistence | IndexedDB (case library, progress, recordings) | |
| Testing | Vitest + a golden-file harness: every case × every maneuver → expected interval measurements, asserted to ±5 ms | **The most important engineering decision in this document.** A teaching simulator that is subtly wrong is worse than none. |
| Build | Vite | |
| Deploy | Static hosting; fully offline-capable via service worker | Fellows will use this on call |

**Export formats:** write recordings to **WFDB** or **EDF+**. This costs little and makes the simulator a data source for your own research — synthetic labeled EGM datasets with known ground truth are genuinely scarce, and this is a plausible second paper out of the project.

---

## 11. Roadmap

**Phase 0 — Spike (2–3 weeks).** Single chamber pair, conduction graph with A/AVN/V, one catheter, one channel pair, EGM synthesis, scrolling display, calipers. Goal: does the EGM look right to an EP attending? Get that answer before building anything else.

**Phase 1 — MVP (3–4 months).** Four-catheter setup with fixed "snap-to" positions (skip full catheter physics initially). Full stimulator. Tier 1 arrhythmias. Surface ECG. Diagnosis-commit and scoring. No 3D navigation yet — a schematic anatomic view is enough.

**Phase 2 — 3D + navigation.** Real meshes, catheter kinematics, fluoro views, free catheter positioning with position-dependent EGMs.

**Phase 3 — Mapping.** Electroanatomic mapping, activation/voltage/propagation maps, entrainment mapping, Tier 2–3 arrhythmias.

**Phase 4 — Ablation, AF, reaction-diffusion sandbox.**

---

## 12. Validation plan

Given your background, treat this as a research instrument, not just a product.

- **Content validity:** structured expert review of case definitions and expected maneuver responses by ≥3 EP attendings, with documented disagreements resolved.
- **Signal validity:** blinded comparison of synthesized vs. real EGMs. Recruit EP faculty to classify segments as real or simulated; target discrimination near chance. Real comparison signals can come from de-identified lab recordings under IRB, or from PhysioNet's intracardiac collections.
- **Construct validity:** does performance discriminate first-year EP fellows from experienced attendings? Standard framework (Messick / Kane validity argument) for simulation-based assessment.
- **Learning effect:** pre/post or randomized design against conventional teaching, with EGM interpretation on real cases as the outcome. This is the publishable endpoint.

**Regulatory:** as an educational tool with no patient-specific input and no clinical claims, this sits outside FDA device regulation. Keep it there — avoid any language suggesting the output informs the care of a specific patient, and do not accept patient data as input in v1.

---

## 13. Open decisions — I need your input

1. **Engine fidelity.** Do you accept the graph-primary hybrid, or do you want the reaction-diffusion solver as the primary truth model from the start? This changes the timeline by roughly a factor of three.
2. **Solo project or team?** The scope above is a small team's year. A solo build during a fellowship bridge year should probably stop at Phase 1 and ship it.
3. **Open source?** MIT/Apache would make this a citable research artifact and attract EP-interested engineers. It also constrains any later commercialization.
4. **Anatomy source.** Are you comfortable with academically-licensed openCARP-family meshes, or does a possible commercial path require you to commission or purchase geometry?
5. **Assessment ambition.** Is the goal a study tool, or a validated assessment instrument (which implies psychometrics, item analysis, and a much heavier content pipeline)?
6. **Real-data anchor.** Can you get access to de-identified EP lab recordings at Northwestern? Even 20–30 well-labeled studies would let you tune the synthesis model against ground truth and would strengthen every validity argument above.
7. **Mobile?** Phone-sized screens cannot display 20 channels at 100 mm/s. Desktop/tablet only, or a reduced-channel mobile mode?

---

## 14. References

- Michaud GF, Tada H, Chough S, et al. Differentiation of atypical atrioventricular node re-entrant tachycardia from orthodromic reciprocating tachycardia using a septal accessory pathway by the response to ventricular pacing. *J Am Coll Cardiol.* 2001;38(4):1163–1167. doi:10.1016/S0735-1097(01)01480-2 — source of the SA−VA >85 ms and PPI−TCL >115 ms thresholds.
- Katritsis DG, Josephson ME. Supraventricular tachycardias: differential diagnosis at bedside and in the electrophysiology laboratory. *Continuing Cardiology Education.* 2016. doi:10.1002/cce2.31
- Kaboudian A, Cherry EM, Fenton FH. Real-time interactive simulations of large-scale systems on personal computers and cell phones: Toward patient-specific heart modeling and other applications. *Sci Adv.* 2019;5(3):eaav6019. doi:10.1126/sciadv.aav6019 — WebGL/GPU browser cardiac simulation precedent (Abubu.js).
- Kaboudian A, Gray RA, Uzelac I, Cherry EM, Fenton FH. Fast interactive simulations of cardiac electrical activity in anatomically accurate heart structures by compressing sparse uniform Cartesian grids. *Comput Methods Programs Biomed.* 2024. doi:10.1016/j.cmpb.2024.108456
- Plank G, Loewe A, Neic A, et al. The openCARP simulation environment for cardiac electrophysiology. *Comput Methods Programs Biomed.* 2021;208:106223. doi:10.1016/j.cmpb.2021.106223 — solver reference and open mesh/coordinate resources (opencarp.org/community/modeling-resources).
- Bayer J, et al. Universal ventricular coordinates. *Med Image Anal.* 2018. doi:10.1016/j.media.2018.01.005
- Schuler S, et al. Cobiveco: consistent biventricular coordinates. *Med Image Anal.* 2021. doi:10.1016/j.media.2021.102247
- Josephson ME. *Clinical Cardiac Electrophysiology: Techniques and Interpretations.* — normal interval ranges, pacing protocols.
- Issa Z, Miller JM, Zipes DP. *Clinical Arrhythmology and Electrophysiology.* — maneuver algorithms; use as the primary content source for case authoring.

*Items in §7 marked "cutoffs vary" should be verified against primary sources before they are encoded as grading thresholds.*
