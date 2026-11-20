import { randomInt } from 'node:crypto';
import { validatePasswordStrength } from '../../utils/validators.js';

// Omit visually ambiguous characters to make emailed credentials easier to type.
const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghjkmnpqrstuvwxyz', '23456789', '!@#$'];
const pick = alphabet => alphabet[randomInt(alphabet.length)];

export function generateInvitationCredentials() {
  const characters = groups.map(pick);
  const alphabet = groups.join('');
  while (characters.length < 8) characters.push(pick(alphabet));
  for (let index = characters.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [characters[index], characters[other]] = [characters[other], characters[index]];
  }
  const password = characters.join('');
  // Use the same character-class rules as signup and owner password changes.
  if (!validatePasswordStrength(password).isValid) throw new Error('Invalid generated invitation password');
  return { password, credential: String(randomInt(100000, 1000000)) };
}
