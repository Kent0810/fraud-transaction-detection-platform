import { useMemo } from 'react';
import QRCode from 'qrcode';
import Svg, { Path, Rect } from 'react-native-svg';

/** A QR code drawn as one SVG path: dark on white whatever the theme, so every scanner can read it. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const { path, cells } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    let d = '';
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { path: d, cells: modules.size };
  }, [value]);

  // A quiet zone of 4 cells around the code, as the QR standard asks.
  const view = cells + 8;
  return (
    <Svg width={size} height={size} viewBox={`-4 -4 ${view} ${view}`} accessibilityLabel="QR code">
      <Rect x={-4} y={-4} width={view} height={view} fill="#FFFFFF" />
      <Path d={path} fill="#111111" />
    </Svg>
  );
}
