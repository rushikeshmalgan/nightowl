/** Room codes and links. Pure, so they test in plain Node. */

/** 31 characters: no 0, O, 1, I or L, which are easy to misread aloud or on a phone. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

/** A uniformly random integer in [0, max), from the browser's secure random source. */
export function cryptoRandomInt(max: number): number {
  const range = 0x1_0000_0000;
  const limit = range - (range % max);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

/** A new unguessable code: 31^6, about 887 million, possibilities. */
export function generateRoomCode(randomInt: (max: number) => number = cryptoRandomInt): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

/** How a code is shown to people. */
export function formatRoomCode(code: string): string {
  return `OWL-${code}`;
}

/** The code behind whatever was typed or pasted, or null when it is not a valid code. */
export function parseRoomCode(input: string): string | null {
  let code = input.trim().toUpperCase().replace(/[\s-]/g, '');
  // A real code never starts with OWL (O and L are not in the alphabet), so this prefix is safe to drop.
  if (code.startsWith('OWL')) code = code.slice(3);
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const character of code) if (!ROOM_CODE_ALPHABET.includes(character)) return null;
  return code;
}

/** The code in a `#room=CODE` link hash, or null. */
export function roomCodeFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('room');
  return value ? parseRoomCode(value) : null;
}

/** A link that opens the app and offers to join the room. The code stays in the hash, which no server receives. */
export function roomLink(code: string, base: string): string {
  return `${base.split('#')[0]}#room=${code}`;
}

export function roomChannelName(code: string): string {
  return `nightowl-room:${code}`;
}
