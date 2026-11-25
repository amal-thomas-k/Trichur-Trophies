# Preparing and publishing templates

The initial template definitions are in `src/demo-templates.js`. All start with `calibrationStatus: "unverified"`. A successful render or an exact-size PDF does not calibrate a physical trophy, cutter, printer or media profile.

| Family | Prepared design | Components | Physical status |
| --- | --- | --- | --- |
| 479 C | Explicitly synthetic demonstration; original canvas metadata | Front, 85.005333 × 156.040667 mm | Unverified |
| 727 A | Inspected blank source frames plus new field placement | Front 34.036 × 34.036 mm; base 71.289333 × 90.254667 mm | Both cuts and pairing unverified |
| H GLASS BIG | Inspected blank source frame plus new field placement | Front, 114.977333 × 242.993333 mm | Unverified |

See `docs/REFERENCE_AUDIT.md` and `docs/reference-inventory.json` for measurements and exact source limitations. The original references remain in `Design Templates/`. Do not serve that directory or the personal inspection material in `private/reference-audit/` to customers.

## Prepare artwork in Photoshop

1. Work on a copy of the PSD. Preserve the original and its source hash. Identify original recipient photo, recipient name, achievement and all order-specific wording.
2. Hide/remove variable content by its real layers. Confirm that nothing remains inside flattened layers, masks, groups or smart objects. Do not paint over an old recipient or use generative fill to fabricate the master.
3. Export an sRGB PNG background at the original canvas size, with no recipient content. Export decorations that must cover the customer's photo as a separate transparent foreground. A frame with a white centre is a background, not a transparent foreground.
4. Export a photo mask separately if a production model needs an irregular shape. The current seeded layouts use circular photo crops. Do not use a decorative edge as an inferred physical trim path.
5. If the approved design needs a fixed legacy/curved heading or a Photoshop effect the browser cannot match, export that exact heading from Photoshop as a transparent fixed asset. Label it fixed artwork; it is not editable Unicode text. Never silently replace an approved font.
6. Compare the clean exports at full size and on a contrasting background. Check especially the old portrait area and every original name/achievement position. Keep a staff preparation record.

The clean layer-derived 479 candidates in `private/prepared-assets/` omit all original type and portrait content. They can be used in a new staff-reviewed version; they are not automatically published as a faithful original reproduction. For new copies, review the `foregroundPath` draw order and field geometry with an actual proof before publishing.

## Numeric geometry

All coordinates are millimetres from the top-left of the component canvas. Each published version freezes its source assets and definitions. Order groups reference that version; creating an improved version must not change an existing order's approved art.

Example component for the synthetic 479 layout:

```json
{
  "id": "front",
  "name": "Front",
  "widthMm": 85.005333,
  "heightMm": 156.040667,
  "backgroundPath": "private/prepared-assets/479-c-synthetic-background.png",
  "photo": {"x": 12.5, "y": 40, "width": 60, "height": 60, "shape": "circle"},
  "headingBox": {"x": 6, "y": 10, "width": 73, "height": 22, "minFontMm": 3, "maxFontMm": 5.5},
  "nameBox": {"x": 7, "y": 106, "width": 71, "height": 16, "minFontMm": 3, "maxFontMm": 6},
  "achievementBox": {"x": 8, "y": 126, "width": 69, "height": 15, "minFontMm": 2.8, "maxFontMm": 4},
  "bleedMm": 0,
  "safeZoneMm": 3,
  "allowRotation": true,
  "media": "photo-paper",
  "trimGeometryStatus": "unverified"
}
```

`name` and `achievement` are per-recipient values. The shared heading belongs to the order or group. A base may omit `photo`; the 727 base is text-only. A component may omit a heading/achievement field where there is no room. The small 727 front has a deliberately limited name area: a long name should produce a fit issue, not be silently shortened or shrunk below its configured minimum. Use a staff-approved larger layout/version if needed.

The source defines font limits in millimetres; 1 mm is 72/25.4 PDF points. The authoritative renderer measures the shaped text at the real output resolution. It must keep the whole Unicode string intact. A fit failure blocks proof/approval until wording or an approved layout is corrected. Customers should not edit fonts or geometry.

The supported field schema is explicit: `name` and `achievement` have recipient scope; `heading`, `event` and `date` have shared scope. Field rules may set `required`, `defaultText` and grapheme-counted `maxLength`. Unsupported keys/scope combinations are rejected. Nonempty content without corresponding geometry on any component is rejected rather than silently omitted. With paired components, a shared heading may appear on the base while the front holds only the photo/name. A logo requires a `logoBox` on at least one component.

Example rule:

```json
{"key":"achievement","scope":"recipient","label":"Achievement / designation","required":false,"defaultText":"","maxLength":100}
```

## Masks and bundled font selection

Renderer `tt-canonical-3` accepts an explicit numeric polygon in `photo.mask` and `component.trimMask`:

```json
{"type":"polygon","points":[[0,0],[60,0],[60,45],[30,60],[0,45]]}
```

Photo-mask points are millimetres relative to the photo rectangle; trim-mask points are relative to the component trim rectangle. There must be 3–128 bounded points with usable area. Duplicates and self-intersections are rejected. Raw SVG, arbitrary mask URLs and inferred decorative-border cuts are not supported. `backgroundColor: "transparent"` can preserve an explicit cutout. A trim silhouette remains physically unverified until staff measure, cut and fit it; it is not machine cutter output or irregular sheet nesting.

If a shaped component also uses bleed, staff must supply `component.bleedMask` in the full bleed-footprint coordinates. The renderer does not infer an expanded cut path. Retain the separately measured trim mask for the final component geometry.

Each text box, component or template may select `font: "malayalam"` or `font: "latin"`. These resolve to the bundled Noto Sans Malayalam/Liberation Sans families; box selection takes precedence. Unknown/external font assets are rejected, and choosing Latin-only for Malayalam text fails rather than silently substituting a font. This is controlled selection from licensed bundled fonts, not automatic matching of original PSD fonts.

## Fonts and Malayalam

The renderer bundles Noto Sans Malayalam under the SIL Open Font License and Liberation Sans under its supplied licence; see `src/fonts/README.md`. They are chosen fonts for the new layouts, not substitutions represented as faithful matches to source PSDs.

The source 492 and carving PSDs contain legacy ML-TT encoding. Their text must be checked against the original visual design and re-entered in Unicode or supplied as staff-approved fixed artwork. A blind Latin-to-Malayalam conversion is unsafe. Font declarations alone cannot establish licensing, appearance or correct encoding.

Editable curved Malayalam is subject to the renderer's explicit quality gate. A generated SVG text-path feasibility image is evidence to inspect, not proof of correctness. A Malayalam reader must compare conjuncts, chillus, vowel signs, punctuation and mixed-script initials, including a straight control line. Keep editable curved production fields disabled until that sign-off exists; use a correctly labelled fixed heading asset when appropriate.

## Physical calibration and publishing

1. Measure the actual insert and required cutting clearance; record width, height, shape and allowed rotation for each component.
2. Select the intended printer, driver and stock. Print the calibration PDF at **Actual Size / 100%** with Fit/Shrink/Borderless enlargement disabled.
3. Measure both 100 mm rulers between tick-stroke centres, and the square/circle between their thin stroke centre lines. Outer-edge measurements include the stroke width. A printer that scales X and Y differently is not acceptable; correct its settings before approving a template.
4. Print the template itself, cut it and fit it to the real trophy. Check decoration clearance and readable name size. Confirm the proposed 727 front/base association with the actual product.
5. Record the operator, date, printer profile, media, measured values and result. Only then mark the relevant template/profile calibrated using the application's staff control. Retain the unverified source measurements as provenance.
6. Publish a new immutable version for any geometry, media, component or artwork change. Moving an order to it requires new proofs and approval; old approved artwork remains available in history.

The default workflow is sRGB with zero declared bleed. The renderer supports genuine supplied background bleed only. Set `bleedMm`, `bleedPolicy: "provided-background"`, `backgroundIncludesBleed: true` and a clean `backgroundPath`. The full background must be exactly `round((widthMm + 2 × bleedMm) × dpi / 25.4)` by `round((heightMm + 2 × bleedMm) × dpi / 25.4)` pixels. New published versions seal `backgroundSha256`/`foregroundSha256` from their supplied files. Missing/mismatched full-bleed backgrounds fail; the renderer never fabricates or repeats edge pixels.

Photo/text geometry remains relative to the trim origin. The canonical PNG includes the provided bleed, the PDF embeds its full footprint, and the manifest records both trim and bleed. Test a genuine full-bleed source before enabling it for a model. No CMYK conversion, PDF/X certification, colour match or irregular nesting is implied.

## Repeatable asset preparation

`python scripts/audit_references.py` regenerates the metadata inventory, private layer inspection, three byte-identical blank-frame copies, cleaned 479 candidates and synthetic 479 background. It requires Pillow only for raster operations; production does not need Python or PSD parsing. The script never writes into `Design Templates/`. The identity-free prepared masters are required runtime files; include them in a private deployment/source package, while excluding `private/reference-audit/` and unrelated reference samples.
