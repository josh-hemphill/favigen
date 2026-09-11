import { URL } from 'url';
import subslate from 'subslate';
import { IconPlatforms, IconSize } from './defaults.js';
import { HtmlTag, IcoIcons, NormalizedIcons, PngIcons } from './types.js';

export function uResolve (from: string, to: string): string {
	const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
	if (resolvedUrl.protocol === 'resolve:') {
		const { pathname, search, hash } = resolvedUrl;
		return pathname + search + hash;
	}
	return resolvedUrl.toString();
}

export function relativeTo (base: string | undefined | null, path: string): string {
	if (!base) {
		return path;
	}
	const directory = base.endsWith('/') ? base : `${base}/`;
	return uResolve(directory, path);
}

export const isPngIcon = (v: NormalizedIcons, platform: IconPlatforms): v is PngIcons =>
	v.platform === platform &&
	v.type === 'png' &&
	!!v.height && !!v.width;

export const getPngArea = ([_k, v]: [unknown, NormalizedIcons]): number =>
	(<PngIcons>v).height * (<PngIcons>v).width;

export const isIcoIcon = (v: NormalizedIcons, platform: IconPlatforms): v is IcoIcons =>
	v.platform === platform &&
	v.type === 'ico' &&
	!!v.sizes?.length;

export function interpolateName (template: string, data: Record<string, unknown>): string {
	return subslate(template, data, { startStopPairs: ['{{', '}}'] });
}

export function publicUrl (
	name: string,
	path: string | undefined | null,
	href: string | undefined,
	cacheBustingQueryParam: string | null,
): string {
	const resolved = href || relativeTo(path, name);
	return cacheBusting(resolved, cacheBustingQueryParam);
}

export function iconPublicUrl (
	icon: Pick<NormalizedIcons, 'name' | 'path' | 'href'>,
	path: string | undefined | null,
	cacheBustingQueryParam: string | null,
): string {
	return publicUrl(icon.name, icon.path || path, icon.href, cacheBustingQueryParam);
}

export function cacheBusting (path: string, cacheBustingQueryParam: string | null): string {
	if (typeof cacheBustingQueryParam !== 'string') {
		return path;
	}
	const paramParts = cacheBustingQueryParam.split('=');
	if (paramParts.length === 1) {
		return path;
	}
	const url = new URL(path, 'https://cache.busting');
	url.searchParams.set(paramParts[0], paramParts.slice(1).join('='));
	return url.origin === 'https://cache.busting'
		? url.pathname + url.search
		: url.toString();
}

export function escapeAttr (value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;');
}

export function renderHtmlTag (tag: HtmlTag): string {
	const attrs = Object.entries(tag.attrs)
		.filter(([, value]) => value !== undefined && value !== false)
		.map(([key, value]) => (value === true ? key : `${key}="${escapeAttr(String(value))}"`))
		.join(' ');
	return `<${tag.tag}${attrs ? ` ${attrs}` : ''}>`;
}

export function resolveTemplateName (
	templateName: string,
	size: IconSize,
	values: Record<string, unknown>,
): string {
	const template = size.templateNameOverride || (
		size.type === 'ico'
			? '{{platformName}}.{{type}}'
			: templateName
	);
	return interpolateName(template, values);
}

export function isPositiveNum (num: number | null | undefined): num is number {
	return !!num && num > 0;
}
