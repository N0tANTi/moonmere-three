// A dark olive shadow, two broad leaf values and a very light silver stone wash.
// All palette decisions use perceptual sRGB values; the scene buffer stays linear.
const vertexShader = /* glsl */ `
  varying vec2 canvasUV;
  void main() {
    canvasUV = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D image;
  uniform vec2 stepUV;
  uniform bool applyGrade;
  varying vec2 canvasUV;
  const vec3 lightness = vec3(.2126,.7152,.0722);

  float luma(vec3 rgb) { return dot(rgb,lightness); }
  vec3 inDisplay(vec3 linear) {
    return sRGBTransferOETF(vec4(max(linear,0.0),1.0)).rgb;
  }
  float nearby(vec2 offset, float center, inout float weight, inout float detail, inout float low) {
    float sampleY=luma(inDisplay(texture2D(image,canvasUV+offset).rgb));
    // Blend small changes inside a leaf. A vein, silhouette, or reflection
    // with a clearly different value supplies no cross-edge contribution.
    float w=1.0-smoothstep(.020,.083,abs(sampleY-center));
    weight+=w;
    detail=max(detail,abs(sampleY-center));
    low=min(low,sampleY);
    return w*sampleY;
  }
  void main() {
    vec4 scenePixel=texture2D(image,canvasUV);
    if (!applyGrade) {
      gl_FragColor=vec4(scenePixel.rgb,1.0);
      #include <colorspace_fragment>
      return;
    }
    vec3 rgb=inDisplay(scenePixel.rgb);
    float Y=luma(rgb);
    float chroma=max(max(rgb.r,rgb.g),rgb.b)-min(min(rgb.r,rgb.g),rgb.b);
    float foliage=smoothstep(.037,.190,(rgb.g-rgb.b)/max(.12,Y))
                * smoothstep(-.030,.051,rgb.g-rgb.r+.026);
    float mids=smoothstep(.19,.37,Y)*(1.0-smoothstep(.55,.78,Y));
    float withinLeaf=foliage*smoothstep(.042,.13,Y)*(1.0-smoothstep(.49,.72,Y));
    float weight=1.0, detail=0.0, low=Y;
    float local=Y;
    local+=nearby(vec2(stepUV.x,0.0),Y,weight,detail,low);
    local+=nearby(vec2(-stepUV.x,0.0),Y,weight,detail,low);
    local+=nearby(vec2(0.0,stepUV.y),Y,weight,detail,low);
    local+=nearby(vec2(0.0,-stepUV.y),Y,weight,detail,low);
    float level=mix(Y,local/weight,withinLeaf*.43);
    // Only the greens approach pigment-like groups. Smooth shoulders retain
    // partial coverage at edges and avoid a discrete posterization threshold.
    float bands=level*13.0;
    float pigment=(floor(bands)+smoothstep(.18,.82,fract(bands)))/13.0;
    level=mix(level,pigment,withinLeaf*.42);

    // The toe reaches black in the deep pool and the canopy's recesses. The
    // opposite bend admits more silver-green light to the outer leaf faces.
    float foliageDetail=smoothstep(.016,.10,detail);
    float toe=mix(.036,mix(.030,.058,foliageDetail),foliage)*(1.0-smoothstep(.074,.260,Y));
    // Faint, isolated stars in the black part of the sky keep their intensity.
    float pinpoint=(1.-smoothstep(.008,.041,low))*smoothstep(.008,.046,Y-low)*(1.-foliage);
    toe*=1.0-.92*pinpoint;
    float opened=(.005+foliage*mix(.009,.041,foliageDetail))*mids;
    float outputY=max(0.0,level-toe+opened);
    rgb*=outputY/max(.00001,Y);
    float greenInk=foliage*(.65+.35*smoothstep(.030,.12,rgb.g-rgb.r));
    float shadow=smoothstep(.035,.15,Y)*(1.-smoothstep(.25,.52,Y));
    rgb+=greenInk*shadow*vec3(-.006,.003,-.009);
    rgb+=greenInk*mids*vec3(-.012,.003,-.008);
    float chalk=(1.0-smoothstep(.048,.16,chroma))*smoothstep(.23,.42,Y)
              *(1.0-smoothstep(.71,.88,Y));
    rgb+=chalk*vec3(.002,-.001,.004);
    gl_FragColor=sRGBTransferEOTF(vec4(max(rgb,0.0),1.0));
    #include <colorspace_fragment>
  }
`;

export function createFinish(THREE, renderer) {
  const dimensions=renderer.getDrawingBufferSize(new THREE.Vector2());
  const gl=renderer.getContext();
  const hdr=renderer.extensions.has('EXT_color_buffer_float');
  const format=hdr ? gl.RGBA16F : gl.SRGB8_ALPHA8;
  const sampleCounts=gl.getInternalformatParameter(gl.RENDERBUFFER,format,gl.SAMPLES);
  const target=new THREE.WebGLRenderTarget(dimensions.x,dimensions.y,{
    type:hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    colorSpace:hdr ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace,
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
    depthBuffer:true,stencilBuffer:false,
    samples:Math.max(0,...Array.from(sampleCounts).filter(n=>n<=4)),
  });
  target.texture.name='Moonmere | ungraded scene';
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
  const stepUV=new THREE.Vector2();
  const material=new THREE.ShaderMaterial({
    name:'Moonmere | leaf pigment and silver stone',
    uniforms:{image:{value:target.texture},stepUV:{value:stepUV},applyGrade:{value:true}},
    vertexShader,fragmentShader,toneMapped:false,depthTest:false,depthWrite:false,
  });
  const imagePlane=new THREE.Mesh(geometry,material);
  imagePlane.frustumCulled=false;
  const frame=new THREE.Scene();
  frame.add(imagePlane);
  const lens=new THREE.Camera();

  function setSize(width,height) {
    width=Math.max(1,Math.round(width));
    height=Math.max(1,Math.round(height));
    target.setSize(width,height);
    const reach=Math.max(.80,height/750);
    stepUV.set(reach/width,reach/height);
  }
  setSize(dimensions.x,dimensions.y);

  return {
    setSize,
    render(scene,camera,graded=true) {
      const previous=renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene,camera);
      } finally {
        renderer.setRenderTarget(previous);
      }
      material.uniforms.applyGrade.value=graded;
      renderer.render(frame,lens);
    },
    dispose() {
      target.dispose();geometry.dispose();material.dispose();
    },
  };
}
