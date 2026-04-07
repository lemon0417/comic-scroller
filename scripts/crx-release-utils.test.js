const { generateKeyPairSync } = require('crypto');

const {
  decodePrivateKeyBase64,
  getCrxArtifactName,
} = require('./crx-release-utils.cjs');

describe('crx release utils', () => {
  it('builds the CRX artifact name from the release version', () => {
    expect(getCrxArtifactName('4.0.52')).toBe('comic-scroller-4.0.52.crx');
  });

  it('fails when the base64 private key secret is missing', () => {
    expect(() => decodePrivateKeyBase64('')).toThrow(
      'crx-release: missing CHROME_EXTENSION_PRIVATE_KEY_B64.',
    );
  });

  it('fails when the decoded key is not a PEM private key', () => {
    const encoded = Buffer.from('not-a-pem').toString('base64');

    expect(() => decodePrivateKeyBase64(encoded)).toThrow(
      'crx-release: decoded CHROME_EXTENSION_PRIVATE_KEY_B64 is not a PEM private key.',
    );
  });

  it('decodes a valid PEM private key from the base64 secret', () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
    });
    const encoded = Buffer.from(privateKey, 'utf8').toString('base64');

    expect(decodePrivateKeyBase64(encoded)).toContain(
      '-----BEGIN PRIVATE KEY-----',
    );
  });
});
