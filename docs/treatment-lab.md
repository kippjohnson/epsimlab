# Treatment lab · release 0.6 / engine 0.3

The lab extends the event scheduler; it does not swap a rhythm label or load another case when treatment is delivered. The initial five-case behavior is preserved until intervention. No real patient data or copied electrograms are included.

## Intervention models

- **Adenosine:** blocks the AV nodal input for eight simulated seconds. AVNRT and orthodromic AVRT loops stop; the authored AT, flutter, and AF drivers continue. Recovery restores forward conduction. This AT is intentionally adenosine-insensitive. No escape during transient drug block or sinus-node suppression is modeled.
- **Esmolol:** 60-second fixed exposure increases AV nodal delay and refractoriness, slowing conduction/ventricular response. It does not remove an atrial driver.
- **Isoproterenol:** 60-second exposure shortens sinus cycle length and modeled nodal delays/recovery. Pacing remains necessary to test inducibility; there is no promise of induction.
- **Ibutilide:** deterministic conversion after ten simulated seconds in the flutter and AF examples. No conversion is authored for AT. This is a time-compressed conversion demonstration, not a pharmacodynamic model. QT effects and torsades are omitted and named in the interface.
- **Cardioversion:** arms once, waits for ventricular activation, and delivers a shock artifact at V+16 ms (the surface-II template's nominal R peak). It cancels after three seconds without a trigger. Conversion clears in-flight wavefronts and pacing but preserves lesions. Automatic AT recurs after five seconds unless its focal site is ablated. Other converted rhythms stay in sinus until another modeled trigger; no recurrence probability is estimated.

No mg doses, infusion rates, joule selection, prescribing algorithm, or sedation/anticoagulation decision is provided. Side effects, hemodynamics, and interactions are outside this model. Drug effects use independent modifiers when combined; these combinations are not clinically validated. The UI shows remaining simulated time and prevents repeated dosing during an active exposure. Pause freezes all physiology; 5× changes playback speed, not the event model.

## RF and tissue state

Seven discrete anatomical identities are displayed on the existing schematic heart: slow-pathway region, left lateral accessory connection, high lateral RA focus, three CTI line segments, and the His risk region. An orange catheter moves between selected target coordinates. This is discrete site selection, not free catheter steering or an activation map. RF settings are intentionally compressed teaching values.

Every second of delivery adds `power × contact / 300` to the target's cumulative effect, capped at one. Zero contact has no effect. The illustrative threshold has no clinical lesion-size meaning. Stopping cancels future delivery; accumulated partial effect persists. No cooling, edema, recovery, reconnection, temperature, impedance, irrigation, or steam-pop model exists. Contact is an authored control, not measured force.

At full effect:

- Slow-pathway conduction is disabled, preserving the fast pathway; reinduction should be tested.
- Accessory-pathway return conduction is disabled. The AVRT case has no alternate retrograde AV nodal route, so RV pacing after successful ablation has no conducted A return.
- The focal AT driver is disabled persistently.
- The flutter driver stops only when all three CTI segments are blocked. This is a periodic driver linked to an abstract lesion line, not a spatial macroreentrant circuit.
- His injury prevents normal His-to-ventricle conduction and starts a 1,500-ms escape clock. This is displayed as a complication, not treatment success.

AF ablation is disabled in the UI because this model has no pulmonary-vein trigger network or isolation assessment.

## Endpoint workflow

Repeat atrial induction and RV pacing use actual existing stimulator protocols, including tissue capture/refractoriness. The learner must examine the response; no universal cure score is generated.

For flutter, directional probes query conduction through the three-segment line versus an alternate route. Any gap yields a 45-ms direct transit; a complete line yields a 150-ms alternate transit in each direction. These authored times are not clinical cutoffs. Probes do not create a full pacing electrogram sequence; this limitation appears beside their results. Both directions must be tested after the last lesion. Drugs remain a visible confounder requiring reassessment after washout. Observation and further clinical validation are still necessary.

## Replay and persistence

Commands add drug, cardioversion/cancel, RF/start-stop, and endpoint-test variants. All use the same ordered simulation clock. Save/export and both server validators accept validated engine-0.3 treatment histories. Older version labels cannot carry new treatment commands. Lesions and drug timers reconstruct from commands; no database migration is needed. The worker retains an event cursor so command-time notes are included in the next recording frame.

## Verification

The 42-test suite covers the prior diagnostic cases and accounts plus mechanism-specific drug responses, washout, synchronization/cancellation/timeout, AT recurrence, timed ibutilide conversion, RF contact and partial delivery, reinduction after slow-pathway treatment, AP/AT specificity, CTI gaps and directional testing, His injury, deterministic mixed-treatment replay, and authenticated study save/load with new commands. Invalid RF values and old-version treatment histories are rejected.

Browser checks on the local app verified RF accumulation to 100%, procedure-log delivery, live signals during treatment, adenosine administration, and account save/replay restoring the same partial RF lesion. The 390×844 phone layout has no horizontal content overflow. Clinical expert review remains pending; this is a procedural teaching prototype.

## Sources used for physiological direction

- Adenosine label: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=364a4c53-0705-7969-e063-6294a90a1717
- Esmolol label: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=59ba978b-a393-421c-9a67-77e690249d88
- Ibutilide label: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0cf8724a-f0d1-4ce2-b7c1-cf5fac345fd0
- Isoproterenol and variable AVNRT inducibility: https://pubmed.ncbi.nlm.nih.gov/9538310/
- Contact-force-guided CTI ablation study: https://esc365.escardio.org/journal/60443

All numeric implementation thresholds above are authored simulator parameters, not values transcribed from these references.
