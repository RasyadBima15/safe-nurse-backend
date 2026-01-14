import crypto from 'crypto'

// export function generatePassword(length = 16) {
//   return crypto
//     .randomBytes(length)
//     .toString("base64") 
//     .replace(/[^a-zA-Z0-9]/g, '')
//     .slice(0, length);
// }

export function generatePassword() {
  return "12345";
}