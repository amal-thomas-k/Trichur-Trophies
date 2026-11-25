/** Deterministic millimetre shelf packing. No scaling, omissions or silent copies. */
export const MM_TO_PT = 72 / 25.4;
const finite = (value, label, min = 0) => {
  if (!Number.isFinite(value) || value < min) throw new Error(`${label} must be a finite number >= ${min}`);
  return value;
};

export function normalizeProfile(input = {}) {
  if(input.orientation!==undefined&&!['portrait','landscape'].includes(input.orientation))throw new Error('A3 orientation must be portrait or landscape');
  if(input.colorSpace!==undefined&&input.colorSpace!=='sRGB')throw new Error('Only the documented sRGB print workflow is implemented; CMYK/PDF-X conversion requires a separately validated profile');
  const landscape = input.orientation === 'landscape';
  const profile = {
    id: input.id || 'A3-sRGB', name: input.name || 'A3 / sRGB',
    widthMm: landscape ? 420 : 297, heightMm: landscape ? 297 : 420,
    marginMm: Number(input.marginMm ?? 10), gapMm: Number(input.gapMm ?? 3),
    orientation: landscape ? 'landscape' : 'portrait', media: input.media || 'photo-paper',
    colorSpace: 'sRGB', ...input,
  };
  // A3 is fixed, even if an untrusted request supplies page dimensions.
  profile.widthMm = landscape ? 420 : 297;
  profile.heightMm = landscape ? 297 : 420;
  profile.colorSpace = 'sRGB';
  finite(profile.marginMm, 'Printer margin', 0);
  finite(profile.gapMm, 'Cutting gap', 0);
  if (profile.marginMm * 2 >= Math.min(profile.widthMm, profile.heightMm)) throw new Error('Printer margins leave no usable A3 area');
  return profile;
}

export function packPieces(pieces, inputProfile = {}) {
  if (!Array.isArray(pieces) || pieces.length === 0) throw new Error('No approved pieces to print');
  const profile = normalizeProfile(inputProfile);
  const usableW = profile.widthMm - profile.marginMm * 2;
  const usableH = profile.heightMm - profile.marginMm * 2;
  const placements = [];
  const shelvesByPage = [];
  const ordered = pieces.map((piece, inputIndex) => {
    const widthMm = finite(Number(piece.widthMm), 'Piece width', 0.1);
    const heightMm = finite(Number(piece.heightMm), 'Piece height', 0.1);
    const bleedMm = finite(Number(piece.bleedMm ?? 0), 'Bleed', 0);
    if (piece.media && piece.media !== profile.media) throw new Error(`Incompatible media for piece ${piece.recipientId || inputIndex}: ${piece.media}; select a matching profile`);
    return { ...piece, widthMm, heightMm, bleedMm, inputIndex };
  }).sort((a, b) => (b.heightMm + 2*b.bleedMm) - (a.heightMm + 2*a.bleedMm) || b.widthMm - a.widthMm || a.inputIndex - b.inputIndex);

  for (const piece of ordered) {
    const variants = [{ rotation: 0, width: piece.widthMm + 2*piece.bleedMm, height: piece.heightMm + 2*piece.bleedMm }];
    if (piece.allowRotation === true) variants.push({ rotation: 90, width: variants[0].height, height: variants[0].width });
    const viable = variants.filter(v => v.width <= usableW + 1e-8 && v.height <= usableH + 1e-8);
    if (!viable.length) throw new Error(`Oversized insert ${piece.modelCode || ''}/${piece.componentId || ''}: ${piece.widthMm} x ${piece.heightMm} mm plus ${piece.bleedMm} mm bleed cannot fit A3; no scaling was applied`);
    let selected;
    for (let page = 0; page < shelvesByPage.length && !selected; page++) {
      for (const shelf of shelvesByPage[page]) {
        for (const variant of viable) {
          if (variant.height <= shelf.height + 1e-8 && shelf.nextX + variant.width <= usableW + 1e-8) {
            selected = { page, shelf, variant, x: shelf.nextX, y: shelf.y };
            break;
          }
        }
        if (selected) break;
      }
      if (!selected) {
        const shelves = shelvesByPage[page];
        const nextY = shelves.length ? shelves.at(-1).y + shelves.at(-1).height + profile.gapMm : 0;
        for (const variant of viable) {
          if (nextY + variant.height <= usableH + 1e-8) {
            const shelf = { y: nextY, height: variant.height, nextX: 0 };
            shelves.push(shelf);
            selected = { page, shelf, variant, x: 0, y: nextY };
            break;
          }
        }
      }
    }
    if (!selected) {
      const variant = viable[0];
      const shelf = { y: 0, height: variant.height, nextX: 0 };
      shelvesByPage.push([shelf]);
      selected = { page: shelvesByPage.length - 1, shelf, variant, x: 0, y: 0 };
    }
    selected.shelf.nextX = selected.x + selected.variant.width + profile.gapMm;
    placements.push({
      ...piece,
      page: selected.page + 1,
      xMm: profile.marginMm + selected.x,
      yMm: profile.marginMm + selected.y,
      footprintWidthMm: selected.variant.width,
      footprintHeightMm: selected.variant.height,
      rotation: selected.variant.rotation,
    });
  }
  const result = { profile, pageCount: shelvesByPage.length, placements };
  validatePlacements(result, pieces.length);
  return result;
}

export function validatePlacements({ profile, placements, pageCount }, expectedCount = placements.length) {
  if (placements.length !== expectedCount) throw new Error(`Placement count mismatch: expected ${expectedCount}, got ${placements.length}`);
  const seen = new Set();
  for (const p of placements) {
    if (seen.has(p.inputIndex)) throw new Error('Duplicate placement detected');
    seen.add(p.inputIndex);
    if (!Number.isInteger(p.page) || p.page < 1 || p.page > pageCount) throw new Error('Invalid page index');
    if (p.xMm < profile.marginMm - 1e-7 || p.yMm < profile.marginMm - 1e-7 || p.xMm + p.footprintWidthMm > profile.widthMm - profile.marginMm + 1e-7 || p.yMm + p.footprintHeightMm > profile.heightMm - profile.marginMm + 1e-7) throw new Error('Placement exceeds printer safe area');
  }
  for (let i=0; i<placements.length; i++) for (let j=i+1; j<placements.length; j++) {
    const a=placements[i], b=placements[j];
    if (a.page !== b.page) continue;
    const separated = a.xMm+a.footprintWidthMm+profile.gapMm <= b.xMm+1e-7 || b.xMm+b.footprintWidthMm+profile.gapMm <= a.xMm+1e-7 || a.yMm+a.footprintHeightMm+profile.gapMm <= b.yMm+1e-7 || b.yMm+b.footprintHeightMm+profile.gapMm <= a.yMm+1e-7;
    if (!separated) throw new Error(`Pieces overlap or violate cutting gap: ${i}, ${j}`);
  }
  return true;
}
