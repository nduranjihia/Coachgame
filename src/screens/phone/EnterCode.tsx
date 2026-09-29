import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/Button';
import StatusBar from '@/components/StatusBar';
import { CODE_LENGTH } from '@/lib/constants';
import { codeSlots, isValidCode, normaliseCode } from '@/lib/codes';
import { useMyPlayer, useSession } from '@/store/session';

/** Section 6.4: six big single-character boxes, then the join flow. */
export default function EnterCode({ onSubmit }: { onSubmit: (code: string) => void }) {
  const me = useMyPlayer();
  const tvOnline = useSession((s) => s.tvOnline);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const submit = (value: string): void => {
    const clean = normaliseCode(value);
    if (!isValidCode(clean) || busy) return;
    setBusy(true);
    onSubmit(clean);
  };

  const setChar = (index: number, raw: string): void => {
    const chars = codeSlots(code);
    const ch = normaliseCode(raw);
    if (ch) chars[index] = ch;
    const next = normaliseCode(chars.join(''));
    setCode(next);
    if (ch && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
    if (normaliseCode(chars.join('')).length === CODE_LENGTH) submit(chars.join(''));
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Backspace') return;
    if ((event.target as HTMLInputElement).value) return;
    if (index === 0) return;
    event.preventDefault();
    const chars = codeSlots(code);
    chars[index - 1] = '';
    setCode(normaliseCode(chars.join('')));
    boxes.current[index - 1]?.focus();
  };

  const onPaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text');
    if (!text) return;
    event.preventDefault();
    const chars = codeSlots(code);
    normaliseCode(text)
      .split('')
      .forEach((ch, i) => {
        if (index + i < CODE_LENGTH) chars[index + i] = ch;
      });
    const next = normaliseCode(chars.join(''));
    setCode(next);
    if (next.length === CODE_LENGTH) submit(next);
  };

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />
      <div className="cc-scroll-y flex flex-1 flex-col justify-center gap-6 px-6 py-8">
        <div>
          <h1 className="font-display" style={{ fontSize: 32, color: 'var(--ink)' }}>
            Enter the TV code
          </h1>
          <p className="font-body mt-2 text-[16px]" style={{ color: 'var(--ink-dim)' }}>
            Six letters and numbers, up top of the TV.
          </p>
        </div>

        <div className="grid w-full grid-cols-6 gap-2">
          {codeSlots(code).map((ch, i) => (
            <motion.input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={ch}
              onChange={(e) => setChar(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => onPaste(i, e)}
              autoFocus={i === 0}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              maxLength={1}
              aria-label={`Code character ${i + 1}`}
              className="font-display text-center"
              style={{
                width: '100%',
                minWidth: 0,
                height: 'clamp(52px, 17vw, 68px)',
                fontSize: 'clamp(20px, 8vw, 32px)',
                color: 'var(--ink)',
                background: 'var(--bg-2)',
                border: `2px solid ${ch ? 'var(--sun)' : 'var(--line)'}`,
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-hard)',
                outline: 'none',
              }}
            />
          ))}
        </div>

        <Button full disabled={!isValidCode(code) || busy} onClick={() => submit(code)}>
          Join this home
        </Button>

        <p className="font-body text-center text-[15px]" style={{ color: 'var(--ink-dim)' }}>
          Or point your camera at the QR code on the TV
        </p>
      </div>
    </div>
  );
}
