import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');

rmSync('dist', { recursive: true, force: true });
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json', '--emitDeclarationOnly'], { stdio: 'inherit' });
execFileSync(process.execPath, [
	tsc, '-p', 'tsconfig.build.json', '--module', 'CommonJS', '--moduleResolution', 'node10',
	'--ignoreDeprecations', '6.0', '--outDir', 'dist/cjs',
], { stdio: 'inherit' });
writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');

// Both entry points use the same runtime instance, including prepared sources and caches.
writeFileSync('dist/index.js', [
	"export * from './cjs/index.js';",
	"import implementation from './cjs/index.js';",
	'export default implementation.default;',
	'',
].join('\n'));
