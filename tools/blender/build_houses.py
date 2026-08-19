import bpy, bmesh, os, math, sys

# ------------------------------------------------------------------ helpers ---
OUT_DIR = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'

# Shared house dimensions (MUST match the collider constants in the game).
#   Blender is Z-up; the glTF exporter converts to Y-up. We build the door on the
#   Blender +Y face -> after export it faces glTF -Z (the game rotates each house so
#   that -Z door points at its road).
OW, OD, H, T = 8.0, 7.0, 3.0, 0.22      # outer width(X), depth(Y), wall height(Z), thickness
DW, DH = 1.6, 2.25                       # door opening width, height

def mat(name, rgb, rough=0.9, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

def box(name, x0, x1, y0, y1, z0, z1, material, coll):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]]
    for f in [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
              (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]:
        bm.faces.new([v[i] for i in f])
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    ob.data.materials.append(material)
    return ob

def hip_roof(name, hw, hd, z0, rise, material, coll):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    bm = bmesh.new()
    b = [bm.verts.new(p) for p in [
        (-hw, -hd, z0), (hw, -hd, z0), (hw, hd, z0), (-hw, hd, z0)]]
    apex = bm.verts.new((0, 0, z0 + rise))
    for a, c in [(0, 1), (1, 2), (2, 3), (3, 0)]:
        bm.faces.new([b[a], b[c], apex])
    bm.faces.new([b[3], b[2], b[1], b[0]])   # underside cap
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    ob.data.materials.append(material)
    return ob

def build_house(variant, siding_rgb, roof_rgb):
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    coll = bpy.data.collections.new('House')
    bpy.context.scene.collection.children.link(coll)

    M_side  = mat('siding',  siding_rgb, 0.85)
    M_roof  = mat('roof',    roof_rgb, 0.8)
    M_floor = mat('floor',   (0.32, 0.24, 0.17), 0.9)
    M_ceil  = mat('ceiling', (0.85, 0.83, 0.78), 0.95)
    M_trim  = mat('trim',    (0.9, 0.88, 0.82), 0.8)
    M_door  = mat('door',    (0.30, 0.18, 0.11), 0.7)
    M_glass = mat('glass',   (0.15, 0.22, 0.28), 0.15, 0.2)

    hw, hd = OW / 2, OD / 2

    # Floor + ceiling
    box('floor',   -hw, hw, -hd, hd, -0.15, 0.0, M_floor, coll)
    box('ceiling', -hw, hw, -hd, hd, H, H + T, M_ceil, coll)

    # Back wall (-Y), left (-X), right (+X)
    box('wall_back',  -hw, hw, -hd, -hd + T, 0, H, M_side, coll)
    box('wall_left',  -hw, -hw + T, -hd, hd, 0, H, M_side, coll)
    box('wall_right',  hw - T, hw, -hd, hd, 0, H, M_side, coll)

    # Front wall (+Y) split around the centred door opening
    box('front_L', -hw, -DW / 2, hd - T, hd, 0, H, M_side, coll)
    box('front_R',  DW / 2, hw, hd - T, hd, 0, H, M_side, coll)
    box('front_lintel', -DW / 2, DW / 2, hd - T, hd, DH, H, M_side, coll)

    # Door frame trim around the opening (thin), no slab -> walk-through
    box('door_jamb_L', -DW / 2 - 0.06, -DW / 2, hd - T - 0.02, hd + 0.02, 0, DH + 0.06, M_door, coll)
    box('door_jamb_R',  DW / 2, DW / 2 + 0.06, hd - T - 0.02, hd + 0.02, 0, DH + 0.06, M_door, coll)
    box('door_head', -DW / 2 - 0.06, DW / 2 + 0.06, hd - T - 0.02, hd + 0.02, DH, DH + 0.06, M_door, coll)

    # Windows (visual glass panes, slightly proud of walls)
    ww, wh, wz = 1.1, 1.0, 1.1
    def window(cx, cy, axis):
        if axis == 'y':   # on a wall facing +/-Y
            box('win', cx - ww / 2, cx + ww / 2, cy - 0.03, cy + 0.03, wz, wz + wh, M_glass, coll)
            box('winframe', cx - ww / 2 - 0.08, cx + ww / 2 + 0.08, cy - 0.05, cy + 0.05, wz - 0.08, wz + wh + 0.08, M_trim, coll)
        else:             # on a wall facing +/-X
            box('win', cx - 0.03, cx + 0.03, cy - ww / 2, cy + ww / 2, wz, wz + wh, M_glass, coll)
            box('winframe', cx - 0.05, cx + 0.05, cy - ww / 2 - 0.08, cy + ww / 2 + 0.08, wz - 0.08, wz + wh + 0.08, M_trim, coll)
    window(-hw + 0.02, -1.6, 'x'); window(-hw + 0.02, 1.6, 'x')     # left wall
    window(hw - 0.02, -1.6, 'x');  window(hw - 0.02, 1.6, 'x')      # right wall
    window(-2.4, -hd + 0.02, 'y'); window(2.4, -hd + 0.02, 'y')     # back wall
    window(-2.9, hd - 0.02, 'y');  window(2.9, hd - 0.02, 'y')      # front sides

    # Roof: hip pyramid with eave overhang + a thin fascia band
    hip_roof('roof', hw + 0.5, hd + 0.5, H + T, 1.7, M_roof, coll)

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f'house-{variant}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=False, export_apply=True)
    # bounds report
    bpy.context.view_layer.update()
    print(f'EXPORTED house-{variant}.glb')

VARIANTS = [
    ('a', (0.82, 0.76, 0.64), (0.42, 0.18, 0.15)),   # cream / red roof
    ('b', (0.70, 0.75, 0.70), (0.22, 0.25, 0.30)),   # sage / slate roof
    ('c', (0.86, 0.80, 0.70), (0.28, 0.22, 0.16)),   # tan / brown roof
    ('d', (0.74, 0.78, 0.82), (0.30, 0.20, 0.24)),   # blue-grey / maroon roof
]
for v, s, r in VARIANTS:
    build_house(v, s, r)
print('ALL DONE')
