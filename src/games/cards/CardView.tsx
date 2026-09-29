import { memo, type CSSProperties } from 'react';
import { COLOR_HEX, cardLabel } from './deck';
import type { Card, CardColor } from '@/types/games';

export interface CardViewProps {
  card: Card;
  /** Rendered width. A number is px; a string is used verbatim (e.g. `30vh`). */
  width: number | string;
  className?: string;
  /** Unplayable cards on the phone are dimmed to 40%. */
  dim?: boolean;
}

const RATIO = 1.42; // height / width
const CREAM = '#FFF6E9';
const INK = '#14101F';
const BORDER = '3px solid #FFF6E9';
const SHADOW = '0 4px 0 rgba(0,0,0,.35)';

/** Every inner size is derived from the card width, whatever unit it is in. */
function scaler(width: number | string): (factor: number) => string {
  const w = typeof width === 'number' ? `${width}px` : width;
  return (factor: number) => `calc(${w} * ${factor})`;
}

function Face({ card, width }: { card: Card; width: number | string }) {
  const px = scaler(width);
  const face = card.color ? COLOR_HEX[card.color] : null;
  const ink = face ?? INK;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width,
        aspectRatio: `${RATIO}`,
        background: face ?? 'transparent',
        borderRadius: px(0.13),
        border: BORDER,
        boxShadow: SHADOW,
        overflow: 'hidden',
      }}
      aria-label={cardLabel(card)}
    >
      <div
        className="absolute flex items-center justify-center"
        style={{
          width: px(0.66),
          height: px(0.47),
          borderRadius: '50%',
          background: CREAM,
          transform: 'rotate(-18deg)',
        }}
      >
        <div className="flex items-center justify-center" style={{ transform: 'rotate(18deg)' }}>
          {card.kind === 'number' ? (
            <span className="font-display" style={{ fontSize: px(0.42), lineHeight: 1, color: ink }}>
              {card.value ?? 0}
            </span>
          ) : null}

          {card.kind === 'skip' ? (
            <svg viewBox="0 0 100 100" style={{ width: px(0.4), height: px(0.4) }} aria-hidden="true">
              <circle cx={50} cy={50} r={36} fill="none" stroke={ink} strokeWidth={13} />
              <line x1={24} y1={76} x2={76} y2={24} stroke={ink} strokeWidth={13} strokeLinecap="round" />
            </svg>
          ) : null}

          {card.kind === 'reverse' ? (
            <svg viewBox="0 0 100 100" style={{ width: px(0.46), height: px(0.46) }} aria-hidden="true">
              <path
                d="M20 34 H68 L54 18 M80 66 H32 L46 82"
                fill="none"
                stroke={ink}
                strokeWidth={11}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}

          {card.kind === 'draw2' ? (
            <span className="font-display" style={{ fontSize: px(0.34), lineHeight: 1, color: ink }}>
              +2
            </span>
          ) : null}

          {card.kind === 'wild' || card.kind === 'wild4' ? (
            <div className="relative flex items-center justify-center">
              <svg viewBox="0 0 100 100" style={{ width: px(0.34), height: px(0.34) }} aria-hidden="true">
                <path d="M50 50 L50 4 A46 46 0 0 1 96 50 Z" fill={COLOR_HEX.red} />
                <path d="M50 50 L96 50 A46 46 0 0 1 50 96 Z" fill={COLOR_HEX.yellow} />
                <path d="M50 50 L50 96 A46 46 0 0 1 4 50 Z" fill={COLOR_HEX.green} />
                <path d="M50 50 L4 50 A46 46 0 0 1 50 4 Z" fill={COLOR_HEX.blue} />
              </svg>
              {card.kind === 'wild4' ? (
                <span
                  className="font-display absolute"
                  style={{ fontSize: px(0.19), lineHeight: 1, color: INK, textShadow: `0 0 3px ${CREAM}, 0 0 6px ${CREAM}` }}
                >
                  +4
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <CornerGlyph card={card} size={px(0.17)} style={{ top: px(0.06), left: px(0.07) }} />
      <CornerGlyph card={card} size={px(0.17)} style={{ bottom: px(0.06), right: px(0.07), transform: 'rotate(180deg)' }} />
      {card.color ? <ColorMarker color={card.color} size={px(0.13)} /> : null}
    </div>
  );
}

function CornerGlyph({ card, size, style }: { card: Card; size: string; style: CSSProperties }) {
  return (
    <div className="absolute flex flex-col items-center" style={style}>
      <span className="font-display" style={{ fontSize: `calc(${size} * 0.7)`, lineHeight: 1, color: CREAM }}>
        {card.kind === 'number' ? card.value ?? 0 : cardLabel(card).slice(0, 1)}
      </span>
    </div>
  );
}

function ColorMarker({ color, size }: { color: CardColor; size: string }) {
  const style: CSSProperties = {
    position: 'absolute',
    right: '5%',
    bottom: '3%',
    width: size,
    height: size,
  };
  const fill = COLOR_HEX[color];
  if (color === 'red') {
    return (
      <svg viewBox="0 0 100 100" style={style} aria-hidden="true">
        <path d="M50 12 L88 84 H12 Z" fill={CREAM} stroke={INK} strokeWidth={8} />
        <path d="M50 32 L71 72 H29 Z" fill={fill} />
      </svg>
    );
  }
  if (color === 'green') {
    return (
      <svg viewBox="0 0 100 100" style={style} aria-hidden="true">
        <rect x={12} y={12} width={76} height={76} fill={CREAM} stroke={INK} strokeWidth={8} />
        <path d="M50 27 L73 50 L50 73 L27 50 Z" fill={fill} />
      </svg>
    );
  }
  if (color === 'blue') {
    return (
      <svg viewBox="0 0 100 100" style={style} aria-hidden="true">
        <rect x={14} y={14} width={72} height={72} fill={CREAM} stroke={INK} strokeWidth={8} />
        <rect x={30} y={30} width={40} height={40} fill={fill} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" style={style} aria-hidden="true">
      <circle cx={50} cy={50} r={42} fill={CREAM} stroke={INK} strokeWidth={8} />
      <circle cx={50} cy={50} r={26} fill={fill} />
    </svg>
  );
}

export interface CardBackProps {
  width: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Face-down card: --bg-2 with a sun-yellow tilted oval and the "CC" initials. */
export function CardBack({ width, className = '', style = {} }: CardBackProps) {
  const px = scaler(width);
  return (
    <div
      className={`flex items-center justify-center ${className}`.trim()}
      style={{
        width,
        aspectRatio: `${RATIO}`,
        background: 'var(--bg-2)',
        borderRadius: px(0.13),
        border: BORDER,
        boxShadow: SHADOW,
        ...style,
      }}
      aria-hidden="true"
    >
      <div
        className="font-display flex items-center justify-center"
        style={{
          width: px(0.6),
          height: px(0.4),
          borderRadius: '50%',
          background: 'var(--sun)',
          transform: 'rotate(-18deg)',
          color: INK,
          fontSize: px(0.2),
          lineHeight: 1,
        }}
      >
        <span style={{ transform: 'rotate(18deg)' }}>CC</span>
      </div>
    </div>
  );
}

function CardViewImpl({ card, width, className = '', dim = false }: CardViewProps) {
  return (
    <div className={className} style={{ opacity: dim ? 0.4 : 1, transition: 'opacity 160ms ease', lineHeight: 0 }}>
      <Face card={card} width={width} />
    </div>
  );
}

/** One Wild Cards card, drawn entirely with CSS and inline SVG. */
const CardView = memo(CardViewImpl);
export default CardView;
