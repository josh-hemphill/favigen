import ts from '@wessberg/rollup-plugin-ts';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json',{encoding:'utf-8'}));

import { terser } from 'rollup-plugin-terser';
import { ModuleFormat, OutputOptions, RollupOptions } from 'rollup';
const dist = './dist/';
const input = 'src/lib/index.ts';
const out = (format: ModuleFormat): OutputOptions => ({
	format,
	exports: 'auto',
	sourcemap: true,
});

export default <RollupOptions[]>[
	{
		input,
		plugins:[
			ts({
				transpiler: 'babel',
				include: ['src/**/*.[tj]s'],
				transpileOnly:true,
				browserslist: false,
				tsconfig: 'tsconfig.json',
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				//@ts-ignore
				tsconfigOverride: {
					'exclude': [
						'**/*.test.*',
					],
					compilerOptions: {
						rootDir: './src/lib',
					},
					declarationDir: './dist',
				},
			}),
		],
		output: [
			{
				plugins: [terser()],
				file: `${dist}index.cjs.js`,
				exports: 'named',
				...out('cjs'),
			},
			{
				plugins: [terser()],
				file: `${dist}index.cjs`,
				exports: 'named',
				...out('cjs'),
			},
			{
				plugins: [terser()],
				file: `${dist}index.esm.js`,
				exports: 'auto',
				...out('es'),
			},
			{
				plugins: [terser()],
				file: `${dist}index.mjs`,
				exports: 'auto',
				...out('es'),
			},
			{
				plugins: [terser()],
				name: pkg.name,
				file: `${dist}index.js`,
				exports: 'default',
				extend: true,
				...out('umd'),
			},
		],
	},
];
