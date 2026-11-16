import { randomNickname, rerollNickname, sessionNickname } from './nickname';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe('randomNickname', () => {
  it('is two capitalised words, an adjective and a bird', () => {
    expect(randomNickname(() => 0)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it('varies with the random source', () => {
    expect(randomNickname(() => 0)).not.toBe(randomNickname((max) => max - 1));
  });
});

describe('sessionNickname', () => {
  it('keeps the same nickname for the whole session', () => {
    const storage = memoryStorage();
    expect(sessionNickname(storage)).toBe(sessionNickname(storage));
  });

  it('reuses a stored nickname', () => {
    expect(sessionNickname(memoryStorage({ 'nightowl-nickname': 'Calm Heron' }))).toBe('Calm Heron');
  });

  it('rerolls to a new stored nickname', () => {
    const storage = memoryStorage({ 'nightowl-nickname': 'Calm Heron' });
    const next = rerollNickname(storage, () => 0);
    expect(next).toBe(randomNickname(() => 0));
    expect(sessionNickname(storage)).toBe(next);
  });

  it('still gives a nickname when storage throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(sessionNickname(broken)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(rerollNickname(broken)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });
});
