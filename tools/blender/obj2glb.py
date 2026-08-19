import bpy, sys
a=sys.argv[sys.argv.index('--')+1:]
inp, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    bpy.ops.wm.obj_import(filepath=inp)
except Exception:
    bpy.ops.import_scene.obj(filepath=inp)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_apply=True)
print('OK', out)
