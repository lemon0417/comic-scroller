const { generateKeyPairSync } = require('crypto');

const {
  decodePrivateKeyBase64,
  deriveManifestKeyFromPrivateKeyBase64,
  getCrxArtifactName,
  normalizeManifestPublicKey,
  resolveManifestKeyFromEnv,
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

  it('normalizes a PEM public key into a manifest key string', () => {
    const pem = [
      '-----BEGIN PUBLIC KEY-----',
      'ABC123',
      'XYZ987',
      '-----END PUBLIC KEY-----',
    ].join('\n');

    expect(normalizeManifestPublicKey(pem)).toBe('ABC123XYZ987');
  });

  it('derives a manifest key from the private key secret', () => {
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

    expect(deriveManifestKeyFromPrivateKeyBase64(encoded)).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('prefers an explicit public key from the environment', () => {
    expect(
      resolveManifestKeyFromEnv({
        CHROME_EXTENSION_PUBLIC_KEY:
          '-----BEGIN PUBLIC KEY-----\nABC123\n-----END PUBLIC KEY-----',
        CHROME_EXTENSION_PRIVATE_KEY_B64: 'ignored',
      }),
    ).toBe('ABC123');
  });
});
