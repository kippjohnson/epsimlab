/** Strength-duration threshold: rheobase × (1 + chronaxie / width).
 * Fixed teaching parameters shared by both networks, not a patient prediction. */
export function captureThreshold(atrial:boolean,width:number){
 return (atrial?.6:.8)*(1+.5/width);
}
