import { Favigen } from '../src/index.js';
import { makeLogoBuffer, onlyIcons } from './helpers.js';

describe('html metadata', () => {
	let logo: Buffer;
	beforeAll(async () => {
		logo = await makeLogoBuffer();
	});

	it('should allow setting an URL prefix', () => {
		const pipeline = new Favigen(logo, {
			...onlyIcons({
				favicons: ['favicon-32x32.png'],
				android: true,
			}),
			path: 'https://domain/subdomain',
		});
		const html = pipeline.getHtml().join('\n');
		expect(html).toContain('https://domain/subdomain/favicon-32x32.png');
		expect(html).toContain('https://domain/subdomain/manifest.webmanifest');
	});

	it('should add crossorigin to the manifest tag when loadManifestWithCredentials is true', () => {
		const pipeline = new Favigen(logo, {
			...onlyIcons({ android: true }),
			loadManifestWithCredentials: true,
		});
		const manifestTag = pipeline.getHtmlTags().find((tag) => tag.attrs.rel === 'manifest');
		expect(manifestTag?.attrs.crossorigin).toBe('use-credentials');
	});

	it('should allow setting a cache busting query parameter', () => {
		const pipeline = new Favigen(logo, {
			...onlyIcons({
				favicons: ['favicon-32x32.png'],
				android: ['android-chrome-192x192.png'],
			}),
			output: { images: false },
			cacheBustingQueryParam: 'v=1',
		});
		const html = pipeline.getHtml().join('\n');
		const manifest = pipeline.getManifests()[0].contents;
		expect(html).toContain('favicon-32x32.png?v=1');
		expect(manifest).toContain('android-chrome-192x192.png?v=1');
	});

	it('should apply app metadata to apple and android tags', () => {
		const pipeline = new Favigen(logo, {
			...onlyIcons({
				android: true,
				appleIcon: ['apple-touch-icon-180x180.png'],
			}),
			appName: 'PWA',
			appShortName: 'Short',
			theme_color: '#abc',
			appleStatusBarStyle: 'default',
		});
		const html = pipeline.getHtml().join('\n');
		expect(html).toContain('name="application-name" content="PWA"');
		expect(html).toContain('name="theme-color" content="#abc"');
		expect(html).toContain('name="apple-mobile-web-app-title" content="Short"');
		expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="default"');
	});

	it('emits structured htmlTags so bundlers can rewrite attributes', () => {
		const pipeline = new Favigen(logo, onlyIcons({
			favicons: ['favicon.ico'],
		}));
		const tags = pipeline.getHtmlTags();
		expect(tags[0]).toMatchObject({
			tag: 'link',
			platform: 'favicons',
			attrs: {
				rel: 'icon',
				type: 'image/x-icon',
			},
		});
	});
});
