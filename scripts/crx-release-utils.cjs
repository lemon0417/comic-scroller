const { createPublicKey } = require('crypto');

const BASE64_PATTERN = /^[A-Za-z0-9+/=\s]+$/;

function getCrxArtifactName(version) {
  const normalizedVersion = String(version || '').trim();

  if (!normalizedVersion) {
    throw new Error('crx-release: missing version in package.json');
  }

  return `comic-scroller-${normalizedVersion}.crx`;
}

function decodePrivateKeyBase64(raw) {
  const normalized = String(raw || '').trim();

  if (!normalized) {
    throw new Error(
      'crx-release: missing CHROME_EXTENSION_PRIVATE_KEY_B64. Export a base64-encoded PEM private key before running `yarn crx`.',
    );
  }

  if (!BASE64_PATTERN.test(normalized)) {
    throw new Error(
      'crx-release: CHROME_EXTENSION_PRIVATE_KEY_B64 is not valid base64 text.',
    );
  }

  const pem = Buffer.from(normalized, 'base64').toString('utf8').trim();
  if (
    !pem.includes('-----BEGIN') ||
    !pem.includes('PRIVATE KEY-----') ||
    !pem.includes('-----END')
  ) {
    throw new Error(
      'crx-release: decoded CHROME_EXTENSION_PRIVATE_KEY_B64 is not a PEM private key.',
    );
  }

  return `${pem}\n`;
}

function normalizeManifestPublicKey(publicKeyPem) {
  return String(publicKeyPem || '')
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function deriveManifestKeyFromPrivateKeyBase64(raw) {
  const privateKeyPem = decodePrivateKeyBase64(raw);
  const publicKeyPem = createPublicKey(privateKeyPem).export({
    type: 'spki',
    format: 'pem',
  });

  const manifestKey = normalizeManifestPublicKey(publicKeyPem);
  if (!manifestKey) {
    throw new Error(
      'crx-release: failed to derive a manifest public key from CHROME_EXTENSION_PRIVATE_KEY_B64.',
    );
  }

  return manifestKey;
}

function resolveManifestKeyFromEnv(env = process.env) {
  const explicitPublicKey = normalizeManifestPublicKey(
    env.CHROME_EXTENSION_PUBLIC_KEY,
  );
  if (explicitPublicKey) {
    return explicitPublicKey;
  }

  if (env.CHROME_EXTENSION_PRIVATE_KEY_B64) {
    return deriveManifestKeyFromPrivateKeyBase64(
      env.CHROME_EXTENSION_PRIVATE_KEY_B64,
    );
  }

  return '';
}

module.exports = {
  decodePrivateKeyBase64,
  deriveManifestKeyFromPrivateKeyBase64,
  getCrxArtifactName,
  normalizeManifestPublicKey,
  resolveManifestKeyFromEnv,
};
