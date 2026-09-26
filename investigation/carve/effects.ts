import * as THREE from 'three';
import type { Head } from './engine';
/** Fixed pool: 96 foam beads + 48 debris/dust chunks. Presentation only. */
export class Surge {
  readonly group=new THREE.Group();
  private foam=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xeaf5df,transparent:true,opacity:.86}),96);
  private debris=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0x968268,transparent:true,opacity:.7}),48);
  private mud=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x927f56,transparent:true,opacity:.58,side:THREE.DoubleSide,depthWrite:false}));
  private dummy=new THREE.Object3D();
  private head:Head|null=null;private trail:{x:number;y:number;bed:number;width:number;dx:number;dy:number}[]=[];
  constructor(){this.foam.frustumCulled=this.debris.frustumCulled=false;this.mud.renderOrder=4;this.foam.renderOrder=5;this.group.add(this.mud,this.foam,this.debris);}
  set(head:Head|null,trail:typeof this.trail,h:Uint8Array,W:number){
    this.head=head;this.trail=trail;const pos:number[]=[];
    for(let k=1;k<trail.length;k++){
      const a=trail[k-1],b=trail[k];
      const z=(s:typeof a)=>h[Math.max(0,Math.min(h.length-1,Math.round(s.y)*W+Math.round(s.x)))]+.98;
      const edge=(s:typeof a,side:number)=>[s.x+s.dy*s.width*.52*side+.5,z(s),-s.y+s.dx*s.width*.52*side-.5];
      const a0=edge(a,-1),a1=edge(a,1),b0=edge(b,-1),b1=edge(b,1);
      pos.push(...a0,...a1,...b0,...a1,...b1,...b0);
    }
    this.mud.geometry.dispose();this.mud.geometry=new THREE.BufferGeometry();
    this.mud.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.mud.geometry.computeBoundingSphere();
  }
  update(t:number,on:boolean){
    this.group.visible=on&&!!this.head;if(!this.group.visible)return;
    const h=this.head!,d=this.dummy;
    for(let k=0;k<96;k++){
      const phase=(t*1.8+k*.618)%1,a=k*2.4,rad=h.width*Math.sqrt((k%17)/17)*.78;
      d.position.set(h.x+.5+Math.cos(a)*rad-h.dx*phase*2,h.z+.4+Math.sin(phase*Math.PI)*.55,-h.y-.5+Math.sin(a)*rad+h.dy*phase*2);
      d.scale.set(.12+.2*phase,.08,.25+.3*phase);d.rotation.set(0,-Math.atan2(h.dy,h.dx),0);d.updateMatrix();this.foam.setMatrixAt(k,d.matrix);
    }this.foam.instanceMatrix.needsUpdate=true;
    for(let k=0;k<48;k++){
      const phase=(t*.65+k*.381)%1,a=k*2.39,rad=h.width+phase*3;
      d.position.set(h.x+.5+Math.cos(a)*rad,h.z+1+4*Math.sin(phase*Math.PI),-h.y-.5+Math.sin(a)*rad);
      d.rotation.set(phase*4,k,phase*3);const s=(h.cut?1:0)*(.12+(k%5)*.07)*(1-phase);d.scale.setScalar(s);d.updateMatrix();this.debris.setMatrixAt(k,d.matrix);
    }this.debris.instanceMatrix.needsUpdate=true;
  }
}
