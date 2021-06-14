import { URL } from 'url';
import { IconPlatforms } from './defaults.js';
import { IcoIcons, NormalizedIcons, PngIcons } from './types.js';

export function uResolve (from: string, to: string): string {
	const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
	if (resolvedUrl.protocol === 'resolve:') {
		// `from` is a relative URL.
		const { pathname, search, hash } = resolvedUrl;
		return pathname + search + hash;
	}
	return resolvedUrl.toString();
}


export const isPngIcon = (v: NormalizedIcons,platform: IconPlatforms): v is PngIcons =>
	(v.platformName === platform || v.platform === platform) &&
	v.type === 'png' &&
	!!v.height && !!v.width;

export const getPngArea = ([_k,v]: [unknown,NormalizedIcons]): number =>
	(<PngIcons>v).height * (<PngIcons>v).width;

export const isIcoIcon = (v: NormalizedIcons,platform: IconPlatforms): v is IcoIcons =>
	(v.platformName === platform || v.platform === platform) &&
	v.type === 'ico' &&
	!!v.sizes?.length;
