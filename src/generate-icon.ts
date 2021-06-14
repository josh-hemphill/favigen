import Jimp from 'jimp/*';
import { IconSize } from './defaults.js';
import { NormalizedIcons } from './types.js';

export async function generateIcon (iconDef: IconSize & NormalizedIcons, img: Jimp): Promise<Buffer> {
	if (iconDef.overlayShadow) img.shadow({
		opacity: 0.5,
		blur: 5,
	});
	return img.getBufferAsync(Jimp.MIME_PNG);
}
