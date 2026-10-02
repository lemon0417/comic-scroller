const { verifyBuildFeatures } = require('./verify-build-features.cjs');

function bundle(modules = {}, code = '') {
  return { 'manage.js': { type: 'chunk', fileName: 'manage.js', modules, code } };
}

describe('build feature guard', () => {
  it('accepts a release without developer modules', () => {
    expect(() => verifyBuildFeatures(bundle({ '/src/ui/containers/ManageApp/index.tsx': { renderedLength: 123 } }), false)).not.toThrow();
  });
  it('rejects a release with a rendered developer panel or logger', () => {
    for (const id of ['/src/ui/containers/ManageApp/ManageDeveloperPanel.tsx', '/project/node_modules/redux-logger/dist/index.js']) {
      expect(() => verifyBuildFeatures(bundle({ [id]: { renderedLength: 1 } }), false)).toThrow('contains developer tools');
    }
  });
  it('allows modules eliminated by tree shaking and production stubs', () => {
    expect(() => verifyBuildFeatures(bundle({ '/src/domain/reducers/developerTools.ts': { renderedLength: 0 }, '/src/utils/devLog.production.ts': { renderedLength: 12 } }), false)).not.toThrow();
  });
  it('rejects a leftover developer entry from an unrecognized module', () => {
    expect(() => verifyBuildFeatures(bundle({}, 'CS_DEBUG'), false)).toThrow('entry points');
  });
  it('rejects a development build with missing tools', () => {
    expect(() => verifyBuildFeatures(bundle(), true)).toThrow('missing developer tools');
  });
});
