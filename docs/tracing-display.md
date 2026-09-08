# Selecting displayed tracings

The **Tracings** button beside Calipers opens individual channel checkboxes, grouped by surface ECG and catheter. At least one signal stays selected. Thirty signals are available:

- All 12 surface leads: I, II, III, aVR, aVL, aVF, V1–V6.
- HRA, His and RV quadripolar catheters: 1–2, 2–3 and 3–4 each.
- CS decapolar catheter: every adjacent pair from 1–2 through 9–10, including 3–4 and 7–8.

Presets include EP study (II, V1, HRA 1–2, His 3–4/1–2, all five non-overlapping CS pairs and RV 1–2), 12-lead ECG, all signals, intracardiac only, and II / His / RV. Existing device selections are retained. Catheters display proximal-to-distal; the surface leads use conventional order. This supports adjacent bipolar channels, not arbitrary electrode combinations or unipolar recordings.

Selection applies to live recording and frozen review. Large selections scroll vertically with a minimum 44 px per row. Gains retain their original channel identity, and caliper measurements use the displayed catheter's label. Changing selection clears the current caliper overlay without deleting saved measurements. His annotations follow a visible His row and are omitted if none is selected. The treatment lab's compact II / His / RV monitor remains fixed.

All thirty channels are acquired and retained, including in frozen segments. Selection is stored as stable channel IDs in browser local storage independently of study/account saves. Invalid or unavailable storage falls back to the EP study preset. The first nine engine indices and their samples are unchanged; existing study commands and saved measurement labels remain compatible.

## Signal model

Surface waveforms are authored teaching templates, not a patient-specific volume-conductor solution. I and II are independent basis signals; III = II − I, aVR = −(I + II)/2, aVL = I − II/2, and aVF = II − I/2. These relationships include background noise and artifacts and are preserved by the identical linear surface filters. Chest leads share activation times with distinct P/QRS/T templates and illustrative R-wave progression. This does not add validated ischemia, pre-excitation, bundle-branch block or VT localization patterns.

Added CS pairs interpolate activation delay and amplitude between the existing proximal, middle and distal positions, including the AF event's authored delays. Added HRA/RV pairs use nearby timing/amplitude variations; His 2–3 interpolates the existing His recordings. These are schematic local electrograms, not a new spatial propagation model or an electrode-potential forward solution. Catheter positions and stimulation sites are unchanged.

References: [ECG electrode relationships](https://pmc.ncbi.nlm.nih.gov/articles/PMC12987027/) and [CS recording sites from proximal 9–10 to distal 1–2](https://pubmed.ncbi.nlm.nih.gov/28039281/).

## Validation

Production TypeScript/build and 46 tests pass. Tests cover complete lead/pair coverage, finite and frame-continuous waveforms in every case, limb-lead identities including pacing/shock artifacts, forward and distal-first CS sequences, and preservation of surface signals during intracardiac filter changes. A direct comparison against the prior release confirmed sample-for-sample equality for the original nine channels across every case, including legacy AVNRT.

Browser checks covered all-channel scrolling (30 rows of 44 px), 12-lead display, CS 7–8 gain identity, matching live/review selection, a 250 ms CS 7–8 caliper measurement, and selection persistence after reload. At 390 × 844, the scrollable selector fit without horizontal overflow and both CS 7–8 and CS 3–4 were selectable. Browser warning/error logs were empty.
