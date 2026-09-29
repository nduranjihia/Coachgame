import Sheet from '@/components/Sheet';
import { COLOR_HEX, COLOR_NAME } from './deck';
import type { CardColor } from '@/types/games';

export interface ColorSheetProps {
  open: boolean;
  title?: string;
  onPick: (color: CardColor) => void;
  onCancel: () => void;
}

/** Four huge colour buttons for wild cards, plus the current colour chip. */
export default function ColorSheet({ open, title = 'Pick a colour', onPick, onCancel }: ColorSheetProps) {
  const colors: CardColor[] = ['red', 'yellow', 'green', 'blue'];
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="grid grid-cols-2 gap-3">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className="flex min-h-[84px] items-center justify-center gap-3 rounded-3xl"
            style={{
              background: COLOR_HEX[c],
              border: '3px solid rgba(0,0,0,.4)',
              boxShadow: 'var(--shadow-hard)',
            }}
          >
            <span
              className="font-display"
              style={{ fontSize: 24, color: '#14101F', textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              {COLOR_NAME[c]}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="font-body mt-4 w-full text-center"
        style={{ fontSize: 15, color: 'var(--ink-dim)', minHeight: 44 }}
      >
        Cancel
      </button>
    </Sheet>
  );
}
