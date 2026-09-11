import { favigen } from '../src/index.js';
import { makeLogoBuffer, onlyIcons } from './helpers.js';

describe('independent output channels', () => {
	let logo: Buffer;
	beforeAll(async () => {
		logo = await makeLogoBuffer();
	});

	const platforms = onlyIcons({
		android: true,
		favicons: true,
	});

	it('should not generate images when output.images is false', async () => {
		const { images, files, html } = await favigen(logo, {
			...platforms,
			output: { images: false },
		});
		expect(images).toStrictEqual([]);
		expect(files.length).toBeGreaterThanOrEqual(1);
		expect(html.length).toBeGreaterThanOrEqual(1);
	});

	it('should not generate files when output.files is false', async () => {
		const { images, files, html } = await favigen(logo, {
			...platforms,
			output: { files: false },
		});
		expect(files).toStrictEqual([]);
		expect(images.length).toBeGreaterThanOrEqual(1);
		expect(html.length).toBeGreaterThanOrEqual(1);
	});

	it('should not generate html when output.html is false', async () => {
		const { images, files, html } = await favigen(logo, {
			...platforms,
			output: { html: false },
		});
		expect(html).toStrictEqual([]);
		expect(images.length).toBeGreaterThanOrEqual(1);
		expect(files.length).toBeGreaterThanOrEqual(1);
	});

	it('should allow disabling asset generation', async () => {
		const result = await favigen(logo, onlyIcons({}));
		expect(result).toEqual({
			files: [],
			images: [],
			htmlTags: [],
			html: [],
		});
	});
});
