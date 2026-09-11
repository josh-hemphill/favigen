import { IconPlatforms, ResolvedOptions } from './defaults.js';
import { HtmlTag, IconsMap } from './types.js';
import { iconPublicUrl, isIcoIcon, isPngIcon } from './utils.js';

type HtmlOptionKey =
	| 'theme_color'
	| 'background'
	| 'appName'
	| 'appShortName'
	| 'appleStatusBarStyle'
	| 'loadManifestWithCredentials'
	| 'path'
	| 'cacheBustingQueryParam'
	| 'files'
type Options = Pick<ResolvedOptions, HtmlOptionKey>

function iconHref (
	icon: { name: string; path: string; href?: string },
	options: Options,
): string {
	return iconPublicUrl(icon, options.path, options.cacheBustingQueryParam);
}

function manifestHref (filename: string, options: Options): string {
	return iconPublicUrl(
		{ name: filename, path: options.path },
		options.path,
		options.cacheBustingQueryParam,
	);
}

/** Build HTML tags from the current icon map and public paths. */
export function getHtmlDefaults (
	options: Options,
	iconsMap: IconsMap,
	enabledPlatforms: ReadonlySet<IconPlatforms>,
): HtmlTag[] {
	const tags: HtmlTag[] = [];

	if (enabledPlatforms.has('favicons')) {
		for (const [, icon] of iconsMap) {
			if (isIcoIcon(icon, 'favicons')) {
				tags.push({
					platform: 'favicons',
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/x-icon',
						href: iconHref(icon, options),
					},
				});
			} else if (isPngIcon(icon, 'favicons')) {
				tags.push({
					platform: 'favicons',
					tag: 'link',
					attrs: {
						rel: 'icon',
						type: 'image/png',
						sizes: `${icon.width}x${icon.height}`,
						href: iconHref(icon, options),
					},
				});
			}
		}
	}

	if (enabledPlatforms.has('android')) {
		tags.push(
			{
				platform: 'android',
				tag: 'link',
				attrs: {
					rel: 'manifest',
					href: manifestHref(options.files.android.manifestFileName, options),
					crossorigin: options.loadManifestWithCredentials ? 'use-credentials' : undefined,
				},
			},
			{
				platform: 'android',
				tag: 'meta',
				attrs: {
					name: 'mobile-web-app-capable',
					content: 'yes',
				},
			},
			{
				platform: 'android',
				tag: 'meta',
				attrs: {
					name: 'theme-color',
					content: options.theme_color || options.background,
				},
			},
			{
				platform: 'android',
				tag: 'meta',
				attrs: {
					name: 'application-name',
					content: options.appName || undefined,
				},
			},
		);
	}

	if (enabledPlatforms.has('appleIcon')) {
		for (const [, icon] of iconsMap) {
			if (!isPngIcon(icon, 'appleIcon')) continue;
			if (!/\d/.test(icon.name)) continue;
			tags.push({
				platform: 'appleIcon',
				tag: 'link',
				attrs: {
					rel: 'apple-touch-icon',
					sizes: `${icon.width}x${icon.height}`,
					href: iconHref(icon, options),
				},
			});
		}
		const appleTitle = options.appShortName || options.appName;
		tags.push(
			{
				platform: 'appleIcon',
				tag: 'meta',
				attrs: {
					name: 'apple-mobile-web-app-capable',
					content: 'yes',
				},
			},
			{
				platform: 'appleIcon',
				tag: 'meta',
				attrs: {
					name: 'apple-mobile-web-app-status-bar-style',
					content: options.appleStatusBarStyle,
				},
			},
			{
				platform: 'appleIcon',
				tag: 'meta',
				attrs: {
					name: 'apple-mobile-web-app-title',
					content: appleTitle || undefined,
				},
			},
		);
	}

	if (enabledPlatforms.has('appleStartup')) {
		for (const [, icon] of iconsMap) {
			if (!isPngIcon(icon, 'appleStartup')) continue;
			tags.push({
				platform: 'appleStartup',
				tag: 'link',
				attrs: {
					rel: 'apple-touch-startup-image',
					media: icon.htmlMediaContent,
					href: iconHref(icon, options),
				},
			});
		}
	}

	if (enabledPlatforms.has('coast')) {
		for (const [, icon] of iconsMap) {
			if (!isPngIcon(icon, 'coast')) continue;
			tags.push({
				platform: 'coast',
				tag: 'link',
				attrs: {
					rel: 'icon',
					type: 'image/png',
					sizes: `${icon.width}x${icon.height}`,
					href: iconHref(icon, options),
				},
			});
		}
	}

	if (enabledPlatforms.has('windows')) {
		tags.push({
			platform: 'windows',
			tag: 'meta',
			attrs: {
				name: 'msapplication-TileColor',
				content: options.background,
			},
		});
		const tile = Array.from(iconsMap.values()).find((icon) =>
			isPngIcon(icon, 'windows') && icon.width === 144 && icon.height === 144,
		);
		if (tile) {
			tags.push({
				platform: 'windows',
				tag: 'meta',
				attrs: {
					name: 'msapplication-TileImage',
					content: iconHref(tile, options),
				},
			});
		}
		tags.push({
			platform: 'windows',
			tag: 'meta',
			attrs: {
				name: 'msapplication-config',
				content: manifestHref(options.files.windows.manifestFileName, options),
			},
		});
	}

	if (enabledPlatforms.has('yandex')) {
		tags.push({
			platform: 'yandex',
			tag: 'link',
			attrs: {
				rel: 'yandex-tableau-widget',
				href: manifestHref(options.files.yandex.manifestFileName, options),
			},
		});
	}

	return tags;
}
