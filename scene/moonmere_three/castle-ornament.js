// Palace-space carving for the ornate tier; the caller supplies the rotated
// masonry builder so these pieces share its geometry batches and quarry finish.
const turn=Math.PI*2;

function foliate(b,key,x,y,z,r,t,petals=4,stretch=1){
  const count=petals*6,points=[];
  for(let i=0;i<=count;i++){
    const a=i*turn/count, radius=r*(.72+.28*Math.cos(a*petals));
    points.push([x+Math.cos(a)*radius,y+Math.sin(a)*radius*stretch,z]);
  }
  b.line(key,points,t);
}

function curve(b,key,path,z,r){
  b.line(key,path.map(([x,y])=>[x,y,z]),r);
}

// Alternating dressed voussoirs, each with an actual front, intrados and arris.
// Leaving a narrow joint between successive stones gives the archivolt shadow.
function carvedArch(b,arch,x,y,z,w,h,spread,depth){
  const inner=arch(x,y,w,h).slice(1,-1), outer=arch(x,y,w+2*spread,h+spread*1.13).slice(1,-1);
  for(let i=0;i<inner.length-1;i++){
    const points=[inner[i],inner[i+1],outer[i+1],outer[i]];
    const cx=points.reduce((sum,p)=>sum+p[0],0)/4, cy=points.reduce((sum,p)=>sum+p[1],0)/4;
    const front=points.map(([u,v])=>[cx+(u-cx)*.966,cy+(v-cy)*.975,z+depth]);
    b.face('stone',front,.85+.22*Math.abs(Math.cos(i*1.76)));
    for(const edge of [0,1]){
      const a=front[edge],c=front[(edge+1)%4];
      b.face('shadowstone',[[a[0],a[1],z],a,c,[c[0],c[1],z]],.83);
    }
  }
  curve(b,'trim',outer,z+depth*.85,.041);
}

function greatWindow(b,{arch,hoop}){
  const x=2.12,y=10.16,w=2.55,h=6.60,z=-41.98,d=z+.255;
  carvedArch(b,arch,x,y,z+.09,w*1.28,h+.33,.23,.16);
  for(const [width,height,forward,r,mat] of [
    [w*1.04,h+.04,.26,.062,'trim'],[w*1.18,h+.22,.18,.075,'shadowstone'],
    [w*1.48,h+.74,.16,.066,'trim']]) {
    curve(b,mat,arch(x,y,width,height),z+forward,r);
  }
  // The great wheel has a lobed oculus, fine petal openings and small
  // quatrefoils in the two spandrels beneath it, as in the reference close-up.
  const roseY=y+h-w*.406,roseR=w*.223;
  hoop(b,x,roseY,d+.038,roseR,.065,'trim',32);
  hoop(b,x,roseY,d+.045,roseR*.19,.034,'trim',16);
  for(let i=0;i<7;i++){
    const a=i*turn/7+Math.PI/2,dx=Math.cos(a),dy=Math.sin(a);
    const p=x+dx*roseR*.66,q=roseY+dy*roseR*.66;
    hoop(b,p,q,d+.06,roseR*.29,.036,'trim',12);
  }
  for(const side of [-1,1]){
    const bay=x+side*w*.25;
    curve(b,'trim',arch(bay,y,w*.49,h-w*.62),d+.035,.055);
    const q=y+h-w*.70;
    foliate(b,'trim',bay,q,d+.092,w*.076,.033,4);
  }
  const cell=w/6;
  for(let i=0;i<=6;i++){
    const px=x-w/2+i*cell;
    const head=y+h-w*(.71+.12*Math.abs(i-3)/3);
    b.line('trim',[[px,y,d+.04],[px,head-.18,d+.04]],i===3?.048:.034);
  }
  for(const sill of [y+1.29,y+3.16]){
    b.box('trim',x,sill,d+.035,w,.067,.115);
    for(let i=0;i<6;i++){
      const q=x-w/2+cell*(i+.5);
      curve(b,'trim',arch(q,sill+.02,cell*.98,.54).slice(1,-1),d+.08,.021);
    }
  }
  // Engaged shafts and carved capitals carry the three stepped orders.
  for(const side of [-1,1])for(const [offset,r] of [[.09,.080],[.26,.10],[.41,.078]]){
    const px=x+side*(w*.5+offset), top=y+h-.89*w+offset*.48;
    b.turned('trim',px,z+.17,[[y,r*1.4],[y+.15,r*1.5],[y+.23,r],[top-.18,r],
      [top-.12,r*1.55],[top,r*1.86]],8);
  }
  for(const [w2,yy,d2,shade] of [[3.07,y-.39,.39,.85],[3.50,y-.24,.54,.96],[3.75,y-.10,.47,1.04]])
    b.box('stone',x,yy,z+.13,w2,.12,d2,shade);
}

function carvedGallery(b,{arch,hoop}){
  const z=-41.67;
  // A string course of perforated roundels above the window. It casts a thin
  // continuous shadow over the carved stone ribbons below.
  b.box('stone',1.85,18.88,z-.13,9.83,.40,.18,.75);
  b.box('trim',1.85,18.83,z,10.10,.095,.39);
  b.box('trim',1.85,19.28,z,10.11,.095,.44);
  for(let i=0;i<16;i++){
    const x=-2.54+i*.584;
    hoop(b,x,19.09,z+.05,.163,.036,'trim',14);
    foliate(b,'trim',x,19.09,z+.06,.114,.024);
  }
  for(let i=0;i<13;i++){
    const x=-2.42+i*.70,ys=19.47,ww=.43,hh=.89;
    const outline=arch(x,ys,ww,hh);
    b.face('shadowstone',outline.map(([u,v])=>[u,v,-41.846]),.71);
    curve(b,'trim',outline,-41.76,.042);
    foliate(b,'trim',x,ys+.61,-41.71,.106,.021,3);
    if(i%2===0){
      b.turned('trim',x-.32,-41.72,[[ys-.04,.098],[ys+.09,.101],[ys+.14,.066],
        [ys+.63,.066],[ys+.71,.106]],8);
    }
  }
}

function wingSculpture(b,{arch,hoop}){
  for(const [cx,front,width,bodyHeight] of [[-5.55,-43.95,5.75,11.34],
    [9.14,-42.60,5.0,10.84],[-9.98,-45.16,4.35,8.16]]){
    const y=9.51,w=width*.36,h=bodyHeight*.64;
    carvedArch(b,arch,cx,y,front+.15,w*1.14,h+.17,.17,.13);
    const d=front+.25;
    for(const dir of [-1,1]){
      const half=cx+dir*w*.24;
      curve(b,'trim',arch(half,y,w*.49,h-w*.44),d,.044);
      b.line('trim',[[half,y,d],[half,y+h-w*1.03,d]],.029);
      foliate(b,'trim',half,y+h-w*.66,d+.013,w*.08,.029);
    }
    hoop(b,cx,y+h-w*.29,d,w*.116,.041,'trim',18);
    b.box('trim',cx,y+h*.39,d,w,.067,.111);
    // Quatrefoil panels sit below the outer window heads and a short arcade
    // follows the height of each individual wing, avoiding one long flat band.
    const high=8.35+bodyHeight-.59;
    for(let i=-2;i<=2;i++) {
      const q=cx+i*width*.146;
      b.face('shadowstone',[[q-.17,high-.49,d-.04],[q+.17,high-.49,d-.04],
        [q+.17,high-.11,d-.04],[q-.17,high-.11,d-.04]],.83);
      foliate(b,'trim',q,high-.30,d,.185,.036);
    }
    b.box('trim',cx,high-.54,front+.10,width+.12,.095,.35);
    for(const dir of [-1,1]){
      const xx=cx+width*.376*dir,yy=8.35+bodyHeight*.43+1.50;
      curve(b,'shadowstone',arch(xx,yy,.49,1.26),front+.11,.056);
      foliate(b,'trim',xx,yy+.86,front+.19,.128,.035,3);
    }
  }
}

function drumCarving(b,{arch}){
  const x=-5.13,z=-49.78,r=2.20;
  // Blind panels retain a continuous pale fortified drum. The only dark
  // openings are the sparse arrow slits already cut into the tower.
  function project(a,u,y,radius){
    return [x+Math.sin(a)*radius+Math.cos(a)*u,y,z+Math.cos(a)*radius-Math.sin(a)*u];
  }
  for(const [n,low,w,h,depth] of [[10,25.70,.67,2.42,.045],[14,29.66,.52,1.01,.048]]){
    for(let i=0;i<n;i++){
      const a=(i+(n===10?.10:0))*turn/n, pts=arch(0,low,w,h);
      b.line('stone',pts.map(([u,v])=>project(a,u,v,r+.054)),depth,.81);
      b.line('trim',arch(0,low+.06,w*.82,h-.13).map(([u,v])=>project(a,u,v,r+.069)),.026);
    }
  }
  for(const [y,radius,mat] of [[24.92,2.27,'trim'],[25.10,2.26,'shadowstone'],[25.45,2.30,'trim'],
      [29.19,2.22,'shadowstone'],[29.36,2.25,'trim']]){
    b.turned(mat,x,z,[[y-.055,radius-.031],[y,radius],[y+.085,radius]],28);
  }
  for(let i=0;i<16;i++){
    const a=(i+.10)*turn/16,pts=[[-.11,25.43],[.11,25.43],[.11,25.12],[0,24.95],[-.11,25.12]];
    b.face('trim',pts.map(([u,v])=>project(a,u,v,r+.094)),.96);
  }
}

function figuralCanopy(b,{arch,pinnacle},x,z,base,scale){
  const r=.42*scale, rise=1.81*scale;
  b.turned('stone',x,z,[[base,.06],[base+.29*scale,r*.59],[base+.58*scale,r],
    [base+.72*scale,r*1.22],[base+.87*scale,r*1.05]],8,.95,Math.PI/8);
  const plinth=base+.89*scale,ceiling=plinth+rise;
  b.turned('shadowstone',x,z,[[plinth,r*.90],[ceiling,r*.91]],8,.87,Math.PI/8);
  // A hooded standing figure gives each projecting niche a readable silhouette
  // even before its flanking colonnettes and crockets resolve at full size.
  const zz=z+r*.94;
  b.turned('trim',x,zz,[[plinth+.12*scale,.14*scale],[plinth+.19*scale,.20*scale],
    [plinth+.71*scale,.125*scale],[plinth+.86*scale,.17*scale],[plinth+.99*scale,.083*scale]],8);
  b.turned('stone',x,zz,[[plinth+1.00*scale,.071*scale],[plinth+1.04*scale,.12*scale],
    [plinth+1.23*scale,.107*scale],[plinth+1.28*scale,.018*scale]],8);
  for(const dir of [-1,1]){
    const px=x+dir*r*.82;
    b.turned('trim',px,zz,[[plinth,.083*scale],[plinth+.14*scale,.101*scale],
      [plinth+.21*scale,.063*scale],[ceiling-.25*scale,.063*scale],[ceiling-.17*scale,.096*scale]],8);
  }
  curve(b,'trim',arch(x,plinth,r*1.62,rise).slice(1,-1),zz,.062*scale);
  b.turned('trim',x,z,[[ceiling-.02*scale,r*1.30],[ceiling+.13*scale,r*1.32],
    [ceiling+.20*scale,r*1.10],[ceiling+.83*scale,r*.07]],8);
  for(const dir of [-1,1]) pinnacle(b,x+dir*r,z+.11*scale,ceiling+.06*scale,.93*scale,.12*scale);
}

function crocketedSpire(b,{pinnacle},x,z,base,h,r){
  pinnacle(b,x,z,base,h,r);
  for(const t of [.40,.55,.70,.84]){
    const y=base+t*h,rr=r*(1.18-1.21*t);
    for(let i=0;i<4;i++){
      const a=(i+.14)*turn/4,q=Math.cos(a),v=Math.sin(a);
      b.line('trim',[[x+rr*q,y,z+rr*v],[x+(rr+r*.31)*q,y+r*.25,z+(rr+r*.31)*v],
        [x+(rr+r*.23)*q,y+r*.64,z+(rr+r*.23)*v]],Math.max(.028,r*.14));
    }
  }
}

function chiseledSpandrels(b){
  for(const side of [-1,1]){
    for(const [distance,y,r] of [[1.92,17.88,.34],[2.23,17.34,.27],[1.63,17.33,.24],[2.09,16.83,.22]]){
      const x=2.12+side*distance,z=-41.86;
      const diamond=[[x,y+r*.91,z],[x+r,y,z],[x,y-r*.91,z],[x-r,y,z],[x,y+r*.91,z]];
      b.line('stone',diamond,.044,.74);
      foliate(b,'trim',x,y,z+.039,r*.68,.035);
    }
  }
  // Handcut facing stones on the broad buttress piers. Recessed bed joints
  // change position between the two shafts and at each construction lift.
  for(const [x,shift] of [[-2.85,.08],[6.55,.28]])for(const [bottom,top,half,front] of [
    [8.85,11.87,.575,-41.11],[12.20,16.44,.47,-41.20],[16.91,21.34,.34,-41.31]]){
    for(let y=bottom+shift,index=0;y<top-.31;y+=.56,index++){
      const joint=x+(index%2===0?.16:-.16)*half;
      for(const [left,right] of [[x-half,joint-.016],[joint+.016,x+half]]){
        const bevel=.024,ys=Math.min(y+.50,top);
        const face=[[left+bevel,y,front],[right-bevel,y,front],[right,ys-bevel,front],
          [right-bevel,ys,front],[left+bevel,ys,front],[left,y+bevel,front]];
        b.face('stone',face,.85+.23*Math.abs(Math.sin(index*1.61+left*2.3)));
      }
    }
  }
}

export function addCastleOrnament(b,tools){
  greatWindow(b,tools);
  carvedGallery(b,tools);
  wingSculpture(b,tools);
  drumCarving(b,tools);
  chiseledSpandrels(b);
  for(const [x,z,y,scale] of [[-2.85,-41.08,14.22,1.08],[6.55,-41.13,13.15,.95],
    [-7.98,-43.17,14.4,.74],[11.41,-42.01,13.21,.79]]){
    figuralCanopy(b,tools,x,z,y,scale);
  }
  for(const [x,z,y,h,r] of [[-3.13,-43.20,21.54,4.12,.28],[5.99,-44.37,21.76,3.78,.26],
    [-7.28,-46.93,23.82,3.30,.23],[10.16,-50.06,21.50,4.43,.28]]){
    // Each needle grows out of a stepped stone turret anchored in the roof.
    b.turned('stone',x,z,[[y-3.68,r*1.29],[y-.20,r*.89],[y,r*1.15]],8);
    crocketedSpire(b,tools,x,z,y,h,r);
  }
}
