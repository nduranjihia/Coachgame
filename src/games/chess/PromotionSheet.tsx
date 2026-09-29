import Button from '@/components/Button';
import Sheet from '@/components/Sheet';

export interface PromotionSheetProps {
  open: boolean;
  onPick: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
  /** Colour of the pawn being promoted, used for the piece tile. */
  colour: 'w' | 'b';
}

const OPTIONS: { key: 'q' | 'r' | 'b' | 'n'; letter: string; name: string }[] = [
  { key: 'q', letter: 'Q', name: 'Queen' },
  { key: 'r', letter: 'R', name: 'Rook' },
  { key: 'b', letter: 'B', name: 'Bishop' },
  { key: 'n', letter: 'N', name: 'Knight' },
];

/** Section 11.4: four big labelled buttons for the promotion piece. */
export default function PromotionSheet({ open, onPick, onCancel, colour }: PromotionSheetProps) {
  return (
    <Sheet open={open} onClose={onCancel} title="Promote to…">
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onPick(o.key)}
            className="flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-3xl"
            style={{
              background: colour === 'w' ? '#F4E3C3' : '#B9855E',
              border: '3px solid rgba(0,0,0,.4)',
              boxShadow: 'var(--shadow-hard)',
            }}
          >
            <span
              className="font-display"
              style={{ fontSize: 34, lineHeight: 1, color: colour === 'w' ? '#14101F' : '#FFF6E9' }}
            >
              {o.letter}
            </span>
            <span
              className="font-body"
              style={{ fontSize: 15, fontWeight: 600, color: colour === 'w' ? '#14101F' : '#FFF6E9' }}
            >
              {o.name}
            </span>
          </button>
        ))}
      </div>
      <Button full variant="ghost" className="mt-4" onClick={onCancel}>
        Cancel
      </Button>
    </Sheet>
  );
}
