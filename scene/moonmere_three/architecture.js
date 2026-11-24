import { addCastleOrnament } from './castle-ornament.js';

// A quarried limestone gorge and a Gothic palace. Coordinates are in metres.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b-a)*t;

function seed(n) {
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

export function bankEdge(z, side) {
  return 10.35 + 1.60*Math.sin(z*0.176+side*1.27) +
    0.91*Math.sin(z*0.397-side*1.51) + 0.39*Math.sin(z*0.699+side);
}

function cliffHeight(z, side) {
  return 5.7 + 1.15*Math.sin(z*0.135+side) + 0.92*Math.sin(z*0.318+side*1.2)
    + 2.45*Math.exp(-Math.pow((z-(side<0 ? 1.8 : -3.9))/5.1,2));
}

function terrace(z) { return clamp((-z-27.2)/12.7,0,1)*8.53; }

function rearSurface(x,z) {
  const contour=.78*Math.sin(.48*x)+.67*Math.cos(.31*x+.8);
  const slope=terrace(z+contour);
  const depth=clamp(slope/2,0,1)*clamp((9-slope)/1.5,0,1);
  const shelf=.34*Math.sin(slope*4.4+.32*x)+.28*Math.cos(1.27*x+.38*z);
  const channel=.62*Math.exp(-(((x-4.12)/1.15)**2));
  return slope-.38+depth*(shelf-channel);
}

export function sampleBank(x,z) {
  const side = x<0 ? -1 : 1;
  const distance = Math.abs(x)-bankEdge(z,side);
  const back = rearSurface(x,z);
  if (distance < -0.65) return Math.max(-0.62, back-0.12);
  const top = cliffHeight(z, side) + 0.28*Math.sin(x*0.85-z*0.18);
  const lip = clamp((distance+0.65)/1.75,0,1);
  return Math.max(back, mix(-0.4,top,lip) + clamp(distance-1.1,0,12)*0.29);
}

// A repeating, hand-laid texture with individually tinted blocks and chipped joints.
function stoneAtlas(T) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d'), rand=seed(418);
  ctx.fillStyle='#92918b'; ctx.fillRect(0,0,1024,1024);
  let bottom=0;
  while (bottom<1024) {
    const h=Math.min(1024-bottom,19+Math.floor(rand()*25));
    let x=-Math.floor(rand()*81);
    while(x<1024) {
      const w=45+rand()*97, c=180+rand()*34;
      const shade=ctx.createLinearGradient(0,bottom,0,bottom+h);
      shade.addColorStop(0,`rgb(${c+7},${c+6},${c+3})`);
      shade.addColorStop(0.20,`rgb(${c+3},${c+2},${c})`);
      shade.addColorStop(1,`rgb(${c-7},${c-7},${c-8})`);
      ctx.fillStyle=shade; ctx.fillRect(x+0.65,bottom+0.75,w-0.7,h-0.85);
      x+=w;
    }
    bottom+=h;
  }
  for(let i=0;i<3700;i++){
    const x=rand()*1024,y=rand()*1024,r=1.5+rand()**2*23;
    const wash=ctx.createRadialGradient(x,y,0,x,y,r);
    const c=rand()<0.52?'63,68,58':'245,242,234';
    wash.addColorStop(0,`rgba(${c},${0.02+rand()*0.14})`);
    wash.addColorStop(1,`rgba(${c},0)`);
    ctx.fillStyle=wash;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  for(let i=0;i<900;i++) {
    const x=rand()*1024,y=rand()*1024,h=4+rand()**2*98;
    const drip=ctx.createLinearGradient(0,y,0,y+h);
    drip.addColorStop(0,`rgba(66,69,57,${rand()*0.12})`); drip.addColorStop(1,'rgba(66,69,57,0)');
    ctx.fillStyle=drip;ctx.fillRect(x,y,0.4+rand()**2*3.2,h);
  }
  return texture(T,canvas);
}

function texture(T,canvas) {
  const map=new T.CanvasTexture(canvas);
  map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
}

// Vertical fluting and bedding planes reflect the two fracture directions of the gorge.
function cliffAtlas(T) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
  const c=canvas.getContext('2d'), rand=seed(61128);
  const pigment=c.createImageData(768,768);
  function mottling(nx,ny) {
    const grain=Float32Array.from({length:nx*ny},()=>rand());
    return (x,y)=>{
      const u=x*nx/768,v=y*ny/768,i=Math.floor(u),j=Math.floor(v);
      const a=u-i,b=v-j,ii=(i+1)%nx,jj=(j+1)%ny;
      return mix(mix(grain[j*nx+i],grain[j*nx+ii],a),mix(grain[jj*nx+i],grain[jj*nx+ii],a),b);
    };
  }
  const large=mottling(6,7), fissures=mottling(56,10), lichens=mottling(32,30);
  for(let y=0;y<768;y++)for(let x=0;x<768;x++){
    const a=large(x,y),s=fissures(x,y),l=lichens(x,y),i=(y*768+x)*4;
    const light=159+61*a+40*(l-.5)+29*(s-.5)+9*(rand()-.5);
    const moss=Math.max(0,(.65-a)*1.6)+Math.max(0,.54-l)*.31;
    pigment.data.set([light-30*moss,light+2-16*moss,light-13-30*moss,255],i);
  }
  c.putImageData(pigment,0,0);
  for(let i=0;i<810;i++){
    const x=rand()*768,y=rand()*768,w=1+rand()**2*34,h=9+rand()**1.25*135;
    const tint=rand()<0.51?'39,51,35':'228,232,212';
    const grad=c.createLinearGradient(x,y,x+w,y);grad.addColorStop(0,`rgba(${tint},${0.04+rand()*0.18})`);
    grad.addColorStop(1,`rgba(${tint},0)`);c.fillStyle=grad;
    c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y-h*.07);c.lineTo(x+w*.75,y+h*.62);
    c.lineTo(x+w*.3,y+h);c.lineTo(x+w*.08,y+h*.72);c.fill();
  }
  for(let i=0;i<159;i++){
    let x=rand()*768,y=rand()*768;
    c.beginPath();c.moveTo(x,y);const n=2+Math.floor(rand()*6);
    for(let j=0;j<n;j++){x+=(rand()-.48)*12;y+=3+rand()*20;c.lineTo(x,y);}
    c.strokeStyle=`rgba(42,50,40,${.09+rand()*.25})`;c.lineWidth=.7+rand()*2;c.stroke();
  }
  return texture(T,canvas);
}

function material(T, color, map=null) {
  return new T.MeshStandardMaterial({color,map,roughness:.94,metalness:0,vertexColors:true,side:T.DoubleSide});
}

function periodicNoise(rand, columns, rows, size) {
  const lattice=Float32Array.from({length:columns*rows},()=>rand());
  return (x,y)=>{
    const u=x*columns/size,v=y*rows/size,i=Math.floor(u),j=Math.floor(v);
    const dx=u-i,dy=v-j,sx=dx*dx*(3-2*dx),sy=dy*dy*(3-2*dy);
    const a=(i%columns+columns)%columns,b=(j%rows+rows)%rows;
    const c=(a+1)%columns,d=(b+1)%rows;
    return mix(mix(lattice[b*columns+a],lattice[b*columns+c],sx),
      mix(lattice[d*columns+a],lattice[d*columns+c],sx),sy);
  };
}

function repeatingData(T,bytes,size,format,space){
  const map=new T.DataTexture(bytes,size,size,format);
  map.colorSpace=space;map.wrapS=map.wrapT=T.RepeatWrapping;
  map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;
  map.anisotropy=4;map.needsUpdate=true;
  return map;
}

// Redraw the quarry beds for this finish. Each stone has its own mineral content
// and height. Erosion displaces the face of a joint without shifting the course.
function quarryFinish(T,dressed=false){
  const size=1024,rand=seed(305170),courseForY=new Uint8Array(size),beds=new Float32Array(size);
  const courses=[],colour=new Uint8Array(size*size*4),relief=new Uint8Array(size*size);
  const courseWeights=Array.from({length:dressed?26:31},()=>dressed?.50+rand()*1.2:.67+rand()*.76);
  const total=courseWeights.reduce((sum,n)=>sum+n,0);
  let end=0;
  for(const weight of courseWeights){
    const low=Math.round(end);end+=weight/total*size;
    const high=Math.min(size,Math.round(end));
    for(let y=low;y<high;y++){
      courseForY[y]=courses.length;beds[y]=Math.min(y-low+.5,high-y-.5);
    }
    const jag=new Float32Array(size),tint=new Float32Array(size),offset=Math.floor(rand()*size);
    const widths=Array.from({length:(dressed?11:9)+Math.floor(rand()*8)},()=>.54+rand()*1.10);
    const length=widths.reduce((sum,n)=>sum+n,0);let edge=0;
    for(const width of widths){
      const a=Math.round(edge);edge+=width/length*size;
      const b=Math.min(size,Math.round(edge)), mineral=(rand()-.5)*(dressed?59:19);
      for(let k=a;k<b;k++){
        const x=(k+offset)%size;
        jag[x]=Math.min(k-a+.5,b-k-.5);tint[x]=mineral;
      }
    }
    courses.push({jag,tint});
  }
  const cloud=periodicNoise(rand,6,7,size), calcite=periodicNoise(rand,33,42,size);
  const chips=periodicNoise(rand,114,128,size), run=periodicNoise(rand,82,9,size);
  const seams=periodicNoise(rand,15,23,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const grain=chips(x,y), fleck=rand(), rain=run(x,y), stoneCloud=cloud(x,y), crystal=calcite(x,y);
    const warp=seams(x,y)-.5;
    const iy=(Math.round(y+5.2*warp+1.9*(grain-.5))+size)%size;
    const ix=(Math.round(x+7.2*warp+3.3*(crystal-.5))+size)%size;
    const course=courses[courseForY[iy]],edge=Math.min(beds[iy],course.jag[ix]);
    const chipWidth=.6+3.8*Math.max(0,(grain-.49)*2)+1.4*Math.max(0,(rain-.64)*3);
    const joint=1-clamp((edge-.20)/chipWidth,0,1);
    const wornLip=clamp(1-Math.abs(edge-chipWidth-1.2)*.67,0,1)*(1-joint);
    const mineral=215+course.tint[ix]+37*(stoneCloud-.5)+28*(crystal-.5)+21*(grain-.5)+11*(fleck-.5);
    const stain=21*Math.max(0,(.55-rain)*2)*(.25+.75*stoneCloud);
    let value=mineral-stain-(27+18*crystal)*joint+10*wornLip;
    if(dressed){
      // Light catches occasional chipped arrises. Most of the contrast comes
      // from the stone itself, so the mortar never forms a black brick grid.
      const chalkLip=wornLip*clamp((crystal-.31)*2.2,0,1);
      const tooling=Math.cos((x*.76+y*.32)+grain*9)*(2.4+2.4*crystal);
      value+=15*chalkLip-8*joint-13*(stoneCloud-.5)+tooling;
    }
    const cool=clamp((.60-stoneCloud)*1.9,0,.65),i=y*size+x;
    colour[i*4]=clamp(value+3-4*cool,0,255);colour[i*4+1]=clamp(value+1,0,255);
    colour[i*4+2]=clamp(value-2+6*cool,0,255);colour[i*4+3]=255;
    relief[i]=clamp(151+46*(grain-.5)+23*(crystal-.5)+13*(fleck-.5)-87*joint+17*wornLip,0,255);
  }
  return {map:repeatingData(T,colour,size,T.RGBAFormat,T.SRGBColorSpace),
    bump:repeatingData(T,relief,size,T.RedFormat,T.NoColorSpace)};
}

// Runoff widens existing vertical joints in the ravine. Sheltered pockets retain
// moisture, and exposed edges bleach to a lighter grey than the body of the rock.
function erodedCliff(T,base){
  const canvas=base.image,size=canvas.width,rand=seed(82153);
  const source=canvas.getContext('2d').getImageData(0,0,size,size).data;
  const albedo=new Uint8Array(size*size*4),height=new Uint8Array(size*size);
  const karst=periodicNoise(rand,23,8,size),sediment=periodicNoise(rand,5,8,size);
  const splits=periodicNoise(rand,90,13,size),pitting=periodicNoise(rand,115,93,size);
  const pooled=periodicNoise(rand,11,16,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,k=karst(x,y),s=sediment(x,y),p=pitting(x,y),f=splits(x,y);
    const pocket=clamp(.40+2.4*(s-.48)+1.25*(pooled(x,y)-.46),0,1);
    const fracture=Math.abs(k-.44),hairline=Math.abs(f-.51);
    const seam=clamp(1-fracture/(.045+.09*p),0,1)*pocket;
    const rim=clamp(1-Math.abs(fracture-.103)/.056,0,1)*pocket;
    const crack=clamp(1-hairline/.067,0,1)*clamp((.63-k)*3.7,0,1);
    const wet=clamp((.56-s)*3.6,0,1)*clamp((.64-k)*2.9,0,1);
    const powder=17*(s-.40)+22*(p-.5)+12*(rand()-.5);
    const weather=powder-57*seam-25*crack-43*wet+23*rim+3.8;
    const avg=source[i*4]*.21+source[i*4+1]*.71+source[i*4+2]*.08;
    for(let c=0;c<3;c++){
      const grey=mix(source[i*4+c],avg,.24);
      albedo[i*4+c]=clamp(grey+weather+(c===2?2.5+wet*5:0),0,255);
    }
    albedo[i*4+3]=255;
    height[i]=clamp(151+51*(f-.5)+69*(p-.5)-91*seam-30*crack+20*rim,0,255);
  }
  return {map:repeatingData(T,albedo,size,T.RGBAFormat,T.SRGBColorSpace),
    bump:repeatingData(T,height,size,T.RedFormat,T.NoColorSpace)};
}

// R is mineral streaking, G is the soft penumbra of small clusters of leaves,
// B is the density of moisture. All three are sampled in fixed world space.
function weatherField(T){
  const size=512,rand=seed(14825),bytes=new Uint8Array(size*size*4);
  const broad=periodicNoise(rand,5,6,size),leaf=periodicNoise(rand,18,23,size);
  const speck=periodicNoise(rand,46,61,size),rain=periodicNoise(rand,38,7,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const a=broad(x,y),b=leaf(x,y),c=speck(x,y),d=rain(x,y),i=(y*size+x)*4;
    bytes[i]=255*(.27*a+.46*d+.27*c);
    bytes[i+1]=255*clamp((.48*a+.34*b+.18*c-.37)*3.4,0,1);
    bytes[i+2]=255*clamp((.45*a+.38*d+.17*b-.31)*2.4,0,1);bytes[i+3]=255;
  }
  return repeatingData(T,bytes,size,T.RGBAFormat,T.NoColorSpace);
}

function applyWeather(mat,field,outcrop){
  mat.onBeforeCompile=shader=>{
    shader.uniforms.moonWeather={value:field};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vMoonStoneWorld;')
      .replace('#include <project_vertex>',
        'vMoonStoneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vMoonStoneWorld;\nuniform sampler2D moonWeather;')
      .replace('#include <map_fragment>',`
        #include <map_fragment>
        vec3 pStone=vMoonStoneWorld;
        vec2 rainUV=vec2(pStone.x+.63*pStone.z,.23*pStone.x+pStone.y);
        vec3 weatherA=texture2D(moonWeather, rainUV*.074).rgb;
        vec2 shadowUV=vec2(pStone.x+.67*pStone.y-.21*pStone.z,pStone.z+.63*pStone.y+.18*pStone.x);
        vec3 canopyA=texture2D(moonWeather,shadowUV*.033+vec2(.21,.07)).rgb;
        float canopyB=texture2D(moonWeather,shadowUV*.072+vec2(.61,.29)).g;
        float lowWall=1.0-smoothstep(9.0,25.0,pStone.y);
        float shadeLeaves=smoothstep(.12,.84,.70*canopyA.g+.30*canopyB)*(.12+.88*lowWall);
        float dampStone=weatherA.b*(.19+.81*(1.0-smoothstep(.35,8.2,pStone.y)));
        float grainTint=mix(.74,1.23,weatherA.r);
        diffuseColor.rgb*=grainTint*mix(vec3(1.035,1.021,1.005),vec3(.71,.756,.785),dampStone);
        ${outcrop?`float neutral=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(neutral*1.045,neutral*1.04,neutral*.985),.26);
          diffuseColor.rgb*=1.12;`:''}
      `)
      .replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+.17*(weatherA.r-.5)-.32*dampStone,.43,1.0);
      `)
      .replace('#include <lights_fragment_end>',`
        #include <lights_fragment_end>
        reflectedLight.directDiffuse*=mix(vec3(1.24,1.21,1.185),vec3(.38,.45,.53),shadeLeaves);
        reflectedLight.indirectDiffuse*=mix(vec3(1.025),vec3(.83,.87,.92),shadeLeaves);
        // Moonlight reflected by the pale pond floor reaches the inner bank and
        // the arcade across the water. Limit this bounce to exposed stone faces.
        vec3 stoneNormal=inverseTransformDirection(normal,viewMatrix);
        float leafOpening=1.0-.49*shadeLeaves-.14*dampStone;
        ${outcrop?`float shore=smoothstep(4.8,7.3,-pStone.x)*(1.0-smoothstep(12.3,17.5,-pStone.x));
          shore*=smoothstep(-30.0,-21.0,pStone.z)*(1.0-smoothstep(13.0,22.0,pStone.z));
          shore*=1.0-smoothstep(5.8,8.7,pStone.y);
          float exposed=smoothstep(-.27,.60,dot(stoneNormal,normalize(vec3(.84,.17,.52))));
          float bounce=shore*(.10+.90*exposed)*(.65+.35*leafOpening);
          vec3 targetLit=diffuseColor.rgb*vec3(1.04,1.06,1.03)*bounce;
          targetLit*=1.0-.14*smoothstep(.20,.39,dot(targetLit,vec3(.2126,.7152,.0722)));`:
          `float arcade=(1.0-smoothstep(.63,1.02,abs(pStone.z+19.90)))*
            (1.0-smoothstep(3.56,4.04,abs(pStone.x+5.28)))*(1.0-smoothstep(4.1,4.6,pStone.y));
          float exposed=smoothstep(-.43,.63,dot(stoneNormal,normalize(vec3(.31,.33,.89))));
          float bounce=arcade*(.22+.78*exposed)*(.44+.56*leafOpening);
          vec3 targetLit=diffuseColor.rgb*vec3(.81,.83,.81)*bounce;`}
        vec3 currentLit=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse;
        reflectedLight.indirectDiffuse+=max(targetLit-currentLit,vec3(0.0));
      `);
  };
  mat.customProgramCacheKey=()=>outcrop?'moonmere-weathered-strata-2':'moonmere-weathered-ashlar-2';
}

function dressPalaceStone(T,mat,quarry){
  const detailed=quarryFinish(T,true);
  const baseWeather=mat.onBeforeCompile;
  mat.map=detailed.map;mat.bumpMap=detailed.bump;mat.bumpScale=.064;
  mat.onBeforeCompile=shader=>{
    baseWeather(shader);
    shader.uniforms.moonGardenQuarry={value:quarry.map};
    // The keep uses a continuous circumferential course, with the seam behind
    // the tower. The front courses meet the original geometry's world-space UVs.
    const angle=12*Math.PI/180,x=-1.5-7.13*Math.cos(angle)-5.78*Math.sin(angle);
    const z=-44+7.13*Math.sin(angle)-5.78*Math.cos(angle);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec2 drumXY=vMoonStoneWorld.xz-vec2(${x.toFixed(6)},${z.toFixed(6)});
      if(vMoonStoneWorld.y>21.0 && length(drumXY)<2.60 && length(drumXY)>1.96){
        vMapUv=vec2(atan(drumXY.x,drumXY.y)*.318309886+.37,vMoonStoneWorld.y*.136+.19);
        vBumpMapUv=vMapUv;
      }
      #include <project_vertex>
    `);
    shader.fragmentShader=shader.fragmentShader
      .replace('uniform sampler2D moonWeather;',`
        uniform sampler2D moonWeather;
        uniform sampler2D moonGardenQuarry;
        float moonLedgeWash(float y,float ledge,float reach){
          float below=ledge-y;
          return smoothstep(-.035,.11,below)*(1.0-smoothstep(.18,reach,below));
        }
      `)
      .replace('float grainTint=',`
        float palaceBed=smoothstep(5.0,8.4,pStone.y);
        float bedStrength=.32+.68*palaceBed;
        diffuseColor.rgb=mix(diffuse*texture2D(moonGardenQuarry,vMapUv).rgb,diffuseColor.rgb,bedStrength);
        vec2 drumDelta=pStone.xz-vec2(${x.toFixed(6)},${z.toFixed(6)});
        float drum=(1.0-smoothstep(2.35,2.86,length(drumDelta)))*smoothstep(20.8,22.3,pStone.y);
        float faceLedges=moonLedgeWash(pStone.y,19.20,2.8)+moonLedgeWash(pStone.y,16.35,1.7)
          +moonLedgeWash(pStone.y,10.22,1.34)+moonLedgeWash(pStone.y,23.82,1.75);
        float keepLedges=moonLedgeWash(pStone.y,31.28,3.28)+moonLedgeWash(pStone.y,29.38,1.20)
          +moonLedgeWash(pStone.y,25.41,2.46);
        float arcadeLedges=moonLedgeWash(pStone.y,3.46,1.1)+moonLedgeWash(pStone.y,2.80,.86);
        float belowCornice=mix(arcadeLedges*.45,mix(faceLedges,keepLedges,drum),palaceBed);
        float aroundDrum=atan(drumDelta.x,drumDelta.y)*2.20;
        float wallU=mix(pStone.x+.39*pStone.z,aroundDrum,drum);
        vec3 runnels=texture2D(moonWeather,vec2(wallU*.15,pStone.y*.022)+vec2(.67,.08)).rgb;
        float stain=belowCornice*smoothstep(.34,.67,runnels.r)*(.40+.60*runnels.b);
        float whitewash=smoothstep(.61,.80,runnels.r)*smoothstep(.41,.85,canopyA.r);
        diffuseColor.rgb*=mix(vec3(1.0),vec3(.69,.71,.73),min(.92,stain));
        diffuseColor.rgb+=vec3(.047,.046,.043)*whitewash*bedStrength;
        float grainTint=`);
  };
  mat.customProgramCacheKey=()=>'moonmere-engraved-palace-ashlar-1';
}

// Flat faces are accumulated per finish, then sent to the GPU in one draw per finish.
class Builder {
  constructor(T,materials) { this.T=T;this.materials=materials;this.batches={}; }
  face(key, points, shade=1) {
    const b=this.batches[key]??={pos:[],uv:[],color:[]};
    const a=points[0],u=points[1].map((v,i)=>v-a[i]),v=points[2].map((q,i)=>q-a[i]);
    const n=[Math.abs(u[1]*v[2]-u[2]*v[1]),Math.abs(u[2]*v[0]-u[0]*v[2]),Math.abs(u[0]*v[1]-u[1]*v[0])];
    const axes=n[1]>n[0]&&n[1]>n[2]?[0,2]:n[0]>n[2]?[2,1]:[0,1];
    const mult=key==='rock'||key==='ledge'?0.16:0.128;
    const col=typeof shade==='number'?[shade,shade,shade]:shade;
    for(let j=1;j<points.length-1;j++) for(const p of [a,points[j],points[j+1]]) {
      b.pos.push(...p); b.uv.push(p[axes[0]]*mult,p[axes[1]]*mult);b.color.push(...col);
    }
  }
  rings(key,layers,shade=1, cap=true) {
    const n=layers[0].length;
    for(let j=1;j<layers.length;j++) for(let i=0;i<n;i++) {
      const k=(i+1)%n;this.face(key,[layers[j-1][i],layers[j][i],layers[j][k],layers[j-1][k]],shade);
    }
    if(cap) {this.face(key,layers.at(-1).slice().reverse(),shade);this.face(key,layers[0],shade);}
  }
  box(key,x,y,z,w,h,d,shade=1) {
    const layers=[y,y+h].map(v=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,k])=>[x+i*w/2,v,z+k*d/2]));
    this.rings(key,layers,shade);
  }
  turned(key,x,z,profile,n=12,shade=1, rotation=0){
    this.rings(key,profile.map(([h,r])=>Array.from({length:n},(_,i)=>{
      const a=TAU*i/n+rotation;return [x+r*Math.cos(a),h,z+r*Math.sin(a)];})),shade);
  }
  line(key,pts,r,shade=1){
    const V=this.T.Vector3, layers=[];
    for(let i=0;i<pts.length;i++){
      const p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
      const t=new V(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
      const n=new V().crossVectors(t,Math.abs(t.z)>.91?new V(0,1,0):new V(0,0,1)).normalize();
      const bin=new V().crossVectors(t,n);
      layers.push(Array.from({length:5},(_,j)=>{
        const q=TAU*j/5, v=n.clone().multiplyScalar(Math.cos(q)*r).addScaledVector(bin,Math.sin(q)*r);
        return [p[0]+v.x,p[1]+v.y,p[2]+v.z];}));
    }
    this.rings(key,layers,shade,false);
  }
  build(scene) {
    for(const [key,b] of Object.entries(this.batches)){
      const g=new this.T.BufferGeometry();
      for(const [name,data,n] of [['position',b.pos,3],['uv',b.uv,2],['color',b.color,3]])
        g.setAttribute(name,new this.T.Float32BufferAttribute(data,n));
      g.computeVertexNormals();g.computeBoundingSphere();
      const mesh=new this.T.Mesh(g,this.materials[key]);mesh.name='Moonmere | '+key;
      mesh.castShadow=key!=='waterfall';mesh.receiveShadow=true;scene.add(mesh);
    }
  }
}

function arch(x,y,w,h) {
  const rise=Math.min(.87*w,.65*h), shoulder=y+h-rise, a=[[x-w/2,y]];
  for(let i=0;i<=12;i++){
    const angle=Math.PI-Math.PI*i/36;
    a.push([x+w/2+w*Math.cos(angle),shoulder+rise*Math.sin(angle)/.8660254]);
  }
  return [...a,...a.slice(0,-1).reverse().map(([u,v])=>[2*x-u,v])];
}

function hoop(b,x,y,z,r,t,mat='trim',n=18){
  b.line(mat,Array.from({length:n+1},(_,i)=>[x+r*Math.cos(i*TAU/n),y+r*Math.sin(i*TAU/n),z]),t);
}

function window(b,x,y,z,w,h,kind=0){
  const points=arch(x,y,w,h);
  b.face('glass',points.map(([a,c])=>[a,c,z+.025]));
  const thick=Math.max(.029,w*.037);
  for(const [extra,d,r,key] of [[.16,.07,.68,'shadowstone'],[.06,.14,.63,'trim']]){
    b.line(key,arch(x,y,w+extra*w,h+.35*extra*w).map(([a,c])=>[a,c,z+d]),thick*r);
  }
  if(kind===2){
    for(let i=0;i<2;i++) {
      const off=.25+i*.11;
      b.line(i?'trim':'shadowstone',arch(x,y,w*(1+off),h+w*off*.55).map(([a,c])=>[a,c,z+.10-i*.04]),w*.023);
    }
    const rz=y+h-w*.406,r=w*.223,d=z+.18;
    hoop(b,x,rz,d,r,w*.021);hoop(b,x,rz,d,r*.18,w*.009);
    for(let i=0;i<7;i++){
      const a=i*TAU/7+Math.PI/2;hoop(b,x+r*.66*Math.cos(a),rz+r*.66*Math.sin(a),d,r*.29,w*.012);
    }
    for(const s of [-1,1]){
      const q=x+s*w*.25;
      b.line('trim',arch(q,y,w*.495,h-.62*w).map(([a,c])=>[a,c,d]),w*.017);
      hoop(b,q,y+h-w*.72,d,w*.057,w*.009);
    }
    for(let i=0;i<6;i++){
      const step=w/6,q=x-w/2+step*(i+.5),hi=h-w*(.71+.12*Math.abs(i-2.5)/2.5);
      b.line('trim',arch(q,y,step*.96,hi).map(([a,c])=>[a,c,d]),w*.010);
      for(const y0 of [y+.02,y+hi*.41]){
        const tr=arch(q,y0,step*.95,step*.86);
        b.line('trim',tr.map(([a,c])=>[a,c,d+.008]),w*.0065);
      }
    }
  } else if(kind===1){
    for(let i=0;i<2;i++){
      const q=x+(i-.5)*w*.46;
      b.line('trim',arch(q,y,w*.46,h-w*.46).map(([a,c])=>[a,c,z+.15]),thick*.40);
    }
    hoop(b,x,y+h-w*.29,z+.15,w*.118,thick*.38, 'trim',12);
  }
  b.box('trim',x,y-.10,z+.09,w*1.17,.13,.32);
}

function pinnacle(b,x,z,y,h,r){
  b.turned('stone',x,z,[[y,r],[y+h*.17,r],[y+h*.19,r*.74],[y+h*.29,r*.74]],8);
  b.turned('trim',x,z,[[y+h*.27,r*.97],[y+h*.32,r*1.04],[y+h*.36,r*.76],[y+h*.94,r*.048]],8);
  b.turned('shadowstone',x,z,[[y+h*.89,r*.06],[y+h*.94,r*.13],[y+h,r*.011]],6);
}

function buttress(b,x,z,base,h,scale=1){
  for(const [f,th,w,d] of [[0,.27,1.13,1.16],[.27,.36,.95,1.0],[.63,.37,.73,.82]]){
    b.box('stone',x,base+h*f,z,w*scale,h*th,d*scale);
    b.box('trim',x,base+h*(f+th)-.16,z,(w+.19)*scale,.17,(d+.14)*scale);
    for(const s of [-1,1]) b.turned('trim',x+s*w*scale*.38,z+d*scale/2,[
      [base+h*f,.078*scale],[base+h*(f+th),.078*scale]],6);
  }
  pinnacle(b,x,z,base+h,2.76*scale,.39*scale);
}

function hip(b,x,y,z,w,d,h){
  const a=w/2,c=d/2,r=Math.max(.12,a-c*.52);
  const p=[[x-a,y,z+c],[x+a,y,z+c],[x+a,y,z-c],[x-a,y,z-c],
    [x-r,y+h,z],[x+r,y+h,z]];
  for(const face of [[0,1,5,4],[1,2,5],[2,3,4,5],[3,0,4]]) b.face('roof',face.map(i=>p[i]));
  b.line('shadowstone',[p[4],p[5]],.075);
}

function turret(b,x,z,base,top,r,crenel=true,keep=false){
  b.turned('stone',x,z,[[base,r*1.03],[base+.7,r],[top-2,r],[top-1.5,r*1.11],[top-.57,r*1.11]],28);
  const bands=keep?[base+1.1,top-7.45,top-2.06,top-1.57,top-.61]:
    [base+1.1,top-5.5,top-5.28,top-2,top-1.67,top-1.39,top-.61];
  for(const level of bands){
    const rad=r*(level>top-1.8?1.125:keep?1.012:1.026);
    b.turned(keep?'stone':'trim',x,z,[[level,rad],[level+(keep?.072:.105),rad]],28);
  }
  for(let i=0;i<18;i++){
    const a=TAU*i/18, angles=[a-.114,a,a+.114],coords=[];
    for(const [ratio,dir] of [[1.11,angles],[.88,[...angles].reverse()]])
      for(const q of dir) coords.push([x+ratio*r*Math.cos(q),z+ratio*r*Math.sin(q)]);
    if(crenel) b.rings('stone',[top-.59,top].map(v=>coords.map(([u,w])=>[u,v,w])));
  }
  if(!crenel) pinnacle(b,x,z,top-.59,3.25,r);
  if(keep){
    const project=(a,u,v,radius)=>[x+Math.cos(a)*u+Math.sin(a)*radius,v,z-Math.sin(a)*u+Math.cos(a)*radius];
    for(const [a,level] of [[.24,top-5.22],[2.12,top-4.76],[4.1,top-5.34],
      [-.77,top-9.72],[.99,top-10.42],[3.2,top-9.93]]){
      const shape=arch(0,level,.084,.73);
      b.face('glass',shape.map(([u,h])=>project(a,u,h,r+.017)));
      b.line('shadowstone',shape.map(([u,h])=>project(a,u,h,r+.024)),.018);
    }
    // Thin drip trails underneath the cornice gradually disappear into the masonry.
    const weather=seed(372);
    for(let i=0;i<24;i++){
      const a=TAU*(i+weather()*.60)/24, y=top-2.12-weather()*.35;
      const length=.47+weather()**1.4*3.69,w=.034+weather()*.066;
      b.face('stone',[[0,y],[w,y-.15],[w*.45,y-length],[w*.12,y-length*.78]]
        .map(([u,h])=>project(a,u,h,r+.014)),.82+weather()*.12);
    }
    return;
  }
  for(const [level,width,h,finish] of [[top-4.05,.23,1.22,'glass'],[top-8.66,.24,1.68,'shadowstone']])
    for(let i=0;i<14;i++){
      const a=TAU*i/14,pts=arch(0,level,width*r,h);
      const project=(u,v,rr)=>[x+Math.cos(a)*u+Math.sin(a)*rr,v,z-Math.sin(a)*u+Math.cos(a)*rr];
      b.face(finish,pts.map(([u,v])=>project(u,v,r+.025)));
      b.line('trim',pts.map(([u,v])=>project(u,v,r+.042)),.03);
    }
}

function steppedChapel(b) {
  // The compact Lady Chapel has a true stepped west gable and a slate roof behind it.
  const x=-9.38,z=-45.84,eave=19.42,rise=6.28,half=2.91,depth=4.77;
  b.box('stone',x,13.80,z-depth/2,2*half,eave-13.80,depth);
  for(let i=0;i<7;i++){
    const halfStep=half*(7-i)/7,low=eave+rise*i/7,high=eave+rise*(i+1)/7;
    b.box('stone',x,low,z,halfStep*2,high-low,.41);
    for(const side of [-1,1]){
      const coping=x+side*(halfStep-half/14);
      b.box('trim',coping,high-.06,z,half/7+.16,.15,.55);
    }
  }
  for(const side of [-1,1]) {
    b.face('roof',[[x+side*half,eave,z-.22],[x,eave+rise,z-.22],
      [x,eave+rise,z-depth],[x+side*half,eave,z-depth]]);
    b.line('shadowstone',[[x+side*half,eave+.05,z+.23],[x,eave+rise,z+.23]],.065);
    const bay=x+.97*side;
    window(b,bay,19.24,z+.22,.61,2.26);
    b.line('trim',arch(bay,19.14,.80,2.56).map(([u,v])=>[u,v,z+.28]),.055);
  }
  window(b,x,19.00,z+.22,1.02,4.20,1);
  hoop(b,x,24.12,z+.27,.24,.064,'shadowstone',16);
  for(const [offset,level,height,radius] of [
    [-2.52,20.26,2.73,.21],[-1.69,22.08,2.88,.18],[0,25.68,3.54,.37],[1.27,23.01,2.16,.16],
  ]) pinnacle(b,x+offset,z+.06,level,height,radius);
}

function flyingArch(b,outerX,innerX,z,foot,rise) {
  // Two independent little flyers bridge the side aisle to the taller nave.
  const base=t=>foot+rise*Math.sin(t*Math.PI*.5),thickness=t=>.26+.36*(1-t)**2;
  for(let i=0;i<11;i++){
    const a=i/11,k=(i+1)/11,u=mix(outerX,innerX,a),v=mix(outerX,innerX,k);
    const p=[[u,base(a)],[v,base(k)],[v,base(k)+thickness(k)],[u,base(a)+thickness(a)]];
    for(const depth of [-.15,.15]) b.face('stone',p.map(([x,y])=>[x,y,z+depth]));
    b.face('shadowstone',[[u,base(a),z-.15],[v,base(k),z-.15],[v,base(k),z+.15],[u,base(a),z+.15]]);
    b.face('trim',[[u,base(a)+thickness(a),z-.15],[v,base(k)+thickness(k),z-.15],
      [v,base(k)+thickness(k),z+.15],[u,base(a)+thickness(a),z+.15]]);
  }
  b.box('stone',outerX,foot-1.98,z,.48,2.34,.65);
  pinnacle(b,outerX,z,foot+.31,2.04,.23);
}

function palace(b,ornate=false){
  const base=8.35;
  const world=b,angle=12*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
  b=Object.create(world);
  b.face=(key,points,shade)=>world.face(key,points.map(([x,y,z])=>[
    2+(x-2)*co+(z+44)*si-3.50,y,-44-(x-2)*si+(z+44)*co]),shade);
  b.box('shadowstone',1.0,6.04,-48.74,23.74,2.32,13.42,.86);
  b.box('stone',-9.12,5.18,-41.65,7.78,2.85,6.66,.89);
  for(const y of [6.52,7.52,8.04]) b.box('trim',-9.12,y,-38.33,7.96,.14,.48,.93);
  // Window wall and flying shafts below a crenellated gallery. The ridge is set back.
  b.box('stone',1.85,base,-47.02,10.4,12.83,10.04);
  window(b,2.12,10.16,-41.98,2.55,6.60,2);
  for(const x of [-.57,4.82]){
    window(b,x,12.81,-41.97,.72,2.68,1);
    b.line('trim',arch(x,12.67,.94,3.12).map(([u,v])=>[u,v,-41.82]),.053);
    window(b,x,17.79,-41.97,.38,1.06);
  }
  for(const [x,height] of [[-.97,1.20],[-.52,1.54],[-.07,1.20],[4.37,1.05],[4.81,1.40],[5.25,1.05]]){
    b.line('shadowstone',arch(x,10.25,.34,height).map(([u,v])=>[u,v,-41.93]),.045);
  }
  b.line('trim',arch(2.12,10.10,3.66,7.94).map(([u,v])=>[u,v,-41.78]),.061);
  const rain=seed(12391);
  for(const x of [-2.16,-1.34,-.90,.34,.61,3.42,3.61,4.44,5.57]){
    const y=9.17+rain()*1.28, w=.068+rain()*.112, h=.22+rain()*.87;
    b.face('stone',[[x,y,-41.978],[x+w,y+.11,-41.978],[x+w*.57,y-h*.65,-41.978],
      [x+w*.28,y-h,-41.978],[x+w*.12,y-h*.47,-41.978]],.75+rain()*.13);
  }
  for(const x of [-2.85,6.55]) buttress(b,x,-41.78,base,13.25,1.12);
  for(const y of [8.75,9.03,18.91,19.18,20.86]){
    b.box('trim',1.85,y,-41.97,10.54,.14,.48);
  }
  for(let i=0;i<13;i++) {
    const x=-2.42+i*.70;
    b.line('shadowstone',arch(x,19.43,.5,1.01).map(([u,v])=>[u,v,-41.88]),.048);
    b.box('trim',x,20.99,-41.99,.39,.43,.42);
  }
  b.box('stone',1.30,20.3,-48.55,8.6,3.55,6.5);
  hip(b,1.30,23.82,-48.55,9.03,6.95,3.03);
  for(const [x,top,half] of [[-1.94,23.42,.65],[-.04,24.93,1.13],[1.98,23.22,.57],[3.54,23.65,.64]]){
    b.box('stone',x,20.92,-45.18,2*half,top-20.92,.64);
    window(b,x,21.21,-44.84,1.13*half,top-21.23,1);
    b.face('stone',[[x-half,top,-44.83],[x+half,top,-44.83],[x,top+1.42*half,-44.83]]);
    b.line('trim',[[x-half,top,-44.72],[x,top+1.42*half,-44.72],[x+half,top,-44.72]],.072);
    pinnacle(b,x,-44.81,top+1.42*half,.93,.11);
  }
  for(const [x,z,w,h,front,roof] of [
    [-5.55,-48.45,5.75,11.34,-43.95,2.52],[9.14,-47.1,5.00,10.84,-42.60,1.64],
    [-9.98,-48.62,4.35,8.16,-45.16,1.92],[12.30,-51.98,4.06,7.73,-48.38,2.10]
  ]){
    b.box('stone',x,base,z,w,h,2*(front-z));
    window(b,x,base+1.16,front+.018,w*.36,h*.64,1);
    for(const s of [-1,1]){
      window(b,x+s*w*.38,base+h*.43,front+.026,.41,1.32);
      buttress(b,x+s*(w*.47),front+.15,base,h+.27,.63);
    }
    for(const y of [base+.63,base+h*.78,base+h-.35,base+h-.11])
      b.box('trim',x,y,front,w+.21,.13,.35);
    hip(b,x,base+h,z,w+.28,2*(front-z)+.25,roof);
  }
  // The offset drum is the highest limb of the silhouette, as in the reference.
  turret(b,-5.13,-49.78,base,32.91,2.20,true,true);
  turret(b,11.65,-49.45,base,22.39,1.74);
  turret(b,-9.65,-49.1,base,21.44,.91,false);
  turret(b,-2.09,-54.3,18.5,27.52,1.1,false);
  b.box('stone',-1.55,19.8,-53.3,4.56,6.0,3.72);
  for(const side of [-1,1]) for(const end of [-1,1]){
    pinnacle(b,-1.55+side*2.22,-53.3+end*1.80,25.80,2.29,.22);
  }
  for(const [x,z,y,h,r] of [[-8.38,-44.2,17.4,5.0,.44],[-6.9,-45.5,19.0,4.9,.48],
      [-3.1,-43.8,20.3,4.28,.43],[6.7,-43.4,20.5,4.5,.42],[8.9,-49.9,20.9,4.27,.45],
      [13.2,-51.9,17.85,3.18,.37],[-10.8,-49.6,17.1,4.7,.43],[4.88,-51.72,23.29,4.16,.38]])
    pinnacle(b,x,z,y,h,r);
  for(const [x,z,w,h] of [[-7.56,-50.85,2.11,24.22],[8.21,-53.12,2.32,23.04],
    [13.25,-55.14,1.35,21.84],[-11.51,-52.64,1.47,19.45]]){
    b.box('stone',x,base,z,w,h-base,2.08);
    window(b,x,h-3.34,z+1.06,w*.46,2.22,1);
    hip(b,x,h,z,w*1.18,2.54,2.66);
    for(const s of [-1,1]) pinnacle(b,x+s*w*.51,z+.98,h-.32,2.98,.19);
    pinnacle(b,x,z,h+2.51,1.70,.17);
  }
  for(const [x,z,y,r] of [[-8.72,-53.95,23.6,.57],[-3.30,-54.88,26.43,.41],[6.81,-53.33,25.20,.45]]){
    b.turned('stone',x,z,[[y-5,r],[y-.22,r],[y,r*1.18]],8);
    b.turned('roof',x,z,[[y,r*1.33],[y+.82,r*.68],[y+3.88,r*.045]],8);
    pinnacle(b,x,z,y+3.72,1.03,r*.13);
  }
  pinnacle(b,-9.64,-49.15,21.71,4.98,.19);
  pinnacle(b,8.82,-51.25,23.58,4.18,.16);
  steppedChapel(b);
  flyingArch(b,-6.62,-3.41,-42.75,16.32,3.26);
  flyingArch(b,9.52,7.03,-43.19,16.04,3.03);
  for (const [x,z,y,h,r] of [[-3.39,-44.91,22.03,3.64,.25],
    [2.21,-52.16,25.17,4.26,.29],[6.38,-46.65,22.26,3.28,.23],
    [10.45,-49.34,21.90,4.61,.29]]) {
    b.turned('stone',x,z,[[y-4.80,r*1.06],[y-.92,r*.81],[y+.14,r*.91],[y+.24,r]],8);
    pinnacle(b,x,z,y+.20,h,r);
  }
  // A lower cloister and buttressed outworks come forward on the viewer's left.
  b.box('stone',-9.15,base-.35,-41.10,7.62,5.56,5.72);
  for(let i=0;i<4;i++) window(b,-11.85+i*1.79,base+.39,-38.22,1.08,3.18,1);
  for(const y of [base+.08,base+4.63,base+4.95]) b.box('trim',-9.15,y,-38.21,7.77,.16,.43);
  for(let i=0;i<13;i++) b.box('stone',-12.73+i*.60,base+5.19,-38.27,.37,.43,.40);
  turret(b,-12.64,-42.90,base-.31,16.12,.96);

  if(ornate) addCastleOrnament(b,{arch,hoop,window,pinnacle});
  // A partly collapsed belvedere and a stair in the rear garden break the slope.
  b=world;
  const cx=7.34,front=-33.47,soil=terrace(front)-.59;
  for(const side of [-1,1]) {
    const x=cx+side*1.18;
    b.box('stone',x,soil,front,.55,3.01,1.06);
    buttress(b,x,front+.24,soil+.12,3.04,.45);
    pinnacle(b,x,front,soil+3.02,1.35,.22);
  }
  const a=arch(cx,soil,1.83,2.76).slice(1,-1);
  for(let i=1;i<a.length;i++){
    const [u,h]=a[i-1],[v,k]=a[i];
    b.face('stone',[[u,h,front+.51],[v,k,front+.51],[v,soil+3.06,front+.51],[u,soil+3.06,front+.51]]);
  }
  b.line('trim',a.map(([x,y])=>[x,y,front+.55]),.088);
  for(let k=0;k<15;k++) {
    const z=-29.09-k*.27,y=terrace(z)-.38;
    b.box('shadowstone',7.34+.35*Math.sin(k*.21),y-.14,z,1.62+.14*Math.cos(k),.20,.38,.93);
  }
}

// Stones are offset along the normal to the pointed arch. This keeps the broad
// voussoirs radial even at the nearly vertical springing and the sharp crown.
function cutArchStones(b,cx,width,peak,z) {
  const arris=arch(cx,0,width,peak).slice(1,-1);
  const normal=arris.map(([x,y],i)=>{
    const p=arris[Math.max(0,i-1)],q=arris[Math.min(arris.length-1,i+1)];
    const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);
    return [-dy/len,dx/len];
  });
  const path=(i,offset,depth)=>[arris[i][0]+normal[i][0]*offset,
    arris[i][1]+normal[i][1]*offset,z+depth];
  const interpolate=(a,c,t)=>a.map((v,i)=>mix(v,c[i],t));
  for(let i=0;i<arris.length-1;i+=2) {
    const end=i+2,high=i===10||i===12,trim=high?.458:.386;
    const sections=[[.104,.587],[.145,.724],[trim-.039,high?.850:.806],[trim,.681]];
    const rings=sections.map(([off,depth])=>{
      const a=path(i,off,depth),m=path(i+1,off,depth),c=path(end,off,depth);
      return [interpolate(a,m,.098),m,interpolate(c,m,.098)];
    });
    const tint=[.74,1.06,.91,1.01,.81,1.06][(i/2)%6];
    for(let j=0;j<3;j++) for(let k=0;k<2;k++) {
      b.face(j===1?'stone':'trim',[rings[j][k],rings[j+1][k],rings[j+1][k+1],rings[j][k+1]],tint);
    }
    for(const k of [0,2]) b.face('shadowstone',rings.map(r=>r[k]),.68);
    const q=path(i,.136,.727),v=path(i,trim-.038,high?.847:.801);
    b.line('shadowstone',[q,v],.016,.63);
  }
  // Narrow back ribs delineate the dark depth of each portal without reducing its span.
  for(const depth of [-.43,.15,.49]) {
    b.line('trim',arris.map(([x,y])=>[x,y-.011,z+depth]),depth>.4?.051:.043,.91);
  }
  for(let i=2;i<arris.length-2;i+=4) {
    const [x,y]=arris[i];
    b.line('shadowstone',[[x,y-.024,z-.49],[x,y-.024,z+.54]],.023,.73);
  }
}

function arcadeCapital(b,x,z,interior) {
  const front=z+.685;
  for(const side of [-1,1]) {
    const sx=x+side*.261;
    b.turned('shadowstone',sx,z+.61,[[.13,.184],[.23,.178],[.31,.133],[2.18,.133]],10,.82);
    b.turned('trim',sx,front,[[.14,.160],[.21,.167],[.28,.111],[.32,.123],
      [.37,.103],[2.11,.103],[2.18,.135],[2.23,.114],[2.31,.172]],10);
  }
  b.turned('trim',x,z+.690,[[.16,.154],[.25,.170],[.39,.100],[2.15,.100],[2.31,.16]],10,.94);
  b.box('shadowstone',x,2.292,z+.130,1.00,.235,1.28,.75);
  for(const [h,w,d] of [[2.31,1.05,1.41],[2.565,1.11,1.48],[2.713,1.21,1.55]]) {
    b.box('trim',x,h,z+.045,w,.063,d);
  }
  // Overlapping leaves curl out from the necking into the square abacus.
  for(let i=0;i<5;i++) {
    const cx=x+(i-2)*.196, lean=(i-2)*.030;
    const foot=[cx,2.311,front+.083],l=[cx-.096,2.485,front+.105];
    const r=[cx+.087,2.49,front+.101],mid=[cx+lean*.24,2.498,front+.189];
    const tip=[cx+lean,2.619,front+.208];
    b.face('trim',[foot,l,mid],.88);b.face('trim',[foot,mid,r],1.05);
    b.face('stone',[l,tip,mid],.88);b.face('trim',[r,mid,tip],1.04);
  }
  // Inscribed stone panels occupy the residual masonry between the arches.
  const y=interior?4.10:4.22,w=interior?.53:.43, h=.69;
  b.box('shadowstone',x,y-h/2,z+.587,w+.14,h+.12,.069,.77);
  b.box('trim',x,y-h/2+.024,z+.615,w+.062,h-.04,.075,1.08);
  b.box('stone',x,y-h/2+.104,z+.657,w-.084,h-.206,.043,.77);
  const crest=Array.from({length:21},(_,j)=>{
    const a=TAU*j/20,r=(.73+.25*Math.cos(4*a))*(w*.39);
    return [x+r*Math.cos(a),y+r*Math.sin(a),z+.703];
  });
  b.line('trim',crest,.040,1.06);
  b.turned('trim',x,z+.615,[[y-.046,.071],[y,.082],[y+.045,.039]],6,.93);
}

function piercedParapet(b,x,z) {
  const width=4.30/8, depth=.47, y=5.981;
  for(let i=0;i<8;i++) {
    const cx=x-2.15+(i+.5)*width;
    const outer=[],inner=[];
    for(let j=0;j<32;j++) {
      const a=(j+.5)*TAU/32,cs=Math.cos(a),sn=Math.sin(a);
      const r=Math.min(width*.5/Math.abs(cs),.326/Math.abs(sn));
      outer.push([cx+r*cs,y+r*sn]);
      const hole=.150+.032*Math.cos(4*a);
      inner.push([cx+hole*cs,y+hole*sn]);
    }
    for(let j=0;j<32;j++) {
      const k=(j+1)%32;
      for(const d of [-depth,depth]) {
        b.face('stone',[outer[j],outer[k],inner[k],inner[j]].map(([u,v])=>[u,v,z+d]),.94+(i%3)*.03);
      }
      b.face('shadowstone',[[...inner[j],z+depth],[...inner[k],z+depth],
        [...inner[k],z-depth],[...inner[j],z-depth]],.77);
    }
    const mould=inner.concat([inner[0]]).map(([u,v])=>[cx+(u-cx)*1.16,y+(v-y)*1.16,z+depth+.036]);
    b.line('trim',mould,.034,1.04);
  }
  b.box('shadowstone',x,5.627,z,4.39,.075,1.07,.82);
  b.box('trim',x,5.681,z,4.37,.044,1.09);
  b.box('trim',x,6.276,z,4.44,.163,1.175);
}

function quayMonument(b) {
  // A stepped devotional niche at the foot of the overgrown garden stair, paired
  // with the surviving end of the balustrade farther along the bank.
  const x=5.88,z=-25.54;
  for(const [y,w,d,h] of [[-.16,3.84,2.85,.30],[.14,3.53,2.57,.23],[.37,3.22,2.31,.21],
    [.58,2.96,2.07,.19],[.77,2.69,1.88,.18]]) {
    b.box('stone',x,y,z,w,h,d,.89+(y+.16)*.11);
    b.box('trim',x,y+h-.058,z+.022,w+.067,.061,d+.083);
  }
  const pier=z-.20,front=pier+.46;
  b.box('stone',x,.95,pier,2.23,1.65,.90);
  const niche=arch(x,1.025,1.49,2.16);
  b.face('shadowstone',niche.map(([u,v])=>[u,v,front+.030]),.70);
  b.line('shadowstone',niche.map(([u,v])=>[u,v,front+.073]),.038,.70);
  for(const side of [-1,1]) {
    const px=x+side*.976;
    b.box('stone',px,.93,pier,.40,2.77,.93,.97);
    for(const sx of [-.10,.10]) {
      b.turned('trim',px+sx,front+.053,[[1.03,.084],[1.15,.102],[1.22,.064],
        [3.06,.064],[3.15,.109],[3.23,.12]],8);
    }
    b.box('trim',px,3.24,pier,.53,.13,1.02);
    pinnacle(b,px,pier,3.61,side<0?.56:.38,.16);
    const line=arch(x,1.10,1.64,2.23).slice(1,-1);
    if(side===1) {
      for(let j=0;j<line.length-1;j++) {
        const a=line[j],c=line[j+1];
        b.face('stone',[[a[0],a[1],front],[c[0],c[1],front],
          [c[0],3.56,front],[a[0],3.56,front]],.92);
      }
      b.line('shadowstone',line.map(([u,v])=>[u,v,front+.045]),.099,.76);
      b.line('trim',line.map(([u,v])=>[u,v,front+.096]),.061);
    }
  }
  b.box('stone',x,3.53,pier,2.12,.21,.92);
  b.box('trim',x,3.72,pier,2.36,.13,1.02);
  // Carved robes taper to shoulders. The angular folds remain legible in the reflection.
  for(const [dx,floor,size] of [[-.37,1.03,.81],[.10,1.04,1.04],[.46,.90,.66]]) {
    const cx=x+dx,cz=front+.13,py=floor,lean=dx<0?.11:dx>.2?-.083:-.046;
    const ring=(height,r,depth)=>Array.from({length:12},(_,j)=>{
      const a=TAU*j/12,fold=j%2?.79:1.07;
      return [cx+(Math.cos(a)*r*fold+lean*height)*size,py+height*size,
        cz+Math.sin(a)*depth*fold*size+.024*height*height];
    });
    b.rings('stone',[ring(.00,.186,.13),ring(.15,.167,.134),ring(.70,.101,.101),
      ring(.88,.148,.094),ring(.98,.078,.065)],1.04);
    const head=cx+lean*size;
    b.turned('trim',head,cz+.02,[[py+.96*size,.053*size],[py+1.12*size,.115*size],
      [py+1.24*size,.079*size],[py+1.265*size,.024*size]],9,1.07);
    b.line('trim',[[head-.111*size,py+.89*size,cz+.031],[head-.145*size,py+.65*size,cz+.11],
      [head+.048*size,py+.73*size,cz+.167]],.049*size,1.05);
    for(let i=-1;i<=1;i++) {
      b.line('trim',[[cx+i*.10,py+.06*size,cz+.12],[cx+i*.065,py+.31*size,cz+.10],
        [head+i*.032,py+.65*size,cz+.07]],.015*size,.95);
    }
  }
}

function gardenArcade(b,ornate=false){
  const spans=[2.55,3.16,2.55],axis=-3.78,z=-19.9, wallTop=5.47, y=-.38;
  const world=b;
  b=Object.create(world);
  b.face=(key,points,shade)=>world.face(key,points.map(([x,h,depth])=>[
    axis-1.50+(x-axis)*.62,h*.62,z+(depth-z)*.62]),shade);
  const pierWidth=.78, full=spans.reduce((a,c)=>a+c,0)+4*pierWidth;
  let left=axis-full/2;
  for(let i=0;i<4;i++){
    const x=left+pierWidth/2;
    b.box('stone',x,y,z,pierWidth,wallTop-y,1.13);
    for(const [h,w,t] of [[-.18,1.18,.37],[.18,1.01,.12],[2.40,1.08,.15],[2.64,1.14,.18]]){
      b.box('trim',x,h,z,w,t,1.28);
    }
    for(const s of [-1,1]) b.turned('trim',x+s*.28,z+.60,[[.11,.11],[2.43,.11]],8);
    if(ornate) arcadeCapital(b,x,z,i===1||i===2);
    if(i===3)break;
    const width=spans[i],cx=x+pierWidth/2+width/2,peak=i===1?4.47:4.11;
    const inner=arch(cx,0,width,peak).slice(1,-1);
    for(let j=0;j<inner.length-1;j++){
      const [a,h]=inner[j],[u,k]=inner[j+1];
      b.face('stone',[[a,h,z+.55],[u,k,z+.55],[u,wallTop,z+.55],[a,wallTop,z+.55]]);
      b.face('shadowstone',[[a,h,z+.55],[u,k,z+.55],[u,k,z-.55],[a,h,z-.55]]);
      b.face('stone',[[a,h,z-.55],[u,k,z-.55],[u,wallTop,z-.55],[a,wallTop,z-.55]]);
    }
    for(const [add,r,key] of [[.09,.064,'shadowstone'],[.22,.08,'trim'],[.38,.044,'shadowstone']]){
      b.line(key,arch(cx,0,width+add,peak+add*.54).map(([a,h])=>[a,h,z+.58]),r);
    }
    if(i!==1){
      const d=z+.63;
      for(const s of [-1,1]) {
        const roseX=cx+s*width*.25;
        const crown=arch(roseX,2.66,width*.44,.82);
        b.line('trim',crown.slice(1,-1).map(([a,h])=>[a,h,d]),.060);
      }
      hoop(b,cx,3.67,d,.118,.055);
    }
    if(ornate) cutArchStones(b,cx,width,peak,z);
    left+=pierWidth+width;
  }
  const x0=axis-full/2;
  for(const [h,w,d] of [[5.04,.14,1.22],[5.28,.09,1.32],[5.48,.21,1.36]])
    b.box('trim',axis,h,z,full+.12,w,d);
  for(let i=0;i<25;i++){
    const cx=x0+.25+i*(full-.5)/24;
    b.line('shadowstone',arch(cx,4.79,.35,.34).slice(1,-1).map(([a,h])=>[a,h,z+.61]),.047);
  }
  // One surviving panel of the frieze, and an isolated short parapet across the pool.
  if(ornate) {
    piercedParapet(b,axis-2.24,z);
    // Corbel teeth cast a broken, fine shadow under the weather-drip.
    for(let i=0;i<24;i++) {
      const x=x0+.30+i*(full-.60)/23;
      b.box('stone',x,5.151,z+.58,.143,.126,.246,.86+(i%3)*.045);
    }
  } else {
    b.box('stone',axis-2.24,5.66,z,4.30,.65,.96);
    b.box('trim',axis-2.24,6.28,z,4.44,.16,1.17);
    for(let i=0;i<8;i++) hoop(b,axis-4.06+i*.51,5.97,z+.51,.189,.047,'shadowstone',12);
  }
  b=world;
  b.box('stone',8.62,-.21,-24.62,2.55,3.55,2.05);
  for(const h of [.03,2.68,3.19]) b.box('trim',8.62,h,-24.60,2.72,.18,2.21);
  for(let i=0;i<5;i++)b.box('stone',7.48+i*.56,3.4,-24.0,.27,.52,.61);
  if(ornate) {
    quayMonument(b);
    for(let i=0;i<5;i++) {
      const x=7.62+i*.50;
      b.box('shadowstone',x,2.89,-23.55,.38,.27,.08,.73);
      hoop(b,x,3.03,-23.477,.117,.033,'trim',10);
    }
    for(const x of [7.49,9.75]) {
      b.turned('trim',x,-23.57,[[.0,.125],[.25,.152],[.36,.089],[2.45,.089],[2.61,.158]],8);
    }
  }
}

function gorge(b){
  const random=seed(11928), rockTint=()=>.74+random()*.27;
  for(const side of [-1,1]){
    const slices=[];
    for(let z=-57;z<=33;z+=.84){
      const edge=bankEdge(z,side),h=cliffHeight(z,side),k=rockTint();
      const section=[];
      for(const [d,r] of [[-.64,-.085],[-.20,.12],[.04,.31],[.34,.48],
          [.42,.62],[.85,.80],[1.20,1],[3.6,1],[8.8,1],[15,1]]){
        const notch=.38*Math.sin(1.76*z+side*.52)+.31*Math.sin(3.2*z-2.4*r);
        const x=side*(edge+d+notch+(random()-.5)*(d>1?.49:.29));
        const y=r<1 ? Math.max(rearSurface(x,z)-.30,r*h+(random()-.5)*.49) : sampleBank(x,z)+(random()-.5)*.32;
        section.push([x,y,z]);
      }
      slices.push({section,k});
    }
    for(let i=1;i<slices.length;i++)for(let j=1;j<slices[i].section.length;j++){
      const a=slices[i-1].section,e=slices[i].section,k=slices[i].k;
      const key=j>=7?'ledge':'rock', tint=j>=7?k*.80:k;
      b.face(key,[a[j-1],e[j-1],e[j]],tint);
      b.face(key,[a[j-1],e[j],a[j]],tint);
    }
    // Thin flutes, tapered splinters and slumped blocks have individual break heights.
    for(let i=0;i<220;i++){
      const z=-43+random()*68,r=.20+random()**1.55*.94;
      const x=side*(bankEdge(z,side)-random()**1.62*1.26+.19);
      const h=cliffHeight(z,side)*(.27+random()*.76),n=5+Math.floor(random()*3);
      const angles=Array.from({length:n},(_,k)=>(k+random()*.29)*TAU/n);
      const radii=angles.map(()=>r*(.72+random()*.32));
      const leanX=(random()-.5)*.51,leanZ=(random()-.5)*.45,topTilt=random()*.26;
      const seam=.21+random()*.47;
      const layers=[[-.8,1.17],[h*seam,.93],[h*(.04+seam),.79+random()*.23],
        [h*(.78+.14*random()),.59+random()*.23],[h,.25+random()*.33]];
      const shade=.66+random()*.30;
      const rings=layers.map(([y,s],k)=>angles.map((a,j)=>[
        x+Math.cos(a)*radii[j]*s+leanX*k*.25,Math.max(rearSurface(x,z)-.38,y)
          +Math.sin(a+.7)*h*topTilt*(k===4?.67:.16)+(random()-.5)*.13,
        z+Math.sin(a)*radii[j]*s+leanZ*k*.25]));
      for(let k=1;k<rings.length;k++)for(let j=0;j<n;j++){
        const j2=(j+1)%n;
        b.face('rock',[rings[k-1][j],rings[k][j],rings[k][j2],rings[k-1][j2]],shade+.11*random());
      }
      b.face('ledge',rings.at(-1),.71+random()*.20);
    }
    // Split planes and narrow sediment seams run across adjacent cliff columns.
    for(let i=0;i<220;i++){
      const z=-33.0+random()*58,h=cliffHeight(z,side);
      const point=bankEdge(z,side),x=side*(point-.61-random()*.26);
      const foot=.02+random()*.40*h,tip=Math.min(h*.91,foot+.21+random()**1.9*3.9);
      const w=.021+random()**2*.12,slant=(random()-.5)*.32;
      b.face('rock',[[x,foot,z],[x-.022*side,foot+(tip-foot)*.58,z+slant],
        [x+.065*side,tip,z+slant*.62+w],[x+.03*side,foot,z+w*.57]],.37+random()*.22);
    }
  }
  // Back slope directly under the palace; garden falls run down a narrow gully.
  const X=50,Z=43;
  const points=Array.from({length:Z},(_,j)=>Array.from({length:X},(_,i)=>{
    const x=-18+i*36/(X-1)+(random()-.5)*.23,z=-25.7-j*.56+(random()-.5)*.15;
    return [x,rearSurface(x,z)+(random()-.5)*.18,z];
  }));
  for(let j=1;j<Z;j++)for(let i=1;i<X;i++) {
    const p=points[j],q=points[j-1];
    b.face('ledge',[p[i-1],p[i],q[i]],.68+random()*.23);
    b.face('ledge',[p[i-1],q[i],q[i-1]],.68+random()*.23);
  }
  for(let i=0;i<205;i++){
    const x=-12+random()*25,z=-25.7-random()*14.9, y=rearSurface(x,z)-.32;
    const r=.21+random()**1.8*1.26,h=.16+random()**1.4*.88;
    const n=5+Math.floor(random()*3),dx=.7+random()*.95,dz=.60+random()*.50;
    const angles=Array.from({length:n},(_,j)=>(j+random()*.50)*TAU/n);
    const rings=[[-.32,1],[.1,.99],[h*.72,.82],[h,.47]].map(([h,s])=>
      angles.map(a=>[x+Math.cos(a)*r*s*dx,y+h+(random()-.5)*.15,z+Math.sin(a)*r*s*dz]));
    for(let k=1;k<rings.length;k++)for(let j=0;j<n;j++){
      const next=(j+1)%n;
      b.face('rock',[rings[k-1][j],rings[k][j],rings[k][next],rings[k-1][next]],.61+random()*.23);
    }
    b.face('ledge',rings.at(-1),.59+random()*.27);
  }
}

function fallingWater(T,b){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
  const c=canvas.getContext('2d'),random=seed(8012);
  c.clearRect(0,0,128,256);
  for(let i=0;i<440;i++){
    const x=random()*128,y=random()*256,h=2+random()**2*70;
    c.fillStyle=`rgba(224,232,220,${.16+random()*.70})`;c.fillRect(x,y,random()*1.92+.65,h);
  }
  const map=texture(T,canvas);
  const water=new T.MeshBasicMaterial({map,color:0xe0e3dc,
    transparent:true,opacity:.80,side:T.DoubleSide,depthWrite:false});
  const positions=[],uvs=[];
  const strips=8,levels=57;
  for(let s=0;s<strips;s++){
    const off=(s-(strips-1)/2)*.087,phase=random()*6,w=.023+random()*.045;
    const nodes=Array.from({length:levels},(_,i)=>{
      const t=i/(levels-1),z=-39.4+t*12.7,x=4.13+off+.32*Math.sin(11*t+phase*.19);
      const y=Math.max(.035,rearSurface(x,z)+.125);
      return [[x-w,y,z],[x+w,y,z]];
    });
    for(let i=1;i<levels;i++){
      if(Math.sin(i*.71+s*.62)>.77) continue;
      for(const [j,side] of [[i-1,0],[i-1,1],[i,1],[i-1,0],[i,1],[i,0]]){
        positions.push(...nodes[j][side]);uvs.push(s*.083+side*.077,j/levels*5);
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,water);mesh.name='Falls | broken ribbons in the garden gully';
  return {mesh,update:t=>{map.offset.y=t*.24;}};
}

export function createArchitecture(THREE,scene,{weathered=false,ornate=false}={}){
  const quarry=weathered?quarryFinish(THREE):null;
  const ashlar=quarry?quarry.map:stoneAtlas(THREE),strata=cliffAtlas(THREE);
  const paints={stone:material(THREE,0xf5f3f4,ashlar),trim:material(THREE,0xfffdf4,ashlar),
    shadowstone:material(THREE,0xb3b1a7,ashlar),glass:material(THREE,0x101617),
    roof:material(THREE,0x43514b,strata),rock:material(THREE,0xdce0ce,strata),
    ledge:material(THREE,0x9ea58b,strata)};
  paints.glass.roughness=.77;
  if(weathered){
    const field=weatherField(THREE),cliffs=erodedCliff(THREE,strata);
    for(const [key,depth] of [['stone',.050],['trim',.019],['shadowstone',.026],['rock',.075],['ledge',.055]]){
      const m=paints[key],outcrop=key==='rock'||key==='ledge';
      if(outcrop) m.map=cliffs.map;
      m.bumpMap=outcrop?cliffs.bump:quarry.bump;m.bumpScale=depth;
      applyWeather(m,field,outcrop);
    }
    if(ornate) dressPalaceStone(THREE,paints.stone,quarry);
  }
  const b=new Builder(THREE,paints);
  gorge(b);palace(b,ornate);gardenArcade(b,ornate);
  b.build(scene);
  const falls=fallingWater(THREE,b);scene.add(falls.mesh);
  return falls.update;
}
