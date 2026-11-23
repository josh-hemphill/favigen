import { favigen, Favigen } from '../src/index.js';
import { makeLogoBuffer } from './helpers.js';

describe('failure handling', () => {
	it('should fail gracefully if no source is provided', async () => {
		await expect(() => new Favigen('' as never)).toThrow('No source provided');
		await expect(favigen([] as never)).rejects.toThrow('No source provided');
	});

	it('should fail gracefully if source is neither a buffer or a string', async () => {
		await expect(() => new Favigen(42 as never)).toThrow('Invalid source type provided');
		await expect(favigen([42] as never)).rejects.toThrow('Invalid source type provided');
	});

	it('should fail gracefully if buffer is empty', async () => {
		await expect(favigen(Buffer.from(''))).rejects.toThrow('Invalid image buffer');
		await expect(favigen(Buffer.from('not-an-image'))).rejects.toThrow('Invalid image buffer');
	});

	it('should fail gracefully if path to source image is invalid', async () => {
		await expect(favigen('missing.png')).rejects.toThrow(/ENOENT/);
	});

	it('loads a valid image buffer', async () => {
		const logo = await makeLogoBuffer();
		const inst = new Favigen(logo);
		await expect(inst.source).resolves.toBeDefined();
	});
});
