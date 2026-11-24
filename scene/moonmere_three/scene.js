import * as THREE from 'three';
import { createArchitecture, sampleBank } from './architecture.js';
import { createGarden } from './garden.js';
import { createWater } from './water.js';
import { createSky } from './sky.js';
import { createFinish } from './finish.js';

const stage = document.querySelector('canvas');
const bar = document.querySelector('.transport');
const toggle = document.querySelector('#play');
const seek = document.querySelector('#seek');
const clock = document.querySelector('output');
const capture = new URLSearchParams(location.search).has('capture');
const smallPreview = new URLSearchParams(location.search).has('small');
const duration = 10;
const radians = THREE.MathUtils.degToRad;
const renderer = new THREE.WebGLRenderer({canvas:stage, antialias:true, alpha:false,
  powerPreference:'high-performance', preserveDrawingBuffer:capture});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const world = new THREE.Scene();
world.background = new THREE.Color(0x030403);
const camera = new THREE.PerspectiveCamera(40,16/9,.12,750);
camera.rotation.order = 'YXZ';
const sky = createSky(THREE,world);
sky.rotation.y = radians(3.25);
const falls = createArchitecture(THREE,world,{weathered:__MOONMERE_REFINED__,ornate:__MOONMERE_ENGRAVED__});
const garden = createGarden(THREE,world,sampleBank,{refined:__MOONMERE_REFINED__,illustrated:__MOONMERE_ENGRAVED__});
const water = createWater(THREE,world,{reflectionSize:smallPreview?512:1024});
const finish = __MOONMERE_ENGRAVED__ ? createFinish(THREE,renderer) : null;
let grading = Boolean(finish);

const key = new THREE.DirectionalLight(0xf9f8ff,3.43);
key.position.set(-21,69,38);
key.target.position.set(-1,4,-15);
key.castShadow = true;
key.shadow.mapSize.set(4096,4096);
Object.assign(key.shadow.camera,{left:-52,right:52,top:54,bottom:-54,near:1,far:154});
key.shadow.camera.updateProjectionMatrix();
key.shadow.bias = -.00008;
key.shadow.normalBias = .026;
key.shadow.autoUpdate = false;
key.shadow.needsUpdate = true;
world.add(key,key.target);
world.add(new THREE.HemisphereLight(0xdee2e2,0x6b7755,.35));
const fill = new THREE.DirectionalLight(0xd9decb,.86);
fill.position.set(29,23,-34);
world.add(fill);
// A small amount of light reflected by the chalk terrace reaches the distant
// carved facade while the trees close to the lens stay in deep shadow.
const terraceBounce = new THREE.SpotLight(0xf7f1ff,550,74,.70,.58,2);
terraceBounce.position.set(-9,27,-22);
terraceBounce.target.position.set(1,15,-43);
world.add(terraceBounce,terraceBounce.target);
const arcadeBounce = new THREE.SpotLight(0xf1eff6,260,35,.77,.60,2);
arcadeBounce.position.set(1,9,-7);
arcadeBounce.target.position.set(-4,2,-19);
world.add(arcadeBounce,arcadeBounce.target);

// The reference tilts down from the moon before approaching the flower.
// Each key encodes time, eye position, pitch, horizontal heading and vertical FOV.
const keys = [
  [0,   -.26,3.45,36.1, 24.9,1.5,40],
  [1.2, -.24,3.40,34.0, 21.9,1.4,40],
  [3.1, -.16,3.26,29.8, 11.4,.3,40],
  [5.0,  .55,3.20,27.45, 6.3,-2.0,40],
  [6.6,  .19,2.98,24.85, 2.0,-5.0,41],
  [8.2, -.06,2.72,22.15,-4.5,-10.0,42.5],
  [9.2,  .025,2.68,21.19,-8.4,-12.7,43],
  [10,  -.03,2.70,21.52,-7.6,-11.4,43],
];
function pathAt(t,j,i) {
  const a=keys[i],b=keys[i+1],prev=keys[Math.max(i-1,0)],next=keys[Math.min(i+2,keys.length-1)];
  const dt=b[0]-a[0],u=THREE.MathUtils.clamp((t-a[0])/dt,0,1);
  const va=(b[j]-prev[j])/(b[0]-prev[0]), vb=(next[j]-a[j])/(next[0]-a[0]);
  return (2*u*u*u-3*u*u+1)*a[j]+(u*u*u-2*u*u+u)*dt*va+
         (-2*u*u*u+3*u*u)*b[j]+(u*u*u-u*u)*dt*vb;
}
let yaw=0, pitch=0;
function draw(t) {
  t=THREE.MathUtils.clamp(t,0,duration);
  const next=keys.findIndex(k=>k[0]>t);
  const segment=next===-1?keys.length-2:next-1;
  const at=j=>pathAt(t,j,segment);
  camera.position.set(at(1),at(2),at(3));
  camera.rotation.set(radians(at(4))+pitch,-radians(at(5))+yaw,0,'YXZ');
  camera.fov=at(6);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  if(typeof falls==='function') falls(t);
  if(typeof garden==='function') garden(t); else garden?.update?.(t,camera);
  water.update(t,camera);
  if(finish) finish.render(world,camera,grading);
  else renderer.render(world,camera);
}
function dimensions() {
  const width=capture?smallPreview?960:1920:Math.round(stage.clientWidth*Math.min(devicePixelRatio,1.5));
  const height=capture?smallPreview?540:1080:Math.round(stage.clientHeight*Math.min(devicePixelRatio,1.5));
  renderer.setSize(Math.max(1,width),Math.max(1,height),false);
  finish?.setSize(Math.max(1,width),Math.max(1,height));
  camera.aspect=width/height;
}
dimensions();
draw(0);
const gl=renderer.getContext(), gpuInfo=gl.getExtension('WEBGL_debug_renderer_info');
window.moonmere={render:draw,duration,engine:'Three.js r'+THREE.REVISION,
  gpu:gpuInfo?gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
if(capture) {
  bar.hidden=true;
  Object.assign(window.moonmere,{world,renderer,camera});
} else {
  let t=0, playing=true, last=performance.now(), pointer=null;
  if(finish) {
    const gradeButton=document.createElement('button');
    gradeButton.type='button';
    gradeButton.textContent='调色';
    gradeButton.setAttribute('aria-label','画面调色');
    gradeButton.setAttribute('aria-pressed','true');
    gradeButton.title='对比同一场景调色前后的画面';
    gradeButton.addEventListener('click',()=>{
      grading=!grading;
      gradeButton.setAttribute('aria-pressed',String(grading));
      draw(t);
    });
    bar.classList.add('has-grade');
    bar.insertBefore(gradeButton,bar.querySelector('.hint'));
  }
  const report=()=>{
    seek.value=t.toFixed(3);
    clock.value='0:'+String(Math.floor(t)).padStart(2,'0')+' / 0:10';
    toggle.textContent=playing?'暂停':'播放';
    toggle.setAttribute('aria-label',playing?'暂停':'播放');
  };
  const playPause=()=>{if(t>=duration) t=0; playing=!playing; last=performance.now(); report();};
  toggle.addEventListener('click',playPause);
  document.querySelector('#reset').addEventListener('click',()=>{t=0;yaw=0;pitch=0;playing=true;last=performance.now();report();});
  seek.addEventListener('input',()=>{playing=false;t=Number(seek.value);draw(t);report();});
  document.addEventListener('keydown',e=>{if(e.code==='Space' && (e.target===document.body||e.target===stage)){e.preventDefault();playPause();}});
  stage.addEventListener('pointerdown',e=>{pointer=[e.clientX,e.clientY];stage.setPointerCapture(e.pointerId);playing=false;report();});
  stage.addEventListener('pointermove',e=>{
    if(!pointer) return;
    yaw=THREE.MathUtils.clamp(yaw-(e.clientX-pointer[0])*.004,-1.15,1.15);
    pitch=THREE.MathUtils.clamp(pitch+(e.clientY-pointer[1])*.004,-.65,.65);
    pointer=[e.clientX,e.clientY]; draw(t);
  });
  stage.addEventListener('pointerup',()=>{pointer=null;});
  stage.addEventListener('pointercancel',()=>{pointer=null;});
  window.addEventListener('resize',()=>{dimensions();draw(t);});
  const tick=now=>{
    if(playing){
      t=Math.min(duration,t+(now-last)/1000);
      if(t>=duration) playing=false;
      draw(t);report();
    }
    last=now;requestAnimationFrame(tick);
  };
  report();requestAnimationFrame(tick);
}
