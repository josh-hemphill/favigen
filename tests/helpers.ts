import { Jimp, JimpMime } from 'jimp';
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
	const img = new Jimp({ width: size, height: size, color: 0x2266CCFF });
	const innerSide = Math.floor(size * 0.6);
	const inner = new Jimp({ width: innerSide, height: innerSide, color: 0xFFFFFFFF });
	img.composite(inner, Math.floor(size * 0.2), Math.floor(size * 0.2));
	return img.getBuffer(JimpMime.png);
}

export async function readPngSize (contents: Buffer): Promise<{ width: number; height: number }> {
	const img = await Jimp.read(contents);
	return { width: img.width, height: img.height };
}

export function icoImageCount (contents: Buffer): number {
	return contents.readUInt16LE(4);
}
