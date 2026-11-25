# A3 production and physical checks

An approved digital proof is not evidence of a correct printer scale or physical fit. Use the calibration PDF and a real sample of each trophy model before releasing a customer order.

## Printer/profile calibration

1. Load the exact intended paper/media. Disable driver enlargement, borderless expansion, page fitting and automatic scale-to-printable-area.
2. Choose **A3, 297 × 420 mm**, the intended portrait/landscape orientation, and **100% / Actual Size** in the PDF viewer and printer driver.
3. Print `samples/render-check/calibration-A3.pdf`. It includes measured reference geometry. Measure horizontal and vertical rulers independently between the centres of the 0/100 tick strokes. Square/circle dimensions also refer to stroke centre lines: measuring the outer edges of their 0.5-point strokes adds about 0.176 mm. Record measured lengths, printer model, driver, paper type and operator/date.
4. Check the driver's nonprintable margins. Set the profile margin conservatively; use a greater margin if the driver clips the test. Do not shrink finished inserts to fit.
5. Print one insert per template version, cut using a physically verified path and trial-fit it in the actual trophy. PSD canvas dimensions do not prove trim or decorative-border geometry.
6. Only after these checks, record the printer profile and model/profile calibration in the staff interface. Keep the measured notes with the order pilot checklist.

Changing printer, media, borderless mode, driver scaling or template dimensions requires a fresh calibration. Downloading a PDF or programmatically checking its MediaBox cannot perform this physical check.

## Production sequence

The organiser must finish readable individual proof reviews and approve the current common wording, photographs, names and quantities. Staff then select the calibrated profile and queue an export. Technical validation checks page bounds, piece dimensions, allowed rotation, margins, gap, bleed footprint, counts and coverage.

Review the generated PDF and its placement manifest. Confirm expected recipient count, total copies and total printed components separately. Pair front/base pieces by recipient ID and copy number. Keep assembly labels in the manifest or safe waste areas; do not draw unwanted borders over customer artwork.

Release the validated job explicitly. Record **printed** only after a human completes printing. An output file is an artifact, not a report from the printer. If content changes, produce a new proof and approval; old output becomes superseded.

Diagnostic/sample exports are for measuring and inspecting uncalibrated demonstrations. They must not be treated as production-authorized output or used to bypass the calibration gate.

## Layout and colour

The PDF has exact A3 page dimensions. Geometry is stored in millimetres and converted to points with `72 / 25.4`. Approved artwork is normally sampled at 300 DPI and embedded at its prescribed physical size. A higher output DPI cannot restore detail absent from a compressed or heavily cropped phone photograph.

Packing is conservative and deterministic. It may rotate a piece by 90° only when the template/media allows that. It respects margins, bleed and cutting gaps and rejects incompatible media. It does not shrink an oversized item; choose another page/profile or redesign the physically approved model if a piece cannot fit.

Seeded templates use zero bleed. Nonzero bleed is supported only when staff supply a clean, correctly sized full-bleed background with the explicit `provided-background` policy described in `TEMPLATE_SETUP.md`. The canonical PNG and PDF include that real supplied bleed. Reserving empty space or repeating edge pixels is not treated as bleed. Incompatible media is rejected; prepare separate compatible exports rather than assuming automatic multi-profile splitting.

The implemented default is an explicit **sRGB raster workflow**. This is not PDF/X, automatic CMYK conversion or a promise of printer colour matching. The source blank CMYK sheet does not identify an ICC printer profile. Print skin tones, blacks, gradients and representative colours on the production device and agree the appearance before the pilot. Any future ICC/CMYK workflow needs its own evidence.

## Reprints

Select the exact recipient, component and copy number to reprint, and record the reason. A single corrected item must not silently cause a complete order reprint. Verify whether the current approval still applies; a content correction always needs new review/approval. Keep the original job and audit history for comparison.

## Stop conditions

Stop release if the file is incomplete, a hash check fails, a required font is missing, a name overflows, the proof is stale, the dimensions are unverified, a cut path is ambiguous, or a piece exceeds the printable area. Resolve the precise issue and retry; do not acknowledge a fake successful print.
