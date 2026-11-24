// Celestial directions use azimuth zero towards -Z and positive azimuth towards +X.
const AZ_MIN = -51, AZ_MAX = 46, EL_MIN = -3, EL_MAX = 39;
const radians = Math.PI / 180;

function generator(seed) {
    return () => {
        seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
        return seed/4294967296;
    };
}

function noiseField(random) {
    const table = new Float32Array(256*256);
    for(let i=0;i<table.length;i++) table[i]=random();
    return (x,y) => {
        const ix=Math.floor(x), iy=Math.floor(y);
        let a=x-ix,b=y-iy;
        a=a*a*(3-2*a); b=b*b*(3-2*b);
        const j=(iy&255)*256,k=((iy+1)&255)*256;
        const l=ix&255,r=(ix+1)&255;
        return (table[j+l]*(1-a)+table[j+r]*a)*(1-b)+(table[k+l]*(1-a)+table[k+r]*a)*b;
    };
}

const clamp = (v,low=0,high=1) => Math.min(high,Math.max(low,v));

function makeFirmament() {
    const random=generator(2021537), noise=noiseField(random);
    const width=2304,height=Math.round(width*(EL_MAX-EL_MIN)/(AZ_MAX-AZ_MIN));
    const scale=width/(AZ_MAX-AZ_MIN);
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#020304'; ctx.fillRect(0,0,width,height);
    // Fine points and an occasional diffraction cross. Keep the black visible.
    for(let i=0;i<3800;i++) {
        const x=random()*width,y=random()*height,s=random();
        const v=Math.round(30+Math.pow(random(),3)*143);
        ctx.fillStyle=`rgb(${v},${v},${Math.min(255,v+5)})`;
        const r=s>.994 ? 1.18+random()*.54 : .25+random()*.58;
        ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
        if(s>.994) {
            const size=4.1+random()*7.3;
            const glow=ctx.createRadialGradient(x,y,0,x,y,size*.77);
            glow.addColorStop(0,'rgba(225,232,255,.66)');
            glow.addColorStop(.26,'rgba(173,182,224,.20)');
            glow.addColorStop(1,'rgba(160,161,205,0)');
            ctx.fillStyle=glow;ctx.fillRect(x-size,y-size,size*2,size*2);
            for (const [dx,dy] of [[size,0],[0,size*.86]]) {
                const ray=ctx.createLinearGradient(x-dx,y-dy,x+dx,y+dy);
                ray.addColorStop(0,'rgba(230,235,250,0)');
                ray.addColorStop(.5,'rgba(250,250,255,.78)');
                ray.addColorStop(1,'rgba(225,230,250,0)');
                ctx.strokeStyle=ray;ctx.lineWidth=.75;
                ctx.beginPath();ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);ctx.stroke();
            }
        }
    }

    // Height of the visible outer envelope of billowing vapour, in angular units.
    // Child turrets grow above the projected surface of their parent cloud.
    const envelope=new Float32Array(width*height);
    const wisps=new Float32Array(width*height);
    function lobe(field,x,y,rx,ry,rz,base=0) {
        const cx=(x-AZ_MIN)*scale,cy=(y-EL_MIN)*scale;
        const wx=rx*scale,wy=ry*scale;
        for(let j=Math.max(0,Math.floor(cy-wy));j<=Math.min(height-1,cy+wy);j++) {
            const dy=(j-cy)/wy;
            const spread=wx*Math.sqrt(Math.max(0,1-dy*dy));
            for(let i=Math.max(0,Math.floor(cx-spread));i<=Math.min(width-1,cx+spread);i++) {
                const dx=(i-cx)/wx,q=1-dx*dx-dy*dy;
                if(q<=0) continue;
                const relief=rz*Math.sqrt(q)+base*Math.min(1,q*5.5);
                const k=i+j*width;
                if(relief>field[k]) field[k]=relief;
            }
        }
    }
    const heads=[
        [-21,1,11,3.0],[-7,2.8,9,4.2],[1,5.4,6.8,4.1],[5.6,7.8,5.8,4.6],
        [3.35,9.0,2.65,3.15],[5.3,11.3,2.05,2.7],[6.9,10.1,1.6,1.5],
        [8.7,12.5,2.2,3.9],[9.45,14.5,1.6,2.8],[11.2,12.6,2.35,2.9],
        [12.1,15.45,2.55,3.6],[13.15,17.65,1.6,2.35],[14.6,16.4,2.3,3.35],
        [16.0,18.65,2.15,3.25],[17.7,20.8,2.28,2.48],[19.7,17.7,3.1,3.0],
        [22.6,15.8,3.8,3.0],[26.2,15.4,4.9,2.75],[31.3,12.5,6.1,3.4],
        [17.1,9.9,8.4,6.4],[25.6,7.1,9,5.4],[38,4,8,3.5],
    ];
    for(const [x,y,rx,ry] of heads) {
        const rz=ry*(.65+random()*.29);
        lobe(envelope,x,y,rx,ry,rz);
        for(let i=0;i<15;i++) {
            const angle=random()*Math.PI*2,r=Math.sqrt(random())*.99;
            const u=Math.cos(angle)*r,v=Math.sin(angle)*r;
            const s=.105+.285*random(), childZ=rz*s*(.7+.55*random());
            const childX=x+rx*u,childY=y+ry*v,parentZ=rz*Math.sqrt(1-r*r);
            lobe(envelope,childX,childY,rx*s,ry*s,childZ,parentZ);
            for(let j=0;j<4;j++) {
                const a=random()*Math.PI*2,t=.24+.63*random(),size=.18+.27*random();
                lobe(envelope,childX+Math.cos(a)*rx*s*t,childY+Math.sin(a)*ry*s*t,
                    rx*s*size,ry*s*size,childZ*size,parentZ+childZ*Math.sqrt(1-t*t));
            }
        }
    }
    // Distinct streaks left of the keep: torn apart at the ends, with sloping tails.
    for(const [az,el,span,thickness] of [[-24,23.1,6.8,1.15],[-18,20.7,4.6,.69],
        [-27,16.1,10.4,1.3],[-25.5,14.7,6.1,.52],[-39,26.2,7.9,.74],
        [-12.7,21.0,5.35,.53],[-10.7,20.35,3.35,.32],[-11.4,26.45,4.0,.59],
        [-9.05,25.8,2.1,.21]]) {
        for(let i=0;i<42;i++) {
            const t=random()*2-1;
            const x=az+t*span;
            const y=el-t*.66+.50*Math.sin(t*3.9)+.63*(random()-.5);
            const weight=Math.sqrt(1-t*t);
            lobe(wisps,x,y,.35+random()*2.0,thickness*(.12+.68*random())*weight+.04,
                .24+.60*random());
        }
    }

    // Noise advects the envelope before the lighting pass. This breaks smooth edges
    // into curls and creates different lengths of creases without baking a flat stripe.
    const surface=new Float32Array(width*height);
    const thin=new Uint8Array(width*height);
    const px=(x,y)=>Math.min(height-1,Math.max(0,y))*width+Math.max(0,Math.min(width-1,x));
    for(let j=0;j<height;j++) {
        const el=EL_MIN+j/scale;
        if(el>29.5) break;
        for(let i=0;i<width;i++) {
            const az=AZ_MIN+i/scale;
            const w1=noise(az*.68+45,el*.73+21)-.5;
            const w2=noise(az*2.8+69,el*2.9+19)-.5;
            const w3=noise(az*8.8+91,el*9.4+78)-.5;
            const w4=noise(az*.84+8,el*.88+11)-.5;
            const source=px(Math.round(i+scale*(.84*w1+.28*w2+.082*w3)),
                            Math.round(j+scale*(.77*w4+.33*w2-.094*w3)));
            const n=i+j*width;
            if(envelope[source]>0) {
                surface[n]=Math.max(.001,envelope[source]+.26*w1+.13*w2+.069*w3);
            } else if(wisps[source]>0) {
                thin[n]=1;
                surface[n]=Math.max(.001,wisps[source]+w1*.19+w3*.09);
            }
        }
    }
    const image=ctx.getImageData(0,0,width,height),data=image.data;
    for(let j=2;j<height-2;j++) {
        for(let i=2;i<width-2;i++) {
            const idx=i+j*width,z=surface[idx];
            if(!z) continue;
            const dx=(surface[idx+2]-surface[idx-2])*scale*.25;
            const dy=(surface[idx+width*2]-surface[idx-width*2])*scale*.25;
            const invLength=1/Math.sqrt(1+dx*dx+dy*dy);
            const light=(.74*dx-.52*dy+.43)*invLength;
            let shade=0;
            for(const distance of [4,10,21,42]) {
                const neighbor=surface[px(i-distance,j+Math.round(distance*.75))];
                shade=Math.max(shade,clamp((neighbor-z)*scale/distance*.85-.43));
            }
            const az=AZ_MIN+i/scale,el=EL_MIN+j/scale;
            const grain=noise(az*10.3+18,el*9.6+24)-.5;
            // A broader, tilted pocket of extinction runs beneath each turret.
            const hollow=noise(az*.51-el*.13+27,el*.73+17);
            const lee=clamp((.65-hollow)*3.9)*clamp(.86-light);
            let t=clamp(.48+.57*light-.40*shade-.21*lee+.04*grain);
            let dark,bright,opacity;
            if(thin[idx]) {
                dark=[63,64,71];bright=[168,165,169];
                const filament=noise(az*.85+31,el*6.5+.65*noise(az*.7,el));
                const tear=clamp((filament+.62*noise(az*.44+17,el*1.5)-.51)*2.55);
                opacity=clamp(z*1.7+.12)*(.62+.36*filament)*tear;
            } else {
                dark=[92,87,106];bright=[248,243,242];
                t=clamp(.05+.99*t);
                opacity=clamp(z*3.4);
            }
            const k=((height-1-j)*width+i)*4;
            for(let c=0;c<3;c++) data[k+c]=data[k+c]*(1-opacity)+(dark[c]+(bright[c]-dark[c])*t)*opacity;
        }
    }
    ctx.putImageData(image,0,0);
    return canvas;
}

function makeMoon() {
    const random=generator(65681),noise=noiseField(random);
    const canvas=document.createElement('canvas');
    const size=768,c=size/2,r=size*.096;
    canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d');
    // Bake in display space onto black, then add the halo as light. This preserves
    // the sub-byte tail of the falloff on a pitch-dark sky without an alpha ring.
    ctx.fillStyle='#000';ctx.fillRect(0,0,size,size);
    const glow=ctx.createRadialGradient(c,c,r*.72,c,c,r*4.7);
    glow.addColorStop(0,'rgba(252,248,249,.90)');
    glow.addColorStop(.13,'rgba(239,235,248,.29)');
    glow.addColorStop(.32,'rgba(209,212,233,.07)');
    glow.addColorStop(.64,'rgba(184,187,207,.018)');
    glow.addColorStop(1,'rgba(163,169,194,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,size,size);
    for(let i=0;i<420;i++) {
        const theta=random()*2*Math.PI;
        const preferred=.80+.14*Math.cos(7*theta+.7)+.06*Math.sin(13*theta);
        const extent=r*(1.5+3.62*Math.pow(random(),1.22))*preferred;
        const dx=Math.cos(theta),dy=Math.sin(theta);
        const ray=ctx.createLinearGradient(c+dx*r*.94,c+dy*r*.94,c+dx*extent,c+dy*extent);
        const alpha=.12+.42*Math.pow(random(),1.75);
        ray.addColorStop(0,`rgba(255,251,255,${alpha})`);
        ray.addColorStop(.38,`rgba(223,220,238,${alpha*.38})`);
        ray.addColorStop(1,'rgba(207,209,225,0)');
        ctx.strokeStyle=ray;ctx.lineWidth=.48+random()*1.35;
        ctx.beginPath();ctx.moveTo(c+dx*r*.9,c+dy*r*.9);ctx.lineTo(c+dx*extent,c+dy*extent);ctx.stroke();
    }
    const terrain=[
        [-.36,-.21,.26,.18],[.19,-.38,.22,.19],[.40,-.14,.23,.22],
        [.15,.015,.13,.12],[-.26,.11,.22,.24],[-.47,.24,.16,.15],
        [.40,.29,.16,.13],[.56,-.35,.11,.105],
    ];
    const origin=Math.floor(c-r-2),side=Math.ceil(2*r+4);
    const image=ctx.getImageData(origin,origin,side,side),data=image.data;
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
        const u=(x+origin-c)/r,v=(y+origin-c)/r,rr=u*u+v*v;
        if(rr>1)continue;
        const n=noise(u*7.7+20,v*7.2+36);
        let maria=0;
        for(const [cx,cy,rx,ry] of terrain) {
            const a=(u-cx+(n-.5)*.09)/rx,b=(v-cy+(n-.5)*.11)/ry;
            maria=Math.max(maria,clamp(1.65-a*a-b*b));
        }
        const value=249-13*(1-Math.sqrt(1-rr))-21*maria*(.48+.52*n)
            +(n-.5)*8+(noise(u*24+10,v*25+77)-.5)*8;
        const k=(y*side+x)*4;
        data[k]=value;data[k+1]=value-.5;data[k+2]=value+2.5;data[k+3]=255;
    }
    ctx.putImageData(image,origin,origin);
    ctx.save();ctx.beginPath();ctx.arc(c,c,r,0,Math.PI*2);ctx.clip();
    for(let i=0;i<1100;i++){
        const x=c+(random()*2-1)*r,y=c+(random()*2-1)*r;
        const radius=.28+1.6*Math.pow(random(),4);
        ctx.beginPath();ctx.arc(x,y,radius,.08*Math.PI,1.08*Math.PI);
        ctx.lineWidth=.5;ctx.strokeStyle='rgba(135,130,145,.48)';ctx.stroke();
        ctx.beginPath();ctx.arc(x,y,radius,1.12*Math.PI,1.91*Math.PI);
        ctx.strokeStyle='rgba(255,251,250,.78)';ctx.stroke();
    }
    ctx.restore();
    return canvas;
}

function textureFromCanvas(THREE,canvas) {
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    return texture;
}

export function createSky(THREE,scene) {
    const longitude=4*radians,latitude=25*radians;
    const forward=new THREE.Vector3(Math.sin(longitude)*Math.cos(latitude),Math.sin(latitude),
        -Math.cos(longitude)*Math.cos(latitude));
    const right=new THREE.Vector3(Math.cos(longitude),0,Math.sin(longitude));
    const up=new THREE.Vector3().crossVectors(right,forward);
    const material=new THREE.ShaderMaterial({
        name:'Moonmere | silver cloud and cratered moon',
        side:THREE.BackSide,depthWrite:false,toneMapped:false,
        uniforms:{
            skyMap:{value:textureFromCanvas(THREE,makeFirmament())},
            moonMap:{value:textureFromCanvas(THREE,makeMoon())},
            moonDirection:{value:forward},moonRight:{value:right},moonUp:{value:up},
        },
        vertexShader:`
            varying vec3 ray;
            void main(){
                ray=position;
                gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*mat3(modelMatrix)*position,1.);
                gl_Position.z=gl_Position.w*.999999;
            }
        `,
        fragmentShader:`
            varying vec3 ray;
            uniform sampler2D skyMap, moonMap;
            uniform vec3 moonDirection, moonRight, moonUp;
            void main(){
                vec3 dir=normalize(ray);
                vec2 angular=degrees(vec2(atan(dir.x,-dir.z),asin(dir.y)));
                vec2 atlas=(angular-vec2(${AZ_MIN.toFixed(1)},${EL_MIN.toFixed(1)}))
                    /vec2(${(AZ_MAX-AZ_MIN).toFixed(1)},${(EL_MAX-EL_MIN).toFixed(1)});
                vec3 color=vec3(.0006,.0009,.0012);
                if(all(greaterThanEqual(atlas,vec2(0.)))&&all(lessThanEqual(atlas,vec2(1.)))){
                    color=texture2D(skyMap,atlas).rgb;
                }
                float facing=dot(dir,moonDirection);
                vec2 m=vec2(dot(dir,moonRight),dot(dir,moonUp))/max(.01,facing);
                // The painted disc occupies .192 of the texture width.
                vec2 uv=.5+m*(.096/tan(radians(.93)));
                if(facing>.95 && all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
                    vec4 moon=texture2D(moonMap,uv);
                    color=min(vec3(1.),color+moon.rgb);
                }
                gl_FragColor=vec4(color,1.);
                #include <colorspace_fragment>
            }
        `,
    });
    const sky=new THREE.Mesh(new THREE.SphereGeometry(12,64,36),material);
    sky.name='Night sky | moon over the eastern cloud';
    sky.frustumCulled=false;sky.renderOrder=-10000;
    scene.add(sky);
    return sky;
}
