// Prints a new Ed25519 key pair for signing licences.
// Keep LICENCE_PRIVATE_KEY secret (apps/control only); ship LICENCE_PUBLIC_KEY with every install.
import { generateLicenceKeyPair } from '../src/licence';

const { privateKeyPem, publicKeyPem } = generateLicenceKeyPair();
const b64 = (s: string) => Buffer.from(s).toString('base64');
console.log('# apps/control .env (secret)');
console.log(`LICENCE_PRIVATE_KEY=${b64(privateKeyPem)}`);
console.log('\n# every install (public)');
console.log(`LICENCE_PUBLIC_KEY=${b64(publicKeyPem)}`);
