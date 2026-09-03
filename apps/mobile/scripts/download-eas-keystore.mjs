import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(projectDir, 'credentials');
const statePath = path.join(os.homedir(), '.expo', 'state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const sessionSecret = state?.auth?.sessionSecret;
if (!sessionSecret) {
  throw new Error('No Expo session found. Run eas login first.');
}

const query = `
  query DownloadAndroidKeystore(
    $projectFullName: String!
    $applicationIdentifier: String
  ) {
    app {
      byFullName(fullName: $projectFullName) {
        androidAppCredentials(
          filter: { applicationIdentifier: $applicationIdentifier }
        ) {
          androidAppBuildCredentialsList {
            name
            isDefault
            androidKeystore {
              keystore
              keystorePassword
              keyAlias
              keyPassword
            }
          }
        }
      }
    }
  }
`;

const response = await fetch('https://api.expo.dev/graphql', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'expo-session': sessionSecret,
  },
  body: JSON.stringify({
    query,
    variables: {
      projectFullName: '@twda/world-domination',
      applicationIdentifier: 'com.twdagency.worlddomination',
    },
  }),
});

const payload = await response.json();
if (payload.errors) {
  throw new Error(`Expo GraphQL errors: ${payload.errors.map((e) => e.message).join('; ')}`);
}

const list =
  payload?.data?.app?.byFullName?.androidAppCredentials?.[0]?.androidAppBuildCredentialsList ?? [];
const creds = list.find((item) => item.isDefault) ?? list[0];
const keystore = creds?.androidKeystore;
if (!keystore?.keystore) {
  throw new Error('No Android keystore found on EAS for this app.');
}

fs.mkdirSync(outDir, { recursive: true });
const keystorePath = path.join(outDir, 'release.jks');
fs.writeFileSync(keystorePath, Buffer.from(keystore.keystore, 'base64'));

const credentialsJson = {
  android: {
    keystore: {
      keystorePath: 'credentials/release.jks',
      keystorePassword: keystore.keystorePassword,
      keyAlias: keystore.keyAlias,
      keyPassword: keystore.keyPassword,
    },
  },
};
fs.writeFileSync(path.join(projectDir, 'credentials.json'), `${JSON.stringify(credentialsJson, null, 2)}\n`);
fs.writeFileSync(
  path.join(outDir, 'keystore.properties'),
  [
    `storeFile=${keystorePath.replaceAll('\\', '/')}`,
    `storePassword=${keystore.keystorePassword}`,
    `keyAlias=${keystore.keyAlias}`,
    `keyPassword=${keystore.keyPassword}`,
    '',
  ].join('\n'),
);

console.log(`Wrote keystore to ${keystorePath}`);
console.log(`Wrote credentials.json and credentials/keystore.properties (gitignored)`);
console.log(`Key alias: ${keystore.keyAlias}`);
