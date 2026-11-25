# Original reference audit

The 23 files in `Design Templates/` were inspected without editing them: 12 PSD files and 11 PNG/JPEG exports. `docs/reference-inventory.json` records file sizes, SHA-256 hashes, canvas resolution, colour modes, layers, effect-record flags and declared font names. Its personal text and layer names are redacted. The local-only `private/reference-audit/full-inventory.json` and inspection images contain original reference material and must not be served, published or included in a public source archive.

The repeatable audit is `python scripts/audit_references.py` (Python 3.12 with Pillow). It parses PSD version-1 headers, resolution resources, layer records and text metadata according to [Adobe's PSD specification](https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/). It also decodes ordinary 8-bit RGB raw/RLE raster layers for inspection. It is **not a general Photoshop effects renderer**. No font, smart-object or warped-text fidelity is inferred from a successful metadata parse.

## Measured metadata

All PSD files specify 300 × 300 DPI. Millimetres below are calculated from pixel canvas dimensions, not measured trophy cuts.

| PSD | Canvas pixels | Canvas mm | Layers | Colour |
| --- | --- | --- | ---: | --- |
| 2091 NEW A | 567 × 756 | 48.006 × 64.008 | 2 | RGB |
| 479 C | 1004 × 1843 | 85.005333 × 156.040667 | 19 | RGB |
| 492 C 4 | 1157 × 1547 | 97.959333 × 130.979333 | 15 | RGB |
| 492 C R | 720 × 720 | 60.96 × 60.96 | 3 | RGB |
| 727 A BASE | 842 × 1066 | 71.289333 × 90.254667 | 2 | RGB |
| 727 A R | 402 × 402 | 34.036 × 34.036 | 4 | RGB |
| CARVING KANADI BIG BASE | 4134 × 543 | 350.012 × 45.974 | 4 | RGB |
| CARVING KANNADI R BIG | 2953 × 2953 | 250.020667 × 250.020667 | 11 | RGB |
| H GLASS BIG | 1358 × 2870 | 114.977333 × 242.993333 | 2 | RGB |
| Sheet_A3 | 3508 × 4961 | 297.010667 × 420.031333 | 1 | CMYK |
| Sheet_CLEAR | 3900 × 5700 | 330.2 × 482.6 | 0 | RGB |
| XYLEM GLASS SMALL | 1020 × 2388 | 86.36 × 202.184 | 10 | RGB |

`Sheet_A3` is a blank CMYK reference. The application must independently use exact A3 geometry, 297 × 420 mm, not copy the rounded source raster's calculated millimetres. The reference does not identify the shop printer's required colour profile. `Sheet_CLEAR` is **not** A3. A 350.012 mm carving base needs allowed rotation or landscape packing; it must not be scaled down to fit portrait width.

## Layer-aware preparation

Three source exports were visually inspected as identity-free blank decorative frames and copied byte-for-byte:

| Source | Prepared asset | Use |
| --- | --- | --- |
| 727 A R copy.png | `private/prepared-assets/727-a-r-frame.png` | Background beneath new photo/text |
| 727 A BASE copy.png | `private/prepared-assets/727-a-base-frame.png` | Background beneath new text |
| H GLASS BIG copy.png | `private/prepared-assets/h-glass-big-frame.png` | Background beneath new photo/text |

These exports have opaque interiors; they are not foreground overlays or photo masks. Their borders are decorative artwork and are not verified cut paths. The proposed 727 front/base pairing is based on the supplied filenames and must be confirmed by shop staff.

The 479 C PSD was decomposed into its original raster layers. A clean **candidate** background uses zero-based PSD layer indices 0, 1 and 3; a candidate transparent foreground uses indices 6, 14 and 18. All type layers, original portrait layer 4 and original church-photo layer 15 are excluded. Only normal-blend, full-opacity layers without masks or live effects were reassembled. The original rounded alpha is retained. No repainting, generative fill or white rectangle covering of a recipient was used. Visual inspection confirmed no old recipient image or text in these candidates:

- `private/prepared-assets/479-c-clean-background.png`
- `private/prepared-assets/479-c-clean-foreground.png`

The candidate is not an approved reproduction of the complete original: the original shared header and type effects were intentionally removed, and source-font matching remains unverified. It is available for staff preparation, but the default seeded 479 layout uses a separately created **synthetic** background and is labelled as a demonstration. This avoids claiming an unchanged approved original design.

## Font and encoding limitations

| Reference | Relevant font declarations | Finding / required action |
| --- | --- | --- |
| 479 C | Aileron-Bold, Aladin-Regular, CassandraPersonalUse-Regular, MonotypeCorsiva | Font files and usable production licences were not supplied. New typography is not an exact match. Check the personal-use font's licence before any reuse. |
| 492 C 4 | ML-TTAathira-Bold, ML-TTNanditha-Bold, ML-TTPooram-Bold | Confirmed legacy encoding: stored text uses Latin/extended Latin characters while the export displays Malayalam. Retype verified Unicode or export approved fixed type from Photoshop. |
| CARVING KANNADI R BIG | ML-TTKaumudi-Normal, ML-TTSabari-Bold | Confirmed legacy encoding in the curved Malayalam header. Do not pass the raw PSD string into a Unicode font. |
| XYLEM GLASS SMALL | BackslashRegular, BroncoRegular, BrushScriptMT, Humanist777BT-BlackB, Humanist777BT-RomanB | Original fonts and font-matching approval remain unavailable. |

Times New Roman appears in PSD EngineData resources as well; a declaration is not proof that it contributes visible glyphs. The audit does not silently convert legacy font strings. No live smart-object record was found in the inspected layer records, but that does not establish complete compatibility of every Photoshop feature. Multiple references contain `lfx2`/`lrFX` effects records. Their faithful reproduction is not claimed.

No handwritten `image(8).png` reference was present. No contact details or sample people's names/photos are used in seeded customer orders.
