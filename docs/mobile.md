# Mobile study workspace

The app uses a dedicated phone layout at widths up to 760 CSS pixels, and on short landscape screens up to 1050 pixels wide. Larger screens retain the simultaneous anatomy, recordings, and pacing panels.

## Workflow

- Switch between **Recordings**, **Pacing**, and **Anatomy** without restarting the study. Case briefing is available in Anatomy.
- Pause/resume, deliver/stop pacing, and freeze remain available above the bottom navigation. The pacing button shows the active protocol, including site and coupling interval.
- Delivering a train returns to Recordings. Opening another panel preserves the recording and protocol state.
- The bottom navigation provides cases, saved studies, guidance, and the existing procedure roadmap entries.
- Controls use larger touch targets. Numeric fields and primary selects use 16 px text; dialogs scroll within the dynamic viewport and keep their close control available.
- Calipers track the active pointer, commit only on its release, and discard cancelled gestures. In measuring mode, the trace surface captures the gesture; otherwise it permits ordinary page scrolling.
- Safe-area padding accommodates display cutouts and the home indicator.

## Rendering

The recording buffer initializes once per mounted lab, avoiding a fresh multi-megabyte allocation on every UI update. The same simulation worker continues running while panels change. Trace canvases skip drawing when hidden or dimensionless, cap pixel ratio at 2, and draw at approximately 30 fps. The 3D viewer already skips rendering while offscreen. These changes affect presentation, not the simulation clock or recorded samples.

## Validation

Browser viewport checks passed for 320 px and 390 px phones, 844 × 390 landscape, a 768 px tablet, and a 1440 px desktop. No horizontal page overflow was observed. Larger layouts continued showing all three panels.

The phone workflow was checked for panel changes, pacing-to-recording navigation, induction (190 bpm / 315 ms in the default model), pause, and a caliper drag that created one 313 ms measurement. The 3D dialog opened at the smallest tested width. Browser logs were clear during these checks. All 14 existing tests and the production build pass.

These are desktop-browser viewport and pointer checks, not physical iOS/Android device certification. Physical touch gestures, on-screen keyboards, browser toolbar resizing, and sustained device performance still need testing on hardware.

## Opening it on a phone

The current development server listens on this computer's loopback interface. Its `127.0.0.1` address cannot be used from another device. The demo is now deployed at [EPSimLab](https://app.epsimlab.com) for phone testing and normal use. Source is at https://github.com/kippjohnson/epsimlab.
