import Jimp from 'jimp';
import { favigen } from '../src/index.js';
import { makeLogoBuffer, onlyIcons, readPngSize } from './helpers.js';

describe('image conversion options', () => {
	let logo: Buffer;
	beforeAll(async () => {
		logo = await makeLogoBuffer();
	});

	it('keeps the requested canvas size when a background is forced', async () => {
		const { images } = await favigen(logo, {
			...onlyIcons({
				appleIcon: ['apple-touch-icon-180x180.png'],
			}),
			background: '#333',
		});
		expect(images).toHaveLength(1);
		await expect(readPngSize(images[0].contents)).resolves.toEqual({ width: 180, height: 180 });
	});

	it('keeps the requested canvas size when an offset is applied', async () => {
		const { images } = await favigen(logo, onlyIcons({
			android: { offset: 10, sizes: [{ width: 48, height: 48 }] },
		}));
		expect(images).toHaveLength(1);
		await expect(readPngSize(images[0].contents)).resolves.toEqual({ width: 48, height: 48 });
	});

	it('uses nearest-neighbor scaling when pixel_art is enabled', async () => {
		const source = await (await Jimp.create(8, 8, 0xFF0000FF)).getBufferAsync(Jimp.MIME_PNG);
		const { images } = await favigen(source, {
			...onlyIcons({ favicons: ['favicon-32x32.png'] }),
			pixel_art: true,
		});
		await expect(readPngSize(images[0].contents)).resolves.toEqual({ width: 32, height: 32 });
	});
});
