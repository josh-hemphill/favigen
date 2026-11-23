import { create } from 'xmlbuilder2';
import { ResolvedOptions } from './defaults.js';
import { IconsMap, ManifestDef, ManifestResult, PngIcons } from './types.js';
import { getPngArea, isPngIcon, publicUrl } from './utils.js';

type ManifestOptionKey =
	| 'appName'
	| 'appShortName'
	| 'appDescription'
	| 'dir'
	| 'lang'
	| 'display'
	| 'orientation'
	| 'scope'
	| 'start_url'
	| 'background'
	| 'theme_color'
	| 'path'
	| 'manifestRelativePaths'
	| 'cacheBustingQueryParam'
	| 'developerName'
	| 'developerURL'
	| 'version'
	| 'preferRelatedApplications'
	| 'relatedApplications'
	| 'files'
type Options = Pick<ResolvedOptions, ManifestOptionKey>

function pngHref (icon: PngIcons, options: Options): string {
	if (icon.href) {
		return publicUrl(icon.name, null, icon.href, options.cacheBustingQueryParam);
	}
	const basePath = options.manifestRelativePaths ? null : (icon.path || options.path);
	return publicUrl(icon.name, basePath, undefined, options.cacheBustingQueryParam);
}

function pngIconsFor (iconsMap: IconsMap, platform: PngIcons['platform']): [string, PngIcons][] {
	return Array.from(iconsMap.entries()).filter(
		(entry): entry is [string, PngIcons] => isPngIcon(entry[1], platform),
	);
}

/** Build platform manifests from the current icon map and public paths. */
export function getManifestDefaults (options: Options, iconsMap: IconsMap): ManifestDef[] {
	const manifests: ManifestDef[] = [];
	const androidIcons = pngIconsFor(iconsMap, 'android');
	const firefoxIcons = pngIconsFor(iconsMap, 'firefox');
	const windowsIcons = pngIconsFor(iconsMap, 'windows');
	const yandexIcons = pngIconsFor(iconsMap, 'yandex');

	if (androidIcons.length) {
		const properties: Record<string, unknown> = {
			name: options.appName || undefined,
			short_name: options.appShortName || options.appName || undefined,
			description: options.appDescription || undefined,
			dir: options.dir || 'auto',
			lang: options.lang || 'en-US',
			display: options.display || 'standalone',
			orientation: options.orientation || 'any',
			scope: options.scope || undefined,
			start_url: options.start_url || '/?homescreen=1',
			background_color: options.background || '#fff',
			theme_color: options.theme_color || '#fff',
			icons: androidIcons.map(([, icon]) => ({
				src: pngHref(icon, options),
				sizes: `${icon.width}x${icon.height}`,
				type: 'image/png',
				purpose: 'any',
			})),
		};
		if (options.preferRelatedApplications) {
			properties.prefer_related_applications = true;
		}
		if (Array.isArray(options.relatedApplications) && options.relatedApplications.length > 0) {
			properties.related_applications = options.relatedApplications;
		}
		manifests.push({
			platform: 'android',
			filetype: 'json',
			filename: options.files.android.manifestFileName,
			data: properties,
		});
	}

	if (firefoxIcons.length) {
		manifests.push({
			platform: 'firefox',
			filetype: 'json',
			filename: options.files.firefox.manifestFileName,
			data: {
				version: options.version || '1.0',
				name: options.appName,
				description: options.appDescription,
				icons: firefoxIcons
					.filter(([, icon]) => icon.width === icon.height)
					.map(([, icon]) => ({
						key: icon.width,
						value: pngHref(icon, options),
					}))
					.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {}),
				developer: {
					name: options.developerName,
					url: options.developerURL,
				},
			},
		});
	}

	if (windowsIcons.length) {
		const tile: Record<string, unknown> = {};
		const supportedTiles = [
			{ key: 'square70x70logo', width: 70, height: 70 },
			{ key: 'square150x150logo', width: 150, height: 150 },
			{ key: 'wide310x150logo', width: 310, height: 150 },
			{ key: 'square310x310logo', width: 310, height: 310 },
		];
		for (const supported of supportedTiles) {
			const match = windowsIcons.find(([, icon]) =>
				icon.width === supported.width && icon.height === supported.height,
			);
			if (match) {
				tile[supported.key] = {
					'@src': pngHref(match[1], options),
				};
			}
		}
		tile.TileColor = options.background || '#fff';
		manifests.push({
			platform: 'windows',
			filetype: 'xml',
			filename: options.files.windows.manifestFileName,
			data: {
				browserconfig: {
					msapplication: {
						tile,
					},
				},
			},
		});
	}

	if (yandexIcons.length) {
		const logo = yandexIcons
			.sort((a, b) => getPngArea(b) - getPngArea(a))
			.map(([, icon]) => pngHref(icon, options))[0];
		manifests.push({
			platform: 'yandex',
			filetype: 'json',
			filename: options.files.yandex.manifestFileName,
			data: {
				version: options.version || '1.0',
				api_version: 1,
				layout: {
					logo,
					color: options.background || '#fff',
					show_title: true,
				},
			},
		});
	}

	return manifests;
}

const manifestStringify: Record<ManifestDef['filetype'], (manifest: ManifestDef) => string> = {
	json: (manifest) => JSON.stringify(manifest.data, null, 2),
	xml: (manifest) => create(manifest.data).toString({ prettyPrint: true }),
};

export function stringifyManifest (manifest: ManifestDef): string {
	return manifestStringify[manifest.filetype](manifest);
}

export function serializeManifests (manifests: ManifestDef[]): ManifestResult[] {
	return manifests.map((manifest) => ({
		name: manifest.filename,
		contents: stringifyManifest(manifest),
	}));
}
