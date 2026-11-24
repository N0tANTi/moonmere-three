"""Moonmere's limestone castle, with a modelled west window and a ring keep."""

import math

import bpy
from mathutils import Vector


def _surface(name, color, masonry=False, metallic=0.0):
    material = bpy.data.materials.new("Moonmere castle | " + name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.79
    shader.inputs["Metallic"].default_value = metallic
    if masonry:
        position = nodes.new("ShaderNodeNewGeometry")
        split = nodes.new("ShaderNodeSeparateXYZ")
        links.new(position.outputs["Position"], split.inputs[0])
        around = nodes.new("ShaderNodeMath")
        around.operation = "ADD"
        links.new(split.outputs["X"], around.inputs[0])
        links.new(split.outputs["Y"], around.inputs[1])
        planar = nodes.new("ShaderNodeCombineXYZ")
        links.new(around.outputs[0], planar.inputs["X"])
        links.new(split.outputs["Z"], planar.inputs["Y"])
        brick = nodes.new("ShaderNodeTexBrick")
        for slot, value in {"Scale": 1, "Mortar Size": 0.014,
                            "Mortar Smooth": 0.75, "Brick Width": 0.95,
                            "Row Height": 0.36}.items():
            brick.inputs[slot].default_value = value
        for slot, multiplier in [("Color1", 1.0), ("Color2", 0.71), ("Mortar", 0.64)]:
            brick.inputs[slot].default_value = (*(v * multiplier for v in color), 1)
        links.new(planar.outputs[0], brick.inputs["Vector"])
        weather = nodes.new("ShaderNodeTexNoise")
        weather.inputs["Scale"].default_value = 0.78
        weather.inputs["Detail"].default_value = 2.0
        links.new(position.outputs["Position"], weather.inputs["Vector"])
        patina = nodes.new("ShaderNodeValToRGB")
        patina.color_ramp.elements[0].position = 0.26
        patina.color_ramp.elements[0].color = (0.50,0.53,0.45,1)
        patina.color_ramp.elements[1].position = 0.67
        patina.color_ramp.elements[1].color = (1,1,1,1)
        links.new(weather.outputs["Fac"], patina.inputs[0])
        glazing = nodes.new("ShaderNodeMixRGB")
        glazing.blend_type = "MULTIPLY"
        glazing.inputs[0].default_value = 0.40
        links.new(brick.outputs["Color"], glazing.inputs[1])
        links.new(patina.outputs["Color"], glazing.inputs[2])
        links.new(glazing.outputs[0], shader.inputs["Base Color"])
    return material


def _quarry_atlas():
    """Bake repeatable ashlar and surface wear into separate channels of one tile."""
    import numpy as np

    size = 1024
    rng = np.random.default_rng(82061)
    y, x = np.indices((size, size), dtype=np.float32)

    def weather(columns, rows):
        samples = rng.random((rows, columns), dtype=np.float32)
        u, v = x * (columns / size), y * (rows / size)
        ix, iy = u.astype(np.int32), v.astype(np.int32)
        u, v = u-ix, v-iy
        u, v = u*u*(3-2*u), v*v*(3-2*v)
        right, up = (ix+1) % columns, (iy+1) % rows
        lower = (1-u)*samples[iy,ix] + u*samples[iy,right]
        upper = (1-u)*samples[up,ix] + u*samples[up,right]
        return (1-v)*lower + v*upper

    rain = weather(34, 4)
    clouds = weather(5, 5) * 0.57 + weather(13, 17) * 0.43
    grain = weather(81, 103) * 0.68 + rng.random((size, size)) * 0.32
    stone = np.zeros_like(x)
    joint_distance = np.zeros_like(x)
    row_sizes = rng.uniform(0.73, 1.25, 34)
    courses = np.r_[0, np.cumsum(row_sizes)] * (size/row_sizes.sum())
    # Slight undulations cross the whole tile. Both sides meet when it wraps.
    sample_y = (y + 4.2*(weather(17, 28)-0.5) + 1.3*(grain-0.5)) % size
    sample_x = (x + 6.2*(weather(25, 18)-0.5)) % size
    for low, high in zip(courses[:-1], courses[1:]):
        mask = (sample_y >= low) & (sample_y < high)
        widths = rng.uniform(0.52, 1.55, rng.integers(12, 17))
        beds = np.r_[0, np.cumsum(widths)] * (size / widths.sum())
        u = (sample_x[mask] + rng.uniform(0, size)) % size
        cell = np.minimum(np.searchsorted(beds, u, side="right")-1, len(widths)-1)
        stone[mask] = rng.normal(0, 0.045, len(widths))[cell]
        ends = np.minimum(u-beds[cell], beds[cell+1]-u)
        joint_distance[mask] = np.minimum(ends, np.minimum(sample_y[mask]-low,
                                                            high-sample_y[mask]))
    grout = np.clip(1-joint_distance/(1.4+1.6*grain), 0, 1)
    patina = 0.27*(clouds-0.50) + 0.24*(rain-0.51) + 0.20*(grain-0.5)
    surface = 0.66 + patina + stone - (0.10+0.12*clouds)*grout
    relief = 0.62 - 0.40*grout + 0.18*(grain-0.5) + 0.12*stone
    weathering = np.clip(0.50 + 2.2*patina, 0, 1)
    pixels = np.ones((size, size, 4), dtype=np.float32)
    for channel, data in enumerate((surface, relief, weathering)):
        pixels[:,:,channel] = np.clip(data, 0, 1)
    image = bpy.data.images.new("Quarry | dressed limestone and runoff", size, size,
                                alpha=False, is_data=True)
    image.pixels.foreach_set(pixels.ravel())
    image.update()
    image.pack()
    return image


def _quarried_finishes():
    atlas = _quarry_atlas()
    palette = []
    # Atlas red holds dressed stone, green its height, blue the runoff and grain.
    finishes = [
        ("silver-grey ashlar", (0.14,0.138,0.137), (0.94,0.925,0.905), "Red", 0.050),
        ("carved limestone", (0.34,0.327,0.309), (0.92,0.91,0.885), "Blue", 0.016),
        ("recessed hoodmould", (0.16,0.155,0.148), (0.61,0.60,0.58), "Blue", 0.021),
        ("charcoal glazing", None, (0.003,0.004,0.003), None, 0),
        ("blackened oak", None, (0.030,0.023,0.017), None, 0),
        ("rain-streaked slate", (0.033,0.041,0.042), (0.155,0.191,0.167), "Blue", 0.021),
        ("slate edges", (0.065,0.072,0.072), (0.19,0.215,0.187), "Blue", 0.014)]
    for name, dark, light, channel, depth in finishes:
        mat = _surface(name,light)
        palette.append(mat)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get("Principled BSDF")
        shader.inputs["Specular IOR Level"].default_value = 0.12
        if channel is None:
            continue
        pos = nodes.new("ShaderNodeTexCoord")
        split = nodes.new("ShaderNodeSeparateXYZ")
        links.new(pos.outputs["Object"], split.inputs[0])
        planar_x = nodes.new("ShaderNodeMath")
        planar_x.operation = "ADD"
        links.new(split.outputs["X"], planar_x.inputs[0])
        links.new(split.outputs["Y"], planar_x.inputs[1])
        uv = nodes.new("ShaderNodeCombineXYZ")
        links.new(planar_x.outputs[0], uv.inputs["X"])
        links.new(split.outputs["Z"], uv.inputs["Y"])
        scale = nodes.new("ShaderNodeVectorMath")
        scale.operation = "SCALE"
        scale.inputs["Scale"].default_value = 0.10
        links.new(uv.outputs[0], scale.inputs[0])
        sample = nodes.new("ShaderNodeTexImage")
        sample.image = atlas
        links.new(scale.outputs[0], sample.inputs["Vector"])
        channels = nodes.new("ShaderNodeSeparateColor")
        links.new(sample.outputs["Color"], channels.inputs["Color"])
        tint = nodes.new("ShaderNodeValToRGB")
        near, far = tint.color_ramp.elements
        near.position, far.position = (0.31,0.88) if channel=="Red" else (0.15,0.86)
        near.color, far.color = (*dark,1), (*light,1)
        links.new(channels.outputs[channel], tint.inputs[0])
        links.new(tint.outputs["Color"], shader.inputs["Base Color"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.27
        bump.inputs["Distance"].default_value = depth
        links.new(channels.outputs["Green" if channel=="Red" else "Blue"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return palette


class _Masonry:
    """Collect the masonry, mouldings and glazing into one mesh per building."""

    def __init__(self, name, materials, collection):
        self.name = name
        self.materials = materials
        self.collection = collection
        self.verts = []
        self.faces = []
        self.slots = []

    def shape(self, verts, faces, slot):
        offset = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend(tuple(i + offset for i in face) for face in faces)
        self.slots.extend([slot] * len(faces))

    def rings(self, layers, slot):
        n = len(layers[0])
        verts = [point for ring in layers for point in ring]
        faces = [tuple(reversed(range(n)))]
        for k in range(len(layers) - 1):
            for i in range(n):
                a, b = k*n+i, k*n+(i+1) % n
                faces.append((a, b, b+n, a+n))
        faces.append(tuple(range(len(verts)-n, len(verts))))
        self.shape(verts, faces, slot)

    def block(self, x, y, z0, width, depth, height, slot=0):
        self.rings([[(x+dx*width/2, y+dy*depth/2, z)
                     for dx, dy in [(-1,-1), (1,-1), (1,1), (-1,1)]]
                    for z in (z0, z0+height)], slot)

    def turn(self, x, y, profile, slot, sides=14, rotation=0):
        self.rings([[(x+r*math.cos(rotation+math.tau*i/sides),
                      y+r*math.sin(rotation+math.tau*i/sides), z)
                     for i in range(sides)] for z,r in profile], slot)

    def mould(self, points, radius, slot=1, sides=7):
        """Tube following a planar line of stonework."""
        ring_list = []
        for i, point in enumerate(points):
            tangent = (Vector(points[min(i+1, len(points)-1)]) -
                       Vector(points[max(0, i-1)])).normalized()
            perp = Vector((-tangent.z, 0, tangent.x))
            ring_list.append([Vector(point) + radius * (
                math.cos(j*math.tau/sides)*perp +
                Vector((0, math.sin(j*math.tau/sides), 0)))
                for j in range(sides)])
        self.rings(ring_list, slot)

    def polygon(self, points, y, slot):
        self.shape([(x, y, z) for x,z in points],
                   [tuple(range(len(points)))], slot)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        for material in self.materials:
            mesh.materials.append(material)
        mesh.polygons.foreach_set("material_index", self.slots)
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        self.collection.objects.link(obj)
        return obj


def _arch(x, z, width, height):
    """Perimeter from the left sill to the right sill, with two pointed arcs."""
    radius = width
    rise = min(height*0.68, 0.8660254*width)
    shoulder = z + height - rise
    points = [(x-width/2,z)]
    for i in range(13):
        angle = math.pi-i*math.pi/36
        points.append((x+width/2+radius*math.cos(angle),
                       shoulder+rise*math.sin(angle)/0.8660254))
    mirror = [(2*x-u, v) for u,v in reversed(points[1:-1])]
    return points + mirror + [(x+width/2,z)]


def _circle(g, x, y, z, r, thickness, slot=1, n=24):
    g.mould([(x+r*math.cos(i*math.tau/n), y,
              z+r*math.sin(i*math.tau/n)) for i in range(n+1)], thickness, slot)


def _window(g, x, y, z, width, height, elaborate=False, door=False):
    outline = _arch(x, z, width, height)
    g.polygon(outline, y-0.032, 4 if door else 3)
    radius = max(0.035, width/29)
    for spread, offset, size, slot in [
            (radius*1.38, -0.072, radius*1.04, 2),
            (radius*0.20, -0.136, radius*0.70, 1)]:
        profile = _arch(x, z, width+spread*2, height+spread*1.1)
        g.mould([(u,y+offset,v) for u,v in profile], size, slot)
    if elaborate:
        y -= 0.185
        r = width * 0.218
        rose_z = z+height-width*0.40
        _circle(g, x, y, rose_z, r, radius*0.42)
        _circle(g, x, y, rose_z, r*0.23, radius*0.26)
        for i in range(6):
            angle = i*math.tau/6+math.pi/2
            dx, dz = math.cos(angle), math.sin(angle)
            _circle(g,x+dx*r*0.62,y,rose_z+dz*r*0.62,r*0.30,radius*0.24,n=12)
        cells = 4
        gap = width / cells
        for i in range(cells):
            cx = x-width/2+gap*(i+0.5)
            h = height-width*(0.74 if i in (1,2) else 0.85)
            inner = _arch(cx,z+0.03,gap*0.96,h)
            g.mould([(u,y,v) for u,v in inner],radius*0.36)
        for direction in (-1,1):
            cx = x+direction*width*0.25
            h = height-width*0.60
            canopy = _arch(cx,z+0.03,width*0.49,h)
            g.mould([(u,y+0.01,v) for u,v in canopy],radius*0.33)
            _circle(g,cx,y,z+h-width*0.12,width*0.057,radius*0.22,n=16)
        g.mould([(x-width/2,y,z+height*0.36),
                 (x+width/2,y,z+height*0.36)], radius*0.30,2)
    elif width > 0.70 and not door:
        g.mould([(x,y-0.14,z),(x,y-0.14,z+height*0.9)],radius*0.4)
    g.block(x,y-0.02,z-0.1,width+radius*4,0.28,0.12,1)


def _gable(g, x, y, z, width, depth, rise):
    g.shape([(x-width/2, y, z), (x+width/2, y, z), (x, y, z+rise),
             (x-width/2,y+depth,z), (x+width/2,y+depth,z), (x,y+depth,z+rise)],
            [(0,1,2),(3,5,4)],0)
    for side in (-1,1):
        edge=x+side*width/2
        g.shape([(edge,y-0.05,z),(x,y-0.05,z+rise),(x,y+depth,z+rise),
                 (edge,y+depth,z)], [(0,1,2,3)],5)
        g.mould([(edge,y-0.11,z),(x,y-0.11,z+rise)],0.115)


def _slate_hall(g, x, y, z, width, depth, rise):
    """Long hipped slate roof, with its ridge running across the camera view."""
    a,b=width/2,depth/2
    ridge=max(0.18,a-depth*0.34)
    g.shape([(x-a,y-b,z),(x+a,y-b,z),(x+a,y+b,z),(x-a,y+b,z),
             (x-ridge,y,z+rise),(x+ridge,y,z+rise)],
            [(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],5)
    for step in range(1,9):
        t=step/9
        half=a+(ridge-a)*t
        line_y=y-b+b*t-0.025
        g.mould([(x-half,line_y,z+rise*t),(x+half,line_y,z+rise*t)],
                0.024,6,5)
    g.mould([(x-ridge,y,z+rise),(x+ridge,y,z+rise)],0.09,2)


def _lantern(g, x, y, base, shaft, roof, radius):
    """Slender octagonal pavilion with a projecting gallery and a slate crown."""
    spring=base+shaft
    g.turn(x,y,[(base,0.88*radius),(spring-1.62,0.88*radius),
                (spring-1.42,radius),(spring-1.29,radius),
                (spring-1.22,0.91*radius),(spring,0.91*radius)],0,8,math.pi/8)
    for a in [k*math.tau/8 for k in range(8)]:
        panel=_arch(0,spring-1.27,radius*0.46,1.02)
        verts=[(x+math.cos(a)*u+math.sin(a)*radius*0.857,
                y+math.sin(a)*u-math.cos(a)*radius*0.857,v) for u,v in panel]
        g.shape(verts,[tuple(range(len(verts)))],3)
    g.turn(x,y,[(spring-0.04,radius*1.05),(spring+0.12,radius*1.12),
                (spring+0.22,radius*1.12)],1,8,math.pi/8)
    g.turn(x,y,[(spring+0.20,radius*1.24),(spring+roof*0.32,radius*0.66),
                (spring+roof*0.93,radius*0.085)],5,8,math.pi/8)
    _spire(g,x,y,spring+roof*0.89,roof*0.22,radius*0.12)


def _spire(g, x, y, bottom, height, r):
    g.turn(x,y,[(bottom,r*1.20),(bottom+height*0.13,r*1.20),
                (bottom+height*0.16,r*0.91),(bottom+height*0.29,r*0.91)],1,8)
    g.turn(x,y,[(bottom+height*0.26,r*1.17),(bottom+height*0.32,r*1.17),
                (bottom+height*0.35,r*0.86),(bottom+height*0.90,r*0.075)],2,8)
    g.turn(x,y,[(bottom+height*0.87,r*0.09),(bottom+height*0.92,r*0.15),
                (bottom+height,r*0.016)],1,8)


def _buttress(g, x, y, z, high, scale=1):
    for f,h,w,d in [(0,0.10,1.45,1.55),(0.10,0.34,1.18,1.30),
                      (0.44,0.29,0.92,1.0),(0.73,0.27,0.68,0.80)]:
        g.block(x,y,z+high*f,w*scale,d*scale,high*h,0)
        g.block(x,y,z+high*(f+h)-0.12,(w+0.14)*scale,(d+0.14)*scale,0.16,1)
        for dx in (-0.35,0.35):
            g.turn(x+dx*w*scale, y-d*scale/2,
                   [(z+high*f,0.07*scale),(z+high*(f+h),0.07*scale)],1,7)
    _spire(g,x,y,z+high,2.65*scale,0.43*scale)


def _keep(g, x,y,z,top,r):
    g.turn(x,y,[(z,r*1.07),(z+0.8,r*1.07),(z+1.05,r),
                (top-1.8,r),(top-1.15,r*1.11),(top-0.67,r*1.11)],0,32)
    for level in (z+1.1,top-5.3,top-1.65,top-1.03,top-0.68):
        g.turn(x,y,[(level,r*(1.13 if level>=top-1.1 else 1.025)),
                    (level+0.13,r*(1.13 if level>=top-1.1 else 1.025))],1,32)
    # Cut a real circular parapet into raised merlons and recessed crenels.
    for i in range(18):
        a = math.tau*i/18
        angles = [a-0.11, a, a+0.11]
        outline = [(x+rr*math.cos(ang),y+rr*math.sin(ang))
                   for rr,arc in ((r*1.11,angles),(r*0.90,reversed(angles)))
                   for ang in arc]
        g.rings([[(u,v,level) for u,v in outline] for level in (top-0.72,top)],0)
    # Angled lancets sit on tangent planes around the cylindrical wall.
    for level in (top-4.60,top-9.0):
        for i in range(12):
            a=i*math.tau/12
            points = _arch(0,level,0.32*r,1.43)
            verts = [(x+math.cos(a)*u+math.sin(a)*(r+0.028),
                      y+math.sin(a)*u-math.cos(a)*(r+0.028),v) for u,v in points]
            g.shape(verts,[tuple(range(len(verts)))],3)


def build_castle(*, refined=False):
    collection = bpy.data.collections.new("Castle | Moonmere Abbey")
    bpy.context.scene.collection.children.link(collection)
    palette = _quarried_finishes() if refined else [_surface("limestone ashlar",(0.66,0.70,0.66),True),
               _surface("moonlit carved stone",(0.86,0.86,0.75)),
               _surface("weathered mouldings",(0.47,0.51,0.46)),
               _surface("lead and dark glass",(0.022,0.047,0.053),metallic=0.28),
               _surface("oak doors",(0.069,0.057,0.038)),
               _surface("oxidised slate",(0.082,0.136,0.128),metallic=0.10),
               _surface("slate laps",(0.135,0.174,0.159))]
    g = _Masonry("Abbey | west front and great rose",palette,collection)
    g.block(2,48.4,5.6,8.8,10.8,13.75)
    _gable(g,2,43,19.35,8.8,10.8,4.10)
    _window(g,2,42.98,10.65,4.35,8.35,True)
    if refined:
        for width, height, depth, radius, slot in [
                (5.02,8.77,42.93,0.083,2),(5.27,8.94,42.88,0.069,1),
                (5.50,9.09,42.93,0.046,2)]:
            ring = _arch(2,10.64,width,height)
            g.mould([(u,depth,v) for u,v in ring],radius,slot)
        for base_z in (10.67,13.68):
            for cell in range(4):
                ring = _arch(2-4.35/2+4.35*(cell+0.5)/4,base_z,1.03,0.83)
                g.mould([(u,42.77,v) for u,v in ring],0.035,1)
    _window(g,2,42.98,6.0,2.05,3.45,door=True)
    # Mouldings spread out from the portal in successive deep archivolts.
    for dx in (-1,1):
        for k in range(2):
            g.turn(2+dx*(1.2+0.17*k),42.78,
                   [(6,0.135),(6.28,0.095),(8.06,0.095),(8.18,0.14)],1,8)
    for width,height in [(2.38,3.72),(2.78,3.99)]:
        ring = _arch(2,6,width,height)
        g.mould([(u,42.78,v) for u,v in ring],0.075,2)
    g.mould([(2,42.86,6.08),(2,42.86,8.72)],0.032,2)
    for z,w in [(6.12,9.12),(9.68,9.10),(10.04,9.05),(19.26,9.02)]:
        g.block(2,43.1,z,w,0.59,0.17,1)
    _window(g,2,42.95,20.10,0.80,1.25)
    for side in (-1,1):
        for k in range(4):
            x = 2+side*(0.89+k*0.54)
            top=21.55-k*0.49
            low=19.62
            ring=_arch(x,low,0.39,top-low)
            g.mould([(u,42.89,v) for u,v in ring],0.050,2)
        for k in range(7):
            x=2+side*(0.27+k*0.56)
            g.block(x,42.86,9.52,0.15,0.32,0.18,2)
    for side in (-1,1):
        _buttress(g,2+side*4.15,42.89,5.9,13.8)
        for i in range(3):
            _window(g,2+side*(2.4+i*0.48),42.96,7.05,0.27,1.45)
    _spire(g,2,43.1,23.38,1.22,0.16)
    g.finish()

    for side,name in [(-1,"cloister"),(1,"chapter house")]:
        g = _Masonry("Abbey | "+name,palette,collection)
        cx=2+side*8.21
        y=44.2 if side<0 else 45.0
        roof=13.95 if side<0 else 15.15
        g.block(cx,y+4.3,5.6,7.62,8.6,roof-5.6)
        if side<0:
            _slate_hall(g,cx-0.53,y+4.03,roof,9.12,9.0,4.66)
            for i in (-1,1):
                dormer_x=cx+i*2.16
                g.block(dormer_x,y+0.76,roof+0.26,1.14,1.64,1.42,0)
                _gable(g,dormer_x,y-0.07,roof+1.68,1.33,1.55,0.92)
                _window(g,dormer_x,y-0.08,roof+0.55,0.53,0.96)
        else:
            _gable(g,cx,y,roof,7.62,8.60,4.25)
        for i in (-1,0,1):
            _window(g,cx+2.18*i,y-0.025,9.15,1.14,4.06)
            _window(g,cx+2.18*i,y-0.03,6.18,0.69,1.94)
        if side>0:
            _window(g,cx,y-0.03,15.03,0.95,1.8)
        for dx in (-3.48,3.48):
            _buttress(g,cx+dx,y-0.06,5.9,roof-4.80,0.83)
        for level in (6.10,8.60,14.45):
            g.block(cx,y,level,7.82,0.42,0.22,1)
        g.finish()

    g = _Masonry("Abbey | high round keep and belfries",palette,collection)
    _keep(g,-5.65,52.1,5.65,27.90,2.72)
    _keep(g,11.65,52.0,5.65,21.35,1.64)
    # Tall open belfry crowns the crossing. Dark lancet apertures reveal its depth.
    g.block(3.25,51.8,18.5,3.9,3.9,5.35)
    for i in (-1,0,1):
        _window(g,3.25+i*1.04,49.83,20.23,0.69,2.80)
    for dx in (-1.98,1.98):
        for dy in (-1.98,1.98):
            _spire(g,3.25+dx,51.8+dy,23.43,2.75,0.36)
    g.turn(3.25,51.8,[(23.77,2.98),(24.03,2.72),(26.95,0.20)],5,4,math.pi/4)
    _spire(g,3.25,51.8,26.65,1.34,0.15)
    for x,y,top,r in [(-9.2,49.1,20.1,1.0),(-2.85,45.0,20.25,0.65),
                       (7.4,47.2,20.6,0.80),(13.40,48.2,17.0,0.73)]:
        g.turn(x,y,[(9.5,r),(top-0.45,r),(top-0.16,r*1.14),(top,r*1.14)],0,10)
        _spire(g,x,y,top,2.85+r,r)
    g.finish()

    g = _Masonry("Abbey | western gallery and northern transept",palette,collection)
    # A forward-projecting aisle ends at a belvedere, breaking up the south wall.
    g.block(-10.73,44.05,5.65,6.16,6.4,6.95)
    _slate_hall(g,-10.73,44.05,12.60,6.50,6.76,2.60)
    for dx in (-1.82,-0.61,0.61,1.82):
        _window(g,-10.73+dx,40.83,8.48,0.88,2.76)
    g.block(-10.73,40.91,8.02,6.45,0.5,0.22,1)
    g.block(-10.73,40.91,12.44,6.45,0.5,0.24,1)
    for x in (-13.48,-7.99):
        _buttress(g,x,40.92,5.75,7.0,0.66)
    _lantern(g,-12.52,49.45,7.1,12.64,4.85,1.20)
    # The right transept turns its long roof toward the viewer. Its octagonal
    # stair tower rises over the nearer gable, against the night sky.
    g.block(10.99,53.37,7.2,9.34,6.30,11.70)
    _slate_hall(g,10.99,53.37,18.90,9.75,6.66,4.32)
    for dx in (-3.52,-1.76,0,1.76,3.52):
        _window(g,10.99+dx,50.19,15.32,1.10,2.84)
    _lantern(g,8.39,51.04,16.20,6.43,4.18,1.22)
    _lantern(g,15.32,52.84,10.45,7.91,3.61,1.01)
    g.finish()
    return collection
