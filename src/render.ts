import sharp from 'sharp';
import { createMemoryCache, notifyCacheError } from './cache.js';
import type { CacheErrorHandler, IconCache } from './cache.js';
import { imageWork } from './image-work.js';
import { getTargets } from './plan.js';
import type { IconPlan, IconSpec, PlaneRecipe } from './plan.js';
import { assertVisible, digest, maxPixels, sourceData } from './source.js';
import type { PreparedSource } from './source.js';

export interface RenderedIcon extends IconSpec {
	readonly bytes: Uint8Array;
	readonly byteLength: number;
	readonly digest: string;
}

export interface RenderContext {
	readonly cache?: IconCache | false;
	readonly onCacheError?: CacheErrorHandler;
}

export interface BatchRenderContext extends RenderContext {
	readonly ids?: readonly string[];
	readonly onResult?: (icon: RenderedIcon) => void | Promise<void>;
}

const memory = createMemoryCache();
const inFlight = new WeakMap<IconCache, Map<string, Promise<Buffer>>>();

async function renderPlane (source: PreparedSource, recipe: PlaneRecipe): Promise<Buffer> {
	const data = sourceData(source);
	const { input, visible, scaledWidth, scaledHeight } = recipe;
	let image;
	if (data.svg) {
		const xScale = scaledWidth / input.width;
		const yScale = scaledHeight / input.height;
		const transform = [xScale, 0, 0, yScale, -input.left * xScale - visible.left, -input.top * yScale - visible.top].join(' ');
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${visible.width}" height="${visible.height}"><g transform="matrix(${transform})">${data.svg}</g></svg>`;
		image = sharp(Buffer.from(svg), { limitInputPixels: maxPixels });
	} else {
		if (scaledWidth * scaledHeight > maxPixels) {
			throw new RangeError('The requested cover crop would exceed the render pixel limit. Crop the source first.');
		}
		image = sharp(data.bytes, { limitInputPixels: maxPixels }).autoOrient()
			.extract(input)
			.resize(scaledWidth, scaledHeight, { fit: 'fill', kernel: recipe.kernel, fastShrinkOnLoad: false });
		if (visible.width !== scaledWidth || visible.height !== scaledHeight) image.extract(visible);
	}
	const { data: pixels, info } = await image.toColourspace('srgb').ensureAlpha()
		.raw().toBuffer({ resolveWithObject: true });
	assertVisible(pixels, info.channels);

	const canvas = sharp({
		create: {
			width: recipe.width, height: recipe.height, channels: 4,
			background: recipe.background === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : recipe.background,
		},
	}).composite([{
		input: pixels,
		raw: { width: info.width, height: info.height, channels: 4 },
		left: recipe.left,
		top: recipe.top,
	}]);
	if (recipe.background !== 'transparent') canvas.removeAlpha();
	return canvas.png().toBuffer();
}

function queuedRender (source: PreparedSource, recipe: PlaneRecipe): Promise<Buffer> {
	const inputPixels = source.format === 'svg'
		? recipe.visible.width * recipe.visible.height
		: source.width * source.height + recipe.scaledWidth * recipe.scaledHeight;
	const bytes = sourceData(source).bytes.length + 8 * (inputPixels + recipe.width * recipe.height);
	return imageWork(bytes, () => renderPlane(source, recipe));
}

function fromCache (
	cache: IconCache | false,
	context: RenderContext,
	key: string,
	generate: () => Promise<Buffer>,
): Promise<Buffer> {
	if (!cache) return generate();
	let requests = inFlight.get(cache);
	if (!requests) {
		requests = new Map();
		inFlight.set(cache, requests);
	}
	const pending = requests.get(key);
	if (pending) return pending;

	const result = Promise.resolve().then(async () => {
		try {
			const bytes = await cache.get(key);
			if (bytes) return Buffer.from(bytes);
		} catch (error) {
			notifyCacheError(context.onCacheError, error);
		}

		const rendered = await generate();
		try {
			await cache.set(key, Uint8Array.from(rendered));
		} catch (error) {
			notifyCacheError(context.onCacheError, error);
		}
		return rendered;
	}).finally(() => requests.delete(key));
	requests.set(key, result);
	return result;
}

function encodeIco (planes: Buffer[], sizes: IconSpec['sizes']): Buffer {
	const directory = Buffer.alloc(6 + planes.length * 16);
	directory.writeUInt16LE(1, 2);
	directory.writeUInt16LE(planes.length, 4);
	let fileOffset = directory.length;
	for (const [index, plane] of planes.entries()) {
		const entry = 6 + index * 16;
		const { width, height } = sizes[index];
		directory[entry] = width % 256;
		directory[entry + 1] = height % 256;
		directory.writeUInt16LE(1, entry + 4);
		directory.writeUInt16LE(32, entry + 6);
		directory.writeUInt32LE(plane.length, entry + 8);
		directory.writeUInt32LE(fileOffset, entry + 12);
		fileOffset += plane.length;
	}
	return Buffer.concat([directory, ...planes], fileOffset);
}

/** Render one planned asset, reusing shared PNG planes and ICO containers. */
export async function renderIcon (plan: IconPlan, id: string, context: RenderContext = {}): Promise<RenderedIcon> {
	const target = getTargets(plan).get(id);
	if (!target) throw new Error(`Unknown planned icon: ${id}`);
	const cache = context.cache ?? memory;
	const renderPlanes = () => Promise.all(target.planes.map(({ key, recipe }) =>
		fromCache(cache, context, key, () => queuedRender(target.source, recipe))));
	const { spec } = target;
	const bytes = spec.mimeType === 'image/vnd.microsoft.icon'
		? await fromCache(cache, context, spec.recipeKey, async () => encodeIco(await renderPlanes(), spec.sizes))
		: (await renderPlanes())[0];
	return Object.freeze({
		...spec, bytes: Uint8Array.from(bytes), byteLength: bytes.length, digest: digest(bytes),
	});
}

/** Render selected IDs in plan order unless a caller supplies an explicit order. */
export async function renderIcons (plan: IconPlan, context: BatchRenderContext = {}): Promise<RenderedIcon[]> {
	const targets = getTargets(plan);
	const ids = context.ids ?? plan.ids;
	if (ids.some((id) => !targets.has(id)) || new Set(ids).size !== ids.length) {
		throw new Error('Render selection includes unknown or duplicate IDs');
	}
	return Promise.all(ids.map(async (id) => {
		const icon = await renderIcon(plan, id, context);
		await context.onResult?.(icon);
		return icon;
	}));
}
