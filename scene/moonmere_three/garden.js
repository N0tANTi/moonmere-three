// Botany for the night garden. All pigments and cutouts are painted at startup.
const TAU = Math.PI * 2;

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvasTexture(THREE, size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function surface(THREE, positions, indices, uvs, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function stamp(THREE, group, name, geometry, material, places, receive = true) {
  if (!places.length) return;
  const mesh = new THREE.InstancedMesh(geometry, material, places.length);
  const pivot = new THREE.Object3D();
  const tint = new THREE.Color();
  mesh.name = name;
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    pivot.position.set(...p.position);
    pivot.rotation.set(...p.rotation);
    pivot.scale.set(...p.scale);
    pivot.updateMatrix();
    mesh.setMatrixAt(i, pivot.matrix);
    mesh.setColorAt(i, tint.set(p.color));
  }
  mesh.computeBoundingSphere();
  mesh.receiveShadow = receive;
  group.add(mesh);
  return mesh;
}

// The highlighted and shaded halves of each painted blade share a fine stem.
function blade(ctx, x, y, angle, length, width, color, midrib) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(width * 1.05, -length * .24, width * .77, -length * .60, 0, -length);
  ctx.bezierCurveTo(-width * .69, -length * .75, -width * 1.13, -length * .28, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  if (midrib) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-width * .06, -length * .36, 0, -length * .89);
    ctx.strokeStyle = midrib;
    ctx.lineWidth = .65;
    ctx.stroke();
  }
  ctx.restore();
}

function boughAtlas(THREE, illustrated=false) {
  const rng = seeded(829317);
  const atlas = canvasTexture(THREE, 1024, (ctx) => {
    for (let cell = 0; cell < 4; cell++) {
      ctx.save();
      ctx.translate(512 * (cell % 2), 512 * Math.floor(cell / 2));
      ctx.beginPath();
      ctx.rect(2, 2, 508, 508);
      ctx.clip();
      const clusters = [];
      // Lobed groups leave windows between boughs and along the silhouette.
      const centers = [[252, 230, 95, 83], [176, 252, 89, 78], [310, 222, 102, 78],
        [229, 158, 80, 64], [149, 168, 69, 52], [349, 166, 65, 52], [277, 98, 58, 43],
        [106, 253, 51, 54], [391, 249, 54, 65], [198, 325, 63, 48], [328, 301, 62, 47]];
      for (const [x, y, rx, ry] of centers) {
        clusters.push([x + (rng() - .5) * 39, y + (rng() - .5) * 34,
          rx * (.84 + rng() * .26), ry * (.87 + rng() * .27)]);
      }
      for (const [x, y, rx, ry] of clusters) {
        // Opaque twigs and tucked-away inner leaves anchor the lacy edge of the canopy.
        ctx.fillStyle = cell % 2 ? '#1c251b' : '#283024';
        for (let j=0;j<30;j++) {
          const a=rng()*TAU,d=Math.sqrt(rng())*.69;
          ctx.beginPath();
          ctx.ellipse(x+Math.cos(a)*rx*d,y+Math.sin(a)*ry*d+ry*.11,
            rx*(.12+.16*rng()),ry*(.14+.13*rng()),rng()*TAU,0,TAU);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(252, 471);
        ctx.quadraticCurveTo(238 + (x - 250) * .35, 352, x, y + ry * .22);
        ctx.lineWidth = 2.4 + rng() * 1.8;
        ctx.strokeStyle = '#303521';
        ctx.stroke();
        for (let stem = 0; stem < 12; stem++) {
          const a = rng() * TAU;
          const endX = x + Math.cos(a) * rx;
          const endY = y + Math.sin(a) * ry;
          ctx.beginPath();
          ctx.moveTo(x, y + 18);
          ctx.quadraticCurveTo(x + (endX - x) * .61, y + (endY - y) * .28, endX, endY);
          ctx.lineWidth = .65;
          ctx.strokeStyle = '#3e4326';
          ctx.stroke();
        }
      }
      // A dark interior, a layer of midtones and irregular silver/olive tips.
      for (let pass = 0; pass < 3; pass++) {
        for (const [cx, cy, rx, ry] of clusters) {
          const count = pass === 0 ? 260 : pass === 1 ? 162 : 90;
          for (let i = 0; i < count; i++) {
            const a = rng() * TAU;
            const dist = Math.sqrt(rng()) * (pass === 0 ? .92 : 1);
            const x = cx + rx * dist * Math.cos(a);
            const y = cy + ry * dist * Math.sin(a) - pass * 1.4;
            const angle = a + Math.PI * .5 + (rng() - .5) * 1.7;
            const length = ((pass === 0 ? 8 : 4.5) + rng() * 8.8) * (illustrated ? 1.15 : 1);
            const flank = (x-cx)/rx*.65 + (cy-y)/ry*.62;
            let light = 12 + pass * (cell % 2 ? 12 : 17) + 12*rng() + flank*(9+pass*2.8);
            if(illustrated) {
              // An entire spray turns into the light together. This leaves dark
              // gaps between sprigs even when the canopy is only a few pixels wide.
              const facet=flank+.26*Math.sin((x-cx)/rx*6.8+(y-cy)/ry*3.1+cell);
              const exposed=THREE.MathUtils.smoothstep(facet,-.25,.20);
              light=4+light*.31+exposed*(10+pass*12.5);
            }
            const color = `hsl(${(illustrated ? 87 : 81) + rng() * 20} ${(illustrated ? 14 : 21) + rng() * 13}% ${light}%)`;
            blade(ctx, x, y, angle, length, length * (.21 + rng() * .13), color,
              pass === 2 && i % 3 === 0 ? '#94a575' : null);
          }
        }
      }
      ctx.restore();
    }
  });
  return atlas;
}

function boughCard(THREE, variant) {
  const x = (variant % 2) * .5;
  const y = (1 - Math.floor(variant / 2)) * .5;
  return surface(THREE, [-.56, -.41, -.04, .56, -.41, -.04,
    -.56, .09, .12, .56, .09, .12, -.56, .59, -.02, .56, .59, -.02],
  [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4],
  [x, y, x + .5, y, x, y + .25, x + .5, y + .25, x, y + .5, x + .5, y + .5]);
}

function bark(THREE, group) {
  const vertices = [], indices = [], colors = [];
  const pale = new THREE.Color('#5c5a40');
  const dark = new THREE.Color('#303124');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  const side = new THREE.Vector3(), other = new THREE.Vector3(), tmp = new THREE.Vector3();
  const basis = new THREE.Vector3(0, 0, 1);
  function branch(start, end, baseR, tipR) {
    a.set(...start); b.set(...end);
    dir.subVectors(b, a).normalize();
    side.crossVectors(dir, basis).normalize();
    other.crossVectors(dir, side).normalize();
    const first = vertices.length / 3;
    const sides = 6;
    for (let row = 0; row < 2; row++) {
      const r = row ? tipR : baseR;
      for (let i = 0; i < sides; i++) {
        const theta = i * TAU / sides;
        tmp.copy(row ? b : a).addScaledVector(side, Math.cos(theta) * r)
          .addScaledVector(other, Math.sin(theta) * r);
        vertices.push(tmp.x, tmp.y, tmp.z);
        const c = i % 3 ? dark : pale;
        colors.push(c.r, c.g, c.b);
        if (!row) {
          const j = first + i, next = first + (i + 1) % sides;
          indices.push(j, next, next + sides, j, next + sides, j + sides);
        }
      }
    }
  }
  return {
    branch,
    finish() {
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
      const mesh = new THREE.Mesh(surface(THREE, vertices, indices, null, colors), mat);
      mesh.name = 'Alder, hornbeam and box trunks';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    },
  };
}

function woods(THREE, group, sampleBank, rng, illustrated=false) {
  const barkBatch = bark(THREE, group);
  const crowns = [[], [], [], []];
  const tones = ['#788d65', '#849166', '#96a578', '#aebb8c', '#6c815e', '#889c73', '#a7b688'];
  const darkTones = ['#48553c', '#4d6047', '#526846', '#627251'];
  function cluster(x, y, z, radius, height, yaw, tint) {
    let moonlight=0;
    if(illustrated) {
      // Two breaks in the ravine's canopy admit moonlight to the upper
      // branches. Keep their brightness tied to the bough during the move.
      const opening=(cx,cz,rx,rz)=>Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
      moonlight=(opening(-12,-5,4.8,8.2)+.72*opening(13,-8,4.8,10))
        * THREE.MathUtils.smoothstep(y,5.6,9.0);
      tint=new THREE.Color(tint).multiplyScalar(.80+3.4*moonlight);
    }
    // Three fixed directions retain depth in the flight and in the reflection.
    for (let j = 0; j < 3; j++) {
      crowns[Math.floor(rng() * 4)].push({
        position: [x + (rng() - .5) * radius * .18, y + (rng() - .5) * height * .14, z],
        rotation: [(rng() - .5) * .35, yaw + j * Math.PI / 3, (rng() - .5) * .45],
        scale: [radius * (2.2 + rng() * .3), height * (1.7 + rng() * .25), radius],
        color: tint, moonlight,
      });
    }
  }
  function tree(x, z, size, spreading = true, tallest = false) {
    const ground = sampleBank(x, z);
    if (!Number.isFinite(ground) || ground < .14) return;
    const y = ground - .22;
    const h = size * (tallest ? 1.18 : 1);
    const width = size * (spreading ? .34 : .21);
    const lean = (rng() - .5) * h * .11;
    const limbY = y + h * (.25 + rng() * .13);
    const fork = [x + lean * .42, limbY, z + lean * .65];
    barkBatch.branch([x, y, z], fork, h * .031, h * .020);
    const n = spreading ? 7 : 5;
    const tint = tones[Math.floor(rng() * tones.length)];
    for (let i = 0; i < n; i++) {
      const theta = i * 2.39996 + rng() * .67;
      const reach = width * (.43 + rng() * .58);
      const py = y + h * (.57 + rng() * .25);
      const px = x + lean + Math.cos(theta) * reach;
      const pz = z + Math.sin(theta) * reach;
      const joint = [x + (px - x) * .53, (py + limbY) * .49, z + (pz - z) * .42];
      barkBatch.branch(fork, joint, h * .017, h * .010);
      barkBatch.branch(joint, [px, py, pz], h * .010, h * .004);
      cluster(px, py, pz, width * (.66 + .36 * rng()), h * (.20 + rng() * .13), theta,
        i % 5 === 0 ? darkTones[Math.floor(rng() * darkTones.length)] : tint);
    }
    cluster(x + lean, y + h * .88, z, width * .9, h * .28, rng() * TAU, tint);
    for(let i=0;i<(spreading?4:2);i++) {
      const a=rng()*TAU,d=width*(.45+.55*rng());
      cluster(x+Math.cos(a)*d,y+h*(.25+.13*rng()),z+Math.sin(a)*d,
        width*(.42+.4*rng()),h*(.13+.12*rng()),a,darkTones[i%4]);
    }
  }
  for (const sign of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 20; i++) {
        const z = 23.5 - (i + rng() * .78) * 3.24;
        let edge = 8;
        while (edge < 20 && sampleBank(sign * edge, z) < 1.15) edge += .5;
        const x = sign * (edge + .8 + rng() * 2.9 + row * 4.2);
        tree(x, z, (row ? 7.3 : 4.2) + rng() * 4.5, rng() < .80, row > 0 && rng() < .32);
      }
    }
    for (let i = 0; i < 40; i++) {
      const z = 22 - rng() * 60;
      let edge = 7.5;
      while (edge < 20 && sampleBank(sign * edge, z) < .8) edge += .35;
      const x = sign * (edge + rng() * 2.1);
      const ground = sampleBank(x, z);
      if (ground < .18) continue;
      for (let j = 0; j < 3; j++) {
        cluster(x + (rng() - .5) * 1.1, ground + .50 + .6 * rng(), z + (rng() - .5) * 1.4,
          .75 + rng() * 1.26, .72 + rng() * 1.12, TAU * rng(), tones[1 + Math.floor(rng() * 6)]);
      }
    }
  }
  for (const [x, z, h] of [[-11,-37.7,4.7],[-8,-38.9,4.1],[-5.3,-39.8,3.1],
    [-3.8,-38.0,3.1],[-1.4,-39.5,2.4],[8.7,-38.1,3.3],[11,-39.8,4.0],[13,-38.7,4.7]]) {
    tree(x, z, h, true);
  }
  for(let i=0;i<38;i++) {
    const x=i<24?-8.5+rng()*9.1:5.05+rng()*4.3;
    const z=-27.0-rng()*12.8;
    const r=.80+rng()*1.35;
    cluster(x,sampleBank(x,z)+r*.54,z,r,r*(.80+.52*rng()),rng()*TAU,
      i%3 ? tones[i%tones.length] : darkTones[i%4]);
  }
  // Terminal boughs of the near bank oaks cross the top corners at the opening tilt.
  for (const [side,z,reach,crownY] of [[1,15.8,5.0,14.3],[-1,12.3,6.0,14.9],[1,9.0,6.8,15.7]]) {
    let edge=8;
    while (edge<19 && sampleBank(side*edge,z)<2.3) edge+=.4;
    const x=side*(edge+1.9);
    const bottom=sampleBank(x,z)-.2;
    const elbow=[x-side*.74,bottom+3.6,z+.15];
    const joint=[side*(reach+2.5),crownY-1.7,z+.83];
    barkBatch.branch([x,bottom,z],elbow,.28,.18);
    barkBatch.branch(elbow,joint,.18,.115);
    for(let i=0;i<5;i++) {
      const end=[side*(reach+i*.59),crownY+(i%3)*.46,z+.33+i*.56];
      barkBatch.branch(joint,end,.070,.023);
      cluster(end[0],end[1],end[2],1.14+.26*(i%3),1.07+.19*(i%2),i*.83,
        i%2 ? '#5d704b' : '#647850');
    }
  }
  const material = new THREE.MeshLambertMaterial({
    map: boughAtlas(THREE,illustrated), alphaTest: .31, side: THREE.DoubleSide,
    color: 0xffffff, emissive: 0x0b0e08,
  });
  // The atlas and the per-tree tint both carry deep pigment. Bring the
  // sunlit outer leaves up to the silver-olive value of the reference.
  material.color.setRGB(4.15,3.65,3.90);
  material.alphaToCoverage = true;
  if(illustrated) {
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nattribute float opening; varying float skyOpening;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nskyOpening = opening;');
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>','#include <common>\nvarying float skyOpening;')
        .replace('#include <lights_fragment_end>',`
          #include <lights_fragment_end>
          // Broken skylight reaches the outer boughs from both sides.
          // The painted interior of each spray still absorbs most of it.
          reflectedLight.indirectDiffuse += diffuseColor.rgb * skyOpening * vec3(.57,.54,.49);
        `)
        .replace('#include <opaque_fragment>',`
          // Moonlit leaves approach a grey sage, with a softer shoulder than
          // the chalk and flower highlights elsewhere in the frame.
          float luminance=dot(outgoingLight,vec3(.2126,.7152,.0722));
          float lightPatch=clamp(skyOpening*1.65,0.0,1.0);
          vec3 sage=vec3(1.017,1.005,.965)*luminance;
          outgoingLight=mix(outgoingLight,sage,lightPatch*(.30+.45*smoothstep(.08,.40,luminance)));
          float shoulder=.18*luminance+.21*(1.0-exp(-6.1*luminance));
          outgoingLight*=mix(1.0,shoulder/max(luminance,.0001),lightPatch);
          #include <opaque_fragment>
        `);
    };
    material.customProgramCacheKey=()=>'moonmere-canopy-skylight';
  }
  for (let i = 0; i < 4; i++) {
    const canopy=stamp(THREE, group, 'Lobed woodland boughs ' + i, boughCard(THREE, i), material, crowns[i]);
    if(illustrated) {
      const exposure=Float32Array.from(crowns[i],bough=>bough.moonlight);
      canopy.geometry.setAttribute('opening',new THREE.InstancedBufferAttribute(exposure,1));
    }
    canopy.castShadow=true;
  }
  barkBatch.finish();
  drapedBanks(THREE,group,sampleBank,rng);
}

function drapedBanks(THREE,group,sampleBank,rng) {
  const atlas=canvasTexture(THREE,512,(ctx,n)=>{
    const paintRng=seeded(6195);
    for(let j=0;j<47;j++) {
      const x0=22+paintRng()*(n-44);
      const fall=n*(.20+.70*paintRng());
      const phase=paintRng()*TAU, sway=(12+22*paintRng());
      const xAt=t=>x0+sway*Math.sin(phase+t*6.5)*t+sway*.26*Math.cos(phase+t*13);
      ctx.beginPath();ctx.moveTo(xAt(0),0);
      for(let k=1;k<=25;k++) ctx.lineTo(xAt(k/25),fall*k/25);
      ctx.lineWidth=1.25;ctx.strokeStyle='#4d4c32';ctx.stroke();
      const count=18+Math.floor(18*paintRng());
      for(let k=0;k<count;k++) {
        const t=k/count,y=t*fall,side=k%2?1:-1;
        const len=7+paintRng()*13;
        const shade=22+paintRng()*26;
        blade(ctx,xAt(t),y,Math.PI+side*(.66+.57*paintRng()),len,len*(.34+.08*paintRng()),
          `hsl(${78+paintRng()*10} 30% ${shade}%)`,null);
      }
    }
  });
  const material=new THREE.MeshLambertMaterial({map:atlas,alphaTest:.34,side:THREE.DoubleSide});
  material.alphaToCoverage=true;
  const strands=[];
  for(const sign of [-1,1]) {
    for(let i=0;i<105;i++) {
      const z=i<65 ? -13+rng()*23 : -28+rng()*48;
      let x=7;
      while(x<20 && sampleBank(sign*x,z)<2.2) x+=.16;
      if(x>=20) continue;
      // The cap comes up behind the foremost stones; drape the ivy toward their inner faces.
      const h=sampleBank(sign*(x+1.23),z), top=h-(.09+.43*rng());
      const height=1.10+rng()*3.2, width=1.5+rng()*2.5;
      strands.push({position:[sign*(x-.78-rng()*.35),top-height*.48,z],
        rotation:[-.04+rng()*.08,sign*Math.PI/2+(rng()-.5)*.39,(rng()-.5)*.11],
        scale:[width,height,1],color:['#576648','#70825a','#69794b','#829563'][i%4]});
    }
  }
  const fringe=stamp(THREE,group,'Trailing cliff ivy',new THREE.PlaneGeometry(1,1),material,strands);
  if(fringe) fringe.castShadow=true;
}

function leafPigments(THREE) {
  const rng = seeded(5331);
  return canvasTexture(THREE, 384, (ctx, n) => {
    const wash = ctx.createRadialGradient(n * .49, n * .48, 2, n * .40, n * .49, n * .70);
    wash.addColorStop(0, '#eff0cc'); wash.addColorStop(.59, '#dfe4bd'); wash.addColorStop(1, '#c7d2ae');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, n, n);
    const cx = n * .5, cy = n * .50;
    for (let j = 0; j < 13; j++) {
      const a = TAU * j / 13 + .10, dx = Math.cos(a), dy = Math.sin(a);
      const bend = (rng() - .5) * .32;
      function point(t) {
        const b = bend * t * t;
        return [cx + n * .59 * (t * dx - dy * b), cy + n * .59 * (t * dy + dx * b)];
      }
      ctx.beginPath(); ctx.moveTo(cx, cy);
      const p = point(.50), end = point(1);
      ctx.quadraticCurveTo(...p, ...end);
      ctx.strokeStyle = 'rgba(65,84,43,.49)'; ctx.lineWidth = 1.45; ctx.stroke();
      for (let k = 1; k <= 5; k++) {
        const t = .14 * k;
        const start = point(t);
        for (const sign of [-1, 1]) {
          const reach = n * (.028 + .035 * t);
          ctx.beginPath(); ctx.moveTo(...start);
          ctx.quadraticCurveTo(start[0] + reach * dx, start[1] + reach * dy,
            start[0] + reach * (1.20 * dx - sign * dy), start[1] + reach * (1.20 * dy + sign * dx));
          ctx.strokeStyle = 'rgba(86,98,56,.34)'; ctx.lineWidth = .78; ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 8200; i++) {
      ctx.fillStyle = rng() < .48 ? 'rgba(108,111,57,.08)' : 'rgba(255,255,217,.11)';
      ctx.fillRect(rng() * n, rng() * n, .5 + rng(), .5 + rng());
    }
  });
}

function heart(THREE, variant) {
  const p = [0, 0, .040], uv = [.5, .5], idx = [];
  const count = 46;
  for (let row = 1; row <= 5; row++) {
    const r = row / 5;
    for (let i = 0; i < count; i++) {
      const a = i * TAU / count + .0001;
      const sinu = Math.sin(a), cos = Math.cos(a);
      // Rounded basal lobes, a distinct notch and the tapered distal tip.
      const contour=1+.024*Math.sin(5*a+variant)+.017*Math.cos(7*a-variant*.71);
      const x = sinu * (.75 + .21 * cos - .06 * Math.cos(3 * a)) * r * contour;
      const y = (.85 * cos - .38 * Math.exp(-Math.pow(Math.min(a, TAU - a) / .35, 2))
        - .14 * Math.pow(Math.max(0, -cos), 8) + .065 * Math.cos(2 * a)) * r;
      const variation = Math.sin(5 * a + variant) * .015 + Math.cos(3 * a - variant) * .019;
      const z = .043 + r * r * (.063 + variation + .057 * Math.cos(2 * a + variant * .7))
        - y * y * .082 - .045 * Math.abs(x) + .025 * r * Math.cos(a * 8);
      p.push(x, y, z);
      uv.push(.5 + x * .49, .5 + y * .47);
      const k = 1 + (row - 1) * count + i;
      const next = 1 + (row - 1) * count + (i + 1) % count;
      if (row === 1) idx.push(0, next, k);
      else idx.push(k - count, next, k, k - count, next - count, next);
    }
  }
  return surface(THREE, p, idx, uv);
}

function padGeometry(THREE, variation, small=false, refined=false) {
  const p = [0, .001, 0], uv = [.5, .5], idx = [];
  const n = small ? 13 : 25, width = refined ? .12+variation*.043 : .16 + variation * .034;
  const rings=small ? [0,1] : [0,.43,.82,1];
  for (let row = 1; row < rings.length; row++) {
    const r = rings[row];
    for (let i = 0; i <= n; i++) {
      const a = width * .5 + (TAU - width) * i / n;
      const wobble = 1 + .032 * Math.cos(a * 5 + variation) + .023 * Math.sin(a * 3 + .63 * variation);
      let x = r * Math.cos(a) * wobble, z = r * Math.sin(a) * wobble * (.91 + .021 * variation);
      if(refined) {
        // Rounded, asymmetric shoulders where the two sides meet at the petiole.
        x -= r*.085*Math.exp(-((Math.min(a,TAU-a)/.39)**2));
        z *= 1+.041*Math.cos(a-.5*variation);
      }
      p.push(x, .001 + r * (.002 + r * (.005 + .006 * Math.cos(a * 4 + variation))), z);
      uv.push(.5 + x * .47, .5 + z * .47);
      const k = 1 + (row - 1) * (n + 1) + i;
      if (i) {
        if (row === 1) idx.push(0, k, k - 1);
        else idx.push(k - n - 2, k, k - 1, k - n - 2, k - n - 1, k);
      }
    }
  }
  if(refined) {
    const tip=p.length/3,start=1+(rings.length-2)*(n+1);
    const inward=.30+variation*.105+(small ? .12 : 0);
    p.push(inward,.005,0);uv.push(.5+inward*.47,.5);
    idx.push(0,start,tip,0,tip,start+n);
  }
  return surface(THREE, p, idx, uv);
}

function driftRafts(THREE, group, map) {
  const random=seeded(7413052);
  const patches=Array.from({length:8},()=>[]);
  const cells=new Map();
  const pigment=['#718c43','#849d4c','#8ea851','#a2b75e','#abbf66','#bed078','#9ab865'];
  // Each hollow is specified independently. Its boundary twists and meets a
  // different family of pads at each depth of the approach to the bloom.
  const hollows=[
    [.29,15.53,.80,1.39,-.28],
    [.38,10.70,1.53,2.04,.38],
    [1.00,-4.7,2.45,4.85,-.61],
  ].map(([x,z,rx,rz,a])=>({x,z,rx,rz,c:Math.cos(a),s:Math.sin(a)}));
  function dryMargin(x,z) {
    const wx=x+.24*Math.sin(z*1.23+x*.72)+.13*Math.cos(z*.67-x*2.05)+.11*Math.sin(3.21*z-1.4*x);
    const wz=z+.27*Math.sin(x*1.37+z*.74)-.10*Math.cos(z*1.95+x);
    let margin=9;
    for(const h of hollows) {
      const dx=wx-h.x,dz=wz-h.z;
      margin=Math.min(margin,Math.hypot((dx*h.c-dz*h.s)/h.rx,(dx*h.s+dz*h.c)/h.rz));
    }
    return margin;
  }
  function floatPad(x,z,r,tint,direction,drifter=false,packing=.82) {
    if(Math.abs(x)>9.85 || z>24.4 || z< -26.2) return false;
    const margin=dryMargin(x,z);
    if(margin<(drifter ? .12 : .98) || (!drifter && margin<1.19 && random()>(margin-.98)*4.72))
      return false;
    const col=Math.floor(x/.65),row=Math.floor(z/.65);
    for(let a=col-1;a<=col+1;a++) for(let b=row-1;b<=row+1;b++) {
      const neighbors=cells.get(a*256+b);
      if(!neighbors)continue;
      for(const [ox,oz,other] of neighbors) {
        if((x-ox)**2+(z-oz)**2<((r+other)*packing)**2) return false;
      }
    }
    const cell=col*256+row;
    if(!cells.has(cell)) cells.set(cell,[]);
    cells.get(cell).push([x,z,r]);
    const small=r<.11 || z< -2;
    const variant=Math.floor(random()*4);
    const shade=Math.min(pigment.length-1,Math.max(0,tint
      +(random()<.38?(random()<.5?-1:1):0) +(r<.09&&random()<.37?1:0)));
    patches[(small?4:0)+variant].push({
      position:[x,.008+random()*.015,z],
      rotation:[(random()-.5)*.023,direction+(random()-.5)*3.3,(random()-.5)*.019],
      scale:[r,r,r*(.79+.26*random())],color:pigment[shade],
    });
    return true;
  }

  // Overlapping coves shelter families of rafts. The right foreground has a
  // nearly continuous yellow-green mattress and two ragged scallops into the pool.
  // Left of it are narrow spits and free islands surrounded by a broader inlet.
  const beds=[
    [4.25,16.5,2.8,6.4,-.26],[2.47,17.2,1.42,3.11,.39],
    [1.92,13.35,1.56,2.75,-.49],[-.64,13.48,1.13,1.01,-.67],
    [-.98,16.33,.85,2.29,.22],[.11,17.88,1.23,1.32,-.19],
    [2.73,9.64,1.82,4.35,.31],[.48,7.95,1.53,1.08,.24],
    [3.9,2.8,2.45,6.04,-.33],[-.63,4.20,1.26,1.63,.52],
    [-3.17,9.74,1.58,2.68,-.7],[-4.69,1.33,1.51,2.31,.56],
    [-1.97,-1.38,1.24,1.65,-.4],[.75,-12.1,2.64,2.37,.9],
    [4.06,-8.28,2.25,4.55,-.23],[-3.32,-10.32,2.07,4.53,.27],
  ];
  for(const sign of [-1,1]) {
    let z=-25.5+random()*2.3;
    while(z<24.7) {
      beds.push([sign*(5.7+random()*2.7),z,1.87+random()*1.53,
        2.57+random()*3.72,(random()-.5)*1.25]);
      z+=2.65+random()*3.20;
    }
  }
  for(let i=0;i<28;i++) {
    const z=-24.8+random()*25.2;
    beds.push([(random()-.49)*12.3,z,1.03+random()*2.22,1.42+random()*2.35,(random()-.5)*2.30]);
  }

  for(const [cx,cz,width,length,turn] of beds) {
    const cosine=Math.cos(turn),sine=Math.sin(turn);
    const base=1+Math.floor(random()*4),area=width*length;
    const colonies=Math.ceil(5+area*1.8);
    for(let k=0;k<colonies;k++) {
      const angle=random()*TAU,rad=Math.sqrt(random());
      const dx=width*Math.cos(angle)*rad,dz=length*Math.sin(angle)*rad;
      const hx=cx+dx*cosine+dz*sine,hz=cz-dx*sine+dz*cosine;
      const size=.45+random()*.64,aspect=.65+random()*.62,direction=turn+(random()-.5)*1.85;
      const c=Math.cos(direction),s=Math.sin(direction),tint=base+(random()<.14?1:0);
      const mothers=[];
      for(let j=0;j<35;j++) {
        const a=random()*TAU,d=Math.sqrt(random())*size;
        const u=d*Math.cos(a),v=d*Math.sin(a)*aspect;
        const x=hx+u*c+v*s,z=hz-u*s+v*c;
        const near=Math.max(0,Math.min(1,(z-4)/11));
        const r=(.123+random()**1.20*.209)*(1-.245*near);
        if(floatPad(x,z,r,tint,direction)) mothers.push([x,z,r]);
      }
      // Young leaves still share a rhizome: groups of smaller discs hug an adult
      // on one side, then thin out at the edge of the colony.
      for(const [x,z,r] of mothers) {
        const a0=random()*TAU;
        const daughters=2+Math.floor(random()*6);
        for(let j=0;j<daughters;j++) {
          const a=a0+(random()-.5)*3.5;
          const child=r*(.27+.44*random()),d=(r+child)*(.85+.58*random());
          floatPad(x+Math.cos(a)*d,z+Math.sin(a)*d,child,tint,a);
        }
      }
    }
  }
  // Sheltered cores behind the right-hand spits produce a second overlapping
  // generation. Rich growth continues almost to the edge of each nearby hollow.
  const rightCores=[
    [3.45,17.05,2.75,5.3],[2.90,13.05,2.15,4.9],[4.85,8.1,3.10,5.4],
    [2.95,3.70,2.00,3.5],[4.95,-2.6,2.94,6.1],[5.8,-10.5,2.85,5.8],
    [.34,13.28,1.35,1.02],[-.82,16.9,1.14,2.25],[-1.25,7.25,1.35,2.08],
  ];
  for(const [cx,cz,rx,rz] of rightCores) {
    const colonies=Math.ceil(rx*rz*7.0);
    for(let i=0;i<colonies;i++) {
      const heading=random()*TAU,spread=Math.sqrt(random());
      const x=cx+Math.cos(heading)*spread*rx,z=cz+Math.sin(heading)*spread*rz;
      const tint=3+Math.floor(random()*3),a=random()*TAU;
      const reach=.29+random()*.45;
      for(let j=0;j<35;j++) {
        const dir=a+(random()-.5)*4.55,d=Math.sqrt(random())*reach;
        const px=x+Math.cos(dir)*d,pz=z+Math.sin(dir)*d*.86;
        const r=(.051+.108*random()**.92)*(z<4 ? 1.22 : 1);
        floatPad(px,pz,r,tint,dir,false,.65);
      }
      if(cx>1 && cz>1) {
        // New leaves emerge between older overlapping pads in the densest mats.
        for(let j=0;j<24;j++) {
          const dir=random()*TAU,d=Math.sqrt(random())*reach;
          floatPad(x+Math.cos(dir)*d,z+Math.sin(dir)*d*.78,.047+.067*random(),
            tint,dir,false,.56);
        }
      }
    }
  }
  // A few broken chains taper into the dark water. Leave clear gaps between
  // the chains rather than filling the entire pocket with equally spaced dots.
  for(const [cx,cz,angle] of [[.28,15.61,.9],[1.08,11.47,2.7],[.02,10.47,-.35],
    [-.39,9.70,-.8],[.05,-3.1,.17],[1.6,-6.5,1.9]]) {
    for(let j=0;j<9;j++) {
      const d=random()*.77;
      floatPad(cx+d*Math.cos(angle)+(random()-.5)*.27,cz+d*Math.sin(angle)+(random()-.5)*.38,
        .059+.075*random(),2+Math.floor(random()*3),angle,true,.73);
    }
  }
  for(const [x,z,heading] of [[-.27,10.65,.19],[1.02,11.68,2.53],[-.22,15.39,.30]]) {
    for(let i=0;i<25;i++) {
      const d=random()*.74,perp=(random()-.5)*.53;
      floatPad(x+Math.cos(heading)*d-Math.sin(heading)*perp,
        z+Math.sin(heading)*d+Math.cos(heading)*perp,.067+.084*random(),
        2+Math.floor(random()*3),heading,true,.72);
    }
  }
  // Sparse, visibly juvenile outliers bridge the black water between colonies.
  for(let i=0;i<118;i++) {
    const x=(random()-.46)*12.9,z=-20.7+random()*41.6;
    floatPad(x,z,.051+random()*.075,1+Math.floor(random()*5),random()*TAU,true);
  }
  const material=new THREE.MeshStandardMaterial({map,color:0xffffff,roughness:.64,
    metalness:0,side:THREE.DoubleSide,emissive:0x060802});
  for(let i=0;i<patches.length;i++)
    stamp(THREE,group,'Water lilies • drift raft '+i,padGeometry(THREE,i%4,i>=4,true),material,patches[i]);
}

function poolLeaves(THREE, group, map, rng, refined=false) {
  if(refined) return driftRafts(THREE,group,map);
  const groups = Array.from({length:8},()=>[]);
  const palette = ['#698043','#809748','#95ab59','#a5b95e','#b2c56e','#b7c974','#778749','#95aa55'];
  const occupied = new Map();
  function add(x, z, r) {
    if (Math.abs(x) > 10 || z > 25 || z < -26) return;
    if(z>6) r*=1-.27*Math.min(1,(z-6)/9);
    const gap = Math.hypot((x-3.2-.68*Math.sin(z*.62))*.89,(z-9.1)*.44);
    const secondGap = Math.hypot((x-.52-.43*Math.cos(z*.76))*.83,(z-17.8)*.51);
    if ((gap<.72 || secondGap<.99) && rng()>.041) return;
    const gx = Math.floor(x), gz = Math.floor(z);
    for (let u = gx - 1; u <= gx + 1; u++) {
      for (let v = gz - 1; v <= gz + 1; v++) {
        for (const other of occupied.get(128 * u + v) || []) {
          if ((other[0] - x) ** 2 + (other[1] - z) ** 2 < ((other[2] + r) * .80) ** 2) return;
        }
      }
    }
    const key = 128 * gx + gz;
    if (!occupied.has(key)) occupied.set(key, []);
    occupied.get(key).push([x, z, r]);
    const fine=(r<.19||z<1) ? 4 : 0;
    groups[fine+Math.floor(rng() * 4)].push({ position: [x,.003 + rng() * .009,z],
      rotation: [0,rng() * TAU,0], scale: [r,r,r], color: palette[Math.floor(rng() * palette.length)] });
  }
  for (let school = 0; school < 360; school++) {
    const side = rng() > .5 ? 1 : -1;
    const z = -24 + rng() * 49;
    const channel = .2 + 1.1 * Math.sin(.26 * z) + .49 * Math.cos(.73 * z);
    const x = channel + side * (1.08 + Math.pow(rng(), .9) * 8.7);
    const spread = .71 + rng() * 1.38;
    for (let j = 0; j < 29; j++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * spread;
      const px = x + d * Math.cos(a), pz = z + d * Math.sin(a) * 1.3;
      const dist = Math.abs(px - (.2 + 1.1 * Math.sin(.26 * pz) + .49 * Math.cos(.73 * pz)));
      if (dist < .61 + .44 * Math.sin(.64 * pz) && rng() > .085) continue;
      add(px, pz, .105 + Math.pow(rng(), 1.45) * .28);
    }
  }
  // Smaller daughter pads fill the gaps within rafts. The open pockets follow a
  // sinuous channel and organic breaks in the rafts instead of the camera axis.
  for(let i=0;i<33000;i++) {
    const x=-9.8+19.6*rng(),z=-25+49.3*rng();
    const channel= -.42+1.35*Math.sin(z*.225+.81)+.52*Math.sin(z*.60);
    const dark=islandField(x,z);
    const distance=Math.abs(x-channel);
    if(distance<.54+.46*Math.cos(z*.42) && rng()>.025) continue;
    if(dark<-.53 && rng()>(x>0?.17:.085)) continue;
    if(x<0 && rng()<.38) continue;
    const r=.071+Math.pow(rng(),1.52)*.17;
    add(x,z,r);
  }
  function islandField(x,z) {
    return .62*Math.sin(.64*x+.28*z)+.44*Math.cos(.87*z-.41*x)+.28*Math.sin(1.36*x+.52*z);
  }
  for(let i=0;i<15600;i++) {
    const x=-.25+rng()*9.8,z=1.8+rng()*22.5;
    const channel=-.42+1.35*Math.sin(z*.225+.81)+.52*Math.sin(z*.60);
    if(Math.abs(x-channel)<.88+.24*Math.sin(z*.61)) continue;
    if(islandField(x,z)<-.30 && rng()>.085) continue;
    add(x,z,.058+Math.pow(rng(),1.3)*.158);
  }
  const material = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: .64,
    metalness: 0, side: THREE.DoubleSide, emissive: 0x060802 });
  for (let i = 0; i < 8; i++) {
    stamp(THREE, group, 'Water lilies • raft ' + i, padGeometry(THREE, i%4, i>=4), material, groups[i]);
  }
}

// Draw the petiole, a tapering midrib and paired lateral veins in leaf space.
// These lines belong to the surface and follow its folds through light and shadow.
function broadLeafInk(THREE) {
  return canvasTexture(THREE,512,(ctx,n)=>{
    ctx.scale(n,n);
    const wash=ctx.createLinearGradient(.12,.2,.9,.78);
    wash.addColorStop(0,'#e9ebd6');wash.addColorStop(.53,'#e2e6cd');wash.addColorStop(1,'#ccd3b8');
    ctx.fillStyle=wash;ctx.fillRect(0,0,1,1);
    function vein(x,y,cx,cy,tx,ty,width,color) {
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(cx,cy,tx,ty);
      ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineCap='round';ctx.stroke();
    }
    for(let j=0;j<7;j++) {
      const y=.24+.095*j;
      const axis=.50+.017*Math.sin(4*y);
      for(const sign of [-1,1]) {
        const span=.39*Math.sin(Math.PI*(.19+j*.106));
        const x=axis+sign*span, endY=y+.055+.018*(j%3);
        vein(axis,y,axis+sign*span*.56,endY-.012,x,endY,.0044-.00037*j,'rgba(65,79,50,.55)');
        vein(axis+sign*span*.54,endY-.027,x-sign*span*.18,endY-.048,x+sign*.018,endY-.084,
          .0022,'rgba(85,98,69,.51)');
      }
    }
    vein(.50,.235,.545,.53,.49,.96,.007,'rgba(72,83,55,.72)');
  });
}

function broadLeaves(THREE, group, map, rng, illustrated=false) {
  const groups = [[], [], []];
  const barkBatch = bark(THREE, group);
  const palette = ['#314722','#456b31','#344f29','#4a7532','#4b7638','#577b3e',
    '#59853b','#598140','#709449','#294020'];
  function clump(cx, cy, cz, count, spread, tall) {
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996 + rng() * .75;
      const d = spread * Math.sqrt(rng());
      const x = cx + d * Math.cos(a), z = cz + .66 * d * Math.sin(a);
      let y = cy + tall * (1 - d / (spread * 1.32)) + rng() * .29;
      const scale = .29 + rng() * .61;
      // Make room for the flower face while keeping it nestled in the leaves.
      if (Math.abs(x + 1.64) < .95 && z>18.5 && z<20.2) y = Math.min(y, 1.13);
      if (z > 18.4 && x > -1.29 && x < 1.68) continue;
      const rotation = [-.35 - rng() * .62, (rng() - .5) * 1.22, (rng() - .5) * 2.9];
      groups[i % 3].push({position: [x, y, z], rotation,
        scale: [scale * (.87 + rng() * .31), scale, scale], color: palette[Math.floor(rng() * palette.length)]});
      if (i % 4 === 0) {
        barkBatch.branch([cx, .0, cz], [x, y, z], .015 + .009 * rng(), .007);
      }
    }
  }
  clump(-3.65,1.42,19.36,79,1.68,1.11);
  clump(-2.67,.78,18.10,69,1.63,.90);
  clump(-4.61,1.64,20.24,51,1.42,1.03);
  clump(-1.95,1.04,17.63,28,.90,.55);
  clump(3.74,1.20,19.26,72,1.78,1.05);
  clump(3.01,.82,18.17,49,1.25,.92);
  clump(4.77,1.59,20.47,45,1.42,1.04);
  // Foliage on the receding water's edge ties the foreground plants to the ravine.
  for (const sign of [-1,1]) {
    for (let i = 0; i < 7; i++) {
      clump(sign*(8.65 + rng()*.8), .12, 14-i*4.1, 10, .77, .42);
    }
  }
  const material = new THREE.MeshStandardMaterial({map:illustrated ? broadLeafInk(THREE) : map, color:0xffffff,
    roughness:illustrated ? .98 : .81, metalness:0, side:THREE.DoubleSide, emissive:0x030601});
  if(illustrated) {
    material.onBeforeCompile=shader=>{
      const lighting=THREE.ShaderChunk.lights_fragment_begin.replace(
        /getShadow\( directionalShadowMap[^;]+? \)/,
        sample=>'smoothstep(.23, .72, '+sample+')');
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <lights_fragment_begin>',lighting)
        .replace('#include <lights_fragment_end>',`
          #include <lights_fragment_end>
          reflectedLight.directSpecular *= .20;
          reflectedLight.indirectDiffuse += material.diffuseColor * vec3(.075,.066,.042);
        `);
    };
    material.customProgramCacheKey=()=>'moonmere-broadleaf-ink';
  }
  for (let i=0; i<3; i++) {
    const canopy=stamp(THREE, group, 'Emergent heart leaves ' + i, heart(THREE,i),material,groups[i]);
    canopy.castShadow=true;
  }
  barkBatch.finish();
}

function petalPigment(THREE) {
  const rng = seeded(77031);
  return canvasTexture(THREE,256,(ctx,n) => {
    const wash = ctx.createLinearGradient(0,0,0,n);
    wash.addColorStop(0,'#ffffff'); wash.addColorStop(.62,'#fdfbff'); wash.addColorStop(1,'#f4eee3');
    ctx.fillStyle = wash; ctx.fillRect(0,0,n,n);
    for (let j=-6; j<=6; j++) {
      const x0 = n*(.5+j*.022), x1=n*(.5+j*.077);
      ctx.beginPath();ctx.moveTo(x0,n);
      ctx.bezierCurveTo((x0+x1)*.5,n*.74,x1,n*.31,n*.50+j*n*.068,0);
      ctx.lineWidth = j===0 ? 1.75 : 1.04;
      ctx.strokeStyle = j===0 ? '#a9a2b2' : 'rgba(147,135,153,.65)';ctx.stroke();
    }
    for (let i=0;i<300;i++) {
      const x=rng()*n,y=rng()*n;
      if(y>n*.67 && Math.abs(x/n-.5)<.20) continue;
      const a=.22+Math.abs(x/n-.5)*.64+(1-y/n)*.12;
      ctx.fillStyle=`rgba(104,95,115,${a})`;
      ctx.beginPath();
      ctx.ellipse(x,y,.66+rng()*1.05,.57+rng()*.85,(rng()-.5)*.7,0,TAU);
      ctx.fill();
    }
  });
}

function laminaPigments(THREE) {
  const random=seeded(48307);
  return canvasTexture(THREE,1024,(ctx,n)=>{
    const side=n/2;
    for(let variant=0;variant<4;variant++) {
      ctx.save();
      ctx.translate(side*(variant%2),side*Math.floor(variant/2));
      ctx.beginPath();ctx.rect(0,0,side,side);ctx.clip();
      const wash=ctx.createLinearGradient(0,0,side*.14,side);
      wash.addColorStop(0,'#fffeff');
      wash.addColorStop(.55,'#fffdfd');
      wash.addColorStop(1,'#e8dfd9');
      ctx.fillStyle=wash;ctx.fillRect(0,0,side,side);
      // A few hand-drawn ribs bifurcate; the white surface stays mostly clear.
      for(let j=-2;j<=2;j++) {
        const dx=(random()-.5)*.08;
        const origin=side*(.50+.025*j);
        const tip=side*(.50+j*.13+dx);
        const stop=side*(j===0?.035:.11+random()*.24);
        ctx.beginPath();ctx.moveTo(origin,side);
        ctx.bezierCurveTo(side*(.5+j*.085),side*.79,
          side*(.5+j*.16+dx),side*.42,tip,stop);
        ctx.strokeStyle=j===0?'rgba(123,115,142,.32)':'rgba(137,128,147,.19)';
        ctx.lineWidth=j===0?1.45:.94;ctx.stroke();
      }
      const flecks=[42,75,31,99][variant];
      for(let j=0;j<flecks;j++) {
        const x=random(), y=random()**1.55;
        if(y>.63 && Math.abs(x-.5)<.31) continue;
        const width=1.1+random()**2*4.5;
        ctx.beginPath();ctx.ellipse(x*side,y*side,width,width*(.42+.22*random()),
          -.49+(random()-.5)*.72,0,TAU);
        ctx.fillStyle=`rgba(88,83,110,${.34+random()*.43})`;ctx.fill();
      }
      if(variant===3) {
        for(let j=0;j<13;j++) {
          const x=(j%2?.76:.24)+(random()-.5)*.25;
          ctx.beginPath();ctx.ellipse(x*side,side*(.09+.48*random()),
            2.7+2.4*random(),1.4+1.9*random(),-.52+random()*.49,0,TAU);
          ctx.fillStyle='rgba(93,85,112,.71)';ctx.fill();
        }
      }
      ctx.restore();
    }
  });
}

function laminaMaterial(THREE) {
  const mat=new THREE.MeshLambertMaterial({map:laminaPigments(THREE),color:0xffffff,
    vertexColors:true,side:THREE.DoubleSide,emissive:0x392e37});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 lamina; varying vec3 vLamina;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLamina = lamina;');
    const direct=THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
      'vec3 irradiance = dotNL * directLight.color;',
      `float cosine = dot( geometryNormal, directLight.direction );
       float edge = smoothstep(0.42, 0.96, abs(vLamina.x));
       float transmission = max(0.0, 0.24 - cosine) * (0.19 + 0.42 * edge)
                          * (1.0 - 0.55 * vLamina.z);
       vec3 irradiance = directLight.color * (vec3(dotNL) + transmission * vec3(1.0, 0.94, 1.01));`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vLamina;')
      .replace('#include <lights_lambert_pars_fragment>',direct)
      .replace('#include <opaque_fragment>',`
        float dist = (1.0 - abs(vLamina.x)) / max(fwidth(vLamina.x), 0.0001);
        float outline = 1.0-smoothstep(0.12,1.03,dist);
        float rim = smoothstep(0.70,0.99,abs(vLamina.x)) * (1.0-vLamina.z);
        outgoingLight += rim * vec3(0.026,0.025,0.031);
        outgoingLight *= mix(vec3(1.0),vec3(0.65,0.63,0.72),outline * 0.63);
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey=()=>'moonmere-thin-petal-v2';
  return mat;
}

function thinCorolla(THREE,rng) {
  const petals=[],pos=[],uv=[],indices=[],colors=[],lamina=[];
  const hues=[['#d1cadf','#c6bed5','#e8e4ed'],['#f7f4fa','#f4f1f5','#ede9f0'],
    ['#f6f3f7','#fffdf9','#f5f3f6'],['#fbf7ef','#f3efe9','#faf8f7']];
  for(const [ring,n,length,width,rise] of [[0,7,.58,.112,-.026],[1,10,.61,.133,.043],
    [2,9,.51,.128,.105],[3,8,.35,.111,.135]]) {
    for(let i=0;i<n;i++) {
      const a=(i+ring*.37+(rng()-.5)*.15)*TAU/n;
      const phase=rng()*TAU;
      const len=length*(.94+rng()*.10),w=width*(.93+.12*rng()),bend=(rng()-.5)*.10;
      petals.push({cs:Math.cos(a),sn:Math.sin(a),len,w,bend,phase,ring,rise,i});
    }
  }
  const breadth=t=>.012+Math.pow(Math.max(0,Math.sin(Math.PI*t)),.79)*(1.19-.33*t);
  function pointHeight(q,t,s,b) {
    const asym=.011*Math.sin(q.phase+3.7*t)*s*t*t;
    const fold=(.008*s*s+.0014*Math.cos(s*4.1+q.phase)*t)*b;
    return q.ring*.013 + q.rise*t**1.43 - .028*Math.sin(t*Math.PI) + asym+fold;
  }
  const rows=30,columns=14;
  for(const q of petals) {
    const first=pos.length/3;
    const base=new THREE.Color(hues[q.ring][q.i%3]);
    const variant=(q.i+q.ring*3)%4;
    for(let row=0;row<=rows;row++) {
      const t=row/rows,b=breadth(t),d=.021+t*q.len;
      for(let col=0;col<=columns;col++) {
        const s=2*col/columns-1;
        const offset=s*q.w*b*(1+.075*s*Math.sin(t*4.1+q.phase)) + q.bend*t*t*.65;
        const x=q.cs*d-q.sn*offset,z=q.sn*d+q.cs*offset;
        const y=pointHeight(q,t,s,b);
        let covered=0, ghostEdge=0;
        // Local sheet separation determines how much light reaches each overlap.
        for(const other of petals) {
          if(other===q) continue;
          const ot=(x*other.cs+z*other.sn-.021)/other.len;
          if(ot<=0 || ot>=1) continue;
          const ob=breadth(ot);
          const lateral=-x*other.sn+z*other.cs-other.bend*ot*ot*.65;
          const separation=other.w*ob-Math.abs(lateral);
          if(separation<-.018) continue;
          const os=Math.max(-1,Math.min(1,lateral/(other.w*ob)));
          const dy=pointHeight(other,ot,os,ob)-y;
          if(dy>.0015 && dy<.13) {
            const edge=Math.max(0,Math.min(1,(separation+.018)/.041));
            covered=Math.max(covered,edge*(1-dy/.15));
          } else if(dy<-.002 && dy>-.025) {
            ghostEdge=Math.max(ghostEdge,(1+dy/.025)*Math.exp(-Math.abs(separation)/.005));
          }
        }
        const shade=1-.20*covered-.077*ghostEdge-.045*(1-t)**2;
        pos.push(x,y,z);
        uv.push((variant%2+.004+.992*col/columns)*.5,
          (1-Math.floor(variant/2)+.004+.992*t)*.5);
        lamina.push(s,t,covered);
        colors.push(base.r*shade*(1-.038*covered),base.g*shade*(1-.065*covered),base.b*shade);
        const j=first+row*(columns+1)+col;
        if(row&&col) indices.push(j-columns-2,j,j-1,j-columns-2,j-columns-1,j);
      }
    }
  }
  const mesh=surface(THREE,pos,indices,uv,colors);
  mesh.setAttribute('lamina',new THREE.Float32BufferAttribute(lamina,3));
  return new THREE.Mesh(mesh,laminaMaterial(THREE));
}

function originalCorolla(THREE, rng) {
  const p=[],uv=[],idx=[],colors=[];
  const hues=['#c0b8d2','#d4cfdd','#e1dce7','#e9e4df'];
  const rings=[[0,7,.58,.112,-.026],[1,10,.61,.133,.043],
    [2,9,.51,.128,.105],[3,8,.35,.111,.135]];
  for (const [ring,n,length,width,rise] of rings) {
    for(let i=0;i<n;i++) {
      const a=(i+ring*.37+(rng()-.5)*.15)*TAU/n;
      const cs=Math.cos(a),sn=Math.sin(a),phase=rng()*TAU;
      const len=length*(.94+rng()*.10), w=width*(.93+.12*rng()), bend=(rng()-.5)*.10;
      const first=p.length/3, base=new THREE.Color(hues[ring]);
      for(let row=0;row<=13;row++) {
        const t=row/13, breadth=.014 + Math.pow(Math.sin(Math.PI*t),.77)*(1.18-.31*t);
        const d=.021+t*len, midY=ring*.012+rise*Math.pow(t,1.40)-.028*Math.sin(t*Math.PI);
        for(let k=0;k<7;k++) {
          const s=k/3-1, offset=s*w*breadth+bend*t*t*.65;
          const fold=breadth*(s*s*.012+.002*Math.sin(5*s+phase)*t);
          const x=cs*d-sn*offset,z=sn*d+cs*offset;
          p.push(x,midY+fold,z);uv.push(k/6,t);
          const shade=1-.11*Math.abs(s)*Math.sin(Math.PI*t)-.05*Math.max(0,Math.abs(s)-.68);
          colors.push(base.r*shade,base.g*shade,base.b*shade);
          const j=first+row*7+k;
          if(row && k) idx.push(j-8,j,j-1,j-8,j-7,j);
        }
      }
    }
  }
  return new THREE.Mesh(surface(THREE,p,idx,uv,colors),new THREE.MeshLambertMaterial({
    map:petalPigment(THREE),color:0xffffff,vertexColors:true,side:THREE.DoubleSide,
    emissive:0x423c46,
  }));
}

function sculptFlower(THREE, group, rng, refined=false) {
  const flower=new THREE.Group();
  flower.name='White water lily • corolla';
  flower.position.set(-1.64,1.70,18.8);
  // Tilt presents the face to the approaching camera and exposes the outer petals.
  flower.rotation.x=.42;
  group.add(flower);
  const corolla=refined ? thinCorolla(THREE,rng) : originalCorolla(THREE,rng);
  corolla.name='Layered petals with painted ribs';
  flower.add(corolla);
  const pollen=[],pollenIndices=[],pollenColors=[];
  const tints=refined ? ['#f5df82','#e7d786','#f7eaab','#f8e599','#ebd67a']
    : ['#f2df80','#e4d073','#f6e89e','#faec9f','#e9d887'];
  const outline=refined ? [[0,.0019],[.31,.0032],[.62,.0114],[.86,.012],[1,.0048]]
    : [[0,.0019],[.29,.0033],[.66,.0094],[.86,.0081],[1,.0009]];
  for(const [ring,n] of [[0,26],[1,37],[2,46]]) {
    for(let j=0;j<n;j++) {
      const a=(j+ring*.31+(rng()-.5)*.42)*TAU/n,cs=Math.cos(a),sn=Math.sin(a);
      const front=refined ? Math.max(0,(sn-.25)/.75) : 0;
      const root=(refined ? .048 : .037)+.027*ring, reach=(refined ? .051 : .043)+.029*ring+.024*rng();
      const h=(.087+.048*rng()-.007*ring)*(refined ? .85-.38*front : 1)
        +(refined ? .008*(1-sn) : 0), first=pollen.length/3,curve=(rng()-.5)*.20;
      const color=new THREE.Color(tints[j%5]);
      if(refined&&((front>.69&&j%3!==0)||(front>.40&&ring===0&&j%2))) continue;
      for(const [t,w] of outline) {
        const r=root+reach*t**1.36;
        const lean=curve*t*t*.12;
        const py=.033+h*Math.sin(t*1.32);
        for(const s of [-1,1]) {
          const spread=w*s*(refined?1.07+.14*Math.cos(j*2.23+ring)-.24*front:1)+lean;
          pollen.push(cs*r-sn*spread,py,sn*r+cs*spread);
          const value=refined ? .78+.22*t-.075*(s===-1) : .88+.12*t-.04*(s===-1);
          pollenColors.push(color.r*value,color.g*value,color.b*value);
        }
      }
      for(let k=0;k<8;k+=2) pollenIndices.push(first+k,first+k+2,first+k+3,first+k,first+k+3,first+k+1);
    }
  }
  const goldenRing=new THREE.Mesh(surface(THREE,pollen,pollenIndices,null,pollenColors),
    new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  goldenRing.name='Recurved pollen blades';
  flower.add(goldenRing);
  if(refined) {
    // The central receptacle sits below the outward-bending tips of the stamens.
    const pos=[0,.085,0], faces=[], tint=[.92,.89,.84];
    for(let row=1;row<=4;row++) {
      const r=row/4;
      for(let j=0;j<28;j++) {
        const a=TAU*j/28, cs=Math.cos(a), sn=Math.sin(a);
        const radius=(1+.052*Math.sin(4*a+.5))*r;
        pos.push(cs*radius*.076,.085-.035*r*r-.018*sn*r,sn*radius*.053);
        const rib=.030*r*Math.cos(5*a+.45);
        tint.push(.92+.04*r+rib,.89+.05*r+rib,.84+.07*r+rib);
        const ix=1+(row-1)*28+j,next=1+(row-1)*28+(j+1)%28;
        if(row===1) faces.push(0,next,ix);
        else faces.push(ix-28,next,ix,ix-28,next-28,next);
      }
    }
    const heart=new THREE.Mesh(surface(THREE,pos,faces,null,tint),new THREE.MeshLambertMaterial({
      color:0xf0edef,emissive:0x6e6570,vertexColors:true,side:THREE.DoubleSide,
    }));
    heart.name='Ivory receptacle';
    flower.add(heart);
  }
  return flower;
}

export function createGarden(THREE, scene, sampleBank, {refined=false,illustrated=false}={}) {
  const rng=seeded(130127);
  const garden=new THREE.Group();
  garden.name='The lily garden';
  scene.add(garden);
  const leafMap=leafPigments(THREE);
  woods(THREE,garden,sampleBank,rng,illustrated);
  poolLeaves(THREE,garden,leafMap,rng,refined);
  // Freeze the approved foreground framing independently of the number of pads.
  const foregroundRng=seeded(226151088);
  broadLeaves(THREE,garden,leafMap,foregroundRng,illustrated);
  const flower=sculptFlower(THREE,garden,foregroundRng,refined);
  return { update(seconds) {
    flower.rotation.z=.009*Math.sin(seconds*.59+.38);
    flower.rotation.x=.42+.005*Math.sin(seconds*.78);
  } };
}
