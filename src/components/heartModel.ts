import * as THREE from 'three';
import type {NodeId} from '../engine/model';

type Point = [number, number, number];
export type CatheterId = 'HRA' | 'His' | 'CS' | 'RVA';

/** Original schematic geometry. +X = patient left, +Y = superior, +Z = anterior.
 * Coordinates are illustrative model units, not a calibrated patient anatomy.
 * Display positions do not change the conduction engine or capture thresholds.
 */
export const CATHETERS: {id: CatheterId; label: string; color: string; node: NodeId; poles: number; points: Point[]; detail: string}[] = [
  {id: 'HRA', label: 'High right atrium', color: '#6bb6ff', node: 'A', poles: 4,
    points: [[-.96,-3.25,.12],[-1,-1.45,.05],[-1.12,.1,.04],[-1.38,1.02,.08],[-1.2,1.55,.32],[-.94,1.44,.52]],
    detail: 'Quadripolar catheter · atrial recording and pacing'},
  {id: 'His', label: 'His bundle', color: '#f1c267', node: 'H', poles: 4,
    points: [[-.83,-3.25,.15],[-.88,-1.48,.16],[-1,.05,.18],[-.64,.66,.38],[-.12,.43,.5],[.04,.2,.48]],
    detail: 'Quadripolar catheter · septal A / H / V recording'},
  {id: 'CS', label: 'Coronary sinus', color: '#c291ef', node: 'A', poles: 10,
    points: [[-.7,-3.25,.12],[-.76,-1.45,.05],[-.98,.05,-.04],[-.56,.29,-.48],[.12,.22,-.84],[.86,.38,-.81],[1.28,.56,-.43]],
    detail: 'Decapolar catheter · proximal-to-distal atrial recordings'},
  {id: 'RVA', label: 'RV apex', color: '#69d7aa', node: 'V', poles: 4,
    points: [[-.57,-3.25,.18],[-.64,-1.48,.21],[-.94,.1,.26],[-.45,.44,.57],[-.17,-.18,.99],[.05,-1.12,1.03],[.38,-1.93,.61]],
    detail: 'Quadripolar catheter · ventricular recording and pacing'},
];

export interface HeartLabel {text: string; position: THREE.Vector3; color: string; catheter?: CatheterId}
export interface HeartModel {
  root: THREE.Group;
  tissue: THREE.MeshStandardMaterial[];
  chambers: {material: THREE.MeshStandardMaterial; node: NodeId}[];
  catheters: {id: CatheterId; node: NodeId; material: THREE.MeshStandardMaterial; halo: THREE.Mesh; tip: THREE.Mesh}[];
  pickables: THREE.Object3D[];
  labels: HeartLabel[];
  dispose: () => void;
}

export function createHeartModel(): HeartModel {
  const root = new THREE.Group();
  const tissue: THREE.MeshStandardMaterial[] = [];
  const chambers: HeartModel['chambers'] = [];
  const catheters: HeartModel['catheters'] = [];
  const pickables: THREE.Object3D[] = [];
  const labels: HeartLabel[] = [];
  const vec = (p: Point) => new THREE.Vector3(...p);

  function surface(color: string) {
    const material = new THREE.MeshStandardMaterial({color, roughness: .48, metalness: .12,
      transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide});
    tissue.push(material);
    return material;
  }

  function chamber(name: string, center: Point, scale: Point, angle: number, color: string, node: NodeId, ventricular = false) {
    const geometry = new THREE.SphereGeometry(1, 56, 40);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      // A broad base narrows into the ventricular apex; slight asymmetry avoids
      // implying that each chamber is a simple, disconnected sphere.
      const taper = ventricular ? .68 + .3 * (y + 1) / 2 : 1;
      const x = positions.getX(i) * taper + (ventricular ? -.17 * y : .06 * y * y);
      positions.setXYZ(i, x, y, positions.getZ(i) * taper);
    }
    geometry.computeVertexNormals();
    const material = surface(color);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(vec(center)); mesh.scale.set(...scale); mesh.rotation.z = angle;
    root.add(mesh); chambers.push({material, node});

    labels.push({text: name, position: vec(center).add(new THREE.Vector3(name.endsWith('atrium') ? (center[0] < 0 ? -.45 : .4) : .25, .15, scale[2] + .12)), color});
  }

  chamber('Right atrium', [-.99,.95,.03], [.87,1.01,.78], -.12, '#668fae', 'A');
  chamber('Left atrium', [.66,1.08,-.5], [.85,.76,.73], .12, '#c08387', 'A');
  chamber('Right ventricle', [-.35,-.7,.48], [1.3,1.6,.95], .55, '#6b97b2', 'V', true);
  chamber('Left ventricle', [.6,-.88,-.15], [1.1,1.74,.92], .1, '#cf8783', 'V', true);

  function vessel(points: Point[], radius: number, color: string) {
    const curve = new THREE.CatmullRomCurve3(points.map(vec));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 16, false), surface(color));
    root.add(mesh);
    return curve;
  }
  vessel([[-1.16,.99,-.12],[-1.24,1.92,-.2],[-1.17,2.85,-.26]], .28, '#779bb7');
  vessel([[-.99,.46,-.07],[-1.05,-.76,-.12],[-.91,-2.8,-.05]], .3, '#779bb7');
  vessel([[.56,.2,.02],[.23,1.3,.14],[.31,2.38,.14],[.94,2.56,-.2],[1.35,2.06,-.57],[1.27,.68,-.93]], .29, '#ce9490');
  vessel([[-.16,-.03,.71],[-.42,.93,.74],[-.13,1.86,.54],[.67,1.97,.03],[1.61,1.92,-.17]], .27, '#80a6b4');
  vessel([[-.07,1.85,.5],[-.72,1.95,-.33],[-1.64,1.77,-.5]], .2, '#80a6b4');
  for (const side of [-1,1]) for (const y of [.9,1.35]) {
    vessel([[.65 + side*.35,y,-.6],[.65 + side*.8,y+.12,-.85],[.65 + side*1.16,y+.16,-1.05]], .15, '#bb8086');
  }
  vessel([[-.56,.29,-.48],[.12,.22,-.84],[.86,.38,-.81],[1.28,.56,-.43]], .105, '#967ab0');

  // Annuli give context for the septal and ventricular catheter courses.
  for (const [position, radius, color] of [
    [[-.42,.27,.35],.53,'#7596a7'], [[.65,.24,-.27],.48,'#b8898b'],
  ] as [Point,number,string][]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius,.035,10,64), surface(color));
    ring.position.copy(vec(position)); ring.rotation.x = Math.PI / 2.4; root.add(ring);
  }

  for (const definition of CATHETERS) {
    const curve = new THREE.CatmullRomCurve3(definition.points.map(vec));
    const material = new THREE.MeshStandardMaterial({color: definition.color, roughness: .36, metalness: .3,
      emissive: definition.color, emissiveIntensity: .16});
    const shaft = new THREE.Mesh(new THREE.TubeGeometry(curve, 128, .029, 8, false), material);
    shaft.userData.catheter = definition.id; root.add(shaft); pickables.push(shaft);
    const metal = new THREE.MeshStandardMaterial({color: '#edf4fa', roughness: .23, metalness: .8});
    const length = curve.getLength();
    for (let pole = 0; pole < definition.poles; pole++) {
      const t = 1 - (pole * .115 + .045) / length;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(.044,.044,.056,12), metal);
      ring.position.copy(curve.getPointAt(t));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), curve.getTangentAt(t));
      ring.userData.catheter = definition.id; root.add(ring); pickables.push(ring);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.068,16,12), material);
    tip.position.copy(curve.getPoint(1)); tip.userData.catheter = definition.id;
    root.add(tip); pickables.push(tip);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(.14,20,12),
      new THREE.MeshBasicMaterial({color: definition.color, transparent: true, opacity: .22, depthWrite: false}));
    halo.position.copy(tip.position); root.add(halo);
    catheters.push({id: definition.id, node: definition.node, material, halo, tip});
    labels.push({text: definition.id, position: tip.position.clone().add(new THREE.Vector3(.13,.12,.05)), color: definition.color, catheter: definition.id});
  }

  return {root, tissue, chambers, catheters, pickables, labels, dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    root.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }};
}
