import { Jimp, JimpMime, ResizeStrategy } from 'jimp';
import { Favigen, favigen } from '../src/index.js';
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
		const source = await new Jimp({ width: 8, height: 8, color: 0xFF0000FF }).getBuffer(JimpMime.png);
		const { images } = await favigen(source, {
			...onlyIcons({ favicons: ['favicon-32x32.png'] }),
			pixel_art: true,
		});
		await expect(readPngSize(images[0].contents)).resolves.toEqual({ width: 32, height: 32 });
	});

	it('preserves positional transforms and buffer access in the legacy image hook', async () => {
		const generator = new Favigen(logo, onlyIcons({ favicons: ['favicon-32x32.png'] }));
		const image = await generator.source;
		expect(image?.getWidth()).toBe(64);
		expect(await image?.getBufferAsync(JimpMime.png)).toBeInstanceOf(Buffer);

		const afterCreate = jest.fn();
		await generator.getIcons(afterCreate, (clone, _definition, render) => {
			expect(clone.greyscale().resize(12, 8).contain(16, 16, ResizeStrategy.NEAREST_NEIGHBOR).getHeight()).toBe(16);
			expect(clone.resize(12, 8).contain(16, 16, 0).rotate(90).getWidth()).toBe(16);
			clone.shadow({ opacity: 0.5, x: 0, y: 0 });
			render();
		});
		expect(afterCreate).toHaveBeenCalledTimes(1);
		const [{ contents }] = afterCreate.mock.calls[0];
		await expect(readPngSize(contents)).resolves.toEqual({ width: 32, height: 32 });
	});

});
