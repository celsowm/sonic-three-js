import json
import math
import os
import sys

import bpy
from mathutils import Vector


OUTPUT_DIR = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(
    os.getcwd(), "assets", "models", "elements", "green-hill-environment"
)
TEXTURE_DIR = os.path.join(OUTPUT_DIR, "textures")


def ensure_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(TEXTURE_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(collection):
            collection.remove(item)


def create_checker_texture(name, colors, size=64, squares=8):
    path = os.path.join(TEXTURE_DIR, f"{name}.png")
    image = bpy.data.images.new(name, width=size, height=size)
    pixels = []
    for y in range(size):
        for x in range(size):
            index = ((x // (size // squares)) + (y // (size // squares))) % 2
            pixels.extend(colors[index])
    image.pixels = pixels
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    return path


def material(name, color, texture_path=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = 0.9
    principled.inputs["Metallic"].default_value = 0

    if texture_path:
        image = bpy.data.images.load(texture_path)
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.extension = "REPEAT"
        mat.node_tree.links.new(tex.outputs["Color"], principled.inputs["Base Color"])

    return mat


def add_cube(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def add_cylinder(name, location, radius, depth, mat, vertices=24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def add_uv_sphere(name, location, radius, mat, scale=(1, 1, 1), segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return obj


def add_cone(name, location, radius1, radius2, depth, mat, vertices=32, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def shade_smooth(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)


def export_glb(filename):
    path = os.path.join(OUTPUT_DIR, filename)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_image_format="AUTO",
        export_texcoords=True,
        export_normals=True,
        export_yup=True,
    )


def make_terrain_set():
    clear_scene()
    checker = create_checker_texture(
        "green_hill_checker",
        [(0.42, 0.19, 0.08, 1), (0.83, 0.52, 0.18, 1)],
        squares=8,
    )
    side = material("checker dirt", (0.66, 0.36, 0.12, 1), checker)
    side_dark = material("checker dirt dark tile", (0.33, 0.13, 0.05, 1))
    side_light = material("checker dirt light tile", (0.78, 0.46, 0.14, 1))
    grass = material("bright layered grass", (0.06, 0.55, 0.09, 1))
    dark_grass = material("grass shadow", (0.02, 0.28, 0.05, 1))

    add_cube("terrain dirt checker body", (0, -10, 0), (48, 20, 10), side)
    for row in range(4):
        for col in range(8):
            tile_mat = side_dark if (row + col) % 2 == 0 else side_light
            add_cube(
                "raised front checker tile",
                (-21 + col * 6, -17.5 + row * 4, 5.35),
                (5.7, 3.7, 0.18),
                tile_mat,
            )
    add_cube("terrain grass cap", (0, 0.9, 0), (49, 2, 10.5), grass)
    for i in range(12):
        x = -23 + i * 4
        blade = add_cone("front grass blade", (x, 2.7, 5.35), 0.65, 0.05, 4.5, grass, vertices=5)
        blade.rotation_euler[2] = math.radians(-12 + (i % 3) * 12)
        back = add_cone("back grass blade", (x + 1.7, 2.4, -5.35), 0.45, 0.04, 3.4, dark_grass, vertices=5)
        back.rotation_euler[2] = math.radians(8 - (i % 2) * 16)

    add_cube("short raised dirt block", (-14, 13, -1), (18, 10, 9), side)
    for row in range(2):
        for col in range(3):
            tile_mat = side_light if (row + col) % 2 == 0 else side_dark
            add_cube(
                "raised block front checker tile",
                (-20 + col * 6, 10.5 + row * 4, 3.85),
                (5.7, 3.5, 0.18),
                tile_mat,
            )
    add_cube("short raised grass cap", (-14, 19, -1), (19, 2, 9.5), grass)
    add_cube("thin ledge dirt block", (15, 17, 0), (24, 6, 8), side)
    for col in range(4):
        tile_mat = side_dark if col % 2 == 0 else side_light
        add_cube(
            "ledge front checker tile",
            (6 + col * 6, 16.5, 4.35),
            (5.7, 4.4, 0.18),
            tile_mat,
        )
    add_cube("thin ledge grass cap", (15, 21, 0), (25, 1.5, 8.5), grass)
    export_glb("green-hill-terrain-set.glb")


def make_loop():
    clear_scene()
    checker = create_checker_texture(
        "green_hill_loop_checker",
        [(0.39, 0.16, 0.07, 1), (0.76, 0.43, 0.13, 1)],
        squares=10,
    )
    dirt = material("loop checker dirt", (0.62, 0.31, 0.1, 1), checker)
    grass = material("loop grass rim", (0.04, 0.48, 0.08, 1))

    bpy.ops.mesh.primitive_torus_add(major_radius=18, minor_radius=3.2, major_segments=96, minor_segments=10, location=(0, 18, 0))
    loop = bpy.context.object
    loop.name = "large decorative checker loop"
    loop.scale.z = 0.32
    loop.data.materials.append(dirt)
    shade_smooth(loop)

    for angle in range(20, 341, 20):
        radians = math.radians(angle)
        x = math.cos(radians) * 18
        y = 18 + math.sin(radians) * 18
        tuft = add_cone("loop grass tuft", (x, y, 2.7), 0.6, 0.03, 3.0, grass, vertices=5)
        tuft.rotation_euler[2] = radians - math.pi / 2

    add_cube("loop left foot", (-18, -5, 0), (8, 10, 6), dirt)
    add_cube("loop right foot", (18, -5, 0), (8, 10, 6), dirt)
    export_glb("green-hill-loop.glb")


def make_props():
    clear_scene()
    bark = material("warm palm bark", (0.48, 0.24, 0.09, 1))
    palm = material("palm leaf green", (0.02, 0.42, 0.12, 1))
    flower_red = material("red flower", (0.96, 0.12, 0.08, 1))
    flower_blue = material("blue flower", (0.1, 0.25, 0.95, 1))
    flower_yellow = material("yellow flower center", (1, 0.84, 0.05, 1))
    stone = material("soft blue gray stone", (0.38, 0.48, 0.55, 1))
    sign = material("painted sign board", (0.88, 0.58, 0.18, 1))
    totem = material("painted island totem", (0.76, 0.45, 0.18, 1))
    black = material("dark detail", (0.03, 0.025, 0.02, 1))

    for px, height, lean in [(-18, 22, -8), (5, 18, 6)]:
        trunk = add_cylinder("segmented palm trunk", (px, height / 2, 0), 1.2, height, bark, vertices=12)
        trunk.rotation_euler[2] = math.radians(lean)
        for idx in range(6):
            angle = math.radians(idx * 60)
            leaf = add_cone("wide palm frond", (px + math.cos(angle) * 3.2, height + math.sin(angle) * 1.2, math.sin(angle) * 2.2), 1.15, 0.12, 9, palm, vertices=6)
            leaf.rotation_euler = (math.radians(80), 0, angle)
            leaf.scale.x = 0.55
            shade_smooth(leaf)

    for x, mat in [(-3, flower_red), (11, flower_blue), (17, flower_red)]:
        add_cylinder("flower stem", (x, 2, 1.5), 0.08, 4, palm, vertices=8)
        for angle in range(0, 360, 72):
            radians = math.radians(angle)
            petal = add_uv_sphere("round flower petal", (x + math.cos(radians) * 0.7, 4.2 + math.sin(radians) * 0.35, 1.5), 0.38, mat, scale=(1.3, 0.7, 0.25))
            shade_smooth(petal)
        shade_smooth(add_uv_sphere("flower center", (x, 4.2, 1.5), 0.32, flower_yellow, scale=(1, 1, 0.45)))

    shade_smooth(add_uv_sphere("rounded foreground rock", (-8, 1.8, 2.2), 2.3, stone, scale=(1.6, 0.85, 0.75)))
    add_cube("green hill sign post", (24, 3, 0), (1.2, 6, 1), bark)
    add_cube("green hill sign board", (24, 7.2, 0), (8, 3.5, 0.8), sign)
    add_cube("sign dark stripe", (24, 7.2, 0.45), (6.4, 0.55, 0.25), black)
    add_cube("totem body", (34, 5, 0), (4, 10, 3), totem)
    add_cube("totem eye left", (33.1, 7, 1.55), (0.6, 0.6, 0.2), black)
    add_cube("totem eye right", (34.9, 7, 1.55), (0.6, 0.6, 0.2), black)
    add_cube("totem mouth", (34, 4.2, 1.55), (2.1, 0.45, 0.2), black)
    export_glb("green-hill-props.glb")


def make_background():
    clear_scene()
    hill_a = material("distant emerald hill", (0.06, 0.45, 0.16, 1))
    hill_b = material("distant blue green hill", (0.1, 0.58, 0.45, 1))
    cloud = material("soft cloud", (0.96, 0.98, 1, 1))
    water = material("far ocean band", (0.08, 0.42, 0.78, 1))

    add_cube("ocean horizon band", (0, -22, -8), (160, 14, 1), water)
    for x, radius, mat in [(-46, 21, hill_a), (-15, 30, hill_b), (25, 24, hill_a), (58, 18, hill_b)]:
        hill = add_uv_sphere("rounded parallax hill", (x, -22, -6), radius, mat, scale=(1.8, 0.72, 0.08), segments=32, rings=12)
        shade_smooth(hill)

    for x, y in [(-45, 22), (5, 31), (46, 20)]:
        shade_smooth(add_uv_sphere("cloud lobe", (x, y, -7), 5.2, cloud, scale=(1.5, 0.6, 0.12)))
        shade_smooth(add_uv_sphere("cloud lobe", (x + 5, y + 1.3, -7), 4.0, cloud, scale=(1.4, 0.55, 0.12)))
        shade_smooth(add_uv_sphere("cloud lobe", (x - 5, y - 0.7, -7), 3.6, cloud, scale=(1.2, 0.5, 0.12)))

    export_glb("green-hill-background.glb")


def write_metadata():
    metadata = {
        "name": "Green Hill Environment",
        "runtimeFormat": "glb",
        "source": "Generated procedurally with Blender Python; no downloaded third-party models.",
        "orientation": "Y up, X side-scroller axis, Z depth.",
        "recommendedExampleScale": 1,
        "assets": [
            {"id": "green-hill-terrain-set", "file": "green-hill-terrain-set.glb"},
            {"id": "green-hill-loop", "file": "green-hill-loop.glb"},
            {"id": "green-hill-props", "file": "green-hill-props.glb"},
            {"id": "green-hill-background", "file": "green-hill-background.glb"},
        ],
    }
    with open(os.path.join(OUTPUT_DIR, "metadata.json"), "w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2)


def main():
    ensure_dirs()
    make_terrain_set()
    make_loop()
    make_props()
    make_background()
    write_metadata()


if __name__ == "__main__":
    main()
