import Jimp from 'jimp';
import { IconSize, ResolvedOptions } from './defaults.js';
import { NormalizedIcons, PngIcons } from './types.js';

const TRANSPARENT = 0x00000000;
const ROTATE_DEGREES = 90;
const SHADOW_OPACITY = 0.5;
const SHADOW_BLUR = 5;

type CanvasBackground = string | number

export function resolveCanvasBackground (
	iconDef: IconSize & NormalizedIcons,
	options: Pick<ResolvedOptions, 'background'>,
): CanvasBackground {
	const background = iconDef.background;
	if (background === true) {
		return options.background || '#ffffff';
	}
	if (typeof background === 'string') {
		return background;
	}
	if (iconDef.transparent === false) {
		return options.background || '#ffffff';
	}
	return TRANSPARENT;
}

/** Resize, pad, and encode one PNG plane for an icon definition. */
export async function generateIcon (
	iconDef: IconSize & NormalizedIcons,
	img: Jimp,
	options: Pick<ResolvedOptions, 'background' | 'pixel_art'>,
): Promise<Buffer> {
	const width = (iconDef as PngIcons).width;
	const height = (iconDef as PngIcons).height;
	if (!width || !height) {
		throw new Error(`Invalid icon size for ${iconDef.name || 'icon'}`);
	}

	const offsetPercent = iconDef.offset ?? 0;
	const offset = Math.round(Math.max(width, height) * offsetPercent / 100) || 0;
	const innerWidth = Math.max(1, width - offset * 2);
	const innerHeight = Math.max(1, height - offset * 2);
	const pixelArt = options.pixel_art === true;
	const align = Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE;

	const fitted = img.clone();
	if (pixelArt) {
		fitted.contain(innerWidth, innerHeight, align, Jimp.RESIZE_NEAREST_NEIGHBOR);
	} else {
		fitted.contain(innerWidth, innerHeight, align);
	}

	const canvas = await Jimp.create(width, height, resolveCanvasBackground(iconDef, options));
	canvas.composite(fitted, offset, offset);

	if (iconDef.rotate) {
		canvas.rotate(ROTATE_DEGREES);
	}
	if (iconDef.overlayShadow) {
		canvas.shadow({
			opacity: SHADOW_OPACITY,
			blur: SHADOW_BLUR,
		});
	}

	return canvas.getBufferAsync(Jimp.MIME_PNG);
}
