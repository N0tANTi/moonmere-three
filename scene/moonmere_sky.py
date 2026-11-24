"""Paint a moonlit firmament for the pond. Azimuth zero looks along +Y."""
import bpy
import numpy as np


def _noise(x, y, table):
    """Continuous, repeatable value noise using a small tiled random field."""
    ix, iy = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
    dx, dy = x - ix, y - iy
    dx, dy = dx * dx * (3 - 2 * dx), dy * dy * (3 - 2 * dy)
    size = table.shape[0]
    a = table[iy % size, ix % size] * (1 - dx) + table[iy % size, (ix + 1) % size] * dx
    b = table[(iy + 1) % size, ix % size] * (1 - dx) + table[(iy + 1) % size, (ix + 1) % size] * dx
    return a * (1 - dy) + b * dy


def _draw_cumulus(canvas, az, el, width, height, seed, mist=0.0):
    """Merge offset lobes into a silhouette, then paint shadow shelves inside it."""
    h, w = canvas.shape[:2]
    rng = np.random.default_rng(seed)
    x0 = int(np.floor(w * (az - 1.45*width + 180) / 360))
    x1 = int(np.ceil(w * (az + 1.45*width + 180) / 360)) + 1
    y0 = max(0, int(np.floor(h * (el - 1.45*height + 90) / 180)))
    y1 = min(h, int(np.ceil(h * (el + 1.45*height + 90) / 180)) + 1)
    if y1 <= y0:
        return
    cols = np.arange(x0, x1) % w
    u = ((np.arange(x0, x1, dtype=np.float32) + 0.5) * 360 / w - 180 - az) / width
    v = ((np.arange(y0, y1, dtype=np.float32) + 0.5) * 180 / h - 90 - el) / height
    u, v = np.meshgrid(u, v)
    table = rng.uniform(-1, 1, (64, 64)).astype(np.float32)
    # Soft pigment follows one shared deformed drawing surface. The individual
    # heads stay bounded by their own ellipses even at occlusion boundaries.
    p = u + .012*_noise(9*u+3, 8*v, table) + .005*_noise(26*u, 24*v, table)
    q = v + .020*_noise(8*u, 9*v+4, table) + .007*_noise(23*u, 21*v, table)
    relief = np.full(u.shape, -4.0, dtype=np.float32)
    light = np.zeros_like(relief)
    edge = np.full_like(relief, -3)
    centers = []
    # Trace an asymmetric cloud bank with several updrafts at different heights.
    # A separate shallow row along the bottom gives the tower an airy underside.
    for i, px in enumerate(np.linspace(-.76, .78, 6)):
        py = rng.uniform(-.11, .09)
        rx, ry = rng.uniform(.22,.32), rng.uniform(.23,.35)
        centers.append((px, py, rx, ry, rng.uniform(-.06, .09)))
    peaks = sorted(rng.choice(np.arange(1,5), size=2, replace=False))
    for i in peaks:
        px, py, rx, ry, z = centers[i]
        for t in range(1, rng.integers(3,5)):
            px += rng.uniform(-.12,.13)
            py += rng.uniform(.105,.17)
            r = rng.uniform(.22,.31) * (1-.095*t)
            centers.append((px, py, r, r*rng.uniform(1.02,1.30), z-.014*t))
    for px in (-.51, -.13, .24, .58):
        centers.append((px+rng.uniform(-.08,.08), rng.uniform(-.22,-.09),
                        rng.uniform(.18,.27), rng.uniform(.16,.22), .07))
    lobes = []
    for px, py, rx, ry, depth in centers:
        lobes.append((px,py,rx,ry,depth))
        # Curl smaller heads onto the major billows, leaving broad fields of white.
        for _ in range(rng.integers(2,5)):
            angle = rng.uniform(-.5, 3.6)
            size = rng.uniform(.36,.63)
            px2 = px+rx*.76*np.cos(angle)
            py2 = py+ry*.79*np.sin(angle)
            lobes.append((px2, py2, size*rx, size*ry, depth+rng.uniform(.018,.086)))
    for px, py, rx, ry, depth in lobes:
        cx, cy = (p-px)/rx, (q-py)/ry
        d = 1 - cx*cx - cy*cy
        edge = np.maximum(edge, d*min(rx,ry))
        nz = np.sqrt(np.maximum(0,d))
        z = depth + .56*(rx+ry)*nz
        closer = (d >= 0) & (z > relief)
        # A sunlit upper-right surface lays a curved lavender shadow on
        # the lower-left side, including the boundary between overlapping heads.
        lambert = .49*cx + .66*cy + .58*nz
        light[closer] = lambert[closer]
        relief[closer] = z[closer]
    shadow = np.clip((.18-light - .12*q + .035*_noise(8*u, 7*v, table))/.13, 0, 1)
    penumbra = np.clip((.37-light-.17*q)/.19, 0, 1)
    shade = np.clip(.59*shadow + .23*penumbra, 0, .90)[:,:,None]
    lit = np.array([.943,.943,.916], np.float32)
    dark = np.array([.628,.700,.835], np.float32)
    color = lit*(1-shade) + dark*shade
    color += (.007*_noise(u*15,v*14,table)+.012*_noise(u*3,v*3,table))[:,:,None]
    # Antialias the actual silhouette, never an ellipse's drawing rectangle.
    alpha = (np.clip(edge * 150 + .35, 0, 1)*(1-mist))[:,:,None]
    under = canvas[y0:y1, cols]
    canvas[y0:y1, cols] = under * (1 - alpha) + color * alpha


def _silver_cloud_bank(paint):
    """Light overlapping cloud heads on the right-hand horizon in angular space."""
    h, w = paint.shape[:2]
    x0, x1 = int(94*w/360), int(140*w/360)
    y0, y1 = int(86*h/180), int(118*h/180)
    az, el = np.meshgrid((np.arange(x0,x1)+.5)*360/w-90,
                         (np.arange(y0,y1)+.5)*180/h-90)
    rng = np.random.default_rng(476)
    table = rng.uniform(-1,1,(96,96)).astype(np.float32)
    def grain(x,y):
        return _noise(x,y,table)
    # Adjacent lobes share the same distorted coordinates, so edges and the
    # shadows within them curl together rather than floating on a smooth shape.
    x = az + .37*grain(az*.92,el*.94)+.14*grain(az*2.15,el*2.4)
    y = el + .42*grain(az*.61+23,el*.91)+.13*grain(az*2.74,el*2.06)
    depth = np.full(x.shape,-100.)
    edge = np.full(x.shape,-100.)
    light = np.zeros(x.shape)
    heads = [(10,1.9,5.4,3.0),(15,3.2,5.0,3.8),(19.3,6.3,4.3,4.2),
             (22.6,9.7,4.4,4.6),(24.2,14.2,4.1,4.0),(26.0,16.8,3.0,3.1),
             (31.1,11.2,6.1,4.2),(36,8,7,4.4),(42,7,6.9,5)]
    lobes = []
    for cx,cy,rx,ry in heads:
        cx -= 6.5
        cy += .34*max(0,cy-2)
        lobes.append((cx,cy,rx,ry,0))
        for _ in range(24):
            a = rng.uniform(0,2*np.pi)
            k = rng.uniform(.55,.95)
            s = rng.uniform(.19,.43)
            nx,ny = cx+rx*k*np.cos(a), cy+ry*k*np.sin(a)
            lobes.append((nx,ny,rx*s,ry*s,rng.uniform(.22,.94)))
    for cx,cy,rx,ry,front in lobes:
        u,v = (x-cx)/rx,(y-cy)/ry
        d = 1-u*u-v*v
        edge = np.maximum(edge,d*min(rx,ry))
        nz = np.sqrt(np.maximum(0,d))
        dz = front + .60*rx*nz
        draws = (d>0)&(dz>depth)
        light[draws] = (-.50*u+.78*v+.42*nz)[draws]
        depth[draws] = dz[draws]
    light += .16*grain(x*.9,y*1.1)+.075*grain(x*2.5,y*2.8)
    stops = [-1,-.16,.09,.27,.40,.58,.90,1.3]
    palette = np.array([[69,67,80],[86,84,96],[115,111,127],[143,138,153],
                        [178,173,187],[208,203,214],[232,230,232],[248,247,242]])/255
    color = np.stack([np.interp(light,stops,c) for c in palette.T],axis=-1)
    alpha = np.clip(edge*(h/180)+.35,0,1)[:,:,None]
    current = paint[y0:y1,x0:x1]
    current[:] = current*(1-alpha)+color*alpha


def _moon(paint, heading, elevation, rng, refined=False):
    h, w = paint.shape[:2]
    # In Blender's environment mapping +X is clockwise from +Y.
    cx = (heading + 90) * w / 360
    cy = (elevation + 90) * h / 180
    radius = (.89 if refined else 1.12) * h / 180
    margin = int(6 * radius)
    x0, y0 = int(cx) - margin, int(cy) - margin
    py, px = np.mgrid[y0:y0+2*margin, x0:x0+2*margin]
    x, y = (px-cx)*np.cos(np.radians(elevation))/radius, (py-cy)/radius
    r = np.hypot(x, y)
    angle = np.arctan2(y, x)
    rays = (.5 + .5*np.cos(24*angle + .6*np.sin(5*angle)))**20
    glow = .13*np.exp(-r*.8) + .11*rays*np.exp(-r*.82)
    if refined:
        # An engraved corona draws out a few long rays through the shorter halo.
        fine_rays = (.5+.5*np.cos(38*angle+.93*np.sin(5*angle)))**24
        long_rays = (.5+.5*np.cos(8*angle+.42*np.sin(3*angle)))**40
        glow = .25*np.exp(-r*.88) + (.28*fine_rays+.15*long_rays)*np.exp(-r*.48)
        glow *= np.clip((5.45-r)/.9,0,1)
    patch = paint[y0:y0+2*margin, x0:x0+2*margin]
    patch += glow[:,:,None] * [.81, .92, 1.]
    table = rng.uniform(-1, 1, (64, 64)).astype(np.float32)
    maria = .06*_noise(x*3.7+12,y*3.7+15,table) + .045*_noise(x*9,y*9,table)
    for mx,my,sx,sy in [(-.26,.36,.33,.23),(.12,.25,.17,.23),(.46,.02,.22,.30),(-.28,-.32,.20,.14)]:
        maria -= .16*np.exp(-((x-mx)/sx)**2-((y-my)/sy)**2)
    color = np.clip(.95 + maria - .065*r*r, .52, .99)[:,:,None] * [.965,.986,1.]
    opacity = np.clip((1-r)*radius+.5,0,1)[:,:,None]
    patch[:] = patch*(1-opacity)+color*opacity


def build_sky(scene, *, refined=False):
    w,h = (6144,3072) if refined else (4096,2048)
    rng = np.random.default_rng(35837)
    levels = np.linspace(-90,90,h)
    colors = np.asarray([[26,38,36],[58,77,72],[42,57,61],[17,26,33],[7,11,18],[4,6,12]])/255
    stops = [-90,-7,0,9,25,90]
    if refined:
        colors = np.array([[9,14,11],[25,33,28],[26,34,31],[7,10,11],[2,3,5],[2,2,3]])/255
    rows = np.stack([np.interp(levels,stops,c) for c in colors.T],axis=-1)
    paint = np.repeat(rows[:,None,:],w,axis=1).astype(np.float32)
    for _ in range(6600):
        cx,cy = rng.integers(2,w-2),rng.integers(h//2+8,h-2)
        value = .12+.58*rng.random()**3
        tint = np.array([.87,.91,1.]) if rng.random()<.8 else np.array([1.,.92,.78])
        paint[cy,cx] += value*tint
        paint[cy-1:cy+2,cx] += value*.12*tint
        paint[cy,cx-1:cx+2] += value*.12*tint
    if not refined:
        _moon(paint,13.6,23.8,rng)
    # Keep a pocket of open sky around the high turret and moon.
    clouds = [(-49,4,24,10),(-35,10,17,13),(-21,4,11,10),(-13,1,13,10),
              (10,-1,12,12),(23,2,14,13),(32,5,18,17),(41,12,15,17),
              (55,10,17,20),(-52,24,8,3.3),(-23,21,6,2),(-34,22,3,1.2),
              (-19,9,12,10),(-14,10.3,6.3,7),(16.9,7.2,11,12),(22.5,11.8,8,11)]
    if refined:
        # Stack storm heads behind the right flank; leave the round keep against black.
        clouds = [(-43,4,21,8),(-30,5,17,10),(-15,3,13,11),(-9,1,10,6),
                  (9,0,11,6),(16,3,13,7),(42,6,14,12),
                  (-23,20,7.4,2.2),(-16,20.8,3.4,1.1)]
    for i,(az,el,width,height) in enumerate(clouds):
        mist = (.035 if height>5 else .50) if refined else (.09 if height>5 else .57)
        _draw_cumulus(paint,az-90,el,width,height,360+i,mist)
    if refined:
        _silver_cloud_bank(paint)
        _moon(paint,12.3,23.2,rng,refined=True)
    else:
        cloud_zone = (levels < 22)[:,None,None]
        cloud_weight = np.clip((paint.max(axis=2,keepdims=True)-.38)*2.0,0,1)*cloud_zone
        paint *= (1-cloud_weight) + cloud_weight*np.array([.72,.79,.86],np.float32)
    rgba = np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3] = np.clip(paint,0,1)
    image = bpy.data.images.new("Silver cumulus, full moon and star field",w,h,alpha=False)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(rgba.ravel())
    image.update()
    image.pack()
    world = bpy.data.worlds.new("Moonmere | silver night sky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    sky = nt.nodes.new("ShaderNodeTexEnvironment")
    sky.image = image
    nt.links.new(sky.outputs["Color"],nt.nodes.get("Background").inputs["Color"])
    nt.nodes.get("Background").inputs["Strength"].default_value = .88
