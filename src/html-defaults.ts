import { fragment } from 'xmlbuilder2';
import { defaultOptions, IconPlatforms } from './defaults.js';
import { HtmlDef, IconsMap, PngIcons } from './types.js';
import { isIcoIcon, isPngIcon, uResolve } from './utils.js';

const MSTILE_PNG_INDEX = 1;

export const getHtmlDefaults = (options: typeof defaultOptions, iconsMap: IconsMap, manifests: Record<IconPlatforms,string>): HtmlDef[] => ([
	{
		platform: 'favicons',
		data: [
			{'meta':{'@':{
				name: 'theme-color',
				content: options.theme_color,
			}}},
			{'meta':{'@':{
				name: 'mobile-web-app-capable',
				content: 'yes',
			}}},
			{'meta':{'@':{
				name: 'application-name',
				content: options.appName,
			}}},
			{'link':{'@':{
				rel: 'shortcut icon',
				href: Array.from(iconsMap.entries())
					.filter(([_k,v]) => isIcoIcon(v,'favicons'))
					.map(([k,v],i) => i === 0 ? uResolve(k,v.path) : undefined )
					?.[0],
			}}},
			{'link':{'@':{
				rel: 'manifest',
				href: manifests['favicons'],
			}}},
			...Array.from(iconsMap.entries())
				.filter(([_k,v]) => isPngIcon(v,'favicons'))
				.map(([k,v]) => ({'link':{'@':{
					rel: 'icon',
					type: 'image/' + v.type,
					sizes: `${(<PngIcons>v).height}x${(<PngIcons>v).width}`,
					href: uResolve(k,v.path),
				}}})),
		],
	},
	{
		platform: 'coast',
		data: [
			{'link':{'@': Array.from(iconsMap.entries())
				.filter(([_k,v]) => isIcoIcon(v,'favicons'))
				.map(([k,v],i) => i === 0 ? {
					rel: 'icon',
					type:'image/' + v.type,
					sizes: `${(<PngIcons>v).height}x${(<PngIcons>v).width}`,
					href: uResolve(k,v.path),
				} : undefined )
				?.[0],
			}},
		],
	},
	{
		platform: 'yandex',
		data: [
			{'link':{'@':{
				rel: 'yandex-tableau-widget',
				href: manifests['yandex'],
			}}},
		],
	},
	{
		platform: 'windows',
		data: [
			{'meta':{'@':{
				name: 'msapplication-TileColor',
				content: options.theme_color,
			}}},
			{'meta':{'@':{
				name: 'msapplication-TileImage',
				content:  Array.from(iconsMap.entries())
					.filter(([_k,v]) => isPngIcon(v,'windows'))
					.map(([k,v],i) => i === MSTILE_PNG_INDEX ? uResolve(k,v.path) : undefined )
					?.[MSTILE_PNG_INDEX],
			}}},
			{'meta':{'@':{
				name: 'msapplication-config',
				content: manifests['favicons'],
			}}},
		],
	},
	{
		platform: 'appleStartup',
		data: [
			...Array.from(iconsMap.entries())
				.filter(([_k,v]) => isPngIcon(v,'appleIcon'))
				.map(([k,v]) => ({'link':{'@':{
					rel: v.platformName,
					media: v.htmlMediaContent,
					href: uResolve(k,v.path),
				}}})),
		],
	},
	{
		platform: 'appleIcon',
		data: [
			{'meta':{'@':{
				name: 'apple-mobile-web-app-capable',
				content: 'yes',
			}}},
			{'meta':{'@':{
				name: 'apple-mobile-web-app-status-bar-style',
				content: options.appleStatusBarStyle,
			}}},
			{'meta':{'@':{
				name: 'apple-mobile-web-app-title',
				content: options.appName,
			}}},
			...Array.from(iconsMap.entries())
				.filter(([_k,v]) => isPngIcon(v,'appleIcon'))
				.map(([k,v]) => ({'link':{'@':{
					rel: v.platformName,
					type: 'image/' + v.type,
					sizes: `${(<PngIcons>v).height}x${(<PngIcons>v).width}`,
					href: uResolve(k,v.path),
				}}})),
		],
	},
]);

export function toHtmlItem (obj: Record<string,unknown>): string {
	return fragment(obj).toString({ prettyPrint: true });
}
