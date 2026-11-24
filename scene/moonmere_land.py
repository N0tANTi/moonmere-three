"""Limestone gorge, Gothic folly and the moonlit cascade for the abbey film."""

import math
import random

import bpy
from mathutils.bvhtree import BVHTree


_bank_surface = None


def bank_height(x, y):
    """Return the height of the highest built bank or zero at the water's edge."""
    hit, _, _, _ = _bank_surface.ray_cast((x, y, 20), (0, 0, -1))
    return hit.z if hit is not None else 0.0


class Masonry:
    """Collect disconnected stones in one indexed mesh to keep EEVEE draws cheap."""

    def __init__(self, materials):
        self.materials = materials
        self.vertices = []
        self.faces = []
        self.indices = []

    def face(self, points, material):
        start = len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(start, start + len(points))))
        self.indices.append(material)

    def rings(self, lower, upper, material, top=None):
        self.face(list(reversed(lower)), material)
        self.face(upper, material if top is None else top)
        for i, point in enumerate(lower):
            j = (i + 1) % len(lower)
            self.face([point, lower[j], upper[j], upper[i]], material)

    def block(self, x, y, z, w, d, h, material, top=None):
        base = [(x-w/2, y-d/2, z), (x+w/2, y-d/2, z),
                (x+w/2, y+d/2, z), (x-w/2, y+d/2, z)]
        self.rings(base, [(a, b, c+h) for a, b, c in base], material, top)

    def prism(self, contour, front, back, material):
        """The X,Z contour is counterclockwise as seen by the viewer."""
        self.face([(x, front, z) for x, z in contour], material)
        self.face([(x, back, z) for x, z in reversed(contour)], material)
        for i, (x, z) in enumerate(contour):
            u, v = contour[(i+1) % len(contour)]
            self.face([(x, front, z), (x, back, z), (u, back, v), (u, front, v)], material)

    def finish(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        for material in self.materials:
            mesh.materials.append(material)
        mesh.polygons.foreach_set("material_index", self.indices)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def pigment(name, color, dark=None, texture_scale=2.0, stretch=(1, 1, 1), relief=0.06):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    tree = mat.node_tree
    bs = tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Roughness"].default_value = .87
    if dark is None:
        return mat
    geo = tree.nodes.new("ShaderNodeNewGeometry")
    vec = tree.nodes.new("ShaderNodeVectorMath")
    vec.operation = 'MULTIPLY'
    vec.inputs[1].default_value = stretch
    tree.links.new(geo.outputs["Position"], vec.inputs[0])
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = texture_scale
    noise.inputs["Detail"].default_value = 3
    noise.inputs["Roughness"].default_value = .68
    tree.links.new(vec.outputs[0], noise.inputs["Vector"])
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = .25
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = .76
    ramp.color_ramp.elements[1].color = (*color, 1)
    tree.links.new(noise.outputs["Fac"], ramp.inputs[0])
    tree.links.new(ramp.outputs[0], bs.inputs["Base Color"])
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .2
    bump.inputs["Distance"].default_value = relief
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bs.inputs["Normal"])
    return mat


def water_material():
    mat = bpy.data.materials.new("Tarn | wind-brushed jade water")
    mat.diffuse_color = (.012, .053, .047, 1)
    mat.use_nodes = True
    tree = mat.node_tree
    bs = tree.nodes.get("Principled BSDF")
    bs.inputs["Metallic"].default_value = .32
    bs.inputs["Roughness"].default_value = .19
    geo = tree.nodes.new("ShaderNodeNewGeometry")
    vec = tree.nodes.new("ShaderNodeVectorMath")
    vec.operation = 'MULTIPLY'
    vec.inputs[1].default_value = (.45, 3.9, 1)
    tree.links.new(geo.outputs["Position"], vec.inputs[0])
    ripples = tree.nodes.new("ShaderNodeTexNoise")
    ripples.noise_dimensions = '4D'
    ripples.inputs["Scale"].default_value = 1.55
    ripples.inputs["Detail"].default_value = 2.3
    ripples.inputs["W"].driver_add("default_value").driver.expression = "frame*0.006"
    tree.links.new(vec.outputs[0], ripples.inputs["Vector"])
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = .26
    ramp.color_ramp.elements[0].color = (.005, .020, .024, 1)
    ramp.color_ramp.elements[1].position = .75
    ramp.color_ramp.elements[1].color = (.027, .092, .072, 1)
    tree.links.new(ripples.outputs["Fac"], ramp.inputs[0])
    tree.links.new(ramp.outputs[0], bs.inputs["Base Color"])
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = .055
    bump.inputs["Strength"].default_value = .32
    tree.links.new(ripples.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs[0], bs.inputs["Normal"])
    return mat


def blackwater():
    mat = bpy.data.materials.new("Tarn | black mirror and wandering ripples")
    mat.use_nodes = True
    mat.diffuse_color = (.003,.009,.005,1)
    tree = mat.node_tree
    bs = tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (.0014,.0036,.0025,1)
    bs.inputs["Roughness"].default_value = .057
    bs.inputs["IOR"].default_value = 1.33
    # Changing the inclination of the water creates the pattern in the reflections.
    # The surface pigment stays dark between the reflections.
    position = tree.nodes.new('ShaderNodeNewGeometry').outputs["Position"]
    ripples = []
    for scale,speed,detail in [((1.25,1.82,1),.007,1.6),((3.1,4.6,1),-.009,1.1)]:
        vec = tree.nodes.new("ShaderNodeVectorMath")
        vec.operation = 'MULTIPLY'
        vec.inputs[1].default_value = scale
        tree.links.new(position,vec.inputs[0])
        noise = tree.nodes.new("ShaderNodeTexNoise")
        noise.noise_dimensions = '4D'
        noise.inputs["Scale"].default_value = 1.
        noise.inputs["Detail"].default_value = detail
        noise.inputs["Roughness"].default_value = .46
        noise.inputs["W"].driver_add("default_value").driver.expression = f"frame*{speed:.3f}"
        tree.links.new(vec.outputs[0],noise.inputs["Vector"])
        ripples.append(noise.outputs['Fac'])
    small = tree.nodes.new("ShaderNodeMath")
    small.operation = 'MULTIPLY_ADD'
    tree.links.new(ripples[1],small.inputs[0])
    small.inputs[1].default_value = .17
    tree.links.new(ripples[0],small.inputs[2])
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs['Distance'].default_value = .033
    bump.inputs['Strength'].default_value = .67
    tree.links.new(small.outputs[0],bump.inputs['Height'])
    tree.links.new(bump.outputs[0],bs.inputs['Normal'])
    # The black lower layer leaves the reflected masonry legible without
    # turning the entire open channel silver at grazing camera angles.
    dark = tree.nodes.new("ShaderNodeBsdfDiffuse")
    dark.inputs["Color"].default_value = (.001,.002,.001,1)
    glaze = tree.nodes.new("ShaderNodeMixShader")
    glaze.inputs[0].default_value = .32
    tree.links.new(bs.outputs[0],glaze.inputs[1])
    tree.links.new(dark.outputs[0],glaze.inputs[2])
    tree.links.new(glaze.outputs[0],tree.nodes["Material Output"].inputs["Surface"])
    return mat


def reflecting_pool():
    data = bpy.data.lightprobes.new("Tarn | planar reflection", 'PLANE')
    data.clip_start = .025
    data.influence_distance = .11
    probe = bpy.data.objects.new(data.name, data)
    bpy.context.collection.objects.link(probe)
    probe.scale = (24,43,1)
    probe.location = (0,1,.055)


def weathered_stone(mat, *, ashlar=False, trim=False):
    tree = mat.node_tree
    bs = tree.nodes.get("Principled BSDF")
    existing = bs.inputs["Base Color"].links[0].from_socket
    xyz = tree.nodes.get("Geometry").outputs['Position']
    noise = tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = .80 if ashlar or trim else .66
    noise.inputs['Detail'].default_value = 3.5
    tree.links.new(xyz,noise.inputs['Vector'])
    moss = tree.nodes.new('ShaderNodeValToRGB')
    stops = moss.color_ramp.elements
    stops[0].position = .29
    stops[0].color = (.14,.21,.105,1) if not trim else (.48,.56,.43,1)
    stops[1].position = .60
    stops[1].color = (1,1,.95,1)
    lichen = stops.new(.415)
    lichen.color = (.46,.54,.31,1) if not trim else (.75,.77,.62,1)
    tree.links.new(noise.outputs['Fac'],moss.inputs[0])
    layer = tree.nodes.new('ShaderNodeMixRGB')
    layer.blend_type = 'MULTIPLY'
    layer.inputs[0].default_value = .84
    tree.links.new(existing,layer.inputs[1])
    tree.links.new(moss.outputs[0],layer.inputs[2])
    tree.links.new(layer.outputs[0],bs.inputs["Base Color"])
    if trim:
        return
    colour = tree.nodes.new('ShaderNodeMixRGB')
    colour.blend_type = 'MULTIPLY'
    colour.inputs[0].default_value = .47 if ashlar else .57
    tree.links.new(layer.outputs[0],colour.inputs[1])
    if ashlar:
        # Reproject the vertical facade into the XY coordinates of the brick texture.
        remap = tree.nodes.new('ShaderNodeVectorRotate')
        remap.rotation_type = 'X_AXIS'
        remap.inputs['Angle'].default_value = math.pi/2
        tree.links.new(xyz,remap.inputs['Vector'])
        blocks = tree.nodes.new('ShaderNodeTexBrick')
        tree.links.new(remap.outputs[0],blocks.inputs['Vector'])
        blocks.inputs['Scale'].default_value = 1.2
        blocks.inputs['Brick Width'].default_value = .98
        blocks.inputs['Row Height'].default_value = .43
        blocks.inputs['Mortar Size'].default_value = .013
        blocks.inputs['Mortar Smooth'].default_value = .72
        blocks.inputs['Mortar'].default_value = (.26,.28,.23,1)
        blocks.inputs['Color1'].default_value = (.92,.93,.9,1)
        blocks.inputs['Color2'].default_value = (.63,.68,.62,1)
        tree.links.new(blocks.outputs['Color'],colour.inputs[2])
    else:
        seam = tree.nodes.new('ShaderNodeTexWave')
        seam.wave_type = 'BANDS'
        seam.bands_direction = 'Z'
        seam.inputs['Scale'].default_value = .68
        seam.inputs['Distortion'].default_value = 8.0
        seam.inputs['Detail Scale'].default_value = .63
        seam.inputs['Detail'].default_value = 2.3
        tree.links.new(xyz,seam.inputs['Vector'])
        bands = tree.nodes.new('ShaderNodeValToRGB')
        bands.color_ramp.elements[0].position = .012
        bands.color_ramp.elements[0].color = (.32,.36,.285,1)
        bands.color_ramp.elements[1].position = .085
        bands.color_ramp.elements[1].color = (1,.99,.94,1)
        tree.links.new(seam.outputs['Fac'],bands.inputs[0])
        tree.links.new(bands.outputs[0],colour.inputs[2])
        exposure = tree.nodes.new('ShaderNodeMath')
        exposure.operation = 'MULTIPLY_ADD'
        tree.links.new(noise.outputs['Fac'],exposure.inputs[0])
        exposure.inputs[1].default_value = 1.75
        exposure.inputs[2].default_value = -.47
        exposure.use_clamp = True
        tree.links.new(exposure.outputs[0],colour.inputs[0])
    tree.links.new(colour.outputs[0],bs.inputs["Base Color"])


def glint_material(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes.new('ShaderNodeEmission')
    shader.inputs['Color'].default_value = (*color, 1)
    shader.inputs['Strength'].default_value = strength
    mat.node_tree.links.new(shader.outputs[0], nodes.get('Material Output').inputs['Surface'])
    return mat


def outcrop(batch, rng, x, y, z, rx, ry, height, material, cap, taper=.89):
    # Angular footing, broken shoulder, slightly sloping cap and exposed moss lip.
    count = rng.randrange(6, 10)
    offset = rng.uniform(0, math.tau)
    footprint = []
    for i in range(count):
        angle = offset + math.tau * i/count
        scale = rng.uniform(.82, 1.12)
        footprint.append((rx*scale*math.cos(angle), ry*scale*math.sin(angle)))
    drift = rng.uniform(-.29, .29)*rx
    tilt_x, tilt_y = rng.uniform(-.22,.22), rng.uniform(-.15,.15)
    lower = [(x+u, y+v, z-.14) for u, v in footprint]
    shoulder = [(x+u*taper+drift, y+v*taper, z+height+u*tilt_x+v*tilt_y+rng.uniform(-.1,.1))
                for u,v in footprint]
    scale = rng.uniform(.70,.88)
    shoulder_depth = min(.48, height*.28)
    upper = [(x+(a-x)*scale, y+(b-y)*scale, c+shoulder_depth*rng.uniform(.55,1.12))
             for a,b,c in shoulder]
    batch.rings(lower, shoulder, material)
    batch.rings(shoulder, upper, material, cap)


def gorge(batch, rng):
    def ridgeline(side, y):
        return side*(11.8 + 1.0*math.sin(y*.22 + side) + .55*math.sin(y*.42))

    for side in (-1, 1):
        stations = list(range(-25, 42, 2))
        shoreline = [(ridgeline(side, y), y, 1.4 + .48*math.sin(y*.31)) for y in stations]
        for a, b in zip(shoreline, shoreline[1:]):
            xa, ya, za = a
            xb, yb, zb = b
            batch.face([(xa, ya, -.6), (xb, yb, -.6), b, a], 1)
            batch.face([a, b, (xb+side*24, yb, zb+2.1), (xa+side*24, ya, za+2.1)], 4)
        y = -24
        while y < 39:
            x = ridgeline(side, y)
            rear = rng.uniform(4.0, 6.6) + 1.0*math.sin(y*.23)
            outcrop(batch, rng, x+side*2.4, y, -.32, 3.5, rng.uniform(2.7, 4.1),
                    rear, rng.randrange(3), rng.choice([3, 4, 5]))
            # Interlocking vertical joints and moss-covered, staggered terrace breaks.
            for _ in range(rng.randrange(3, 6)):
                ry = rng.uniform(.85, 2)
                py = y+rng.uniform(-1.9, 1.9)
                px = x-side*rng.uniform(.15, 1.8)
                h = rng.uniform(1.1, rear*.88)
                outcrop(batch, rng, px, py, -.33, rng.uniform(.7, 1.85), ry, h,
                        rng.randrange(3), rng.choice([3, 4, 5]))
                if rng.random() < .55:
                    outcrop(batch, rng, px-side*.22, py-.08, h-.43, 1.05, ry*.93, .38,
                            1, rng.choice([3, 4]))
                if rng.random()<.76:
                    outcrop(batch, rng, px-side*.72, py+rng.uniform(-.7,.7), -.14,
                            rng.uniform(.88,1.72), rng.uniform(.7,1.5), rng.uniform(.62,1.63),
                            rng.randrange(3), rng.choice([3,4,5]), .65)
            if rng.random() < .7:
                outcrop(batch, rng, x-side*2.8, y+rng.uniform(-1, 1), -.35,
                        rng.uniform(.5, 1.2), 1.2, rng.uniform(.6, 1.25),
                        rng.randrange(3), 3)
            y += rng.uniform(2.45, 3.35)

    batch.block(1, 52.8, -1.6, 36, 26.7, 7.65, 1, 4)
    for i in range(23):
        x = -17 + i*1.6
        y = 39.0 + .9*math.sin(x*.47)
        outcrop(batch, rng, x, y, -.25, 2.2, 2.3, 6.45+rng.uniform(-.18, .44),
                rng.randrange(3), rng.choice([3, 4]))
        if abs(x-5) > 2.6:
            outcrop(batch, rng, x, y-2.35, -.28, 1.9, 2.8, rng.uniform(2.7, 5.6),
                    rng.randrange(3), rng.choice([3, 4]))


def vegetated_faces(batch, rng):
    """Follow the gorge faces with trailing ivy, interrupted joints and radial ferns."""
    for side in (-1, 1):
        for _ in range(235):
            y = rng.uniform(-16, 38)
            z = rng.uniform(.30, 5.8)
            pos, normal, _, _ = _bank_surface.ray_cast((0,y,z), (side,0,0))
            if pos is None or abs(pos.x)>18 or normal.z>.75:
                continue
            # Bias outward so small leaves sit above the cut surface.
            x = pos.x-side*.055
            if rng.random()<.24:
                for j in range(rng.randint(3,7)):
                    dy, dz = rng.uniform(-.22,.22), rng.uniform(-.27,-.075)
                    point, _, _, _ = _bank_surface.ray_cast((0,y+dy,z+dz), (side,0,0))
                    if point is None or abs(point.x-x)>1.:
                        break
                    end = point.x-side*.045
                    batch.face([(x,y,z),(x,y+.021,z),(end,y+dy+.011,z+dz),
                                (end,y+dy,z+dz)], 14)
                    x,y,z = end,y+dy,z+dz
            elif rng.random()<.43:
                # Long pendant strands follow the rock face in three dimensions.
                phase = rng.uniform(0,math.tau)
                for i in range(rng.randint(4,13)):
                    dy = .07*math.sin(phase+i*.64)
                    dz = rng.uniform(.09,.145)
                    dest, _, _, _ = _bank_surface.ray_cast((0,y+dy,z-dz), (side,0,0))
                    if dest is None or abs(dest.x-x)>1 or z<.3:
                        break
                    x2,y2,z2 = dest.x-side*.096,y+dy,z-dz
                    batch.face([(x,y-.016,z),(x,y+.016,z),(x2,y2+.012,z2),
                                (x2,y2-.012,z2)], 14)
                    dx = -side*rng.uniform(.033,.13)
                    lean = (-1 if i%2 else 1) * rng.uniform(.085,.165)
                    batch.face([(x2,y2,z2),(x2+dx*.6,y2+lean*.65,z2+.07),
                                (x2+dx,y2+lean*1.25,z2-.02),
                                (x2+dx*.6,y2+lean*.48,z2-.049)],rng.choice([3,4,5]))
                    x,y,z = x2,y2,z2
            else:
                # Each fern has three to six arching fronds with paired pointed leaflets.
                size = rng.uniform(.30,.83)
                for j in range(rng.randint(3,6)):
                    dy = rng.uniform(-.89,.89)*size
                    dx = -side*rng.uniform(.26,.89)*size
                    dz = rng.uniform(.05,.42)*size
                    for k in range(1,6):
                        t = k/6
                        a,b,c = x+dx*t, y+dy*t, z+dz*t+size*.29*math.sin(t*math.pi)
                        for mirror in (-1,1):
                            lift = size*.19*(1.-t*.66)*mirror
                            batch.face([(a-dx*.10,b-dy*.10,c),(a+dx*.04,b+lift*.62,c+.028),
                                        (a+dx*.14,b+lift,c+.035),(a+dx*.07,b+dy*.07,c)],
                                       rng.choice([3,4,4,5]))


def pointed_arc(cx, span, spring, sign, t, thickness=0):
    radius = 2*span + thickness
    summit = math.acos(-span/radius)
    angle = math.pi + t*(summit-math.pi)
    vx, vz = math.cos(angle), math.sin(angle)
    return (cx-sign*(span + radius*vx), spring+radius*vz)


def arch_band(batch, cx, span, spring, sign, start, end, inner, outer, front, back, mat):
    contour = [pointed_arc(cx, span, spring, sign, start, inner),
               pointed_arc(cx, span, spring, sign, end, inner),
               pointed_arc(cx, span, spring, sign, end, outer),
               pointed_arc(cx, span, spring, sign, start, outer)]
    if sign == 1:
        contour.reverse()
    batch.prism(contour, front, back, mat)


def folly(batch, rng):
    anchor, y, floor, spring = -1.8, 20, .13, 1.98
    spans = [(anchor-3.07, 1.1), (anchor, 1.45), (anchor+3.07, 1.1)]
    for cx, span in spans:
        for sign in (-1, 1):
            for k in range(10):
                t0, t1 = k/10, (k+1)/10
                p0 = pointed_arc(cx, span, spring, sign, t0, .24)
                p1 = pointed_arc(cx, span, spring, sign, t1, .24)
                shape = [p0, p1, (p1[0], 4.87), (p0[0], 4.87)]
                if sign == 1:
                    shape.reverse()
                batch.prism(shape, y-.36, y+.36, rng.choice([6, 6, 7, 8]))
                arch_band(batch, cx, span, spring, sign, t0+.002, t1-.002,
                          0, .24, y-.42, y+.43, rng.choice([6, 7, 8]))
                for inner, outer, front in [(.025, .075, -.50), (.19, .285, -.47), (.30, .345, -.43)]:
                    arch_band(batch, cx, span, spring, sign, t0, t1,
                              inner, outer, y+front, y-.375, 8)
        # A shield-shaped keystone catches light at the apex.
        az = spring + math.sqrt(3)*span
        batch.prism([(cx-.09, az+.09), (cx+.09, az+.09), (cx+.14, az+.34),
                     (cx, az+.42), (cx-.14, az+.34)], y-.56, y-.37, 8)
    # Four carved piers continue the arch mouldings down to broad wet plinths.
    for px in (anchor-4.40, anchor-1.71, anchor+1.71, anchor+4.40):
        batch.block(px, y, floor-.18, .93, 1.28, .31, 7)
        batch.block(px, y, floor+.13, .77, 1.12, .16, 8)
        for k in range(6):
            batch.block(px, y, floor+.29+k*.247, .50, .84, .243, rng.choice([6, 7]))
        for dx in (-.205, 0, .205):
            batch.block(px+dx, y-.42, floor+.29, .092, .18, 1.48, 8)
        for k, (w, h) in enumerate(((.65, .12), (.76, .09), (.83, .11))):
            batch.block(px, y, 1.73+.095*k, w, 1.0+.065*k, h, 8)
    # Finial-topped parapet: minute details must read as silhouettes against the bank.
    for k in range(30):
        x = anchor-4.61+(k+.5)*9.22/30
        batch.block(x, y, 4.88, 9.22/30-.008, .77, .15, rng.choice([6, 7]))
    for z, w, d, h in [(4.83, 9.32, .94, .09), (5.03, 9.4, 1, .095)]:
        batch.block(anchor, y, z, w, d, h, 8)
    for px in [anchor-4.39, anchor+4.39, anchor-1.72, anchor+1.72]:
        batch.block(px, y, 5.125, .36, .42, .20, 7)
        batch.prism([(px-.17, 5.325), (px+.17, 5.325), (px, 5.68)],
                    y-.15, y+.15, 8)
    for x, span in (spans[0], spans[2]):
        # Four petals and an incised centre make a small quatrefoil above either opening.
        for k in range(4):
            angle = k*math.pi/2
            a, b = x+.12*math.cos(angle), 4.42+.12*math.sin(angle)
            rim = [(a+.114*math.cos(j*math.tau/12), b+.114*math.sin(j*math.tau/12))
                   for j in range(12)]
            batch.prism(rim, y-.416, y-.361, 8)
            batch.prism([(a+(u-a)*.63, b+(v-b)*.63) for u, v in rim], y-.422, y-.417, 1)
    for _ in range(13):
        px = anchor + rng.choice([-1, 1])*rng.uniform(3.9, 6.2)
        outcrop(batch, rng, px, y+rng.uniform(-1.25, 1), -.24, rng.uniform(.25, .61),
                rng.uniform(.3, .69), rng.uniform(.33, .78), rng.choice([6, 7, 1]), 4)

    for _ in range(52):
        x = anchor + rng.choice([-1, 1])*rng.uniform(2.8, 4.58)
        z, front = rng.uniform(4.99, 5.12), y-.54
        length = rng.uniform(.25, 1.85)
        steps = max(3, int(length/.13))
        phase = rng.random()*math.tau
        for i in range(steps):
            a, b = x, z
            x += .075*math.sin(phase+i*.51)
            z -= length/steps
            batch.face([(a-.011,front,b),(x-.01,front,z),(x+.01,front,z),(a+.011,front,b)], 5)
            sign = -1 if i%2 else 1
            batch.face([(x,front-.014,z),(x+.08*sign,front-.023,z+.048),
                        (x+.16*sign,front-.006,z+.021),(x+.085*sign,front-.026,z-.049)], rng.choice([3,4,5]))


def veil_material():
    mat = bpy.data.materials.new("Cascade | silver-green aerated water")
    mat.diffuse_color = (.39,.46,.43,1)
    mat.use_nodes = True
    tree = mat.node_tree
    bs = tree.nodes.get("Principled BSDF")
    bs.inputs["Metallic"].default_value = .12
    bs.inputs["Roughness"].default_value = .34
    geo = tree.nodes.new('ShaderNodeNewGeometry')
    vec = tree.nodes.new('ShaderNodeVectorMath')
    vec.operation = 'MULTIPLY'
    vec.inputs[1].default_value = (6.2,.16,.54)
    tree.links.new(geo.outputs["Position"], vec.inputs[0])
    drift = tree.nodes.new('ShaderNodeVectorMath')
    drift.operation = 'ADD'
    tree.links.new(vec.outputs[0], drift.inputs[0])
    drift.inputs[1].driver_add("default_value", 1).driver.expression = "frame*.016"
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.1
    noise.inputs["Detail"].default_value = 2.9
    tree.links.new(drift.outputs[0], noise.inputs["Vector"])
    ramp = tree.nodes.new('ShaderNodeValToRGB')
    for stop, pos, c in [(ramp.color_ramp.elements[0],.2,(.10,.15,.14)),
                         (ramp.color_ramp.elements[1],.83,(.71,.76,.70)),
                         (ramp.color_ramp.elements.new(.57),.57,(.38,.46,.43))]:
        stop.position = pos
        stop.color = (*c,1)
    tree.links.new(noise.outputs["Fac"], ramp.inputs[0])
    tree.links.new(ramp.outputs[0], bs.inputs["Base Color"])
    tree.links.new(ramp.outputs[0], bs.inputs["Emission Color"])
    bs.inputs["Emission Strength"].default_value = .25
    return mat


def cascade(batch, rng):
    def surface(t, lateral):
        y = 22.7 + t*1.87
        cx = 4.9+.46*math.sin(t*.78) + .16*math.sin(t*2.3)
        width = 2.26-.058*t+.14*math.cos(t*2.0)
        x = cx+width*lateral
        # A rounded lip feeds each inclined fall, all joined to the same mesh.
        phase = math.tau*t+.25*math.sin(lateral*3.2)
        z = .036+.686*t-.097*math.sin(phase)+.009*math.sin(x*14+t*3)
        return x,y,max(.032,z)

    across, along = 18, 106
    for j in range(along):
        t0,t1 = 9.45*j/along,9.45*(j+1)/along
        for i in range(across):
            r0,r1 = 2*i/across-1,2*(i+1)/across-1
            batch.face([surface(t0,r0),surface(t0,r1),surface(t1,r1),surface(t1,r0)], 10)
    # Thin broken ribbons of entrained air drift downhill; no grid of bar-shaped strips.
    for _ in range(115):
        t = rng.uniform(.03,9.05)
        lateral = rng.uniform(-.97,.97)
        length = rng.uniform(.13,.62)
        width = rng.uniform(.0018,.0055)
        curve = rng.uniform(-.025,.025)
        for j in range(5):
            pts = []
            for u,sign in [(j/5,-1),(j/5,1),((j+1)/5,1),((j+1)/5,-1)]:
                r = lateral+curve*math.sin(math.pi*u) + sign*width*math.sin(math.pi*u)
                a,b,c = surface(t+length*u,r)
                pts.append((a,b,c+.016))
            batch.face(pts,11)
    # Rough shore blocks confine the stream; their inside edges disappear below the flow.
    for j in range(27):
        t = j*9.35/26
        for side in (-1,1):
            cx,cy,h = surface(t,side)
            radius = rng.uniform(.55,1.08)
            outcrop(batch,rng,cx+side*(radius-.11),cy+rng.uniform(-.32,.32),
                    -.15,radius,rng.uniform(.6,1.57),h+rng.uniform(.12,.6),
                    rng.randrange(3),rng.choice([3,4,5]),rng.uniform(.72,.92))
    for _ in range(105):
        x = rng.gauss(4.9,.9)
        y = rng.gauss(22.5,.34)
        w = rng.uniform(.025,.145)
        batch.face([(x-w,y,.045),(x,y-.045,.046),(x+w,y,.045),
                    (x+w*.2,y+.034,.047)],rng.choice([10,11,13]))


def tarn(batch, rng):
    batch.face([(-30,-40,0),(30,-40,0),(30,45,0),(-30,45,0)], 9)
    # Broken, tapered ribbons pick out the moving surface in the same colours as the falls.
    for _ in range(540):
        py = rng.uniform(-22,30)
        px = rng.uniform(-9,9)
        if abs(px-2.2-math.sin(py*.19)*.75)<1.7 and rng.random()<.75:
            mat = rng.choice([12, 13])
        else:
            mat = 12
        w, d = rng.uniform(.08,.5), rng.uniform(.005,.025)
        batch.face([(px-w,py,.012),(px-w*.13,py+d,.012),
                    (px+w,py+.012,.012),(px+w*.09,py-d,.012)], mat)
    for k in range(22):
        cx, cy = rng.uniform(-7.9,7.9), rng.uniform(-15,22)
        for index in range(2):
            radius = .22+index*.20+rng.uniform(-.05,.05)
            phase, extent = rng.uniform(0,math.tau), rng.uniform(1.4,4.6)
            for n in range(14):
                a, b = phase+extent*n/14, phase+extent*(n+1)/14
                batch.face([(cx+radius*math.cos(a),cy+radius*math.sin(a),.016),
                            (cx+radius*math.cos(b),cy+radius*math.sin(b),.016),
                            (cx+(radius+.012)*math.cos(b),cy+(radius+.012)*math.sin(b),.016),
                            (cx+(radius+.012)*math.cos(a),cy+(radius+.012)*math.sin(a),.016)], 12)


def sparkles(rng):
    for group in range(4):
        mat = bpy.data.materials.new("Tarn | fine glimmer %02d" % group)
        mat.use_nodes = True
        mat.surface_render_method = 'BLENDED'
        tree = mat.node_tree
        shader = tree.nodes.new('ShaderNodeEmission')
        shader.inputs["Color"].default_value = (.72,.79,.71,1)
        shader.inputs["Strength"].default_value = 1.6
        fade = tree.nodes.new('ShaderNodeMixShader')
        fade.inputs[0].driver_add("default_value").driver.expression = (
            f"0.12+0.82*max(0,sin(frame*.045+{group*1.60:.3f}))**3")
        tree.links.new(tree.nodes.new('ShaderNodeBsdfTransparent').outputs[0], fade.inputs[1])
        tree.links.new(shader.outputs[0], fade.inputs[2])
        tree.links.new(fade.outputs[0],tree.nodes.get('Material Output').inputs['Surface'])
        sheen = Masonry([mat])
        for i in range(5):
            py = rng.uniform(7,22)
            px = 2.5 + math.sin(py*.19)*.69 + rng.uniform(-.88,.88)
            size = rng.uniform(.043,.087)
            height = rng.uniform(.058,.096)
            rays = [(size,.009)]
            if i%2 == 0:
                rays.append((.006,size*.64))
            for width,h in rays:
                sheen.face([(px-width,py,height),(px,py,height-h),(px+width,py,height),
                            (px,py,height+h)],0)
        sheen.finish("Tarn | tiny silver reflections %02d" % group)


def moon_glints():
    rng = random.Random(9304)
    for group in range(8):
        mat = bpy.data.materials.new("Tarn | starlight filament %02d" % group)
        mat.use_nodes = True
        mat.surface_render_method = 'BLENDED'
        tree = mat.node_tree
        uv = tree.nodes.new('ShaderNodeTexCoord').outputs['UV']
        centered = tree.nodes.new('ShaderNodeVectorMath')
        centered.operation = 'SUBTRACT'
        centered.inputs[1].default_value = (.5,.5,0)
        tree.links.new(uv,centered.inputs[0])
        abs_vec = tree.nodes.new('ShaderNodeVectorMath')
        abs_vec.operation = 'ABSOLUTE'
        tree.links.new(centered.outputs[0],abs_vec.inputs[0])
        axes = tree.nodes.new('ShaderNodeSeparateXYZ')
        tree.links.new(abs_vec.outputs[0],axes.inputs[0])
        beams = []
        for x_weight,y_weight in [(10.,90.),(88.,9.),(32.,32.)]:
            x = tree.nodes.new('ShaderNodeMath')
            x.operation = 'MULTIPLY'
            tree.links.new(axes.outputs['X'],x.inputs[0])
            x.inputs[1].default_value = -x_weight
            f = tree.nodes.new('ShaderNodeMath')
            f.operation = 'MULTIPLY_ADD'
            tree.links.new(axes.outputs['Y'],f.inputs[0])
            f.inputs[1].default_value = -y_weight
            tree.links.new(x.outputs[0],f.inputs[2])
            beam = tree.nodes.new('ShaderNodeMath')
            beam.operation = 'EXPONENT'
            tree.links.new(f.outputs[0],beam.inputs[0])
            beams.append(beam.outputs[0])
        cross = tree.nodes.new('ShaderNodeMath')
        cross.operation = 'MAXIMUM'
        tree.links.new(beams[0],cross.inputs[0])
        tree.links.new(beams[1],cross.inputs[1])
        pulse = tree.nodes.new('ShaderNodeMath')
        pulse.operation = 'MULTIPLY_ADD'
        tree.links.new(cross.outputs[0],pulse.inputs[0])
        pulse.inputs[1].driver_add("default_value").driver.expression = (
            f".045+.98*max(0,sin(frame*{.047+.002*group:.3f}+{group*1.73:.3f}))**4")
        core = tree.nodes.new('ShaderNodeMath')
        core.operation = 'MULTIPLY'
        core.inputs[1].default_value = .33
        tree.links.new(beams[2],core.inputs[0])
        tree.links.new(core.outputs[0],pulse.inputs[2])
        emission = tree.nodes.new('ShaderNodeEmission')
        emission.inputs['Color'].default_value = (.82,.90,1.,1)
        emission.inputs['Strength'].default_value = 2.8
        mix = tree.nodes.new('ShaderNodeMixShader')
        tree.links.new(pulse.outputs[0],mix.inputs[0])
        tree.links.new(tree.nodes.new('ShaderNodeBsdfTransparent').outputs[0],mix.inputs[1])
        tree.links.new(emission.outputs[0],mix.inputs[2])
        tree.links.new(mix.outputs[0],tree.nodes.get('Material Output').inputs['Surface'])
        stars = Masonry([mat])
        for i in range(4):
            y = rng.uniform(4.7,20) if i<3 else rng.uniform(20,26)
            x = 2.46+.74*math.sin(.22*y)+rng.gauss(0,.64)
            r = rng.uniform(.105,.255)*(1.25 if i==0 and group in (2,6) else 1)
            # Preserve the fading lower ray above the opaque surface.
            height = .019+1.45*r
            stars.face([(x-r,y-.17*r,.019),(x+r,y-.17*r,.019),
                        (x+r,y+.14*r,height),(x-r,y+.14*r,height)],0)
        obj = stars.finish("Tarn | reflected pinpoints %02d" % group)
        obj.hide_probe_plane = True
        uv_layer = obj.data.uv_layers.new(name="Star center")
        for face in obj.data.polygons:
            for loop,uv_pair in zip(face.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):
                uv_layer.data[loop].uv = uv_pair


def build_land(*, refined=False):
    global _bank_surface
    rng = random.Random(170211)
    mats = [
        pigment("Ravine | silver limestone", (.48,.50,.39), (.16,.20,.16), 2.1, (1.9,1.4,.24)),
        pigment("Ravine | cool cleavage", (.33,.39,.35), (.11,.15,.145), 2.5, (1.7,1.5,.26)),
        pigment("Ravine | weathered chalk", (.57,.55,.43), (.21,.25,.20), 1.5, (2.1,1.7,.27)),
        pigment("Banks | sunless moss", (.16,.225,.078), (.045,.087,.046), 2.8),
        pigment("Banks | deep fern moss", (.095,.164,.080), (.024,.061,.046), 2.2),
        pigment("Banks | lichen", (.25,.31,.10), (.068,.103,.048), 3.6),
        pigment("Folly | grey ivory", (.70,.72,.62), (.31,.35,.33), 3.3),
        pigment("Folly | lavender tufa", (.59,.62,.57), (.31,.34,.34), 2.5),
        pigment("Folly | carved ivory", (.83,.81,.70), (.50,.54,.49), 4.1),
        blackwater() if refined else water_material(),
        veil_material(),
        glint_material("Cascade | threads of foam", (.59,.69,.62), .94),
        glint_material("Tarn | dark reflected lines", (.046,.102,.087), .72),
        glint_material("Tarn | moon-path lines", (.19,.30,.27), .84),
        pigment("Banks | cracks and old ivy", (.074,.086,.053)),
    ]
    if refined:
        for mat in mats[:3]:
            weathered_stone(mat)
        for mat in mats[6:8]:
            weathered_stone(mat,ashlar=True)
        weathered_stone(mats[8],trim=True)
    rocks = Masonry(mats)
    gorge(rocks, rng)
    _bank_surface = BVHTree.FromPolygons(rocks.vertices, rocks.faces)
    rocks.finish("Ravine | jointed limestone and moss shelves")
    plants = Masonry(mats)
    vegetated_faces(plants,rng)
    plants.finish("Ravine | cliff ferns, trailing ivy and thin joints")
    arcade = Masonry(mats)
    folly(arcade, rng)
    folly_object = arcade.finish("Folly | triple pointed arcade and pendant ivy")
    angle = math.radians(7)
    folly_object.rotation_euler.z = angle
    folly_object.location = (20*math.sin(angle)-1.8,20*(1-math.cos(angle)),0)
    stream = Masonry(mats)
    cascade(stream, rng)
    stream.finish("Cascade | flowing silver over limestone")
    pool = Masonry(mats)
    if refined:
        pool.face([(-30,-40,0),(30,-40,0),(30,45,0),(-30,45,0)],9)
        reflecting_pool()
    else:
        tarn(pool, rng)
    pool_object = pool.finish("Tarn | blackwater and etched ripples")
    if refined:
        # Let the probe see the banks and abbey through the back of the water plane.
        pool_object.hide_probe_plane = True
        moon_glints()
    else:
        sparkles(rng)
