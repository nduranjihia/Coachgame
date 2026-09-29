import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The join bug, pinned.
 *
 * `JoinFlow.adopt()` used to call the `setHouseholdId` helper from
 * `@/lib/device`, which writes localStorage only. `useHousehold.bootstrap()`
 * then read `householdId` back out of the zustand store, found `null`, and gave
 * up - so creating a player bounced the phone straight back to the code entry
 * screen, and re-entering the same code failed the same way.
 *
 * The store reads localStorage at module load, so it has to be stubbed before
 * `session.ts` is imported.
 */
function stubLocalStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  const fake = {
    getItem: (key: string) => (entries.has(key) ? (entries.get(key) as string) : null),
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  return entries;
}

const storage = stubLocalStorage();
const { useSession } = await import('./session');

const HH = '4da043a7-33cb-4cc8-ab59-6a935b1bcfec';
const PID = '13b4fe14-4175-4ed0-be89-ed21e606b586';

describe('session identity storage', () => {
  beforeEach(() => {
    storage.clear();
    useSession.setState({ householdId: null, myPlayerId: null, household: null, players: [] });
  });

  it('setHouseholdId writes localStorage and the store together', () => {
    useSession.getState().setHouseholdId(HH);

    // The half that was missing: `bootstrap()` reads this one back.
    expect(useSession.getState().householdId).toBe(HH);
    expect(storage.get('cc.householdId')).toBe(HH);
  });

  it('setMyPlayerId writes localStorage and the store together', () => {
    useSession.getState().setMyPlayerId(PID);

    expect(useSession.getState().myPlayerId).toBe(PID);
    expect(storage.get('cc.playerId')).toBe(PID);
  });

  it('a joined device survives a bootstrap that reads the store back', () => {
    // The exact sequence `JoinFlow.adopt` + `finishJoin` -> `bootstrap` performs.
    useSession.getState().setHouseholdId(HH);
    useSession.getState().setMyPlayerId(PID);

    const seenByBootstrap = useSession.getState().householdId;
    expect(seenByBootstrap).toBe(HH);
  });

  it('setHousehold points the store at the loaded household', () => {
    const household = {
      id: HH,
      join_code: '264B8Q',
      settings: { lastCardPenalty: true, sound: true, moveHints: true },
      created_at: '2026-01-01T00:00:00.000Z',
    };
    useSession.getState().setHousehold(household);

    expect(useSession.getState().householdId).toBe(HH);
    expect(useSession.getState().household).toBe(household);
  });

  it('resetIdentity clears both halves', () => {
    useSession.getState().setHouseholdId(HH);
    useSession.getState().setMyPlayerId(PID);

    useSession.getState().resetIdentity();

    expect(useSession.getState().householdId).toBeNull();
    expect(useSession.getState().myPlayerId).toBeNull();
    expect(storage.get('cc.householdId')).toBeUndefined();
    expect(storage.get('cc.playerId')).toBeUndefined();
  });
});
