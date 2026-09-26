import * as THREE from 'three';
import type { Anatomy } from './engine';
/** Carve/Craterize's fixed particle-pool approach. No timers or allocations per frame. */
export class EruptEffects {
  readonly group=new THREE.Group();
  private smoke=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:0x655f61,transparent:true,opacity:.27,depthWrite:false}),72);
  private ash=new THREE.InstancedMesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial({color:0xd6c1a2,transparent:true,opacity:.6}),64);
  private cracks=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xff8c38,transparent:true,opacity:.9,depthTest:false}));
  private glow=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),new THREE.MeshBasicMaterial({color:0xffb951,transparent:true,opacity:.25,depthWrite:false}));
  private dummy=new THREE.Object3D();private a:Anatomy|null=null;
  constructor(){this.smoke.frustumCulled=this.ash.frustumCulled=false;this.cracks.renderOrder=8;this.group.add(this.smoke,this.ash,this.cracks,this.glow);this.group.visible=false;}
  set(a:Anatomy,heights:Uint8Array,W:number){
    this.a=a;const points:number[]=[];
    for(const vent of a.vents)for(let k=0;k<7;k++)for(let j=1;j<14;j++){
      const angle=k*Math.PI*2/7+a.phase;
      for(const n of [j-1,j]){const r=n*a.radius/16,t=angle+Math.sin(n*.6+k)*.07,x=vent.x+.5+Math.cos(t)*r,y=vent.y+.5+Math.sin(t)*r;
        const i=Math.max(0,Math.min(heights.length-1,Math.floor(y)*W+Math.floor(x)));points.push(x,(heights[i]??a.datum)+.15,-y);}
    }
    this.cracks.geometry.dispose();this.cracks.geometry=new THREE.BufferGeometry();this.cracks.geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  }
  update(t:number,on:boolean,progress=0){
    const a=this.a;this.group.visible=on&&!!a&&t>=0;if(!this.group.visible||!a)return;
    const d=this.dummy,age=Math.min(t,4),cool=Math.max(0,1-Math.max(0,t-2)/2);
    this.cracks.geometry.setDrawRange(0,Math.floor(Math.min(1,t*1.7)*this.cracks.geometry.attributes.position.count/2)*2);
    this.cracks.material.opacity=.9*cool;this.cracks.position.y=a.height*progress*.36;
    this.glow.position.set(a.x+.5,a.datum+a.height*progress,-a.y-.5);this.glow.scale.set(a.radius*.22,.8+a.height*.12,a.radius*.22);this.glow.material.opacity=.25*cool;
    for(let k=0;k<72;k++){
      const v=a.vents[k%a.vents.length],theta=k*2.399,life=(age*(.75+k%5*.04)+k*.037)%2.8,rad=(1+life)*a.radius*.08;
      d.position.set(v.x+.5+Math.cos(theta)*rad+life*.9,a.datum+a.height*progress+life*9,-v.y-.5+Math.sin(theta)*rad);
      d.scale.setScalar((.35+life*.75)*(1+a.radius*.025));d.rotation.set(k,life,k);d.updateMatrix();this.smoke.setMatrixAt(k,d.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate=true;this.smoke.material.opacity=.27*cool*Math.min(1,t*3);
    for(let k=0;k<64;k++){const v=a.vents[k%a.vents.length],theta=k*2.4,flight=(age+k*.04)%1.8,rad=(2+k%7)*flight;
      d.position.set(v.x+Math.cos(theta)*rad,a.datum+a.height*progress+1+12*flight-6*flight*flight,-v.y+Math.sin(theta)*rad);d.scale.setScalar(cool);d.updateMatrix();this.ash.setMatrixAt(k,d.matrix);}
    this.ash.instanceMatrix.needsUpdate=true;
  }
}
