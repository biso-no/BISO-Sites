import QRCode from "qrcode";

/**
 * Renders a QR code as a single SVG path so the pass never needs
 * `dangerouslySetInnerHTML`.
 */
export function qrPath(text: string): { path: string; size: number } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const { size } = modules;
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) {
        parts.push(`M${col} ${row}h1v1h-1z`);
      }
    }
  }
  return { path: parts.join(""), size };
}
