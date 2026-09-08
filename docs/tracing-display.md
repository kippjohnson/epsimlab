# Selecting displayed tracings

The **Tracings** button beside Calipers opens individual channel checkboxes, grouped by surface ECG and catheter. Presets show all nine signals, the seven intracardiac signals, or II / distal His / RV. At least one signal stays selected.

Selection applies to the live recording and frozen review. Rows fill the recording area, channel gains retain their original channel identity, and caliper measurements use the displayed catheter's label. Changing the selection clears the current caliper overlay without deleting saved measurements. His annotations follow the visible His row and are omitted if both His channels are hidden.

All nine channels continue to be acquired and retained, including in a frozen segment. Display selection is stored as stable channel IDs in browser local storage, independently of study/account saves; it persists across reloads and case changes on that device. Invalid or unavailable storage falls back to all channels. The treatment lab's compact II / His / RV monitor remains fixed.

Validation: production TypeScript/build and 42 existing tests passed. Browser checks covered individual toggles, all three presets, prevention of an empty selection, restoration after reload, matching live/review rows, and a 250 ms measurement on His 1–2 after filtering to three rows. At 390 × 844, the selector fit without horizontal overflow. Browser error/warning logs were empty.
