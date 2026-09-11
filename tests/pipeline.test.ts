import { favigen, Favigen } from '../src/index.js';
import { icoImageCount, makeLogoBuffer, onlyIcons, readPngSize } from './helpers.js';

describe('library-first planning and path rebinding', () => {
	let logo: Buffer;
	beforeAll(async () => {
		logo = await makeLogoBuffer();
	});

	it('exposes the planned icon map before any pixels are rendered', () => {
		const pipeline = new Favigen(logo, onlyIcons({
			favicons: true,
			android: ['android-chrome-192x192.png'],
		}));
		const names = [...pipeline.iconsMap.keys()].sort();
		expect(names).toEqual([
			'android-chrome-192x192.png',
			'favicon-16x16.png',
			'favicon-32x32.png',
			'favicon-48x48.png',
			'favicon.ico',
		]);
		expect(pipeline.enabledPlatforms.has('android')).toBe(true);
		expect(pipeline.enabledPlatforms.has('appleIcon')).toBe(false);
	});

	it('lets consuming packages rewrite public URLs without regenerating images', async () => {
		const pipeline = new Favigen(logo, onlyIcons({
			favicons: ['favicon-32x32.png'],
			android: ['android-chrome-192x192.png'],
		}));
		const images = await pipeline.getIcons();
		const original = Buffer.from(images[0].contents);

		pipeline.setPublicPath('/assets/');
		pipeline.setIconHref('favicon-32x32.png', '/assets/favicon-32x32.abc123.png');
		pipeline.setIconHref('android-chrome-192x192.png', '/assets/android-chrome-192x192.def456.png');

		const html = pipeline.getHtml();
		const files = pipeline.getManifests();
		const regenerated = await pipeline.getIcons();

		expect(html.some((tag) => tag.includes('/assets/favicon-32x32.abc123.png'))).toBe(true);
		expect(files[0].contents).toContain('/assets/android-chrome-192x192.def456.png');
		expect(regenerated[0].contents.equals(original)).toBe(true);
	});

	it('supports transformIcons for rename/disable before generation', async () => {
		const pipeline = new Favigen(logo, onlyIcons({
			favicons: true,
		}));
		pipeline.transformIcons((id, icon) => {
			if (id === 'favicon-16x16.png') icon.disable = true;
			if (id === 'favicon-32x32.png') icon.name = 'icon.hash.png';
		});
		expect(pipeline.iconsMap.has('favicon-16x16.png')).toBe(false);
		expect(pipeline.iconsMap.has('icon.hash.png')).toBe(true);
		const images = await pipeline.getIcons();
		expect(images.map((image) => image.name).sort()).toEqual([
			'favicon-48x48.png',
			'favicon.ico',
			'icon.hash.png',
		]);
	});

	it('streams each icon to an afterCreate hook for bundler emitFile', async () => {
		const pipeline = new Favigen(logo, onlyIcons({
			favicons: ['favicon-32x32.png', 'favicon-16x16.png'],
		}));
		const emitted: string[] = [];
		const returned = await pipeline.getIcons((icon) => {
			emitted.push(icon.name);
		});
		expect(returned).toEqual([]);
		expect(emitted.sort()).toEqual(['favicon-16x16.png', 'favicon-32x32.png']);
	});

	it('updates HTML and manifests when setPublicPath is used like a bundler prefix', () => {
		const pipeline = new Favigen(logo, {
			...onlyIcons({
				android: ['android-chrome-192x192.png'],
				favicons: ['favicon.ico'],
			}),
			path: '/',
		});
		pipeline.setPublicPath('https://cdn.example/app/');
		const html = pipeline.getHtml().join('\n');
		const manifest = pipeline.getManifests().find((file) => file.name.endsWith('webmanifest'));
		expect(html).toContain('https://cdn.example/app/favicon.ico');
		expect(manifest?.contents).toContain('https://cdn.example/app/android-chrome-192x192.png');
	});

	it('renders PNG and ICO planes at the requested sizes', async () => {
		const { images } = await favigen(logo, onlyIcons({
			favicons: true,
		}));
		const png32 = images.find((image) => image.name === 'favicon-32x32.png');
		const ico = images.find((image) => image.name === 'favicon.ico');
		expect(png32).toBeDefined();
		expect(ico).toBeDefined();
		if (!png32 || !ico) return;
		await expect(readPngSize(png32.contents)).resolves.toEqual({ width: 32, height: 32 });
		expect(ico.contents.readUInt16LE(0)).toBe(0);
		expect(ico.contents.readUInt16LE(2)).toBe(1);
		expect(icoImageCount(ico.contents)).toBe(5);
	});
});
