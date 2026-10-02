# Model information page

The learner-facing model description lives in `src/components/ModelInfo.tsx`, with styles in `src/components/model-info.css`. It is linked from the lab Guide, app footer and landing page and opens directly at `/#model`.

The page separates three layers: impulse generation, tissue conduction/recovery, and waveform synthesis. It explains each foundational mechanism and the scope of the advanced networks, pacing capture, STIM display, lead artifacts, route-dependent ventricular morphology, filters, local timing landmarks, mapping, treatment and deterministic replay.

Generic model limitations belong on this page. Main-workspace instructions should describe the action and what to inspect. Keep limitations next to a maneuver when they change its interpretation: confirm capture and chamber acceleration, exclude direct atrial capture in para-Hisian pacing, qualify a negative ventricular extrastimulus, and account for active drug effects before interpreting endpoints.

Signal details must stay aligned with the implementation. In particular, the STIM pulse has a minimum visible width and is not a calibrated pulse-duration waveform; zero-output commands create no physical pacing artifact. QRS widths are authored template values. A/H/V annotations mark approximate local His-channel template landmarks. Filtering can shift visible peaks, and these landmarks can differ from network event times. Surface repolarization has a simple rate response, not patient-specific QT dynamics.

Version 0.4 sessions now select the frozen 0.4 engine and waveform generator. New 0.5 studies use the revised physiology and electrode-difference signals. Earlier sessions retain the previous release’s compatibility behavior. Historical filter/gain settings were not stored.

The information page does not claim clinical validation, continuous spatial wavefront propagation, graded fusion, patient-specific geometry or a complete treatment-risk model.

Browser checks: open `/#model` directly, close with Escape, reopen from Guide and footer, use Back/Forward across the hash, and confirm readable layout at desktop and narrow mobile widths. Closing the page should preserve the active study and restore the document title.
