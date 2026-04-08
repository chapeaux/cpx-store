// web-test-runner.config.mjs
import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: 'test/**/*.spec.ts',
  nodeResolve: true,
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
    playwrightLauncher({ product: 'firefox' }),
  ],
  plugins: [
    // Transpile TypeScript files
    esbuildPlugin({ ts: true }),
  ],
};