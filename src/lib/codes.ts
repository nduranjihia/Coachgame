import { CODE_ALPHABET, CODE_LENGTH } from './constants';

/** Uppercase, strip anything outside the alphabet, and cap the length. */
export function normaliseCode(raw: string): string {
  return (raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .split('')
    .filter((ch) => CODE_ALPHABET.includes(ch))
    .slice(0, CODE_LENGTH)
    .join('');
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && code.split('').every((ch) => CODE_ALPHABET.includes(ch));
}

/** The six single-character boxes rendered by the "Enter code" screen. */
export function codeSlots(code: string): string[] {
  const out = new Array<string>(CODE_LENGTH).fill('');
  for (let i = 0; i < Math.min(CODE_LENGTH, code.length); i++) out[i] = code[i];
  return out;
}
