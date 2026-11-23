import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
	bindIcons, buildBasicManifest, createDiskCache, createMemoryCache, iconTags,
	manifestIcons, planIcons, prepareSource, renderIcon, renderIcons,
} from '../src/index.js';
import type { IconCache } from '../src/index.js';
import { imageWork } from '../src/image-work.js';

const svg = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="7.75" width=".5" height="16" fill="red"/></svg>',
);
const wideSvg = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 4"><rect width="8" height="4" fill="#f00"/><rect x="8" width="8" height="4" fill="#0f0"/></svg>',
);

async function pixels (bytes: Uint8Array) {
	const { data, info } = await sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	return { width: info.width, height: info.height, at: (x: number, y: number) =>
		[...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)] };
}

describe('staged Favigen API', () => {
	it('plans browser icons from one SVG and encodes the expected ICO planes', async () => {
		const plan = planIcons(await prepareSource(svg));
		expect(plan.icons.map(icon => icon.name)).toEqual([
			'favicon.ico', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png',
		]);
		const ico = Buffer.from((await renderIcon(plan, 'favicon.ico')).bytes);
		expect(ico.readUInt16LE(2)).toBe(1);
		expect(ico.readUInt16LE(4)).toBe(3);
		for (const [index, size] of [16, 32, 48].entries()) {
			const entry = 6 + index * 16;
			const offset = ico.readUInt32LE(entry + 12);
			const length = ico.readUInt32LE(entry + 8);
			expect(ico[entry]).toBe(size);
			await expect(sharp(ico.subarray(offset, offset + length)).metadata())
				.resolves.toMatchObject({ format: 'png', width: size, height: size });
		}
	});

	it('rasterizes detail at target resolution and keeps maskable artwork inside the safe zone', async () => {
		const plan = planIcons(await prepareSource(svg), { profile: 'pwa' });
		const [app, maskable] = await renderIcons(plan, { ids: ['app.any.512', 'app.maskable.192'] });
		const detail = await pixels(app.bytes);
		expect(detail.at(248, 100)).toEqual([255, 0, 0, 255]);
		expect(detail.at(240, 100)[3]).toBe(0);
		expect(detail.at(270, 100)[3]).toBe(0);
		const mask = await pixels(maskable.bytes);
		expect(mask.at(0, 0)).toEqual([255, 255, 255, 255]);
		expect(mask.at(95, 0)).toEqual([255, 255, 255, 255]);
		expect(mask.at(95, 96)).toEqual([255, 0, 0, 255]);

		const filledSquare = await prepareSource(await sharp({
			create: { width: 32, height: 32, channels: 3, background: '#ff0000' },
		}).png().toBuffer());
		const squarePlan = planIcons(filledSquare, { profile: 'pwa', ids: ['app.maskable.192'] });
		const square = await pixels((await renderIcon(squarePlan, 'app.maskable.192')).bytes);
		for (let y = 0; y < square.height; y++) {
			for (let x = 0; x < square.width; x++) {
				if (Math.hypot(x + 0.5 - 96, y + 0.5 - 96) <= 76.8) continue;
				if (square.at(x, y).some((value) => value !== 255)) throw new Error(`Artwork outside safe zone at ${x}, ${y}`);
			}
		}
	});

	it('retains width by default and clips off-center cover to the padded box', async () => {
		const source = await prepareSource(wideSvg);
		const raster = await prepareSource(await sharp(wideSvg).png().toBuffer());
		for (const artwork of [source, raster]) {
			const defaultIcon = await pixels((await renderIcon(planIcons(artwork), 'favicon.32')).bytes);
			expect(defaultIcon.at(0, 12)).toEqual([255, 0, 0, 255]);
			expect(defaultIcon.at(31, 19)).toEqual([0, 255, 0, 255]);
			expect(defaultIcon.at(0, 11)[3]).toBe(0);

			const covered = planIcons(artwork, {
				ids: ['favicon.32'],
				render: { fit: 'cover', position: [1, 0.5], padding: 0.125, background: '#124' },
			});
			const result = await pixels((await renderIcon(covered, 'favicon.32')).bytes);
			expect(result.at(3, 16)).toEqual([17, 34, 68, 255]);
			expect(result.at(4, 16)).toEqual([0, 255, 0, 255]);
			expect(result.at(27, 16)).toEqual([0, 255, 0, 255]);
			expect(result.at(28, 16)).toEqual([17, 34, 68, 255]);
		}
	});

	it('trims only transparent margins when requested and accepts per-role artwork', async () => {
		const png = await sharp({
			create: { width: 16, height: 16, channels: 4, background: '#00000000' },
		}).composite([{ input: { create: { width: 4, height: 4, channels: 4, background: '#00ff00' } }, left: 4, top: 4 }])
			.png().toBuffer();
		const artwork = await prepareSource(png);
		const plan = planIcons(await prepareSource(svg), {
			variants: { favicon: { source: artwork, trim: true, resample: 'nearest' } },
		});
		const icon = await renderIcon(plan, 'favicon.32');
		expect(icon.sourceId).toBe(artwork.id);
		expect(plan.icons.find(target => target.id === 'touch.180')?.sourceId).not.toBe(artwork.id);
		expect((await pixels(icon.bytes)).at(0, 0)).toEqual([0, 255, 0, 255]);
	});

	it('applies JPEG orientation before crop and accepts static WebP', async () => {
		const jpeg = await sharp(wideSvg).jpeg({ quality: 100 }).withMetadata({ orientation: 6 }).toBuffer();
		const oriented = await prepareSource(jpeg);
		expect(oriented).toMatchObject({ format: 'jpeg', width: 4, height: 16 });
		const plan = planIcons(oriented, { render: { crop: [0, 0, 1, 0.5] } });
		const color = (await pixels((await renderIcon(plan, 'favicon.32')).bytes)).at(16, 12);
		expect(color[0]).toBeGreaterThan(200);
		expect(color[1]).toBeLessThan(40);
		const webp = await sharp(wideSvg).webp().toBuffer();
		await expect(prepareSource(webp)).resolves.toMatchObject({ format: 'webp', width: 16, height: 4 });
	});

	it('rejects external SVG resources and empty raster artwork', async () => {
		await expect(prepareSource(Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><use href="https://example.com/a.svg#mark"/></svg>',
		))).rejects.toThrow(/same file/);
		const empty = await sharp({
			create: { width: 8, height: 8, channels: 4, background: '#00000000' },
		}).png().toBuffer();
		await expect(prepareSource(empty)).rejects.toThrow(/fully transparent/);
	});

	it('validates SVG markup past leading whitespace and rejects invisible or collapsed artwork', async () => {
		const solid = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="red"/></svg>';
		const source = await prepareSource(Buffer.from(' '.repeat(2048) + solid));
		const thinCrop = planIcons(source, { render: { crop: [0, 0, 0.0001, 1], fit: 'cover' } });
		expect((await pixels((await renderIcon(thinCrop, 'favicon.32')).bytes)).at(16, 16))
			.toEqual([255, 0, 0, 255]);
		const collapsed = () => planIcons(source, { render: { crop: [0.5, 0, Number.EPSILON / 8, 1] } });
		expect(collapsed).toThrow('Crop is too small');
		const invisible = await prepareSource(Buffer.from(solid.replace('fill="red"', 'opacity="0"')));
		await expect(renderIcon(planIcons(invisible), 'favicon.32')).rejects.toThrow(/fully transparent/);
		const smallMark = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="8" y="8" width=".0005" height=".0005" fill="red"/></svg>';
		const sparse = await prepareSource(Buffer.from(smallMark));
		const tight = planIcons(sparse, { render: { crop: [0.5, 0.5, 0.0005 / 16, 0.0005 / 16], fit: 'cover' } });
		expect((await pixels((await renderIcon(tight, 'favicon.32')).bytes)).at(16, 16))
			.toEqual([255, 0, 0, 255]);
	});

	it('rejects incompletely decoded opaque raster sources during preparation', async () => {
		const raw = Buffer.from(Array.from({ length: 128 * 128 * 3 }, (_, i) => (i * 31 ^ i >> 3) & 255));
		const full = await sharp(raw, { raw: { width: 128, height: 128, channels: 3 } }).jpeg().toBuffer();
		const truncated = full.subarray(0, Math.floor(full.length / 2));
		await expect(sharp(truncated).metadata()).resolves.toMatchObject({ width: 128, height: 128 });
		await expect(prepareSource(truncated)).rejects.toThrow(/Could not prepare image bytes/);
	});

	it('applies backpressure to concurrent image work over the memory or job budget', async () => {
		const started: string[] = [];
		let release!: () => void;
		const held = new Promise<void>((resolve) => { release = resolve; });
		const submit = (name: string, size: number) => imageWork(size * 1024 * 1024, async () => {
			started.push(name);
			await held;
		});
		const jobs = [submit('a', 160), submit('b', 160), submit('c', 1)];
		await Promise.resolve();
		expect(started).toEqual(['a']);
		release();
		await Promise.all(jobs);
		expect(started).toEqual(['a', 'b', 'c']);
		await expect(imageWork(257 * 1024 * 1024, async () => 'unreachable')).rejects.toThrow(/pixel budget/);
	});

	it('deduplicates concurrent PNG planes and only invalidates changed pixel recipes', async () => {
		const store = createMemoryCache();
		const encoded: string[] = [];
		const cache: IconCache = {
			get: key => store.get(key),
			set (key, value) {
				encoded.push(key);
				return store.set(key, value);
			},
		};
		const source = await prepareSource(wideSvg);
		const original = planIcons(source, { ids: ['favicon.ico', 'favicon.32', 'favicon.48'] });
		const rendered = await renderIcons(original, { cache });
		expect(encoded).toHaveLength(4); // 16, 32, 48, and ICO.
		const renamed = planIcons(source, {
			ids: original.ids, targets: { 'favicon.32': { name: 'brand.png' } },
		});
		const renamedImages = await renderIcons(renamed, { cache });
		expect(renamedImages[1]).toMatchObject({ name: 'brand.png', digest: rendered[1].digest });
		expect(encoded).toHaveLength(4);
		const cropped = planIcons(source, {
			ids: original.ids, targets: { 'favicon.32': { crop: [0.5, 0, 0.5, 1] } },
		});
		const croppedImages = await renderIcons(cropped, { cache });
		expect(croppedImages[1].digest).not.toBe(rendered[1].digest);
		expect(croppedImages[0].digest).toBe(rendered[0].digest);
		expect(encoded).toHaveLength(5);
	});

	it('treats cache adapter failures as optional and retries reads and writes', async () => {
		const plan = planIcons(await prepareSource(svg), { ids: ['favicon.32'] });
		const backing = createMemoryCache();
		const onCacheError = jest.fn(async () => { throw new Error('diagnostic failed'); });
		let broken = true;
		const cache: IconCache = {
			get (key) {
				if (broken) throw new Error('read failed');
				return backing.get(key);
			},
			async set (key, value) {
				if (broken) throw new Error('write failed');
				await backing.set(key, value);
			},
		};
		const expected = await renderIcon(plan, 'favicon.32', { cache: false });
		const uncached = await renderIcon(plan, 'favicon.32', { cache, onCacheError });
		expect(uncached.digest).toBe(expected.digest);
		expect(onCacheError.mock.calls).toHaveLength(2);
		// A rejected async observer also must not produce an unhandled rejection.
		await new Promise<void>((resolve) => setImmediate(resolve));
		broken = false;
		expect((await renderIcon(plan, 'favicon.32', { cache })).digest).toBe(expected.digest);
		expect(await backing.get(expected.recipeKey)).toEqual(expected.bytes);
	});

	it('recovers from corrupt disk entries and reuses persisted bytes through a new cache', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'favigen-test-'));
		try {
			const plan = planIcons(await prepareSource(svg), { ids: ['favicon.32'] });
			const [first] = await renderIcons(plan, { cache: createDiskCache(dir) });
			const disk = createDiskCache(dir);
			const writes = jest.fn(disk.set);
			const second = await renderIcon(plan, first.id, { cache: { get: disk.get, set: writes } });
			expect(second.digest).toBe(first.digest);
			expect(writes).not.toHaveBeenCalled();
			await writeFile(join(dir, 'favigen-v1', first.recipeKey), Buffer.alloc(64));
			const broken = createDiskCache(join(dir, 'favigen-v1', first.recipeKey), {
				async onError () { throw new Error('observer failed'); },
			});
			expect((await renderIcon(plan, first.id, { cache: broken })).digest).toBe(first.digest);
			const recovered = await renderIcon(plan, first.id, { cache: { get: disk.get, set: writes } });
			expect(recovered.digest).toBe(first.digest);
			expect(writes).toHaveBeenCalledTimes(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('binds final URLs and supplies manifest entries without publishing a manifest', async () => {
		const plan = planIcons(await prepareSource(svg), { profile: 'pwa', ids: ['touch.180', 'app.any.192', 'app.maskable.512'] });
		const rendered = await renderIcons(plan);
		const bindings = new Map(rendered.map(icon => [icon.id, {
			outputFileName: `assets/${icon.name}`,
			url: icon.purpose === 'maskable'
				? `https://cdn.example/assets/${icon.name}`
				: `/shop/assets/${icon.name}`,
		}]));
		const bound = bindIcons(rendered, bindings, '1');
		expect(bound).toMatchObject({ schemaVersion: 1, revision: '1' });
		expect(bound.icons[0]).not.toHaveProperty('bytes');
		expect(iconTags(bound).map(tag => tag.attrs.rel)).toEqual(['apple-touch-icon']);
		expect(manifestIcons(bound, {
			manifestUrl: 'https://app.example/shop/meta/app.webmanifest', urlStyle: 'relative',
		})).toEqual([
			{ src: '../assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: 'https://cdn.example/assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
		]);
		expect(buildBasicManifest(bound, { name: 'Shop', startUrl: '/shop/' }))
			.toMatchObject({ name: 'Shop', display: 'standalone', start_url: '/shop/' });
		const deployment = {
			name: 'Shop', appUrl: 'https://app.example/shop/',
			manifestUrl: 'https://app.example/shop/meta/app.webmanifest',
		};
		expect(buildBasicManifest(bound, deployment)).toMatchObject({
			start_url: deployment.appUrl, scope: deployment.appUrl,
		});
		expect(() => buildBasicManifest(bound, { ...deployment, startUrl: 'https://cdn.example/shop/' }))
			.toThrow(/app origin/);
		expect(() => bindIcons(rendered, new Map())).toThrow(/binding/);
	});
	it('preserves URL identity when rebasing manifest entries and validates comparable scopes', async () => {
		const plan = planIcons(await prepareSource(svg), { profile: 'pwa', ids: ['app.any.192'] });
		const [icon] = await renderIcons(plan);
		const manifestUrl = 'https://app.example/shop/meta/app.webmanifest';
		for (const [url, expected] of [
			['/shop/icons/?size=192#art', '../icons/?size=192#art'],
			['/shop/meta/', './'],
			['/shop/meta', '../meta'],
			['/shop/icons//assets/mark', 'https://app.example/shop/icons//assets/mark'],
		]) {
			const bound = bindIcons([icon], new Map([[icon.id, { outputFileName: icon.name, url }]]));
			const [entry] = manifestIcons(bound, { manifestUrl, urlStyle: 'relative' });
			expect(entry.src).toBe(expected);
			expect(new URL(entry.src, manifestUrl).href).toBe(new URL(url, manifestUrl).href);
			expect(() => buildBasicManifest(bound, { name: 'Shop', startUrl: '/shop/start', scope: '/elsewhere/' }))
				.toThrow(/Manifest scope/);
		}
	});

	it('compares physical manifest paths only after their reference base is known', async () => {
		const plan = planIcons(await prepareSource(svg), { profile: 'pwa', ids: ['app.any.192', 'app.any.512'] });
		const icons = await renderIcons(plan);
		const manifestUrl = 'https://app.example/shop/app.webmanifest';
		const publicationFor = (urls: string[]) => bindIcons(icons, new Map(icons.map((icon, index) => [
			icon.id, { outputFileName: icon.name, url: urls[index] },
		])));
		const distinct = publicationFor(['assets/app.png', '/assets/app.png']);
		expect(manifestIcons(distinct, { manifestUrl })).toHaveLength(2);
		const aliases = publicationFor(['/shop/assets/app.png', 'https://app.example/shop/assets/app.png']);
		expect(() => manifestIcons(aliases, { manifestUrl, urlStyle: 'relative' })).toThrow(/Conflicting published icons/);
	});

});
