import { create } from 'xmlbuilder2';
import { defaultOptions } from './defaults.js';
import { IconsMap, ManifestDef, PngIcons } from './types.js';
import { getPngArea, isPngIcon, uResolve } from './utils.js';


export const getManifestDefaults = (options: typeof defaultOptions, iconsMap: IconsMap): ManifestDef[] => [
	{
		platform: 'favicons',
		filetype: 'json',
		filename: 'manifest.json',
		data: {
			'name': options.appName || 'Favigen',
			'short_name': options.appShortName || 'Favigen',
			'description': options.appDescription || 'Favigen',
			'dir': options.dir || 'auto',
			'lang': options.lang || 'en-US',
			'display': options.display || 'standalone',
			'orientation': options.orientation || 'portrait',
			'scope': options.scope || '/',
			'start_url': options.start_url || './?utm_source=web_app_manifest',
			'background_color': options.background || '#FFF',
			'theme_color': options.theme_color || '#FFF',
			'icons': Array.from(iconsMap.entries())
				.filter(([_k,v]) => isPngIcon(v,'favicons'))
				.map(([k,v]) => ({
					'src': uResolve(k,v.path),
					'sizes': (<PngIcons>v).height + 'x' + (<PngIcons>v).width,
					'type': 'image/png',
				})),
		},
	},
	{
		platform: 'firefox',
		filetype: 'json',
		filename: 'manifest.webapp',
		data: {
			'version': '1.0',
			'name': options.appName,
			'description': options.appDescription,
			'icons': Array.from(iconsMap.entries())
				.filter(([_k,v]) => isPngIcon(v,'firefox') && v.width === v.height)
				.map(([k,v]) => ({
					key:(<PngIcons>v).width,
					value: uResolve(k,v.path),
				}))
				.reduce((acc,v) => ({...acc,[v.key]:v.value}),{}),
			'developer': {
				'name': options.developerName,
				'url': options.developerURL,
			},
		},
	},
	{
		platform: 'windows',
		filetype: 'xml',
		filename: 'browserconfig.xml',
		data: {
			'browserconfig': [
				{
					'msapplication': [
						{
							'tile': [
								...Array.from(iconsMap.entries())
									.filter(([_k,v]) => isPngIcon(v,'windows'))
									.map(([k,v]) => ({
										[`square${(<PngIcons>v).height}x${(<PngIcons>v).width}logo`]:{
											'@': { 'src': uResolve(k,v.path) },
										},
									})),
								{ 'TileColor':{ '#': options.background || '#FFF'} },
							],
						},
					],
				},
			],
		},
	},
	{
		platform: 'yandex',
		filetype: 'json',
		filename: 'yandex-browser-manifest.json',
		data: {
			'version': 1,
			'api_version': 1,
			'layout': {
				'logo': Array.from(iconsMap.entries())
					.filter(([_k,v]) => isPngIcon(v,'yandex'))
					.sort((a,b) => getPngArea(b) - getPngArea(a))
					.map(([k,v],i) => i === 0 ? uResolve(k,v.path) : undefined )
					?.[0],
				'color': options.background || '#FFF',
				'show_title': true,
			},
		},
	},
];

const manifestStringify: Record<ManifestDef['filetype'],(manifest: ManifestDef) => string> = {
	'json': (manifest) => JSON.stringify(manifest.data,null,2),
	'xml': (manifest) => create(manifest.data).toString({ prettyPrint: true }),
};

export function stringifyManifest (manifest: ManifestDef): string {
	return manifestStringify[manifest.filetype](manifest);
}
