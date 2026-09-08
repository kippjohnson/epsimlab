# Module 0 · EP foundations

Entry: `https://app.epsimlab.com/#module-0`, the button above the study, or Guide. Five lessons introduce signal interpretation, intervals, pacing, conduction patterns, and the existing clinical scenarios. Thirteen multiple-choice checks offer immediate explanations and retries. A lesson is checked when all its answers are correct; this is a practice record, not a competency credential.

## Teaching interactions

- A/H/V identification on an original schematic His electrogram.
- A forward timing diagram with editable AH, HV, and 1:1 cycle length; baseline, AH-delay, and HV-delay examples; fixed PA of 30 ms. PR includes PA. Block before His removes H and V; block after His removes V. Missing conducted V has no calculated RR or ventricular rate.
- A pacing timing diagram with four S1 pulses and an S2 coupled to the final S1. Capture can be toggled to distinguish a stimulus from its tissue response.
- Concentric, distal-CS-first eccentric, and absent retrograde conduction sketches. Changing VA shifts every atrial event without changing activation order.
- Case questions for AVNRT, AVRT, AT, flutter, and AF, with specific cautions about what a pattern does not establish.

These are deterministic timing sketches, separate from `Engine.ts`. They do not calculate restitution, refractoriness, escape rhythms, or full reentry. Diagram lines do not specify anatomical pathways. No clinical normal-range thresholds or treatment decisions are generated. The existing simulation engine remains version 0.2.0, preserving study replay compatibility.

Clinical interval definitions and mechanism descriptions were cross-checked against NCBI's EP study interpretation chapter, the Merck ECG reference, and EHRA teaching material. Links appear inside the module. All text and diagrams are original; faculty review remains pending.

## Navigation and state

The course remains mounted while closed, so returning from a workspace preserves the current lesson, answers, and explorer controls within the session. Workspace links open the current recordings, pacing panel, or paused calipers without resetting the case. The case-library link explains that starting a case clears the study. The landing page links directly to Module 0. Phone layouts stack the content, use touch-sized controls, and allow diagram scrolling to preserve labels.

Answers are only in memory for guests. Signing in loads the account's answers and merges the guest's current answers over them. A successful explicit **Save progress** is required for persistence. Signing out or switching accounts clears the previous learner's answers. Failed account loads block answer edits and saves until Retry succeeds. Failed saves retain current answers and display an error. Cross-device edits use the last explicitly saved set of answers; automatic merging of simultaneous device edits is not implemented.

## Persistence and deployment

`PUT /api/learning/module-0` accepts `{version: 1, answers: {questionId: optionIndex}}` with a 4 KiB limit. The server validates every question and option, derives completion from the current curriculum, and uses the authenticated user ID. Client-provided user IDs or completion lists cannot change ownership or scoring. `GET` returns that learner's answers. Both routes require active account access; mutations use the existing same-origin JSON check. Responses are private and never cached.

`0002_learning_progress.sql` adds one row per user/module, references the auth user, and cascades on deletion. Apply it before deploying app release 0.5. The migration is additive; existing accounts and studies are unchanged.

## Verification

The 32-test suite includes forward delay/block, VA ordering, S2 coupling and capture, checkpoint validation, and real-D1 tests for private save/load, cross-account isolation, CSRF rejection, invalid payloads and versions, and persistence after signing in again. Production build and Worker dry-run checks are required. Visual browser QA is tracked in the release handoff; clinical faculty validation remains pending.
