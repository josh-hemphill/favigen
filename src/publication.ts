import { posix } from 'node:path';
import { hasControlCharacters, validOutputName } from './utils.js';
import type { RenderedIcon } from './render.js';

export interface IconBinding {
	readonly outputFileName: string;
	readonly url: string;
}

export type PublishedIcon = Readonly<Omit<RenderedIcon, 'bytes'> & IconBinding>;

export interface IconPublication {
	readonly schemaVersion: 1;
	readonly revision?: string;
	readonly icons: readonly PublishedIcon[];
}

const placeholderOrigin = 'https://favigen.invalid/';
const absoluteHttpUrl = /^https?:\/\//i;

function validateUrl (value: string): string {
	if (!value || hasControlCharacters(value) || /[\s\\]/u.test(value) || value.startsWith('//')
		|| (/^[a-z][a-z\d+.-]*:/i.test(value) && !absoluteHttpUrl.test(value))) {
		throw new Error(`Invalid asset URL: ${value}`);
	}
	const url = new URL(value, placeholderOrigin);
	if (url.username || url.password) throw new Error('Asset URLs cannot include credentials');
	return url.href;
}

function unboundUrlKey (value: string): string {
	const resolved = validateUrl(value);
	if (absoluteHttpUrl.test(value)) return `absolute:${resolved}`;
	if (value.startsWith('/')) return `root:${resolved}`;
	// A document-relative reference has no known resolution until the caller supplies a base.
	return `relative:${value}`;
}

/** Bind final names and URLs only to icons from a completed render. */
export function bindIcons (
	rendered: readonly RenderedIcon[],
	bindings: ReadonlyMap<string, IconBinding>,
	revision?: string,
): IconPublication {
	const ids = new Set<string>();
	const names = new Map<string, string>();
	const urls = new Map<string, string>();
	const icons = rendered.map(({ bytes: _bytes, ...icon }) => {
		const binding = bindings.get(icon.id);
		if (!binding || ids.has(icon.id)) throw new Error(`Missing or duplicate icon binding: ${icon.id}`);
		const { outputFileName, url } = binding;
		if (!validOutputName(outputFileName)) throw new Error(`Invalid emitted filename: ${outputFileName}`);
		const href = unboundUrlKey(url);
		const nameKey = outputFileName.toLowerCase();
		if ((names.has(nameKey) && names.get(nameKey) !== icon.digest)
			|| (urls.has(href) && urls.get(href) !== icon.digest)) {
			throw new Error(`Conflicting published icons at ${outputFileName} or ${url}`);
		}
		ids.add(icon.id);
		names.set(nameKey, icon.digest);
		urls.set(href, icon.digest);
		return Object.freeze({ ...icon, outputFileName, url });
	});
	return Object.freeze({ schemaVersion: 1, revision, icons: Object.freeze(icons) });
}

export interface IconLinkTag {
	readonly tag: 'link';
	readonly attrs: Readonly<{
		rel: 'icon' | 'apple-touch-icon';
		href: string;
		type: PublishedIcon['mimeType'];
		sizes: string;
	}>;
}

function iconSizes (icon: PublishedIcon): string {
	return icon.sizes.map(({ width, height }) => `${width}x${height}`).join(' ');
}

/** Create structured browser and touch icon tags without a manifest link. */
export function iconTags (publication: IconPublication): IconLinkTag[] {
	return publication.icons.filter((icon) => icon.role === 'favicon' || icon.role === 'touch').map((icon) => ({
		tag: 'link',
		attrs: {
			rel: icon.role === 'touch' ? 'apple-touch-icon' : 'icon',
			href: icon.url,
			type: icon.mimeType,
			sizes: iconSizes(icon),
		},
	}));
}

export interface ManifestIcon {
	src: string;
	sizes: string;
	type: PublishedIcon['mimeType'];
	purpose: 'any' | 'maskable';
}

export interface ManifestIconOptions {
	/** Absolute URL of the manifest, required for relative URL conversion. */
	readonly manifestUrl?: string;
	readonly urlStyle?: 'bound' | 'relative';
}

function relativeToManifest (icon: URL, manifest: URL): string {
	if (icon.origin !== manifest.origin) return icon.href;
	const difference = posix.relative(new URL('.', manifest).pathname, icon.pathname);
	const relative = difference
		? difference + (icon.pathname.endsWith('/') ? '/' : '')
		: icon.pathname.endsWith('/') ? './' : `../${posix.basename(icon.pathname)}`;
	const prefix = /^[^/]*:/.test(relative) ? './' : '';
	const candidate = `${prefix}${relative}${icon.search}${icon.hash}`;
	return new URL(candidate, manifest).href === icon.href ? candidate : icon.href;
}

/** Return deduplicated app-role manifest entries. Bound URLs are kept as supplied by default. */
export function manifestIcons (publication: IconPublication, options: ManifestIconOptions = {}): ManifestIcon[] {
	const manifest = options.manifestUrl ? new URL(options.manifestUrl) : undefined;
	if (options.urlStyle === 'relative' && !manifest) throw new Error('Relative icon URLs require manifestUrl');
	const entries = new Map<string, ManifestIcon>();
	const urls = new Map<string, string>();
	for (const icon of publication.icons) {
		if (icon.role !== 'app') continue;
		const resolved = manifest && new URL(icon.url, manifest);
		const physical = resolved?.href ?? unboundUrlKey(icon.url);
		if (urls.has(physical) && urls.get(physical) !== icon.digest) {
			throw new Error(`Conflicting published icons at ${physical}`);
		}
		urls.set(physical, icon.digest);

		const src = manifest && resolved && options.urlStyle === 'relative' ? relativeToManifest(resolved, manifest) : icon.url;
		const purpose = icon.purpose ?? 'any';
		const key = JSON.stringify([physical, icon.mimeType, purpose]);
		const previous = entries.get(key);
		const sizes = iconSizes(icon);
		const merged = previous ? [...new Set(`${previous.sizes} ${sizes}`.split(' '))].join(' ') : sizes;
		entries.set(key, { src: previous?.src ?? src, sizes: merged, type: icon.mimeType, purpose });
	}
	return [...entries.values()];
}

export interface BasicManifestOptions extends ManifestIconOptions {
	readonly name: string;
	readonly shortName?: string;
	/** Absolute app deployment base, used for launch defaults and origin validation. */
	readonly appUrl?: string;
	readonly startUrl?: string;
	readonly scope?: string;
	readonly display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
	readonly backgroundColor?: string;
	readonly themeColor?: string;
}

export interface BasicManifest {
	name: string;
	short_name: string;
	start_url: string;
	scope?: string;
	display: NonNullable<BasicManifestOptions['display']>;
	background_color?: string;
	theme_color?: string;
	icons: ManifestIcon[];
}

/** Build an opt-in manifest payload. The caller supplies deployment URLs and owns emission. */
export function buildBasicManifest (publication: IconPublication, options: BasicManifestOptions): BasicManifest {
	if (!options.name.trim()) throw new Error('A basic manifest requires an app name');
	const icons = manifestIcons(publication, options);
	if (!icons.length) throw new Error('A basic manifest requires published app icons');

	const appUrl = options.appUrl ? new URL(options.appUrl) : undefined;
	const start = options.startUrl ?? appUrl?.href ?? './';
	const scope = options.scope ?? appUrl?.href;
	validateUrl(start);
	if (scope) validateUrl(scope);
	const base = options.manifestUrl ?? appUrl?.href
		?? (start.startsWith('/') && scope?.startsWith('/') ? placeholderOrigin : undefined)
		?? (absoluteHttpUrl.test(start) && scope && absoluteHttpUrl.test(scope) ? start : undefined);
	if (base) {
		const launchUrl = new URL(start, base);
		const expectedOrigin = appUrl?.origin ?? new URL(base).origin;
		if (launchUrl.origin !== expectedOrigin || !/^https?:$/.test(launchUrl.protocol)) {
			throw new Error('Manifest start URL must be on the app origin');
		}
		if (scope) {
			const scopeUrl = new URL(scope, base);
			if (scopeUrl.origin !== expectedOrigin || !launchUrl.pathname.startsWith(scopeUrl.pathname)) {
				throw new Error('Manifest scope must be on the app origin and contain its start URL');
			}
		}
	}

	return {
		name: options.name,
		short_name: options.shortName ?? options.name,
		start_url: start,
		scope,
		display: options.display ?? 'standalone',
		background_color: options.backgroundColor,
		theme_color: options.themeColor,
		icons,
	};
}
