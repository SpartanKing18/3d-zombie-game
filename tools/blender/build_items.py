import bpy, bmesh, os, math, sys
OUT_DIR = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'

def mat(name, rgb, rough=0.6, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

def _obj(name, bm, material, coll):
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob); bm.to_mesh(me); bm.free()
    ob.data.materials.append(material); return ob

def box(name, sx, sy, sz, px, py, pz, material, coll, rot=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if rot: bmesh.ops.rotate(bm, verts=bm.verts, matrix=_rotm(rot))
    bmesh.ops.translate(bm, vec=(px, py, pz), verts=bm.verts)
    bm.normal_update(); return _obj(name, bm, material, coll)

def cyl(name, r, h, px, py, pz, material, coll, axis='z', seg=16):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=h)
    if axis == 'x': bmesh.ops.rotate(bm, verts=bm.verts, matrix=_rotm((0, math.pi/2, 0)))
    elif axis == 'y': bmesh.ops.rotate(bm, verts=bm.verts, matrix=_rotm((math.pi/2, 0, 0)))
    bmesh.ops.translate(bm, vec=(px, py, pz), verts=bm.verts)
    bm.normal_update(); return _obj(name, bm, material, coll)

def _rotm(e):
    import mathutils
    return mathutils.Euler(e, 'XYZ').to_matrix().to_4x4()

def new_coll():
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    c = bpy.data.collections.new('Item'); bpy.context.scene.collection.children.link(c); return c

def export(key):
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT_DIR, f'{key}.glb'),
                              export_format='GLB', use_selection=False, export_apply=True)
    print('EXPORTED', key)

GUNMETAL = lambda: mat('gunmetal', (0.09, 0.10, 0.12), 0.45, 0.85)
STEEL    = lambda: mat('steel', (0.55, 0.57, 0.60), 0.3, 0.9)
POLY     = lambda: mat('poly', (0.06, 0.06, 0.07), 0.6, 0.1)
WOOD     = lambda: mat('gunwood', (0.35, 0.22, 0.12), 0.6, 0.0)

# ---- Pistol (length along X ~0.22) ----------------------------------------
def pistol():
    c = new_coll(); gm = GUNMETAL(); poly = POLY(); st = STEEL()
    box('slide', 0.22, 0.045, 0.055, 0.0, 0, 0.03, gm, c)
    cyl('barrel', 0.016, 0.24, 0.0, 0, 0.03, st, c, axis='x')
    box('grip', 0.05, 0.04, 0.11, -0.07, 0, -0.05, poly, c, rot=(0, -0.25, 0))
    box('trigger_guard', 0.05, 0.03, 0.015, -0.02, 0, -0.02, gm, c)
    box('sight', 0.01, 0.01, 0.012, 0.10, 0, 0.062, gm, c)
    export('weapon_pistol_found')

# ---- Rifle (length along X ~0.95) -----------------------------------------
def rifle():
    c = new_coll(); gm = GUNMETAL(); poly = POLY(); st = STEEL()
    box('receiver', 0.5, 0.05, 0.07, 0.05, 0, 0.0, gm, c)
    cyl('barrel', 0.014, 0.5, 0.42, 0, 0.01, st, c, axis='x')
    box('handguard', 0.28, 0.05, 0.05, 0.28, 0, 0.0, poly, c)
    box('stock', 0.22, 0.045, 0.09, -0.28, 0, -0.01, poly, c)
    box('mag', 0.05, 0.04, 0.16, -0.02, 0, -0.11, gm, c, rot=(0, 0.15, 0))
    box('grip', 0.04, 0.035, 0.09, -0.1, 0, -0.06, poly, c, rot=(0, -0.3, 0))
    box('sight', 0.02, 0.015, 0.03, 0.2, 0, 0.05, gm, c)
    export('weapon_rifle_found')

# ---- Shotgun (length along X ~0.9) ----------------------------------------
def shotgun():
    c = new_coll(); gm = GUNMETAL(); wood = WOOD(); st = STEEL()
    cyl('barrel', 0.02, 0.56, 0.24, 0, 0.02, st, c, axis='x')
    cyl('tube', 0.016, 0.5, 0.22, 0, -0.02, gm, c, axis='x')
    box('receiver', 0.16, 0.055, 0.075, -0.06, 0, 0.0, gm, c)
    box('pump', 0.1, 0.05, 0.05, 0.16, 0, -0.03, wood, c)
    box('stock', 0.26, 0.05, 0.1, -0.28, 0, -0.02, wood, c, rot=(0, 0.08, 0))
    export('weapon_shotgun_found')

# ---- Canned beans ----------------------------------------------------------
def can():
    c = new_coll(); tin = mat('tin', (0.72, 0.74, 0.78), 0.3, 0.8); label = mat('label', (0.75, 0.20, 0.12), 0.7, 0.0)
    cyl('can_body', 0.12, 0.30, 0, 0, 0, tin, c, axis='z')
    cyl('can_label', 0.123, 0.20, 0, 0, 0, label, c, axis='z')
    cyl('can_lid', 0.115, 0.02, 0, 0, 0.15, tin, c, axis='z')
    export('food_canned_beans')

# ---- Water bottle ----------------------------------------------------------
def bottle():
    c = new_coll(); plastic = mat('bottle_pl', (0.55, 0.72, 0.85), 0.15, 0.0); cap = mat('cap', (0.15, 0.35, 0.75), 0.5, 0.0)
    cyl('bottle_body', 0.07, 0.36, 0, 0, 0, plastic, c, axis='z')
    cyl('bottle_neck', 0.03, 0.08, 0, 0, 0.20, plastic, c, axis='z')
    cyl('bottle_cap', 0.033, 0.05, 0, 0, 0.26, cap, c, axis='z')
    export('water_bottle')

# ---- Medical kit -----------------------------------------------------------
def medkit():
    c = new_coll(); wcase = mat('kit', (0.90, 0.90, 0.92), 0.6, 0.0); red = mat('red', (0.80, 0.10, 0.10), 0.6, 0.0); clasp = mat('clasp', (0.3, 0.3, 0.32), 0.4, 0.7)
    box('kit_body', 0.32, 0.22, 0.16, 0, 0, 0, wcase, c)
    box('cross_v', 0.05, 0.001, 0.11, 0, 0.111, 0.0, red, c)
    box('cross_h', 0.12, 0.001, 0.045, 0, 0.111, 0.0, red, c)
    box('handle', 0.14, 0.02, 0.02, 0, 0, 0.09, clasp, c)
    export('medical_kit')

for f in (pistol, rifle, shotgun, can, bottle, medkit):
    f()
print('ALL DONE')
