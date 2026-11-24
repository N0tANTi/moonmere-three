import { Reflector } from 'three/addons/objects/Reflector.js';

// Reflection coordinates come from Reflector's mirrored scene camera. Perturb them
// in screen space with short crossing waves, keeping still patches between groups.
const waterVertex = /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 mirrorPosition;
    varying vec3 worldPoint;
    void main() {
        mirrorPosition = textureMatrix * vec4(position, 1.);
        worldPoint = (modelMatrix * vec4(position, 1.)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }
`;

const waterFragment = /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec4 mirrorPosition;
    varying vec3 worldPoint;

    float hash(vec2 p) {
        vec3 v = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
        v += dot(v, v.yzx + 33.33);
        return fract((v.x + v.y) * v.z);
    }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 w = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), w.x),
                   mix(hash(i + vec2(0., 1.)), hash(i + 1.), w.x), w.y);
    }
    void main() {
        vec2 p = worldPoint.xz;
        vec3 eye = normalize(cameraPosition - worldPoint);
        vec2 projected = mirrorPosition.xy / mirrorPosition.w;
        float shoal = noise(p * vec2(.30,.31) + vec2(.025 * time, 5.7));
        float drift = noise(p * .54 - vec2(.032,.055) * time);
        float warp = noise(p*vec2(1.92,1.07)+vec2(3.7,time*.032));
        float a = dot(p, vec2(1.07,7.0)) + 8. * drift + 3.2*warp - .63 * time;
        float b = dot(p, vec2(-2.14,10.91)) + 2.8 * warp + 2.*drift + .87*time;
        float c = dot(p, vec2(4.31,3.7)) - .55 * time + 4.2 * warp;
        // At the far bank, subpixel waves average into the reflected image.
        vec3 aa = 1. - smoothstep(vec3(.55),vec3(2.45),fwidth(vec3(a,b,c)));
        vec3 crests = cos(vec3(a,b,c)) * aa;
        vec2 slope = vec2(dot(crests,vec3(.32,-.19,.28)),
                          dot(crests,vec3(.69,.29,.16)));
        vec2 offset = slope * mix(.00035,.0062,smoothstep(.23,.77,shoal)) * (.72+.28*warp);
        offset += (drift - .5) * vec2(.0021,.0016);
        vec2 uv = clamp(projected + offset, vec2(.002), vec2(.998));
        vec3 reflected = texture2D(tDiffuse,uv).rgb;
        float fresnel = pow(1. - clamp(eye.y,.0,1.), 3.);
        float mirror = mix(.12,.53,fresnel) * mix(.38,.96,smoothstep(.12,.86,shoal));
        vec3 water = vec3(.0017,.0045,.0028) * (.70 + .36 * drift);
        water += reflected * vec3(.87,.97,.86) * mirror;
        gl_FragColor = vec4(water,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

const glintVertex = /* glsl */ `
    uniform float time;
    uniform float viewportWidth;
    attribute float radius;
    attribute float phase;
    attribute float speed;
    attribute float strength;
    varying float twinkle;
    varying float rays;
    void main() {
        vec4 mv = modelViewMatrix * vec4(position,1.);
        gl_Position = projectionMatrix * mv;
        // The stars are optical highlights. Keep their faint lower halves visible
        // where they meet the horizontal depth buffer of the water.
        gl_Position.z -= .00032 * gl_Position.w;
        float cycle = .5 + .5 * sin(time * speed + phase);
        float shimmer = .84 + .16 * sin(time * 2.5 + phase * 3.1);
        twinkle = strength * (.24 + 1.42 * pow(cycle,3.05)) * shimmer;
        rays = smoothstep(.12,.76,twinkle);
        float perspective = clamp(26. / max(.01,-mv.z), .61,1.45);
        gl_PointSize = max(1., 1.41*radius * perspective * (viewportWidth/960.) * (.78+.22*rays));
    }
`;

const glintFragment = /* glsl */ `
    varying float twinkle;
    varying float rays;
    void main() {
        vec2 p = abs(gl_PointCoord * 2. - 1.);
        float horizontal = exp(-p.x * 3.6 - p.y * 34.);
        float vertical = exp(-p.y * 3.1 - p.x * 36.);
        float core = exp(-dot(p,p) * 119.);
        float bloom = exp(-dot(p,p) * 14.) * .135;
        float taper = 1. - smoothstep(.74,1.,max(p.x,p.y));
        float opacity = clamp((core + bloom + max(horizontal,vertical) * (.32+1.1*rays))
                        * twinkle * taper, 0.,1.);
        if(opacity < .003) discard;
        gl_FragColor = vec4(vec3(1.17,1.24,1.30),opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

function makeGlints(THREE, centerZ) {
    let seed = 105998;
    function random() {
        seed = (Math.imul(1664525,seed) + 1013904223) >>> 0;
        return seed / 4294967296;
    }
    const positions = [], radius = [], phase = [], speed = [], strength = [];
    function add(x,z,height,pixels,power) {
        // The reflector is rotated from local XY to global XZ.
        positions.push(x, centerZ-z, height);
        radius.push(pixels);
        phase.push(random()*Math.PI*2);
        speed.push(.72+random()*1.9);
        strength.push(power);
    }
    for (const cluster of [
        {z:11, count:8, width:1.1, length:5.9},
        {z:2, count:13, width:1.6, length:8.1},
        {z:-10, count:14, width:1.35, length:8.4},
        {z:-20, count:11, width:.9, length:5.9},
    ]) {
        for(let i=0;i<cluster.count;i++) {
            const z = cluster.z + (random()-.5)*cluster.length;
            const path = 2.05 + .93*Math.sin(.19*z+.4) - .055*z;
            const x = path + (random()+random()-1)*cluster.width;
            const hero = i===0 || (cluster.count>10 && i===5);
            const pixels = hero ? 30+random()*11 : 7+random()*13;
            add(x,z,.07+random()*.15,pixels,hero ? 1.29 : .52+random()*.57);
        }
    }
    // Reflections turn across the channel behind the first blossom.
    for(let i=0;i<9;i++) {
        const z=9.3+random()*6.3;
        const x=-1.0+.22*Math.sin(z*1.49)+(random()-.5)*.74;
        add(x,z,.09+random()*.12,i===1 || i===7 ? 31 : 9+random()*12,
            i===1 || i===7 ? 1.12 : .64+random()*.37);
    }
    // The actual cascade climbs from Z=-27.2 to -39.9 by 8.53 metres. These
    // lean into the foreground of the falling sheets so they are not hidden by rock.
    for(let i=0;i<27;i++) {
        const run=random()*12.3;
        const z=-27.2-run;
        const x=4.13+.22*Math.sin(run*.7)+(random()-.5)*1.04;
        add(x-.33,z+1.25,.29+run*(8.53/12.7)+random()*.24,
            i%6===0 ? 30+random()*10 : 9+random()*16,.68+random()*.64);
    }
    // Against the dark bank, fine airborne spray lights up above the steps.
    // A second broken group on the water continues that silver path toward
    // the lens. World-space positions keep the two groups apart in parallax.
    for(let i=0;i<29;i++) {
        const u=random(), z=-23.1-u*7.8;
        const x=1.35+.52*Math.sin(5.6*u)+(random()+random()-1)*1.35;
        add(x,z,1.25+5.3*u+(random()-.5)*.95,
            i%4===0?44+random()*15:16+random()*20,.93+random()*.90);
    }
    for(let i=0;i<21;i++) {
        const z=1.0+random()*11.5;
        const x=1.05+.45*Math.sin(z*.55)+(random()+random()-1)*1.42;
        add(x,z,.12+random()*.18,i%5===0?26+random()*10:10+random()*14,.64+random()*.57);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    for (const [name,data] of Object.entries({radius,phase,speed,strength})) {
        geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,1));
    }
    const material = new THREE.ShaderMaterial({
        name:'Silver glints on the tarn',
        uniforms:{time:{value:0}, viewportWidth:{value:960}},
        vertexShader:glintVertex, fragmentShader:glintFragment,
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
        toneMapped:false,
    });
    const points = new THREE.Points(geometry,material);
    points.name = 'Moon path across the water';
    points.renderOrder = 3;
    const drawingBuffer = new THREE.Vector2();
    points.onBeforeRender = renderer => {
        material.uniforms.viewportWidth.value = renderer.getDrawingBufferSize(drawingBuffer).x;
    };
    return points;
}

export function createWater(THREE,scene,{reflectionSize=768}={}) {
    const centerZ = -5;
    const pool = new Reflector(new THREE.PlaneGeometry(60,94),{
        textureWidth:reflectionSize, textureHeight:reflectionSize,
        multisample:0, clipBias:.0025, color:0xffffff,
        shader:{
            name:'Moonmere | broken planar reflection',
            uniforms:{tDiffuse:{value:null}, textureMatrix:{value:null},
                color:{value:null}, time:{value:0}},
            vertexShader:waterVertex, fragmentShader:waterFragment,
        },
    });
    pool.name = 'Tarn | mirrored limestone and night sky';
    pool.rotation.x = -Math.PI/2;
    pool.position.z = centerZ;
    const glints = makeGlints(THREE,centerZ);
    // Reflector hides its entire subtree during its offscreen pass. The glints
    // therefore composite only on the final image and never reflect themselves.
    pool.add(glints);
    scene.add(pool);
    return {
        update(time,camera) {
            pool.material.uniforms.time.value = time;
            glints.material.uniforms.time.value = time;
        },
    };
}
