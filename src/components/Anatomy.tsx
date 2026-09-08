import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Expand, RotateCcw, X, Minus, Plus, Box} from 'lucide-react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {LabEvent} from '../engine/model';
import {CATHETERS, createHeartModel} from './heartModel';
import {SchematicAnatomy} from './SchematicAnatomy';
import './anatomy.css';

interface Props {site: string; onSite: (site: string) => void; events: LabEvent[]; now: number; explain?: boolean}
type View = 'Anterior' | 'Right oblique' | 'Left oblique' | 'Posterior';
const VIEWS: Record<View, [number, number, number]> = {
  Anterior: [0, .35, 10], 'Right oblique': [-7, .8, 7], 'Left oblique': [7, .8, 7], Posterior: [0, .35, -10],
};
interface SceneActions {view: (view: View) => void; zoom: (factor: number) => void}

function HeartViewport({expanded = false, suspended = false, onExpand, ...props}: Props & {expanded?: boolean; suspended?: boolean; onExpand?: () => void}) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<SceneActions | null>(null);
  const [failure, setFailure] = useState(false);
  const [opacity, setOpacity] = useState(32);
  const [labels, setLabels] = useState(true);
  const [view, setView] = useState<View | 'Custom'>('Anterior');
  const latest = useRef({...props, opacity, labels, suspended});
  latest.current = {...props, opacity, labels, suspended};

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});
    } catch {
      setFailure(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', 'Interactive 3D heart and four catheters. Drag to rotate, scroll to zoom, or use arrow keys and plus or minus.');
    canvas.setAttribute('role', 'img'); canvas.tabIndex = 0;
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(43, 1, .1, 60);
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false; controls.enableDamping = false;
    controls.minDistance = 5; controls.maxDistance = 19;
    controls.minPolarAngle = .18; controls.maxPolarAngle = Math.PI - .18;
    controls.rotateSpeed = .7;
    const model = createHeartModel(); scene.add(model.root);
    scene.add(new THREE.HemisphereLight(0xd5e9ff, 0x293040, 2.3));
    const key = new THREE.DirectionalLight(0xffeee5, 3.1); key.position.set(-3,5,7); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8cbbff, 2.5); rim.position.set(4,2,-5); scene.add(rim);

    const overlay = document.createElement('div'); overlay.className = 'heart-label-layer';
    container.appendChild(overlay);
    const labelElements = model.labels.map(label => {
      const element = document.createElement(label.catheter ? 'button' : 'span');
      element.className = label.catheter ? 'heart-label catheter-label' : 'heart-label chamber-3d-label';
      element.textContent = ({'Right atrium': 'RA', 'Left atrium': 'LA', 'Right ventricle': 'RV', 'Left ventricle': 'LV'} as Record<string,string>)[label.text] ?? label.text;
      element.title = label.text; element.style.setProperty('--label-color', label.color);
      if (label.catheter) {
        element.setAttribute('type', 'button'); element.setAttribute('aria-label', `Select ${label.catheter} catheter`);
        element.onclick = () => latest.current.onSite(label.catheter!);
      }
      overlay.appendChild(element);
      return element;
    });
    let width = 1, height = 1, frame = 0, visible = true, lost = false, lastFrame = 0;
    let currentView: View = 'Anterior';
    const setCamera = (next: View) => {
      currentView = next;
      controls.target.set(0,-.12,0);
      camera.position.set(...VIEWS[next]).normalize().multiplyScalar(expanded ? 10 : 11.5).add(controls.target);
      controls.update(); setView(next);
    };
    const zoom = (factor: number) => {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset); controls.update();
    };
    actions.current = {view: setCamera, zoom};
    setCamera('Anterior');
    const resize = new ResizeObserver(() => {
      width = container.clientWidth; height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    });
    resize.observe(container);
    const intersection = new IntersectionObserver(entries => {visible = entries[0].isIntersecting;});
    intersection.observe(container);
    const moved = () => setView('Custom');
    controls.addEventListener('start', moved);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = {x: 0, y: 0};
    const pointerDown = (event: PointerEvent) => {down = {x: event.clientX, y: event.clientY};};
    const pointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX-down.x,event.clientY-down.y) > 5) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hit = raycaster.intersectObjects(model.pickables, false)[0];
      if (hit) latest.current.onSite(hit.object.userData.catheter as string);
    };
    const onKey = (event: KeyboardEvent) => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Home') {setCamera(currentView); return;}
      if (['+','=','-'].includes(event.key)) {zoom(event.key === '-' ? 1.15 : 1/1.15); return;}
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if (event.key === 'ArrowLeft') spherical.theta -= .15;
      if (event.key === 'ArrowRight') spherical.theta += .15;
      if (event.key === 'ArrowUp') spherical.phi -= .15;
      if (event.key === 'ArrowDown') spherical.phi += .15;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, .18, Math.PI-.18);
      camera.position.setFromSpherical(spherical).add(controls.target); controls.update(); setView('Custom');
    };
    const contextLost = (event: Event) => {event.preventDefault(); lost = true; setFailure(true);};
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('keydown', onKey); canvas.addEventListener('webglcontextlost', contextLost);
    const projected = new THREE.Vector3();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (timestamp: number) => {
      frame = requestAnimationFrame(draw);
      const state = latest.current;
      if (lost || !visible || state.suspended || document.hidden || timestamp-lastFrame < 32 || !width || !height) return;
      lastFrame = timestamp;
      const active = (node: string) => !reducedMotion.matches && state.explain && state.events.some(event =>
        event.kind === 'activation' && event.node === node && state.now >= event.t && state.now-event.t < 160);
      model.tissue.forEach(material => {material.opacity = state.opacity / 100; material.visible = state.opacity > 0;});
      model.chambers.forEach(chamber => {
        chamber.material.emissive.copy(chamber.material.color);
        chamber.material.emissiveIntensity = active(chamber.node) ? .42 : .025;
      });
      model.catheters.forEach(catheter => {
        const selected = catheter.id === state.site;
        catheter.material.emissiveIntensity = selected ? .65 : .16;
        catheter.halo.visible = selected || Boolean(active(catheter.node));
        catheter.halo.scale.setScalar(active(catheter.node) ? 1.5 : 1);
      });
      renderer.render(scene, camera);
      model.labels.forEach((label,index) => {
        const element = labelElements[index]; projected.copy(label.position).project(camera);
        element.hidden = !(state.labels && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95);
        element.style.left = `${(projected.x+1)*width/2}px`; element.style.top = `${(1-projected.y)*height/2}px`;
        if (label.catheter) element.setAttribute('aria-pressed', String(label.catheter === state.site));
      });
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect();
      controls.removeEventListener('start', moved); controls.dispose();
      canvas.removeEventListener('pointerdown',pointerDown); canvas.removeEventListener('pointerup',pointerUp);
      canvas.removeEventListener('keydown',onKey); canvas.removeEventListener('webglcontextlost',contextLost);
      model.dispose(); renderer.dispose(); renderer.forceContextLoss();
      canvas.remove(); overlay.remove(); actions.current = null;
    };
  }, [expanded]);

  const selected = CATHETERS.find(catheter => catheter.id === props.site) ?? CATHETERS[0];
  return <div className={`anatomy3d ${expanded ? 'anatomy3d-expanded' : ''}`}>
    <div className="anatomy3d-toolbar">
      <label className="anatomy-view-label"><span className="sr-only">3D viewing angle</span>
        <select aria-label="3D viewing angle" value={view} disabled={failure} onChange={event => actions.current?.view(event.target.value as View)}>
          {view === 'Custom' && <option value="Custom" disabled>Custom view</option>}
          {Object.keys(VIEWS).map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      <div className="anatomy3d-tools">
        <button className="icon-button" aria-label="Reset 3D view" title="Reset view" disabled={failure} onClick={() => actions.current?.view('Anterior')}><RotateCcw size={13}/></button>
        {!expanded && <button className="icon-button" aria-label="Expand 3D anatomy" title="Expand 3D anatomy" onClick={onExpand}><Expand size={14}/></button>}
      </div>
    </div>
    <div className="heart-stage" ref={host} style={failure ? {display: 'none'} : undefined}/>
    {failure && <div className="anatomy-fallback"><SchematicAnatomy {...props}/><p role="status">3D is unavailable in this browser. The schematic and catheter controls remain available.</p></div>}
    {!failure && <>
      <div className="heart-stage-caption"><span>{expanded ? 'Drag to orbit · scroll or pinch to zoom' : 'Drag to rotate · scroll to zoom'}</span><span className="heart-zoom"><button aria-label="Zoom out 3D anatomy" onClick={() => actions.current?.zoom(1.15)}><Minus size={12}/></button><button aria-label="Zoom in 3D anatomy" onClick={() => actions.current?.zoom(1/1.15)}><Plus size={12}/></button></span></div>
      <div className="anatomy3d-settings"><label>Heart opacity <input aria-label="Heart opacity" type="range" min="0" max="85" step="1" value={opacity} onChange={event => setOpacity(Number(event.target.value))}/><output>{opacity}%</output></label><label className="anatomy-label-toggle"><input type="checkbox" checked={labels} onChange={event => setLabels(event.target.checked)}/>Labels</label></div>
    </>}
    {expanded && <div className="anatomy-catheter-picker" aria-label="3D catheter selection">{CATHETERS.map(catheter =>
      <button key={catheter.id} aria-pressed={props.site === catheter.id} onClick={() => props.onSite(catheter.id)} style={{'--catheter-color': catheter.color} as CSSProperties}><i/><span>{catheter.id}<small>{catheter.poles} electrodes</small></span></button>
    )}</div>}
    {expanded && <p className="anatomy-selected-detail"><strong style={{color: selected.color}}>{selected.label}</strong>{selected.detail}{props.site === 'His' || props.site === 'CS' ? ' · Recording only in this release' : ''}</p>}
    <div className="anatomy-model-note">Schematic 3D anatomy · fixed catheter positions</div>
  </div>;
}

export function Anatomy(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {if (expanded) dialog.current?.showModal();}, [expanded]);
  return <>
    <HeartViewport {...props} suspended={expanded} onExpand={() => setExpanded(true)}/>
    {expanded && <dialog className="modal anatomy-dialog" ref={dialog} aria-labelledby="anatomy-dialog-title" onCancel={() => setExpanded(false)} onClick={event => {if (event.target === dialog.current) setExpanded(false);}}>
      <div className="modal-heading"><div><span className="anatomy-dialog-eyebrow"><Box size={13}/> SPATIAL WORKSPACE</span><h2 id="anatomy-dialog-title">Heart & catheters</h2></div><button className="icon-button" aria-label="Close 3D anatomy" onClick={() => setExpanded(false)} autoFocus><X size={20}/></button></div>
      <HeartViewport {...props} expanded/>
    </dialog>}
  </>;
}
