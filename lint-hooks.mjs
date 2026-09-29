// Temporary lint: find hooks called after an early `return` at the top level of
// a component function, which React reports as a hooks-order error.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('./src/', import.meta.url).pathname.replace(/^\//, '');
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(entry)) files.push(p);
  }
})(ROOT);

const HOOK = /(^|[^.\w])use[A-Z][A-Za-z0-9]*\s*\(/;
let problems = 0;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const decl = /^\s*(?:export\s+)?(?:default\s+)?function\s+([A-Z][\w]*)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(decl);
    if (!m) continue;
    const startLine = i;
    let depth = 0;
    let started = false;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
      }
      if (started && depth === 0) { end = j; break; }
    }
    // guard lines: any line between the opening brace and the end that returns
    const guard = [];
    for (let j = startLine + 1; j < end; j++) {
      const line = lines[j];
      if (/^\s{2}(?:return\b|if \(.*\)\s*(?:return|\{?\s*return))/.test(line)) guard.push(j);
      // also `if (...) { return x; }` spanning lines
      if (/^\s{2}if \(/.test(line)) {
        // look ahead a few lines for a return before the matching close
        for (let k = j + 1; k < Math.min(j + 6, end); k++) {
          if (/^\s{4}return\b/.test(lines[k])) { guard.push(j); break; }
          if (/^\s{2}\}/.test(lines[k])) break;
        }
      }
    }
    if (!guard.length) continue;
    const first = Math.min(...guard);
    for (let j = first + 1; j <= end; j++) {
      const line = lines[j];
      if (!HOOK.test(line)) continue;
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
      problems++;
      console.log(`${file}:${j + 1}  hook "${line.trim()}" in ${m[1]} after early return at line ${first + 1}`);
    }
  }
}
console.log(problems ? `${problems} problem(s)` : 'no hook-after-return problems', '- scanned', files.length, 'files');
