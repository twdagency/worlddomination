import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cred = JSON.parse(fs.readFileSync(path.join(projectDir, 'credentials.json'), 'utf8'))
  .android.keystore;
const destJks = path.join(projectDir, 'android', 'app', 'release.jks');
fs.copyFileSync(path.join(projectDir, cred.keystorePath), destJks);
fs.writeFileSync(
  path.join(projectDir, 'android', 'keystore.properties'),
  [
    'storeFile=release.jks',
    `storePassword=${cred.keystorePassword}`,
    `keyAlias=${cred.keyAlias}`,
    `keyPassword=${cred.keyPassword}`,
    '',
  ].join('\n'),
);
console.log('Wrote android/keystore.properties and android/app/release.jks');
