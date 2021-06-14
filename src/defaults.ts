type NString = string | null

export type Display = 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser'
export type Orientation = 'any' | 'natural' | 'portrait' | 'landscape'
export type AppleStatusBarStyle = 'black-translucent' | 'default' | 'black'
export type IconOptions = typeof defaultIconOptions | boolean

type URL = null | `https://${string}`

export const iconPlatforms = [
	'android',
	'appleIcon',
	'appleStartup',
	'coast',
	'favicons',
	'firefox',
	'windows',
	'yandex',
] as const;
export type IconPlatforms = typeof iconPlatforms[number]

export const defaultOptions = {
	path: '/',
	appName: <NString> null,
	appShortName: <NString> null,
	appDescription: <NString> null,
	developerName: <NString> null,
	developerURL: <URL> null,
	dir: 'auto',
	lang: 'en-US',
	background: '#fff',
	theme_color: '#fff',
	appleStatusBarStyle: <AppleStatusBarStyle> 'black-translucent',
	display: <Display> 'standalone',
	orientation: <Orientation> 'any',
	scope: <URL | URL[]> '',
	start_url: '/?homescreen=1',
	version: '1.0',
	logging: false,
	pixel_art: false,
	loadManifestWithCredentials: false,
	manifestRelativePaths: false,
	icons: <Record<IconPlatforms,IconOptions>> {
		android: true,
		appleIcon: true,
		appleStartup: true,
		coast: true,
		favicons: true,
		firefox: true,
		windows: true,
		yandex: true,
	},
};

export type ImgTypes = 'ico' | 'png'
export const defaultIconSize = {
	type: <ImgTypes> 'png',
	templateNameOverride: '',
	width: 0,
	height: 0,
	transparent: <boolean | undefined>undefined,
	rotate: <boolean | undefined>undefined,
	mask: <boolean | undefined>undefined,
	htmlMediaContent: <string | undefined>undefined,
	disable: false,
};
export type IconSize = Partial<typeof defaultIconSize>

export const defaultIconOptions = {
	templateName: '{{platformName}}{{nameSeparator}}{{height}}x{{width}}.{{type}}',
	platformName: 'favicon',
	nameSeparator: '-',
	sizes: <IconSize[]> [
		defaultIconSize,
	],
	height: <null | number> null,
	width: <null | number> null,
	htmlMediaContent: <string | undefined>undefined,
	transparent: <boolean | undefined>true,
	/** true - force, e.g. set background for Android icons */
	background: false,
	offset: 0,
	rotate: <boolean | undefined>false,
	/** apply mask in order to create circle icon (applied by default for firefox). */
	mask: <boolean | undefined>false,
	/** apply glow effect after mask has been applied (applied by default for firefox). */
	overlayGlow: <boolean | undefined>true,
	/** apply drop shadow after mask has been applied */
	overlayShadow: <boolean | undefined>false,
};
