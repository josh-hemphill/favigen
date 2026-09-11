import { favigen, Favigen } from '../src/index.js';
import { makeLogoBuffer, onlyIcons } from './helpers.js';

describe('restricting generated icons', () => {
	let logo: Buffer;
	beforeAll(async () => {
		logo = await makeLogoBuffer();
	});

	it('should allow restricting icons to a favicon png only', async () => {
		const { html, images, files } = await favigen(logo, onlyIcons({
			favicons: ['favicon-32x32.png'],
		}));
		expect(images).toHaveLength(1);
		expect(images[0].name).toBe('favicon-32x32.png');
		expect(html.some((tag) => /rel="icon"/.test(tag) && /png/.test(tag))).toBe(true);
		expect(files).toHaveLength(0);
	});

	it('should allow restricting icons to android icons only', async () => {
		const { html, images, files } = await favigen(logo, onlyIcons({
			android: ['android-chrome-48x48.png'],
		}));
		expect(images).toHaveLength(1);
		expect(images[0].name).toBe('android-chrome-48x48.png');
		expect(files.map((file) => file.name)).toEqual(['manifest.webmanifest']);
		expect(html).toEqual([
			expect.stringMatching(/webmanifest/),
			expect.stringMatching(/mobile-web-app-capable/),
			expect.stringMatching(/theme-color/),
			expect.stringMatching(/application-name/),
		]);
	});

	it('should allow restricting icons to apple icons only', async () => {
		const { html, images } = await favigen(logo, onlyIcons({
			appleIcon: ['apple-touch-icon-60x60.png'],
		}));
		expect(images).toHaveLength(1);
		expect(html).toEqual([
			expect.stringMatching(/<link .*apple-touch-icon/),
			expect.stringMatching(/apple-mobile-web-app-capable/),
			expect.stringMatching(/apple-mobile-web-app-status-bar-style/),
			expect.stringMatching(/apple-mobile-web-app-title/),
		]);
	});

	it('should allow restricting icons and configuring them simultaneously', async () => {
		const pipeline = new Favigen(logo, onlyIcons({
			appleIcon: [
				{ name: 'apple-touch-icon-60x60.png', background: '#CCF' },
				'apple-touch-icon-76x76.png',
			],
		}));
		expect([...pipeline.iconsMap.keys()].sort()).toEqual([
			'apple-touch-icon-60x60.png',
			'apple-touch-icon-76x76.png',
		]);
		expect(pipeline.iconsMap.get('apple-touch-icon-60x60.png')?.background).toBe('#CCF');
		const images = await pipeline.getIcons();
		expect(images).toHaveLength(2);
	});

	it('should allow restricting ico contents independently of png favicons', async () => {
		const { images } = await favigen(logo, onlyIcons({
			favicons: ['favicon.ico'],
		}));
		expect(images).toHaveLength(1);
		expect(images[0].name).toBe('favicon.ico');
	});
});
