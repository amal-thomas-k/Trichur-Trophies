"""Read-only PSD header/layer audit; never edits source artwork.

Uses Pillow only for PNG/JPEG metadata and private visual inspection images.
PSD parsing follows Adobe's published PSD specification. This inventories
records; it does not claim faithful PSD rendering or decode all descriptors.
Run: python scripts/audit_references.py
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Design Templates'
PRIVATE = ROOT / 'private' / 'reference-audit'
PUBLIC = ROOT / 'docs'
MODES = {0: 'Bitmap', 1: 'Grayscale', 2: 'Indexed', 3: 'RGB', 4: 'CMYK', 7: 'Multichannel', 8: 'Duotone', 9: 'Lab'}

def u16(data, offset): return struct.unpack_from('>H', data, offset)[0]
def u32(data, offset): return struct.unpack_from('>I', data, offset)[0]
def s32(data, offset): return struct.unpack_from('>i', data, offset)[0]
def sha(data): return hashlib.sha256(data).hexdigest()

def ps_string(data):
    """Decode a Photoshop EngineData literal without treating it as source code."""
    data = re.sub(rb'\\([0-7]{1,3})', lambda m: bytes([int(m.group(1), 8)]), data)
    data = data.replace(b'\\(', b'(').replace(b'\\)', b')').replace(b'\\\\', b'\\')
    if data.startswith(b'\xfe\xff'):
        return data[2:].decode('utf-16-be', 'replace')
    return data.decode('latin1', 'replace')

def text_values(data):
    out = []
    for match in re.finditer(b'Txt TEXT', data):
        offset = match.end()
        count = u32(data, offset)
        if 0 < count < 100000 and offset + 4 + count * 2 <= len(data):
            out.append(data[offset + 4:offset + 4 + count * 2].decode('utf-16-be', 'replace').rstrip('\0'))
    # Font names are in the PSD's EngineData font dictionaries.
    fonts = []
    for match in re.finditer(rb'/Name\s*\(((?:\\.|[^)])*)\)', data, re.S):
        value = ps_string(match.group(1))
        if value and value not in fonts and value not in ('Default', 'Normal', 'PhotoshopKinsokuHard', 'PhotoshopKinsokuSoft'):
            fonts.append(value)
    return out, fonts

def audit_psd(data):
    if data[:4] != b'8BPS' or u16(data, 4) != 1:
        raise ValueError('Only ordinary PSD version 1 is handled by this audit')
    result = dict(width_px=u32(data, 18), height_px=u32(data, 14), channels=u16(data, 12), depth=u16(data, 22), colour_mode=MODES.get(u16(data, 24), str(u16(data, 24))))
    offset = 26
    offset += 4 + u32(data, offset)
    resources_length = u32(data, offset)
    offset += 4
    resources_end = offset + resources_length
    resources = []
    while offset + 12 <= resources_end:
        if data[offset:offset + 4] not in (b'8BIM', b'MeSa'):
            break
        rid = u16(data, offset + 4)
        offset += 6
        name_length = data[offset]
        offset += (name_length + 2) & ~1
        size = u32(data, offset)
        offset += 4
        value = data[offset:offset + size]
        resources.append(rid)
        if rid == 1005 and len(value) >= 16:
            result['dpi'] = [u32(value, 0) / 65536, u32(value, 8) / 65536]
        if rid == 1039:
            result['icc_profile_sha256'] = sha(value)
            result['icc_profile_bytes'] = len(value)
        offset += size + (size % 2)
    result['image_resource_ids'] = resources
    offset = resources_end
    layer_mask_length = u32(data, offset)
    offset += 4
    layers = []
    if layer_mask_length:
        layer_info_length = u32(data, offset)
        offset += 4
        if layer_info_length:
            count = abs(struct.unpack_from('>h', data, offset)[0])
            offset += 2
            for index in range(count):
                top, left, bottom, right = struct.unpack_from('>4i', data, offset)
                channel_count = u16(data, offset + 16)
                channel_records = [dict(id=struct.unpack_from('>h', data, offset + 18 + i * 6)[0], length=u32(data, offset + 20 + i * 6)) for i in range(channel_count)]
                offset += 18 + channel_count * 6
                blend = data[offset + 4:offset + 8].decode('latin1')
                opacity, clipping, flags = data[offset + 8:offset + 11]
                offset += 12
                extra_length = u32(data, offset)
                offset += 4
                extra_end = offset + extra_length
                mask_length = u32(data, offset)
                offset += 4 + mask_length
                ranges_length = u32(data, offset)
                offset += 4 + ranges_length
                name_length = data[offset]
                name = data[offset + 1:offset + 1 + name_length].decode('latin1', 'replace')
                offset += ((name_length + 4) // 4) * 4
                blocks = []
                texts = []
                fonts = []
                while offset + 12 <= extra_end:
                    sig = data[offset:offset + 4]
                    if sig not in (b'8BIM', b'8B64'):
                        break
                    key = data[offset + 4:offset + 8].decode('latin1')
                    size = u32(data, offset + 8)
                    value = data[offset + 12:offset + 12 + size]
                    blocks.append(key)
                    if key == 'luni' and len(value) >= 4:
                        name = value[4:4 + u32(value, 0) * 2].decode('utf-16-be', 'replace')
                    if key in ('TySh', 'tySh'):
                        texts, fonts = text_values(value)
                    offset += 12 + size + (size % 2)
                layers.append(dict(index=index, name=name, bounds_px=[left, top, right, bottom], visible=not bool(flags & 2), opacity=opacity, blend_mode=blend, clipping=clipping, has_pixel_mask=mask_length > 0, additional_blocks=blocks, text=texts, fonts=fonts, channel_records=channel_records,
                    effect_records=[x for x in blocks if x in ('lrFX', 'lfx2', 'lmfx')],
                    smart_object_records=[x for x in blocks if x in ('SoLd', 'SoLE', 'PlLd', 'plLd')],
                    has_vector_mask=any(x in blocks for x in ('vmsk', 'vsms'))))
                offset = extra_end
            for layer in layers:
                for channel in layer['channel_records']:
                    channel['offset'] = offset
                    offset += channel['length']
    result['layers'] = layers
    result['layer_count'] = len(layers)
    result['fonts'] = sorted({font for layer in layers for font in layer['fonts']})
    result['unicode_malayalam_text_detected'] = any(any('\u0d00' <= char <= '\u0d7f' for char in text) for layer in layers for text in layer['text'])
    if 'dpi' in result:
        result['source_canvas_mm'] = [round(result['width_px'] * 25.4 / result['dpi'][0], 6), round(result['height_px'] * 25.4 / result['dpi'][1], 6)]
    result['physical_cut_calibrated'] = False
    return result

def unpack_channel(data, width, height):
    compression = u16(data, 0)
    if compression == 0:
        raw = data[2:]
    elif compression == 1:
        lengths = [u16(data, 2 + row * 2) for row in range(height)]
        offset = 2 + 2 * height
        output = bytearray()
        for length in lengths:
            row = data[offset:offset + length]
            offset += length
            index = 0
            decoded = bytearray()
            while index < len(row):
                value = row[index]
                index += 1
                if value < 128:
                    count = value + 1
                    decoded.extend(row[index:index + count])
                    index += count
                elif value > 128:
                    decoded.extend(row[index:index + 1] * (257 - value))
                    index += 1
            if len(decoded) != width:
                raise ValueError('PSD RLE row width mismatch')
            output.extend(decoded)
        raw = bytes(output)
    else:
        raise ValueError(f'Unsupported layer compression {compression}')
    if len(raw) != width * height:
        raise ValueError('Decoded channel size mismatch')
    return raw

def export_raster_layers(path, entry):
    """Private inspection only. No effects renderer or faithful composite claim."""
    from PIL import Image
    if entry['colour_mode'] != 'RGB' or entry['depth'] != 8:
        return
    data = path.read_bytes()
    dest = PRIVATE / path.stem
    dest.mkdir(exist_ok=True)
    for layer in entry['layers']:
        if 'TySh' in layer['additional_blocks']:
            continue
        left, top, right, bottom = layer['bounds_px']
        width, height = right - left, bottom - top
        if width <= 0 or height <= 0:
            continue
        channels = {}
        for channel in layer['channel_records']:
            if channel['id'] not in (-1, 0, 1, 2):
                continue
            offset = channel['offset']
            raw = unpack_channel(data[offset:offset + channel['length']], width, height)
            channels[channel['id']] = Image.frombytes('L', (width, height), raw)
        if all(c in channels for c in (0, 1, 2)):
            im = Image.merge('RGBA', [channels[0], channels[1], channels[2], channels.get(-1, Image.new('L', (width, height), 255))])
            im.save(dest / f"layer-{layer['index']:02d}.png")

def prepare_479(entry):
    """Reassemble only inspected raster decorations, never flattened sample text."""
    from PIL import Image, ImageChops
    dest = ROOT / 'private' / 'prepared-assets'
    dest.mkdir(parents=True, exist_ok=True)
    base = Image.new('RGBA', (entry['width_px'], entry['height_px']))
    foreground = Image.new('RGBA', base.size)
    layers = {x['index']: x for x in entry['layers']}
    shape = Image.open(PRIVATE / '479 C' / 'layer-00.png').getchannel('A')
    for canvas, indices in [(base, [0, 1, 3]), (foreground, [6, 14, 18])]:
        for index in indices:
            layer = layers[index]
            if layer['effect_records'] or layer['has_pixel_mask'] or layer['has_vector_mask'] or layer['clipping'] or layer['blend_mode'] != 'norm' or layer['opacity'] != 255:
                raise ValueError(f'Layer {index} requires unsupported composition')
            source = Image.open(PRIVATE / '479 C' / f'layer-{index:02d}.png').convert('RGBA')
            canvas.alpha_composite(source, dest=tuple(layer['bounds_px'][:2]))
        canvas.putalpha(ImageChops.multiply(canvas.getchannel('A'), shape))
    base.save(dest / '479-c-clean-background.png', dpi=(300, 300))
    foreground.save(dest / '479-c-clean-foreground.png', dpi=(300, 300))
    base.alpha_composite(foreground)
    base.save(PRIVATE / '479-c-clean-inspection.png', dpi=(300, 300))

def create_synthetic_479():
    from PIL import Image, ImageDraw
    image = Image.new('RGB', (1004, 1843), '#fcf6e9')
    draw = ImageDraw.Draw(image)
    scale = 300 / 25.4
    box = lambda values: tuple(round(value * scale) for value in values)
    draw.rounded_rectangle((8, 8, 995, 1834), radius=70, outline='#173d43', width=12)
    draw.line((65, 400, 939, 400), fill='#bd9140', width=4)
    draw.ellipse(box((11.5, 39, 73.5, 101)), outline='#bd9140', width=13)
    draw.rounded_rectangle(box((6, 105, 79, 123)), radius=18, fill='#f1dfb9')
    draw.line((110, 1730, 894, 1730), fill='#bd9140', width=3)
    image.save(ROOT / 'private' / 'prepared-assets' / '479-c-synthetic-background.png', dpi=(300, 300))

def main():
    from PIL import Image
    PRIVATE.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    entries = []
    for path in sorted(SOURCE.iterdir()):
        if not path.is_file():
            continue
        data = path.read_bytes()
        entry = dict(file=path.name, bytes=len(data), sha256=sha(data))
        if path.suffix.lower() == '.psd':
            try:
                entry.update(audit_psd(data))
            except Exception as exc:
                entry['audit_error'] = str(exc)
        else:
            with Image.open(path) as im:
                entry.update(width_px=im.width, height_px=im.height, colour_mode=im.mode, format=im.format, dpi=im.info.get('dpi'), icc_profile_bytes=len(im.info.get('icc_profile', b'')))
        entries.append(entry)
    private = dict(note='Private audit includes original PSD text and layer names. Never serve this directory publicly.', source_spec='https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/', files=entries)
    (PRIVATE / 'full-inventory.json').write_text(json.dumps(private, ensure_ascii=False, indent=2), encoding='utf-8')
    for entry in entries:
        if entry['file'] == '479 C.psd' and not entry.get('audit_error'):
            export_raster_layers(SOURCE / entry['file'], entry)
            prepare_479(entry)
    sanitized = json.loads(json.dumps(private))
    sanitized['note'] = 'Original recipient text and layer names redacted. Dimensions describe source canvas only; physical cut shapes and sizes remain unverified.'
    for entry in sanitized['files']:
        for layer in entry.get('layers', []):
            layer['name'] = f"layer-{layer['index']:02d}"
            layer['text_runs'] = [dict(sha256=sha(value.encode('utf-8')), character_count=len(value), has_malayalam=any('\u0d00' <= char <= '\u0d7f' for char in value)) for value in layer.pop('text', [])]
    (PUBLIC / 'reference-inventory.json').write_text(json.dumps(sanitized, ensure_ascii=False, indent=2), encoding='utf-8')
    # Only inspected exports with no sample identity or event text are copied.
    dest = ROOT / 'private' / 'prepared-assets'
    dest.mkdir(parents=True, exist_ok=True)
    for source, target in [('727 A R copy.png', '727-a-r-frame.png'), ('727 A BASE copy.png', '727-a-base-frame.png'), ('H GLASS BIG copy.png', 'h-glass-big-frame.png')]:
        shutil.copyfile(SOURCE / source, dest / target)
    create_synthetic_479()
    prepared = []
    for path in sorted(dest.glob('*.png')):
        with Image.open(path) as im:
            prepared.append(dict(file=path.relative_to(ROOT).as_posix(), sha256=sha(path.read_bytes()), width_px=im.width, height_px=im.height, physical_cut_calibrated=False))
    (PUBLIC / 'prepared-assets.json').write_text(json.dumps(prepared, indent=2), encoding='utf-8')
    print(json.dumps([dict(file=e['file'], pixels=[e.get('width_px'), e.get('height_px')], mm=e.get('source_canvas_mm'), dpi=e.get('dpi'), layers=e.get('layer_count'), fonts=e.get('fonts'), error=e.get('audit_error')) for e in entries], ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
