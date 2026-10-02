const developerModules = [
  '/ui/containers/ManageApp/ManageDeveloperPanel.tsx',
  '/domain/reducers/developerTools.ts',
  '/epics/popup/developerToolsEpic.ts',
  '/infra/services/developerTools.ts',
  '/utils/devLog.ts',
  '/domain/store/debugLogger.ts',
  '/node_modules/redux-logger/',
];

function verifyBuildFeatures(bundle, development) {
  const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
  const renderedModules = chunks.flatMap(chunk => Object.entries(chunk.modules)
    .filter(([, info]) => info.renderedLength > 0)
    .map(([id]) => id.replaceAll('\\', '/')));
  const found = developerModules.filter(fragment => renderedModules.some(id => id.includes(fragment)));
  if (development) {
    const missing = developerModules.filter(fragment => !found.includes(fragment));
    if (missing.length) throw new Error(`Development build is missing developer tools: ${missing.join(', ')}`);
  } else {
    if (found.length) throw new Error(`Release build contains developer tools: ${found.join(', ')}`);
    for (const chunk of chunks) {
      if (['CS_DEBUG', 'PING_BACKGROUND', '執行背景檢查', 'manage-debug-log-toggle'].some(token => chunk.code.includes(token))) {
        throw new Error(`Release build contains developer entry points in ${chunk.fileName}`);
      }
    }
  }
}

module.exports = { verifyBuildFeatures };
