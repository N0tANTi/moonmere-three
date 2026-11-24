"""Build the Moonmere abbey camera study in Blender 5.2.

blender -b --factory-startup -P scene/build_moonmere.py -- --render
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import moonmere_land
from moonmere_audio import write_ambience
from moonmere_castle import build_castle
from moonmere_grove import build_grove
from moonmere_sky import build_sky


def make_camera(scene):
    data = bpy.data.cameras.new("Waterline | 25 mm")
    data.lens = 25
    data.clip_start = .08
    data.clip_end = 450
    camera = bpy.data.objects.new("Crossing the lily pool", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    # A quiet arc to the right lets the first flowers slide out of frame.
    # The gradual tilt preserves the silhouette of the keep during the approach.
    for frame, position, pitch, yaw in [
        (1, (-.66,-18.2,1.03),4.4,1.9), (100,(-.25,-13.7,.95),5.8,1.65),
        (200,(.30,-8.55,1.04),7.65,1.05), (300,(.65,-4.10,1.16),9.10,.35),
    ]:
        camera.location = position
        camera.rotation_euler = (math.radians(90+pitch),0,-math.radians(yaw))
        camera.keyframe_insert(data_path="location",frame=frame)
        camera.keyframe_insert(data_path="rotation_euler",frame=frame)
    scene.timeline_markers.new("Water lily", frame=1)
    scene.timeline_markers.new("Open channel", frame=150)
    scene.timeline_markers.new("The ruined arcade", frame=300)
    scene.frame_set(1)


def sunlight(scene, name, direction, energy, color, shadows, angle=1.7):
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle)
    data.use_shadow = shadows
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.rotation_euler = Vector(direction).to_track_quat("-Z","Y").to_euler()


def light_water_garden(scene, refined):
    if not refined:
        sunlight(scene, "Moonwash | silver key", (.58,.66,-.76), 2.85, (.91,.96,1), True)
        sunlight(scene, "Bounce from the water", (-.70,.32,-.51), .68, (.64,.79,.92), False)
        sunlight(scene, "Warm reflected fill | arcade and flower undersides", (.12,.94,.23), .36, (.95,.89,.71), False)
        return
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -.10
    sunlight(scene, "Raking moonlight", (.83,.70,-1.0), 3.35, (.975,.980,1), True, .85)
    sunlight(scene, "Faint reflected light below the trees", (-.65,.42,-.42), .15, (.72,.78,.84), False)
    # A local, broad fill preserves carving on the distant facade without lighting
    # the whole gorge or turning the thin leaf shadows grey.
    for name,location,target,size,power in [
        ("Return from the chalk terrace",(-6,29,20),(2,45,14),13,2300),
        ("Silver light along the arcade",(1,10,8),(-4,21,2.8),8,1320),
    ]:
        lamp = bpy.data.lights.new(name, "AREA")
        lamp.shape = "DISK"
        lamp.size = size
        lamp.energy = power
        lamp.specular_factor = .10
        lamp.color = (1.0,.955,.97)
        obj = bpy.data.objects.new(name, lamp)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def set_movie(scene):
    scene.render.image_settings.media_type = "VIDEO"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.render.ffmpeg.audio_codec = "AAC"
    scene.render.ffmpeg.audio_mixrate = 48000
    scene.render.ffmpeg.audio_bitrate = 192
    scene.render.filepath = "//moonmere.mp4"


def build(args):
    default_dir = "moonmere_silver" if args.refined else "moonmere"
    output = (args.output or HERE.parent/"output"/default_dir).resolve()
    output.mkdir(parents=True,exist_ok=True)
    blend = output/"moonmere.blend"
    if blend.exists() and not args.replace:
        raise FileExistsError(f"{blend} already exists. Save hand edits before using --replace.")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Moonmere | The lily passage"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = args.percent
    scene.render.fps = 30
    scene.frame_start,scene.frame_end = 1,300
    scene.render.use_persistent_data = True
    scene.eevee.taa_render_samples = args.samples
    scene.eevee.shadow_ray_count = 1
    scene.eevee.shadow_step_count = 4
    scene.eevee.use_raytracing = True
    scene.eevee.ray_tracing_options.resolution_scale = "2"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    build_sky(scene, refined=args.refined)
    moonmere_land.build_land(refined=args.refined)
    castle = build_castle(refined=args.refined)
    pivot = Matrix.Translation((2,46,0))
    turn = pivot @ Matrix.Rotation(math.radians(-9),4,"Z") @ pivot.inverted()
    for building in castle.objects:
        building.matrix_world = turn @ building.matrix_world
    build_grove(moonmere_land.bank_height, refined=args.refined)
    light_water_garden(scene, args.refined)
    make_camera(scene)
    wav = output/"pond_at_night.wav"
    write_ambience(wav)
    strip = scene.sequence_editor_create().strips.new_sound("Water, drops and far insects",str(wav),1,1)
    strip.sound.pack()
    strip.sound.filepath = "//pond_at_night.wav"
    set_movie(scene)
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.overlay.show_overlays = False
            area.spaces.active.shading.color_type = "MATERIAL"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True,relative_remap=False)
    if args.render:
        bpy.ops.render.render(animation=True)
    if args.stills:
        scene.render.image_settings.media_type = "IMAGE"
        scene.render.image_settings.file_format = "PNG"
        for frame in (1,150,300):
            scene.frame_set(frame)
            scene.render.filepath = str(output/f"view_{frame:03d}.png")
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--refined",action="store_true",help="Render the silver limestone and blackwater version.")
    parser.add_argument("--percent",type=int,choices=range(1,101),metavar="1-100",default=100)
    parser.add_argument("--samples",type=int,default=24)
    parser.add_argument("--replace",action="store_true")
    parser.add_argument("--render",action="store_true")
    parser.add_argument("--stills",action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    if args.samples < 1:
        parser.error("--samples must be positive")
    build(args)
