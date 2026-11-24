"""The lily pool, reeds and hillside trees for the moonlit castle camera flight."""

import math
import random

import bpy
import numpy as np
from mathutils import Vector


TAU = 2 * math.pi


class Geometry:
    """Collect small botanical details into a few editable meshes."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.indices = []
        self.uvs = {}

    def patch(self, points, facets, material, uv=None):
        first = len(self.verts)
        self.verts.extend(tuple(p) for p in points)
        if uv is not None:
            self.uvs.update((first + i, p) for i, p in enumerate(uv))
        for face in facets:
            self.faces.append(tuple(first + i for i in face))
            self.indices.append(material)

    def mesh(self, name, palette):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.verts, [], self.faces)
        for mat in palette:
            mesh.materials.append(mat)
        mesh.polygons.foreach_set("material_index", self.indices)
        if self.uvs:
            coords = np.zeros((len(self.verts), 2), dtype=np.float32)
            coords[list(self.uvs)] = list(self.uvs.values())
            indices = np.empty(len(mesh.loops), dtype=np.int32)
            mesh.loops.foreach_get("vertex_index", indices)
            mesh.uv_layers.new(name="Botanical pigments").uv.foreach_set("vector", coords[indices].ravel())
            mesh.polygons.foreach_set("use_smooth", np.ones(len(mesh.polygons), dtype=bool))
        mesh.update()
        return mesh


def material(name, rgb, roughness=0.78, reflected_light=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Emission Color"].default_value = (*rgb, 1)
    shader.inputs["Emission Strength"].default_value = reflected_light
    return mat


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def place(mesh, group, name, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, mesh)
    group.objects.link(obj)
    obj.location = location
    return obj


def limb(geo, start, end, ra, rb, mat, sides=7):
    a, b = Vector(start), Vector(end)
    axis = (b - a).normalized()
    u = axis.cross(Vector((0, 1, 0)))
    if u.length < 0.01:
        u = axis.cross(Vector((1, 0, 0)))
    u.normalize()
    v = axis.cross(u)
    points = []
    for center, radius in ((a, ra), (b, rb)):
        for i in range(sides):
            angle = i * TAU / sides
            points.append(center + radius * (u * math.cos(angle) + v * math.sin(angle)))
    geo.patch(points, [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides)
                       for i in range(sides)], mat)


def crown(geo, rng, center, axes, shade, detail=135):
    """A folded inner group of leaves with separate outer leaves breaking its outline."""
    cx, cy, cz = center
    ax, ay, az = axes
    phase = rng.random() * TAU
    segments, rings = 9, 5
    inner = [(cx, cy, cz - az * .79)]
    for row in range(1, rings):
        latitude = -math.pi * .5 + math.pi * row / rings
        for i in range(segments):
            angle = phase + TAU * (i + .35 * (row % 2)) / segments
            distance = rng.uniform(.59, .76)
            inner.append((cx + ax * distance * math.cos(latitude) * math.cos(angle),
                          cy + ay * distance * math.cos(latitude) * math.sin(angle),
                          cz + az * math.sin(latitude) * rng.uniform(.59, .79)))
    inner.append((cx, cy, cz + az * .8))
    sides = []
    for i in range(segments):
        n = (i + 1) % segments
        sides.extend([(0, 1 + n, 1 + i),
                      (len(inner) - 1, 1 + (rings - 2) * segments + i,
                       1 + (rings - 2) * segments + n)])
        for row in range(rings - 2):
            p = 1 + row * segments
            sides.extend([(p + i, p + n, p + n + segments),
                          (p + i, p + n + segments, p + i + segments)])
    geo.patch(inner, sides, shade)
    for _ in range(detail):
        angle = rng.random() * TAU
        z = rng.uniform(-1, 1)
        radial = math.sqrt(1 - z * z) * rng.uniform(.84, 1.02)
        x = cx + ax * radial * math.cos(angle)
        y = cy + ay * radial * math.sin(angle)
        height = cz + az * z * rng.uniform(.82, 1)
        direction = angle + rng.uniform(-1.2, 1.2)
        cs, sn = math.cos(direction), math.sin(direction)
        length = rng.uniform(.09, .22) * (ax + ay) * .48
        width = length * rng.uniform(.31, .51)
        tilt = rng.uniform(-.2, .55) * length
        index = min(8, shade + rng.choice((0, 1, 1, 2, 3, 3, 4)) + int(z > .42))
        geo.patch([(x - length * cs, y - length * sn, height - tilt),
                   (x + sn * width, y - cs * width, height),
                   (x + length * cs, y + length * sn, height + tilt),
                   (x - sn * width, y + cs * width, height + .035),
                   (x, y, height + width * .44)],
                  [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], index)
    # Pairs of leaves on the same stem read as sprays at the crown's outer edge.
    for _ in range(detail // 4):
        a = rng.uniform(0, TAU)
        z = rng.uniform(-.72, .96)
        d = math.sqrt(1 - z*z)
        along = Vector((math.cos(a), math.sin(a), rng.uniform(-.15,.45)))
        cross = Vector((-along.y, along.x, .18))
        root = Vector((cx + ax * d * along.x * .86, cy + ay * d * along.y * .86,
                       cz + az * z * .91))
        length = (.21 + .17*rng.random()) * (ax + ay) * .5
        index = min(8, shade + rng.choice((1, 2, 2, 3, 4)) + int(z > .29))
        for row in range(3):
            c = root + along * row * length * .31
            for side in (-1, 1):
                tip = c + length * (.57 * along + side * (.57 - .09 * row) * cross)
                tip.z += .06 * length
                mid = c.lerp(tip, .5)
                wing = length * (.12 * along - side * .06 * cross)
                gable = mid + Vector((0, 0, length*.043))
                geo.patch([c, mid-wing, tip, mid+wing, gable],
                          [(0,1,4), (1,2,4), (2,3,4), (3,0,4)], index)


def _paint_leaf(image, root, tip, width, color):
    """Paint an ovate leaf with a curved midrib and a shadow on its folded side."""
    x0, y0 = root
    x1, y1 = tip
    dx, dy = x1-x0, y1-y0
    length = math.hypot(dx,dy)
    if length < .1:
        return
    xlo, xhi = max(0,int(min(x0,x1)-width-1)), min(image.shape[1],int(max(x0,x1)+width+2))
    ylo, yhi = max(0,int(min(y0,y1)-width-1)), min(image.shape[0],int(max(y0,y1)+width+2))
    if xhi <= xlo or yhi <= ylo:
        return
    ys,xs = np.mgrid[ylo:yhi,xlo:xhi]
    t = ((xs-x0)*dx + (ys-y0)*dy)/(length*length)
    dist = ((ys-y0)*dx - (xs-x0)*dy)/length
    midrib = width*.12*np.sin(3.14*t)
    rel = dist-midrib
    profile = np.sin(np.pi*np.clip(t,0,1))**.69 * width * (1.13-.29*t)
    coverage = np.clip(profile-np.abs(rel)+.50,0,1) * ((t>0)&(t<1))
    shading = .72 + .22*(rel > 0) + .19*np.exp(-np.abs(rel)*2.3) + .12*t
    pigment = np.array(color) * shading[:,:,None]
    region = image[ylo:yhi,xlo:xhi]
    region[:,:,:3] += (pigment - region[:,:,:3]) * coverage[:,:,None]
    region[:,:,3] = np.maximum(region[:,:,3], coverage)


def _packed_image(name, pixels):
    height,width = pixels.shape[:2]
    image = bpy.data.images.new(name,width,height,alpha=True)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels.astype(np.float32).ravel())
    image.update()
    image.pack()
    return image


def _canopy_paint():
    rng = random.Random(21058)
    pixels = np.zeros((256,256,4), dtype=np.float32)
    pixels[:] = (.021,.032,.011,1)
    for i in range(2600):
        x,y = rng.random()*256,rng.random()*256
        a = .77*math.sin(y/256*TAU)+rng.uniform(-2.45,2.45)
        length = rng.uniform(4.5,16.0)
        dx,dy = math.cos(a)*length, math.sin(a)*length
        width = length*rng.uniform(.15,.28)
        light = rng.uniform(.37,1.02) * (1 + .16*math.sin(x/256*TAU)*math.cos(y/256*TAU))
        color = (.181*light,.215*light,.079*light)
        # Repeat individual leaves across image borders so the texture tiles.
        for sx in ([0,256] if x<22 else [0,-256] if x>234 else [0]):
            for sy in ([0,256] if y<22 else [0,-256] if y>234 else [0]):
                _paint_leaf(pixels,(x+sx,y+sy),(x+sx+dx,y+sy+dy),width,color)
    diffuse = _packed_image("Hand-painted oak leaves • repeating canopy", pixels)

    pixels = np.zeros((512,512,4),dtype=np.float32)
    # Four cutouts provide alternate terminal sprays across the canopy silhouette.
    for variant in range(4):
        offx,offy = (variant % 2)*256,(variant//2)*256
        origin = np.array((128+offx, 11+offy))
        for branch in range(6):
            a = math.radians(38+branch*20+rng.uniform(-7,7))
            length = rng.uniform(90,190)*(1.15 if branch in (2,3) else .90)
            vector = np.array([math.cos(a),math.sin(a)])
            perp = np.array([-vector[1],vector[0]])
            start = origin+np.array([rng.uniform(-5,5),rng.uniform(0,8)])
            end = start+length*vector
            _paint_leaf(pixels,start,end,.92,(.107,.119,.047))
            for row in range(6):
                t = .17+.13*row
                for sign in (-1,1):
                    p = start+vector*length*(t+rng.uniform(-.05,.05))
                    leaf_length = rng.uniform(18,33)*(1.11-.32*t)
                    tip = p + leaf_length*(vector*.77 + sign*perp*rng.uniform(.58,.99))
                    value = rng.uniform(.59,1.32) * (.82+.28*t)
                    color = (.153*value,.209*value,.068*value)
                    _paint_leaf(pixels,p,tip,leaf_length*rng.uniform(.16,.255),color)
            _paint_leaf(pixels,end-vector*9,end+vector*14,4,(.164,.218,.080))
    return diffuse, _packed_image("Oak and willow • four leafy sprigs",pixels)


def _canopy_finish(palette):
    diffuse, sprays = _canopy_paint()
    for i,mat in enumerate(palette[2:]):
        nodes,links = mat.node_tree.nodes,mat.node_tree.links
        shader = nodes.get("Principled BSDF")
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = diffuse
        multiply = nodes.new("ShaderNodeVectorMath")
        multiply.operation = "SCALE"
        multiply.inputs["Scale"].default_value = .34 + .091*i
        links.new(tex.outputs["Color"], multiply.inputs[0])
        wood = nodes.new("ShaderNodeTexCoord")
        gaps = nodes.new("ShaderNodeTexNoise")
        gaps.inputs["Scale"].default_value = 4.8
        gaps.inputs["Detail"].default_value = 2.4
        links.new(wood.outputs["Object"],gaps.inputs["Vector"])
        shade = nodes.new("ShaderNodeValToRGB")
        shade.color_ramp.elements[0].position = .28
        shade.color_ramp.elements[0].color = (.24,.33,.19,1)
        shade.color_ramp.elements[1].position = .68
        shade.color_ramp.elements[1].color = (.96,.99,.88,1)
        links.new(gaps.outputs["Fac"],shade.inputs[0])
        fleck = nodes.new("ShaderNodeVectorMath")
        fleck.operation = "MULTIPLY"
        links.new(multiply.outputs[0],fleck.inputs[0])
        links.new(shade.outputs[0],fleck.inputs[1])
        links.new(fleck.outputs[0], shader.inputs["Base Color"])
        links.new(fleck.outputs[0], shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = .083
        shader.inputs["Specular IOR Level"].default_value = .20
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .23
        bump.inputs["Distance"].default_value = .016
        links.new(tex.outputs["Color"],bump.inputs["Height"])
        links.new(bump.outputs["Normal"],shader.inputs["Normal"])
    mat = material("Canopy • cut leaf sprays",(.108,.145,.066),.79)
    nodes,links = mat.node_tree.nodes,mat.node_tree.links
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = sprays
    shader = nodes.get("Principled BSDF")
    links.new(tex.outputs["Color"],shader.inputs["Base Color"])
    links.new(tex.outputs["Color"],shader.inputs["Emission Color"])
    shader.inputs["Emission Strength"].default_value = .14
    clip = nodes.new("ShaderNodeMath")
    clip.operation = "GREATER_THAN"
    clip.inputs[1].default_value = .34
    links.new(tex.outputs["Alpha"],clip.inputs[0])
    links.new(clip.outputs[0],shader.inputs["Alpha"])
    palette.append(mat)


def _fine_crown(geo, rng, center, axes, shade, detail=135):
    origin, scale = Vector(center),Vector(axes)
    lobes = [rng.uniform(0,TAU) for _ in range(4)]
    segments,rows = 16,9

    def surface(theta, phi):
        cp = math.cos(phi)
        swell = (.83 + .158*cp*math.sin(3*theta+lobes[0]+phi)
                 + .135*math.sin(4*phi+lobes[1]+cp*math.cos(2*theta))
                 + .095*cp*math.sin(6*theta+3*phi+lobes[2])
                 + .037*math.sin(8*phi+lobes[3]))
        normal = Vector((cp*math.cos(theta),cp*math.sin(theta),math.sin(phi)))
        return origin+normal*scale*swell, normal

    shell, uv, quads = [],[],[]
    for row in range(rows+1):
        for i in range(segments+1):
            phi = (row/rows-.5)*math.pi
            theta = i/segments*TAU
            p,_ = surface(theta,phi)
            shell.append(p)
            uv.append((i/segments*3.4+lobes[0],row/rows*1.95+lobes[1]))
            if row and i:
                ix = row*(segments+1)+i
                quads.append((ix-segments-2,ix-segments-1,ix,ix-1))
    geo.patch(shell,quads,shade,uv)
    sprigs = int(detail*.67)
    for j in range(sprigs):
        theta = j*2.39996+rng.uniform(-.16,.16)
        phi = math.asin((j+.5)/sprigs*2-1)
        root,normal = surface(theta,phi)
        side = Vector((-math.sin(theta),math.cos(theta),rng.uniform(-.35,.35))).normalized()
        tangent = normal.cross(side).normalized()
        size = (axes[0]+axes[1])*.5*rng.uniform(.31,.49)
        heading = (normal*rng.uniform(.64,1) + tangent*rng.uniform(-.46,.61)
                   + side*rng.uniform(-.33,.33)).normalized()
        width = side*size*rng.uniform(.49,.74)
        base = root-normal*size*.105
        mid = base+heading*size*.5+normal*size*.10
        tip = base+heading*size
        variant = rng.randrange(4)
        u,v = .5*(variant%2),.5*(variant//2)
        geo.patch([base-width,base+width,mid-width,mid+width,tip-width,tip+width],
                  [(0,1,3,2),(2,3,5,4)],9,
                  [(u,v),(u+.5,v),(u,v+.25),(u+.5,v+.25),(u,v+.5),(u+.5,v+.5)])


def oak(seed, palette, tall, foliage=crown):
    rng = random.Random(seed)
    g = Geometry()
    h = rng.uniform(5.2, 6.8)
    p0 = Vector((0, 0, -.55))
    junction = Vector((rng.uniform(-.23, .23), rng.uniform(-.22, .22), h * .34))
    limb(g, p0, junction, .30, .17, 0, 9)
    for k in range(6):
        angle = TAU * (k + rng.uniform(-.22, .22)) / 6
        spread = rng.uniform(1, 1.65) * (.74 if tall else 1)
        elbow = junction + Vector((math.cos(angle) * spread * .72,
                                   math.sin(angle) * spread * .72, h * rng.uniform(.12, .23)))
        end = elbow + Vector((math.cos(angle + .22) * spread * .51,
                              math.sin(angle + .22) * spread * .51, h * rng.uniform(.14, .24)))
        limb(g, junction, elbow, .145, .10, 0)
        limb(g, elbow, end, .102, .055, 1)
        for j in range(3):
            azimuth = angle + (j - 1) * 1.18 + rng.uniform(-.3, .3)
            d = rng.uniform(.22, 1.15)
            tip = end + Vector((d * math.cos(azimuth), d * math.sin(azimuth),
                                rng.uniform(.14, .88) + (.6 if tall else 0)))
            limb(g, end, tip, .055, .018, 1, 5)
            size = rng.uniform(.79, 1.3)
            foliage(g, rng, tip, (size, size * rng.uniform(.72, 1.12), size * rng.uniform(.64, 1)),
                  rng.choice((2, 2, 3, 3, 4)), 74)
    foliage(g, rng, (junction.x, junction.y, h * (.94 if tall else .84)),
          (1.34, 1.28, 1.42), 3, 115)
    return g.mesh("Oak boughs and leaves %d" % seed, palette)


def cypress(seed, palette, foliage=crown):
    rng = random.Random(seed)
    g = Geometry()
    limb(g, (0, 0, -.45), (.08, 0, 6.2), .15, .032, 0)
    for row in range(7):
        height = 1.58 + row * .74
        radius = 1.04 * math.sin((row + 1.6) / 9.1 * math.pi) ** .68
        for j in range(3 if row < 6 else 1):
            a = TAU * j / 3 + row * 1.33
            foliage(g, rng, (radius * math.cos(a) * .45, radius * math.sin(a) * .45, height),
                  (radius * .7, radius * .64, 1.05 if row < 5 else .81),
                  2 if row % 3 else 3, 58)
    return g.mesh("Columnar cypress %d" % seed, palette)


def shrub(seed, palette, foliage=crown):
    rng = random.Random(seed)
    g = Geometry()
    for j in range(8):
        angle = 2.4 * j
        d = rng.uniform(.15, 1.23)
        size = rng.uniform(.61, .99)
        pos = Vector((d * math.cos(angle), d * math.sin(angle), rng.uniform(.25, .88)))
        limb(g, (0, 0, -.31), pos, .06, .014, 1, 5)
        foliage(g, rng, pos, (size, size * 1.04, size * .78), rng.choice((3, 4, 5)), 56)
    return g.mesh("Brambles and low branches %d" % seed, palette)


def hillsides(rng, bank_height, refined=False):
    group = collection("Grove • oaks and cypresses")
    palette = [material("Bark • " + n, c) for n, c in (
        ("wet umber", (.073, .051, .038)), ("lichen", (.12, .123, .079)))]
    palette += [material("Canopy • " + n, c, reflected_light=.28) for n, c in (
        ("fir shadow", (.018, .043, .025)), ("laurel", (.035, .071, .032)),
        ("boxwood", (.060, .109, .041)), ("olive", (.093, .148, .056)),
        ("moonleaf", (.145, .206, .072)), ("sage", (.192, .249, .102)),
        ("silver tips", (.236, .286, .130)))]
    if refined:
        _canopy_finish(palette)
    foliage = _fine_crown if refined else crown
    oaks = [oak(413 + i, palette, i % 3 == 0, foliage) for i in range(5)]
    sentinels = [cypress(733 + i, palette, foliage) for i in range(2)]
    scrub = [shrub(318 + i, palette, foliage) for i in range(3)]
    for sign in (-1, 1):
        for row, count in enumerate((19, 14)):
            for i in range(count):
                y = -13 + (i + rng.uniform(-.48, .48)) * (64 / count)
                x = sign * (rng.uniform(9.7, 13.4) if not row else rng.uniform(13.5, 18))
                z = bank_height(x, y) if bank_height else (5.4 + 1.05 * row if y < 32 else 6.0)
                if z < .35:
                    continue
                slim = rng.random() < .22
                mesh = rng.choice(sentinels if slim else oaks)
                tree = place(mesh, group, "Cypress" if slim else "Hillside oak", (x, y, z - .12))
                tree.rotation_euler.z = rng.random() * TAU
                size = rng.uniform(.64, 1.25) * (1.17 if row else 1)
                tree.scale = (size, size, size * rng.uniform(.9, 1.19))
        for i in range(85):
            y = rng.uniform(-15, 47)
            x = sign * rng.uniform(8.5, 16)
            z = bank_height(x,y) if bank_height else 4.0
            if z < .27:
                continue
            obj = place(rng.choice(scrub), group, "Brambles on ledge", (x,y,z-.12))
            obj.rotation_euler.z = rng.uniform(0, TAU)
            size = rng.uniform(.51, 1.48)
            obj.scale = (size, size*rng.uniform(.75,1.22), size*rng.uniform(.67,1.66))
        # Ivy follows the inside lip rather than hanging in front of open water.
        ivy = Geometry()
        for i in range(83):
            y = rng.uniform(-16, 35)
            x = next((sign * (.25*k) for k in range(29, 58)
                      if bank_height and bank_height(sign*.25*k, y) > 1.2), None)
            if x is None:
                continue
            top = bank_height(x,y)
            for j in range(rng.randint(3, 8)):
                offset = rng.gauss(0,.40)
                length = min(top*.91, rng.uniform(.38,2.35))
                phase = rng.uniform(0,TAU)
                for step in range(max(3, int(length/.08))):
                    t = step*.08
                    center = Vector((x-sign*(.27+.16*math.sin(phase+t*1.7)),
                                     y+offset+.09*math.sin(t*3+phase), top+.10-t))
                    d = rng.uniform(.070,.135)*(1-.36*t/length)
                    center.y += rng.uniform(-.07,.07)
                    drape = Vector((-.43*sign*d,(-1)**step*d,-d*.78))
                    wing = Vector((0, d*.56, d*.22))
                    shoulder = center+drape*.34
                    ivy.patch([center,shoulder+wing,center+drape,shoulder-wing],
                              [(0,1,2,3)],rng.choice((3,4,4,5,6,7)))
        if ivy.faces:
            place(ivy.mesh("Hanging ivy", palette), group, "Ivy along inner cliff")
    for x0, y0, count in [(-8.5,38.4,6), (-5.1,37.9,8), (-1.8,38.5,5),
                          (.6,38.9,4), (7.9,38.3,5), (10.9,38.4,6)]:
        for _ in range(count):
            x = x0 + rng.uniform(-1.5, 1.35)
            y = y0 + rng.uniform(-.83, .92)
            z = bank_height(x,y) if bank_height else 5.85
            if z < 1:
                continue
            size = rng.uniform(.72, 1.48)
            obj = place(rng.choice(scrub), group, "Abbey terrace thicket", (x,y,z-.17))
            obj.rotation_euler.z = rng.uniform(0,TAU)
            obj.scale = (size, size*rng.uniform(.8,1.08), size*rng.uniform(.96,1.47))


def pad(g, rng, x, y, r, z, base, veins):
    ang = rng.random() * TAU
    disk = [(x, y, z)]
    count = 19 if veins else 14
    oval = rng.uniform(.76, 1.06)
    for size in (.47, 1):
        for j in range(count + 1):
            a = ang + .135 + (TAU - .27) * j / count
            d = r * size * (1 + .032 * math.sin(5 * a + x))
            disk.append((x + math.cos(a) * d, y + math.sin(a) * d * oval,
                         z + r * size * (.035 + .026 * math.sin(3 * a + y))))
    s = count + 1
    faces = []
    for j in range(count):
        faces += [(0, j + 1, j + 2), (j + 1, s + j + 1, s + j + 2, j + 2)]
    g.patch(disk, faces, base)
    if veins:
        for j in range(1, count, 3):
            mid, end = Vector(disk[1 + j]), Vector(disk[1 + s + j])
            hub = Vector((x, y, z + .0018))
            start = hub.lerp(mid, .19)
            tip = mid.lerp(end, rng.uniform(.62, .91)) + Vector((0, 0, .002))
            slit = Vector((-(tip.y - y), tip.x - x, 0)).normalized() * r * .009
            g.patch([start, mid - slit + Vector((0, 0, .002)), tip,
                     mid + slit + Vector((0, 0, .002))], [(0, 1, 2, 3)], 6)


def flower(g, rng, x, y, size, height):
    """Water lily with ribbed sepals, three whorls and anther filaments."""
    for ring, count, length, spread, rise, mat in (
            (0, 6, .83, .215, .11, 7), (1, 12, 1.03, .259, .20, 9),
            (2, 11, .86, .225, .30, 10), (3, 9, .58, .168, .37, 11)):
        for j in range(count):
            a = (j + .38 * ring + rng.uniform(-.09, .09)) * TAU / count
            cs, sn = math.cos(a), math.sin(a)
            l = length * size * rng.uniform(.93, 1.07)
            w = spread * size
            lift = rise * size * rng.uniform(.84, 1.12)
            points = []
            for t, breadth in ((0, .10), (.28, .83), (.60, 1), (.85, .69), (1, .032)):
                d = (.065 + t) * l
                z = height + size * .025 * ring + lift * (t ** 1.36) + sn * d * .145
                for side in (-1, 0, 1):
                    offset = side * breadth * w
                    points.append((x + d * cs - offset * sn, y + d * sn + offset * cs,
                                   z + abs(side) * breadth * size * .042))
            faces = []
            for i in range(0, 12, 3):
                faces.extend([(i, i + 3, i + 4, i + 1), (i + 1, i + 4, i + 5, i + 2)])
            g.patch(points, faces, mat)
    for ring, count in ((0, 11), (1, 17)):
        for j in range(count):
            a = TAU * (j + ring * .33) / count
            cs, sn = math.cos(a), math.sin(a)
            r = size * (.045 + ring * .073)
            start = (x + cs * r, y + sn * r, height + .06 * size)
            end = (x + cs * (r + .07 * size), y + sn * (r + .07 * size),
                   height + size * rng.uniform(.35, .46))
            limb(g, start, end, size * .017, size * .024, 12 if j % 4 else 13, 4)


def _pond_finish(palette):
    y,x = np.mgrid[-1:1:384j,-1:1:384j]
    a = np.arctan2(y,x)
    r = np.hypot(x,y)
    # Eleven gently bending primary ribs, with secondary veins alternating on either side.
    bend = .105*r*np.sin(3*a+.8) + .05*r*r*np.cos(5*a-.2)
    sector = np.mod((a+bend)*11/TAU + .5,1)-.5
    prim = np.exp(-((sector*r)/(.009+.008*(1-np.minimum(r,1))))**2)
    side = np.mod(r*7.8-np.abs(sector)*.93 + .06*np.sin(9*a+4*r),1)
    minor = np.exp(-(np.minimum(side,1-side)/.038)**2)*np.minimum(1,r*4)
    fibers = .037*np.sin(25*x+9*y)*np.sin(19*y-7*x)+.015*np.sin(53*x+82*y)
    value = .81 + .09*x - .06*np.sin(6*a)*np.minimum(1,r) + fibers-.24*prim-.084*minor
    pixels = np.ones((384,384,4),np.float32)
    pixels[:,:,:3] = value[:,:,None]
    leaf_image = _packed_image("Lily pads • vascular network and water bloom",pixels)
    v,u = np.mgrid[0:1:192j,-1:1:256j]
    ridges = .5+.5*np.cos((u*(6.5+2.8*v) + .14*np.sin(v*5+u))*TAU)
    veins = ridges**13 * (.20+.65*v) * (.7+.3*np.cos(4*u+v))
    colors = np.ones((192,256,4),np.float32)
    colors[:,:,0] = .98-.12*veins-.035*np.abs(u)
    colors[:,:,1] = .964-.18*veins-.06*np.abs(u)-.10*(1-v)**4
    colors[:,:,2] = .951-.11*veins-.038*np.abs(u)-.25*(1-v)**3
    petal_image = _packed_image("Water lily petals • fine silk ribs",colors)
    pad_tones = [(.036,.105,.032),(.068,.151,.045),(.122,.215,.056),
                 (.181,.259,.075),(.239,.308,.079),(.296,.374,.107)]
    for i,mat in enumerate(palette):
        if i < 6:
            pigment = pad_tones[i]
        elif i in (7,9,10,11):
            pigment = tuple(mat.diffuse_color[:3])
        else:
            continue
        nodes,links = mat.node_tree.nodes,mat.node_tree.links
        shader = nodes.get("Principled BSDF")
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = leaf_image if i < 6 else petal_image
        multiply = nodes.new("ShaderNodeVectorMath")
        multiply.operation = "MULTIPLY"
        multiply.inputs[1].default_value = pigment
        links.new(texture.outputs["Color"],multiply.inputs[0])
        links.new(multiply.outputs[0],shader.inputs["Base Color"])
        links.new(multiply.outputs[0],shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = .14 if i<6 else .31
        shader.inputs["Roughness"].default_value = .39+.013*i if i < 6 else .48
        if i < 6:
            shader.inputs["Coat Weight"].default_value = .16
            shader.inputs["Coat Roughness"].default_value = .27
        shader.inputs["Subsurface Weight"].default_value = .06 if i<6 else .17
        shader.inputs["Subsurface Scale"].default_value = .012
        shader.inputs["Sheen Weight"].default_value = .09 if i<6 else .16
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .22 if i<6 else .13
        bump.inputs["Distance"].default_value = .0016 if i<6 else .0008
        links.new(texture.outputs["Color"],bump.inputs["Height"])
        links.new(bump.outputs[0],shader.inputs["Normal"])


def _fine_pad(g,rng,x,y,r,z,base,veins):
    rot = rng.uniform(0,TAU)
    oval = rng.uniform(.78,1.04)
    count = 40 if veins else 24
    rings = (.24,.59,.86,1) if veins else (.46,1)
    phase = rng.uniform(0,TAU)
    cr,sr = math.cos(rot),math.sin(rot)
    waterline = .0015+(z-.043)*.09
    curl = (.5+.5*math.cos(phase-.9))**12
    p,uv,faces = [(x,y,waterline)],[(.5,.5)],[]
    for row,rad in enumerate(rings):
        for j in range(count+1):
            a = (j/count)*(TAU-.20)+.10
            edge = (.95+.07*math.cos(a+.45)+.032*math.cos(4*a+phase)+.023*math.sin(7*a)) * rad
            edge *= 1-.115*math.exp(-(min(a,TAU-a)/.47)**2)
            px,py = edge*math.cos(a), edge*math.sin(a)*oval
            edge_lift = rad**3 * (.006+.004*math.sin(3*a+phase)+.003*math.cos(5*a+phase*.64))
            rolled_tip = curl*rad**5*(.5+.5*math.cos(a-phase))**12*.036
            height = waterline+r*(.006*rad + edge_lift + rolled_tip)
            p.append((x+r*(px*cr-py*sr), y+r*(px*sr+py*cr), height))
            uv.append((.5+.475*rad*math.cos(a),.5+.475*rad*math.sin(a)))
            ix = len(p)-1
            if j:
                faces.append((0,ix-1,ix) if not row else (ix-count-2,ix-1,ix,ix-count-1))
    g.patch(p,faces,base,uv)


def _fine_flower(g,rng,x,y,size,height):
    for ring,count,length,width,lift,material_id in (
            (0,6,.81,.211,.115,7),(1,13,1.06,.234,.20,9),
            (2,12,.87,.219,.30,10),(3,10,.61,.168,.38,11)):
        for j in range(count):
            a = TAU*(j+.36*ring+rng.uniform(-.09,.09))/count
            cs,sn = math.cos(a),math.sin(a)
            length_scale = size*length*rng.uniform(.94,1.07)
            pitch = size*lift*rng.uniform(.89,1.13)
            twist = rng.uniform(-.13,.13)
            p,uv,faces = [],[],[]
            for row in range(15):
                t = row/14
                breadth = .031 + math.sin(math.pi*t)**.67 * (1.12-.26*t)
                d = (.045+t)*length_scale
                midz = height+size*.024*ring+pitch*t**1.43 + sn*d*.20
                for col in range(7):
                    s = col/3-1
                    offset = width*size*breadth*s + twist*size*t*t*.24
                    fold = breadth*size*(s*s*.069 + .013*math.sin(abs(s)*3*math.pi)*t
                                         + s*twist*t*.14)
                    p.append((x+d*cs-offset*sn,y+d*sn+offset*cs,midz+fold))
                    uv.append((col/6,t))
                    ix = len(p)-1
                    if col and row:
                        faces.append((ix-8,ix-1,ix,ix-7))
            g.patch(p,faces,material_id,uv)
    for ring,count in ((0,13),(1,21),(2,25)):
        for j in range(count):
            a = TAU*(j+ring*.24)/count
            cs,sn = math.cos(a),math.sin(a)
            r = size*(.025+.042*ring)
            base = Vector((x+cs*r,y+sn*r,height+.068*size))
            top = base+size*Vector((cs*(.03+.050*ring),sn*(.03+.050*ring),
                                   rng.uniform(.31,.43)-ring*.018))
            mid = base.lerp(top,.55)+Vector((-cs*.022,-sn*.022,0))*size
            limb(g,base,mid,.009*size,.008*size,12,5)
            limb(g,mid,top,.008*size,.006*size,12,5)
            n = (top-mid).normalized()
            shoulder = top+n*size*.05
            limb(g,top,shoulder,.006*size,.024*size,12,7)
            limb(g,shoulder,top+n*size*.092,.024*size,.003*size,13,7)


def pond(rng, refined=False):
    group = collection("Pool • lotus leaves and white water lilies")
    palette = [material("Lily • " + n, c, gloss, .30 if i >= 7 else .09)
               for i, (n, c, gloss) in enumerate((
        ("bottle green", (.034, .088, .043), .48), ("malachite", (.055, .133, .063), .50),
        ("olive", (.105, .174, .055), .46), ("tea", (.113, .192, .079), .44),
        ("fen", (.152, .203, .073), .48), ("young leaf", (.187, .246, .075), .43),
        ("ribs", (.22, .267, .102), .51), ("sepals", (.55, .584, .338), .59),
        ("violet", (.47, .425, .51), .50), ("pearl", (.78, .754, .791), .47),
        ("porcelain", (.93, .911, .86), .48), ("cream", (.981, .915, .721), .47),
        ("saffron", (.94, .62, .099), .44), ("anthers", (.91, .41, .04), .42)))]
    if refined:
        _pond_finish(palette)
    make_leaf = _fine_pad if refined else pad
    make_flower = _fine_flower if refined else flower
    leaf_geometry = Geometry()
    petal_geometry = Geometry()
    flowers = [(-2.25, -13.5, .49), (-2.78, -12.26, .19), (-1.8, -3.05, .35),
               (-3.5, -1.94, .19), (3.06, 2.9, .27), (4.0, 4.1, .17),
               (-2.50, 9.7, .25), (-2.83, 11.08, .2), (3.31, 16.5, .22),
               (-3.03, 22.0, .24), (4.48, 22.7, .21)]
    schools = [(x, y, rng.uniform(.69, 1.08), rng.randint(10, 16)) for x, y, _ in flowers]
    for side in (-1, 1):
        for j in range(42):
            y = -15.5 + 47 * j / 42 + rng.uniform(-.6, .6)
            x = side * (rng.uniform(2.7, 7.1) + .59 * math.sin(y * .42))
            schools.append((x, y, rng.uniform(.62, 1.52), rng.randint(6, 16)))
    if refined:
        for side in (-1,1):
            for j in range(62):
                y = -17.5+j*.84+rng.uniform(-.84,.84)
                x = side*(rng.uniform(2.0,7.65)+.59*math.sin(y*.42))
                schools.append((x,y,rng.uniform(.61,1.65),rng.randint(9,22)))
    # Poisson-style exclusion keeps neighboring pads from visibly cutting across each other.
    occupied = {}
    for x, y, spread, number in schools:
        for _ in range(number * 2):
            cx, cy = x + rng.gauss(0, spread), y + rng.gauss(0, spread * .85)
            channel = .57 + .65 * math.sin(cy * .30) + .26 * math.sin(cy * .68)
            width = 1.05 + .33 * math.sin(cy * .53 + 1.6)
            if abs(cx) >= 8.7 or abs(cx - channel) < width:
                continue
            r = rng.uniform(.11, .36) * (1.1 if cy < -5 else 1)
            cell = (math.floor(cx), math.floor(cy))
            neighbors = [p for i in range(cell[0] - 1, cell[0] + 2)
                         for j in range(cell[1] - 1, cell[1] + 2) for p in occupied.get((i, j), ())]
            if any((cx - px) ** 2 + (cy - py) ** 2 < ((r + pr) * .87) ** 2 for px, py, pr in neighbors):
                continue
            occupied.setdefault(cell, []).append((cx, cy, r))
            make_leaf(leaf_geometry, rng, cx, cy, r, rng.uniform(.043, .068),
                rng.choices(range(6), weights=(.8, 1.4, 2.1, 2.2, 1.1, .55))[0],
                cy < 4 and r > .18)
    for x, y, s in flowers:
        make_flower(petal_geometry, rng, x, y, s, .094 + s * .12)
    place(leaf_geometry.mesh("Layered pads and radiating veins", palette), group, "Rafts of water lilies")
    place(petal_geometry.mesh("Water lily petals and stamens", palette), group, "White water lilies")


def reeds(rng):
    group = collection("Banks • reeds and sedges")
    palette = [material("Sedge • " + n, c) for n, c in (
        ("deep", (.044, .104, .048)), ("sage", (.105, .174, .071)),
        ("old gold", (.213, .233, .091)), ("seed", (.197, .133, .073)))]
    g = Geometry()
    for side in (-1, 1):
        for _ in range(72):
            cx = side * rng.uniform(6.9, 9.65)
            cy = rng.uniform(-13, 34)
            for i in range(rng.randint(11, 24)):
                a = rng.random() * TAU
                cs, sn = math.cos(a), math.sin(a)
                d = rng.random() ** .56 * .61
                x, y = cx + d * cs, cy + d * sn
                h = rng.uniform(.33, .98) * (1.17 - d)
                w = rng.uniform(.014, .038)
                bend = rng.uniform(.15, .72)
                points = []
                for t, width in ((0, .49), (.42, 1), (.72, .66), (1, .04)):
                    for k in (-1, 1):
                        points.append((x + cs * bend * t * t - k * w * width * sn,
                                       y + sn * bend * t * t + k * w * width * cs,
                                       -.019 + h * math.sin(t * 1.65)))
                g.patch(points, [(0, 2, 3, 1), (2, 4, 5, 3), (4, 6, 7, 5)], rng.randrange(3))
                if i == 0:
                    p = (cx + .08, cy, h * 1.16)
                    limb(g, (cx, cy, 0), p, .008, .005, 1, 4)
                    limb(g, p, (p[0] + .017, p[1], p[2] + .13), .020, .014, 3, 5)
    place(g.mesh("Flattened reed leaves and seed heads", palette), group, "Waterside sedges")


def build_grove(bank_height=None, *, refined=False):
    """Dress the banks and pool. Optional terrain height takes world x, y coordinates."""
    rng = random.Random(81640)
    hillsides(rng, bank_height, refined)
    pond(rng, refined)
    reeds(rng)
