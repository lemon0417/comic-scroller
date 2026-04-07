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

module.exports = {
  decodePrivateKeyBase64,
  getCrxArtifactName,
};
