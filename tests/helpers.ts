import Jimp from 'jimp';
import { UserOptions } from '../src/defaults.js';
import { PlatformIconChoice } from '../src/types.js';

export const disabledPlatforms: Record<string, false> = {
	android: false,
	appleIcon: false,
	appleStartup: false,
	coast: false,
	favicons: false,
	firefox: false,
	windows: false,
	yandex: false,
};

export function onlyIcons (icons: Record<string, PlatformIconChoice>): UserOptions {
	return {
		icons: {
			...disabledPlatforms,
			...icons,
		},
	};
}

/** Build a small source PNG so tests do not depend on an external fixture file. */
export async function makeLogoBuffer (size = 64): Promise<Buffer> {
	const img = await Jimp.create(size, size, 0x2266CCFF);
	const inner = await Jimp.create(Math.floor(size * 0.6), Math.floor(size * 0.6), 0xFFFFFFFF);
	img.composite(inner, Math.floor(size * 0.2), Math.floor(size * 0.2));
	return img.getBufferAsync(Jimp.MIME_PNG);
}

export async function readPngSize (contents: Buffer): Promise<{ width: number; height: number }> {
	const img = await Jimp.read(contents);
	return { width: img.getWidth(), height: img.getHeight() };
}

export function icoImageCount (contents: Buffer): number {
	return contents.readUInt16LE(4);
}
