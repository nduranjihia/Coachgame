import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { householdChildScope, householdRowScope } from './realtimeScope';

/**
 * The bug this pins: the household channel filtered `households` by
 * `household_id`, a column that table does not have. Realtime accepted the
 * subscription and reported SUBSCRIBED, then dropped every `postgres_changes`
 * event for the channel - so the phone never saw a move until it was reloaded.
 *
 * The filter strings are checked against the actual migrations so renaming a
 * column breaks this test instead of silently deafening the realtime feed.
 */
function schemaColumns(): Map<string, Set<string>> {
  const sql = readFileSync(fileURLToPath(new URL('../../supabase/migrations/001_init.sql', import.meta.url)), 'utf8');
  const tables = new Map<string, Set<string>>();

  for (const match of sql.matchAll(/create table (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const [, name, body] = match;
    const columns = new Set<string>();
    for (const line of body.split('\n')) {
      const column = /^\s{2}(\w+)\s/.exec(line);
      if (column) columns.add(column[1]);
    }
    tables.set(name, columns);
  }
  return tables;
}

const columnOf = (filter: string): string => filter.slice(0, filter.indexOf('='));
const TABLES = schemaColumns();

describe('realtime filter scopes match the schema', () => {
  it('parses the migration so the assertions below are meaningful', () => {
    expect(TABLES.has('households')).toBe(true);
    expect(TABLES.has('matches')).toBe(true);
  });

  it('filters households by a column households actually has', () => {
    const columns = TABLES.get('households')!;
    expect(columns.has(columnOf(householdRowScope('abc')))).toBe(true);
  });

  it('filters every child table by a column it actually has', () => {
    for (const table of ['devices', 'players', 'matches', 'hands', 'match_secrets', 'commands']) {
      const columns = TABLES.get(table);
      expect(columns, `${table} should exist in the schema`).toBeDefined();
      expect(columns!.has(columnOf(householdChildScope('abc'))), `${table}.household_id should exist`).toBe(true);
    }
  });

  it('keeps the two scopes distinct - this is the regression', () => {
    // If these ever collapse to the same string, the household row is being
    // filtered by a column it does not have and the whole channel goes quiet.
    expect(columnOf(householdRowScope('abc'))).not.toBe(columnOf(householdChildScope('abc')));
  });
});
