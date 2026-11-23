import { Jimp, ResizeStrategy } from 'jimp';

export type JimpImage = InstanceType<typeof Jimp>;

interface ShadowOptions {
	opacity?: number;
	size?: number;
	x?: number;
	y?: number;
	blur?: number;
}

type ResizeOptions = Parameters<JimpImage['resize']>[0];
type ContainOptions = Parameters<JimpImage['contain']>[0];
type JimpMethods = Omit<JimpImage, 'clone' | 'contain' | 'resize'>;
type ImageShape = Pick<JimpImage, 'bitmap' | 'width' | 'height'>;

// Jimp's fluent methods return a base image type, while the instance keeps this wrapper.
export type LegacyImage = {
	[Key in keyof JimpMethods]: JimpMethods[Key] extends (...args: infer Args) => ImageShape
		? (...args: Args) => LegacyImage
		: JimpMethods[Key];
} & {
	clone(): LegacyImage;
	contain(options: ContainOptions): LegacyImage;
	contain(width: number, height: number, align?: number | ResizeStrategy, mode?: ResizeStrategy): LegacyImage;
	getBufferAsync: JimpImage['getBuffer'];
	getHeight(): number;
	getWidth(): number;
	resize(options: ResizeOptions): LegacyImage;
	resize(width: number, height: number, mode?: ResizeStrategy): LegacyImage;
	shadow(options?: ShadowOptions): LegacyImage;
};

/** Preserve the common Jimp 0 methods used via Favigen's legacy image hook. */
export function legacyImage (input: JimpImage | Awaited<ReturnType<typeof Jimp.fromBuffer>>): LegacyImage {
	// Both the constructor and static decoding create the same Jimp runtime class.
	const image = input as JimpImage;
	const clone = image.clone.bind(image) as () => JimpImage;
	const contain = image.contain.bind(image);
	const resize = image.resize.bind(image);
	const result = Object.assign(image, {
		clone: () => legacyImage(clone()),
		getBufferAsync: image.getBuffer.bind(image),
		getHeight: () => image.height,
		getWidth: () => image.width,
		resize (options: ResizeOptions | number, height?: number, mode?: ResizeStrategy) {
			if (typeof options !== 'number') resize(options);
			else if (options !== -1) resize({ w: options, h: height === -1 ? undefined : height, mode });
			else if (height !== undefined && height !== -1) resize({ h: height, mode });
			else throw new Error('Resize requires a width or height');
			return result;
		},
		contain (options: ContainOptions | number, height?: number, align?: number | ResizeStrategy, mode?: ResizeStrategy) {
			if (typeof options !== 'number') contain(options);
			else if (height !== undefined) contain({
				w: options,
				h: height,
				align: typeof align === 'number' ? align || undefined : undefined,
				mode: typeof align === 'string' ? align : mode,
			});
			else throw new Error('Contain requires a width and height');
			return result;
		},
		shadow ({ opacity = 0.7, size = 1.1, x = -25, y = 25, blur = 5 }: ShadowOptions = {}) {
			const original = clone();
			const shadow = clone();
			for (let pixel = 0; pixel < shadow.bitmap.data.length; pixel += 4) {
				shadow.bitmap.data.fill(0, pixel, pixel + 3);
				shadow.bitmap.data[pixel + 3] = Math.max(0, Math.min(255, shadow.bitmap.data[pixel + 3] * opacity));
			}
			shadow.resize({ w: shadow.width * size, h: shadow.height * size }).blur(blur);
			image.bitmap.data.fill(0);
			image.composite(shadow, x, y).composite(original, 0, 0);
			return result;
		},
	}) as unknown as LegacyImage;
	return result;
}
