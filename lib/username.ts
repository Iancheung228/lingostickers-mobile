// What a username may be: the one rule sign-up enforces and profile editing
// can reuse. Friend search matches on this alphabet, so anything else is a
// name nobody could ever find.
export const USERNAME_RULE = 'Use 3–20 letters, numbers, _ or .';

const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function normalizeUsername(raw: string): string {
  return raw.toLowerCase();
}
