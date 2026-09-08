# 3D anatomy foundation

Implemented September 8, 2026. The owner approved using the model approach appropriate for this prototype stage.

## Scope

An original procedural Three.js model replaces the static anatomy drawing as the default view. It includes four chamber surfaces, caval vessels, a schematic aorta and pulmonary vessels, two AV annuli, and a coronary sinus course. Four curved catheters have individual electrode rings: HRA, His, and RVA have four each; CS has ten.

The viewer supports orbit/zoom, four camera presets, transparency, labels, raycast selection, keyboard controls, and an expanded dialog. It remains available on mobile layouts. Selection is shared with the existing lab. After mechanism reveal, A/H/V events drive schematic activity highlights; reduced-motion preferences disable these flashes.

## Boundaries

- These surfaces are an illustrative construction, not a patient segmentation or expert-validated anatomical mesh.
- Coordinates use +X for patient left, +Y for superior, and +Z for anterior. They are arbitrary model units, separate from the older `REGIONS` extension contracts.
- Oblique presets are viewing aids, not calibrated RAO/LAO fluoroscopy projections.
- Catheter coordinates are fixed; camera movement does not move catheters or affect sensing/capture, conduction, or replay.
- CS/His selection does not enable pacing at those sites. Only the existing HRA/RVA pacing sites are functional.
- There is no catheter steering, contact/collision model, spatial activation solver, lesion behavior, or mechanical contraction simulation.

## Files and lifecycle

- `src/components/heartModel.ts`: geometry, catheter paths, electrode meshes, selection objects, and disposal.
- `src/components/Anatomy.tsx`: WebGL scene, camera, controls, projected labels, selection integration, fallback, and expanded dialog.
- `src/components/anatomy.css`: desktop/mobile layout and viewer controls.
- `src/components/SchematicAnatomy.tsx`: original SVG fallback when WebGL is unavailable or lost.

The renderer caps device pixel ratio at 2 and renders at approximately 30 fps while visible. Hidden tabs, offscreen viewers, and the compact view behind the expanded dialog skip rendering. Unmounting releases controls, observers, listeners, geometry, materials, and the WebGL context.

Three.js and its type definitions are pinned in the lockfile. All scene geometry is generated locally. A single JavaScript bundle preserves the existing standalone HTML export; the build reports a size warning because the bundle now includes the 3D renderer. Three.js licensing is included in `THIRD_PARTY_NOTICES.txt`. Renderer and control usage follows the official [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), and [TubeGeometry](https://threejs.org/docs/pages/TubeGeometry.html) documentation.

## Validation

- TypeScript and the production/standalone build pass.
- The 14 existing engine, signal, and API tests pass.
- Browser checks at desktop and phone sizes: scene rendering, expanded dialog, posterior preset, zero-opacity catheter-only view, label toggle, keyboard rotation, zoom/reset, CS selection, and RVA selection updating the stimulator.
- No browser errors or warnings were recorded during these interaction checks.
- No horizontal document overflow at the tested 390 px phone viewport.
- The standalone HTML was generated successfully; a direct browser check of that file was blocked by the browser's local-file URL policy.

These checks do not establish anatomical accuracy. The broader original browser smoke suite, WebGL-unavailable fallback, physical touch gestures, and long-duration GPU behavior have not been exhaustively tested.

## Extension path

Replace the procedural tissue geometry with a reviewed mesh while preserving catheter IDs and scene coordinates. Before adding catheter movement, define a common anatomical coordinate system shared with the conduction/sensing model and a reviewed set of placement targets. Position-dependent capture must be implemented in the engine, not inferred from a visual mesh intersection alone.
