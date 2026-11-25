import qrcode from './vendor/qrcode-generator.mjs';

/**
 * Encode an order-link credential locally. No service calls, image fetches,
 * token-bearing SVG metadata, filesystem writes, or logging occur here.
 * The API owner must authenticate the caller and use a private no-store reply.
 * Encoder: qrcode-generator 2.0.4, MIT; see src/vendor/QR-PROVENANCE.md.
 */
export function orderQrSvg(url) {
  const invalid = () => new Error('Use a complete HTTP(S) order link with its access token in the URL fragment; query parameters and embedded credentials are not allowed.');
  if (typeof url !== 'string' || url.length > 2048 || url !== url.trim() || /[\u0000-\u0020\u007f]/u.test(url)) throw invalid();
  let parsed;
  try { parsed = new URL(url); } catch { throw invalid(); }
  if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || !/^#[a-zA-Z0-9_-]{32,256}$/.test(parsed.hash)) throw invalid();
  // URL serialization safely punycodes hostnames and percent-encodes paths.
  // A fragment-only base64url credential makes the resulting QR payload ASCII.
  const payload = parsed.href;
  if (payload.length > 2048 || /[^\x00-\x7f]/u.test(payload)) throw invalid();
  const code = qrcode(0, 'M');
  try { code.addData(payload, 'Byte'); code.make(); }
  catch { throw new Error('This order link is too long for a reliable QR code. Configure a shorter application base URL.'); }
  const modules = code.getModuleCount();
  const quiet = 4;
  const side = modules + quiet * 2;
  const commands = [];
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules;) {
      if (!code.isDark(row, col)) { col++; continue; }
      const start = col;
      while (col < modules && code.isDark(row, col)) col++;
      const run = col - start;
      commands.push(`M${start + quiet} ${row + quiet}h${run}v1h-${run}z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side * 8}" height="${side * 8}" viewBox="0 0 ${side} ${side}" role="img" aria-label="Order access QR code" shape-rendering="crispEdges"><title>Order access QR code</title><rect width="${side}" height="${side}" fill="#ffffff"/><path d="${commands.join('')}" fill="#000000"/></svg>`;
}

export default orderQrSvg;
