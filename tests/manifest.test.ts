import { favigen, Favigen } from '../src/index.js';
import { makeLogoBuffer, onlyIcons } from './helpers.js';

describe('manifest files', () => {
	let logo: Buffer;
	beforeAll(async () => {
		logo = await makeLogoBuffer();
	});

	it('should not prefer any related applications by default', async () => {
		const result = await favigen(logo, {
			...onlyIcons({ android: true }),
			output: { images: false, html: false },
		});
		const manifestFile = result.files.find((file) => file.name === 'manifest.webmanifest');
		expect(manifestFile).toBeDefined();
		if (!manifestFile) return;
		const manifest = JSON.parse(manifestFile.contents);
		expect(manifest).not.toHaveProperty('prefer_related_applications');
		expect(manifest.icons.length).toBeGreaterThan(0);
		expect(manifest.icons[0]).toMatchObject({
			type: 'image/png',
			purpose: 'any',
		});
	});

	it('should list preferred related applications', async () => {
		const relatedApplications = [
			{
				platform: 'play',
				url: 'https://play.google.com/store/apps/details?id=com.example.app1',
				id: 'com.example.app1',
			},
			{
				platform: 'itunes',
				url: 'https://itunes.apple.com/app/example-app1/id123456789',
			},
		];
		const result = await favigen(logo, {
			...onlyIcons({ android: true }),
			preferRelatedApplications: true,
			relatedApplications,
			output: { images: false, html: false },
		});
		const manifestFile = result.files.find((file) => file.name === 'manifest.webmanifest');
		expect(manifestFile).toBeDefined();
		if (!manifestFile) return;
		const manifest = JSON.parse(manifestFile.contents);
		expect(manifest.prefer_related_applications).toBe(true);
		expect(manifest.related_applications).toStrictEqual(relatedApplications);
	});

	it('should allow renaming of manifests', async () => {
		const result = await favigen(logo, {
			output: { images: false, html: false },
			icons: {
				appleIcon: false,
				appleStartup: false,
				favicons: false,
				coast: false,
				firefox: false,
			},
		});
		expect(new Set(result.files.map((file) => file.name))).toEqual(new Set([
			'manifest.webmanifest',
			'browserconfig.xml',
			'yandex-browser-manifest.json',
		]));

		const renamed = await favigen(logo, {
			output: { images: false, html: false },
			icons: {
				appleIcon: false,
				appleStartup: false,
				favicons: false,
				coast: false,
				firefox: false,
			},
			files: {
				android: { manifestFileName: 'android-manifest.webmanifest' },
				windows: { manifestFileName: 'windows-browserconfig.xml' },
				yandex: { manifestFileName: 'yandex-manifest.json' },
			},
		});
		expect(new Set(renamed.files.map((file) => file.name))).toEqual(new Set([
			'android-manifest.webmanifest',
			'windows-browserconfig.xml',
			'yandex-manifest.json',
		]));
	});

	it('uses basename-only icon src when manifestRelativePaths is true', () => {
		const pipeline = new Favigen(logo, {
			...onlyIcons({
				android: ['android-chrome-192x192.png'],
				windows: ['mstile-150x150.png'],
				yandex: true,
			}),
			manifestRelativePaths: true,
			path: 'favicons/',
		});
		const files = Object.fromEntries(pipeline.getManifests().map((file) => [file.name, file.contents]));
		expect(files['manifest.webmanifest']).toContain('"src": "android-chrome-192x192.png"');
		expect(files['manifest.webmanifest']).not.toContain('favicons/');
		expect(files['browserconfig.xml']).toContain('mstile-150x150.png');
		expect(files['yandex-browser-manifest.json']).toContain('yandex-browser-50x50.png');
	});

	it('writes configured metadata into the web manifest', () => {
		const pipeline = new Favigen(logo, {
			...onlyIcons({ android: ['android-chrome-192x192.png'] }),
			appName: 'PWA',
			appShortName: 'PWA',
			appDescription: 'Progressive Web App',
			dir: 'rtl',
			lang: 'ar',
			background: '#333',
			theme_color: '#abc',
			display: 'fullscreen',
			orientation: 'portrait',
			scope: '/',
			start_url: '/subdomain/',
		});
		const manifest = JSON.parse(pipeline.getManifests()[0].contents);
		expect(manifest).toMatchObject({
			name: 'PWA',
			short_name: 'PWA',
			description: 'Progressive Web App',
			dir: 'rtl',
			lang: 'ar',
			background_color: '#333',
			theme_color: '#abc',
			display: 'fullscreen',
			orientation: 'portrait',
			start_url: '/subdomain/',
		});
	});
});
