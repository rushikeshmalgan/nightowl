import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  formatRoomCode,
  generateRoomCode,
  parseRoomCode,
  roomChannelName,
  roomCodeFromHash,
  roomLink,
} from './roomCode';

describe('generateRoomCode', () => {
  it('makes 6 characters from the 31-character alphabet, never a look-alike', () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('draws each character from the injected source', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAAA');
    expect(generateRoomCode((max) => max - 1)).toBe('999999');
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
    expect(codes.size).toBe(50);
  });
});

describe('parseRoomCode', () => {
  it('accepts a code however it was typed', () => {
    expect(parseRoomCode('owl-4f2k9x')).toBe('4F2K9X');
    expect(parseRoomCode(' 4F2 K9X ')).toBe('4F2K9X');
    expect(parseRoomCode('4F2K9X')).toBe('4F2K9X');
    expect(parseRoomCode('OWL 4F2-K9X')).toBe('4F2K9X');
  });

  it('refuses anything that is not a valid code', () => {
    expect(parseRoomCode('4F2K9')).toBeNull();
    expect(parseRoomCode('4F2K9XX')).toBeNull();
    expect(parseRoomCode('4F2K9O')).toBeNull();
    expect(parseRoomCode('4F2K91')).toBeNull();
    expect(parseRoomCode('')).toBeNull();
    expect(parseRoomCode('<b>hi</b>')).toBeNull();
  });
});

describe('formatting and links', () => {
  it('shows a code with the OWL- prefix', () => {
    expect(formatRoomCode('4F2K9X')).toBe('OWL-4F2K9X');
  });

  it('names the channel after the code', () => {
    expect(roomChannelName('4F2K9X')).toBe('nightowl-room:4F2K9X');
  });

  it('reads a code from a link hash', () => {
    expect(roomCodeFromHash('#room=4f2k9x')).toBe('4F2K9X');
    expect(roomCodeFromHash('#room=nope')).toBeNull();
    expect(roomCodeFromHash('#other')).toBeNull();
    expect(roomCodeFromHash('')).toBeNull();
  });

  it('builds a link that replaces any existing hash', () => {
    expect(roomLink('4F2K9X', 'https://x.app/read#old')).toBe('https://x.app/read#room=4F2K9X');
    expect(roomLink('4F2K9X', 'https://x.app/')).toBe('https://x.app/#room=4F2K9X');
  });
});
