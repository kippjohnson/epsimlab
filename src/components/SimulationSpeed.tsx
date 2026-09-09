import './simulation-speed.css';
export function SimulationSpeed({speed,onSpeed}:{speed:number;onSpeed:(speed:number)=>void}){
 return <label className="simulation-speed" title="Changes the speed of the whole study: signals, pacing, drugs and interventions. Measured intervals stay in simulated milliseconds."><span>Study speed</span><select aria-label="Study speed" value={speed} onChange={e=>onSpeed(Number(e.target.value))}><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="5">5×</option></select></label>;
}
