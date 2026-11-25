"""Prepare identity-free CARVING border assets from the original PSD raster layers.

This local utility preserves the sources and never sends image data to a service.
Only the verified normal, opaque RGB solid-colour overlay used by the two border
layers is reproduced. It is not a general Photoshop-effects renderer.
"""
from pathlib import Path
import hashlib
import json
import re
import struct
from PIL import Image
import audit_references as audit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Design Templates' / 'CARVING KANNADI R BIG.psd'
OUT = ROOT / 'private' / 'prepared-assets'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    original = SOURCE.read_bytes()
    metadata = audit.audit_psd(original)
    audit.export_raster_layers(SOURCE, metadata)
    records = list(re.finditer(b'8BIMlrFX', original))
    effect_layers = [layer for layer in metadata['layers'] if 'lrFX' in layer['effect_records']]
    if len(records) != len(effect_layers):
        raise ValueError('Effects-to-layer mapping is ambiguous')
    effects = {}
    for layer, match in zip(effect_layers, records):
        start = match.start()
        size = struct.unpack_from('>I', original, start + 8)[0]
        effects[layer['index']] = original[start + 12:start + 12 + size]
    canvas = Image.new('RGBA', (metadata['width_px'], metadata['height_px']))
    retained = []
    for index in [9, 10]:
        layer = metadata['layers'][index]
        effect = effects[index]
        offset = effect.index(b'8BIMsofi')
        size = struct.unpack_from('>I', effect, offset + 8)[0]
        fill = effect[offset + 12:offset + 12 + size]
        version = struct.unpack_from('>I', fill, 0)[0]
        mode = fill[8:12].decode('ascii')
        space = struct.unpack_from('>H', fill, 12)[0]
        rgb16 = struct.unpack_from('>3H', fill, 14)
        rgb8 = tuple(round(v / 257) for v in rgb16)
        opacity, enabled = fill[22:24]
        if version != 2 or mode != 'norm' or space != 0 or opacity != 255 or enabled != 1:
            raise ValueError('Unexpected border colour-overlay parameters')
        if layer['blend_mode'] != 'norm' or layer['opacity'] != 255 or layer['clipping'] or layer['has_pixel_mask'] or layer['has_vector_mask']:
            raise ValueError('Unexpected border layer composition')
        source_layer = Image.open(audit.PRIVATE / SOURCE.stem / f'layer-{index:02d}.png').convert('RGBA')
        colored = Image.new('RGBA', source_layer.size, rgb8 + (255,))
        colored.putalpha(source_layer.getchannel('A'))
        canvas.alpha_composite(colored, dest=tuple(layer['bounds_px'][:2]))
        retained.append(dict(layer_index=index, bounds_px=layer['bounds_px'], overlay_rgb=rgb8, overlay_rgb16=rgb16, overlay_opacity=opacity))
    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / 'carving-kannadi-r-big-frame.png'
    canvas.save(output, dpi=(300, 300))
    # Compare fully opaque decorative pixels with the already supplied Photoshop export.
    source_export = ROOT / 'Design Templates' / 'CARVING KANNADI R BIG copy.png'
    original_export = Image.open(source_export).convert('RGB')
    opaque = canvas.getchannel('A').point(lambda v: 255 if v == 255 else 0)
    import numpy as np
    mask = np.asarray(opaque) != 0
    actual = np.asarray(canvas.convert('RGB'))[mask].astype('int16')
    expected = np.asarray(original_export)[mask].astype('int16')
    differences = np.abs(actual - expected)
    comparison = dict(opaque_pixels=int(mask.sum()), exact_rgb_match_pixels=int(np.all(differences == 0, axis=1).sum()), maximum_channel_difference=int(differences.max()), mean_absolute_channel_difference=float(differences.mean()))
    bounds = {l['index']: l['bounds_px'] for l in metadata['layers']}
    def box(index):
        x, y, right, bottom = bounds[index]
        return dict(layer_index=index, bounds_px=bounds[index], x_mm=x * 25.4 / 300, y_mm=y * 25.4 / 300, width_mm=(right-x) * 25.4 / 300, height_mm=(bottom-y) * 25.4 / 300)
    info = dict(
        source_file='Design Templates/CARVING KANNADI R BIG.psd', source_sha256=digest(original),
        source_canvas_px=[metadata['width_px'], metadata['height_px']], source_dpi=metadata['dpi'],
        source_canvas_mm=metadata['source_canvas_mm'], physical_cut_calibrated=False,
        prepared_frame=str(output.relative_to(ROOT)).replace('\\', '/'), prepared_frame_sha256=digest(output.read_bytes()),
        retained_layers=retained, excluded_layers=[0, 1, 2, 3, 4, 5, 6, 7, 8],
        frame_description='Transparent original outer circular ring and inner triangular/circular decoration. Original temple, photo, text and square canvas outline excluded. RGB normal colour overlay from PSD applied to retained layer alpha.',
        source_export_comparison=comparison,
        source_geometry=dict(old_background_image=box(2), white_photo_backing=box(3), photo_mask=box(4), old_photo_source_layer=box(5), name_text=box(6), subtitle_text=box(7), old_curved_heading=box(8), outer_circle=box(9), triangle_ring=box(10)),
        title_status='Original curved heading is legacy Malayalam. The requested new English title must be rendered separately, as an approved fixed curved asset or a tested whole-string SVG textPath; it is not part of this frame.',
        limitations=['Source canvas is not a verified physical cutting dimension.', 'Border effects reproduce only the verified solid colour overlay and existing raster alpha; no general PSD effect fidelity is claimed.', 'Original portrait source is a clipped layer. New photos should use the original circular mask geometry, not its larger source bounds.', 'This utility does not prepare any final batch or approve an order.'],
    )
    for file in ['jyothi-engineering-college-office.jpg', 'Jyothi Logo.png']:
        candidate = ROOT / 'Work 1' / file
        if candidate.exists():
            with Image.open(candidate) as image:
                info.setdefault('requested_source_assets', []).append(dict(file='Work 1/'+file, width_px=image.width, height_px=image.height, colour_mode=image.mode, sha256=digest(candidate.read_bytes())))
    (OUT / 'carving-kannadi-r-big-frame.info.json').write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding='utf-8')
    preview = Image.new('RGBA', canvas.size, 'white')
    preview.alpha_composite(canvas)
    preview.thumbnail((1000,1000))
    preview.convert('RGB').save(audit.PRIVATE / 'carving-clean-frame-inspection.png')
    if digest(SOURCE.read_bytes()) != info['source_sha256']:
        raise ValueError('Original source changed during preparation')
    print(json.dumps(info, ensure_ascii=True, indent=2))

if __name__ == '__main__':
    main()
