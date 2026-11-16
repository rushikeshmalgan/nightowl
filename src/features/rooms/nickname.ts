import { cryptoRandomInt } from './roomCode';

const ADJECTIVES = ['Quiet', 'Sleepy', 'Calm', 'Gentle', 'Silent', 'Amber', 'Moonlit', 'Cozy', 'Patient', 'Steady', 'Wandering', 'Dreamy', 'Brave', 'Curious'];
const BIRDS = ['Owl', 'Heron', 'Nightjar', 'Swift', 'Finch', 'Wren', 'Crane', 'Lark', 'Sparrow', 'Kestrel', 'Plover', 'Robin', 'Egret'];

const KEY = 'nightowl-nickname';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** A generated name such as "Quiet Owl". Nobody types a nickname, so there is nothing to moderate. */
export function randomNickname(randomInt: (max: number) => number = cryptoRandomInt): string {
  return `${ADJECTIVES[randomInt(ADJECTIVES.length)]} ${BIRDS[randomInt(BIRDS.length)]}`;
}

function defaultStore(): Store | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

/** This browser session's nickname, kept so a reload does not change who you are in a room. */
export function sessionNickname(storage: Store | undefined = defaultStore()): string {
  try {
    const stored = storage?.getItem(KEY);
    if (stored) return stored;
  } catch {
    // Storage can be blocked; a fresh nickname is fine.
  }
  const nickname = randomNickname();
  try {
    storage?.setItem(KEY, nickname);
  } catch {
    // Not remembering it is harmless.
  }
  return nickname;
}

/** Picks a new nickname and keeps it for the session. */
export function rerollNickname(storage: Store | undefined = defaultStore(), randomInt: (max: number) => number = cryptoRandomInt): string {
  const nickname = randomNickname(randomInt);
  try {
    storage?.setItem(KEY, nickname);
  } catch {
    // Not remembering it is harmless.
  }
  return nickname;
}
