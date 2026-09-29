import { QRCodeSVG } from 'qrcode.react';
import { joinUrl } from '@/lib/device';

export interface QrTileProps {
  code: string;
  /** The TV pairing screen uses 36vh; the home corner tile uses 14vh. */
  size: number | string;
  /** Optional caption under the code. */
  label?: string;
  /** Overrides the derived join-code size (the pairing screen uses 9vh). */
  codeSize?: number | string;
  className?: string;
}

/** QR code plus the six-character home code, both pointing at `/join/<code>`. */
export default function QrTile({ code, size, label, codeSize, className = '' }: QrTileProps) {
  const px = typeof size === 'number' ? `${size}px` : size;
  const codePx = codeSize === undefined ? `calc(${px} * 0.19)` : typeof codeSize === 'number' ? `${codeSize}px` : codeSize;
  return (
    <div className={`flex flex-col items-center ${className}`.trim()}>
      <div
        className="flex items-center justify-center rounded-[2.2rem] bg-white"
        style={{ padding: `calc(${px} * 0.08)`, width: px, height: px }}
      >
        <QRCodeSVG
          value={joinUrl(code)}
          level="M"
          size={Number.parseFloat(px) * 0.84}
          bgColor="#ffffff"
          fgColor="#14101F"
          includeMargin={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div
        className="code-text font-display mt-[0.7em] text-center"
        style={{ fontSize: codePx, color: 'var(--bg-0)' }}
      >
        {code}
      </div>
      {label ? (
        <div
          className="font-body mt-[0.25em] text-center"
          style={{ fontSize: `calc(${px} * 0.1)`, color: 'rgba(20,16,31,.62)' }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}
