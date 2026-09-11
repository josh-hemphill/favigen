import { IconPlatforms, IconOptions, IconSize } from './defaults.js';

type AppleScreen = {
	deviceWidth: number;
	deviceHeight: number;
	pixelRatio: number;
}

// https://developer.apple.com/design/human-interface-guidelines/layout
const APPLE_SCREENS: AppleScreen[] = [
	{ deviceWidth: 320, deviceHeight: 568, pixelRatio: 2 },
	{ deviceWidth: 375, deviceHeight: 667, pixelRatio: 2 },
	{ deviceWidth: 375, deviceHeight: 812, pixelRatio: 3 },
	{ deviceWidth: 390, deviceHeight: 844, pixelRatio: 3 },
	{ deviceWidth: 393, deviceHeight: 852, pixelRatio: 3 },
	{ deviceWidth: 414, deviceHeight: 896, pixelRatio: 2 },
	{ deviceWidth: 414, deviceHeight: 896, pixelRatio: 3 },
	{ deviceWidth: 414, deviceHeight: 736, pixelRatio: 3 },
	{ deviceWidth: 428, deviceHeight: 926, pixelRatio: 3 },
	{ deviceWidth: 430, deviceHeight: 932, pixelRatio: 3 },
	{ deviceWidth: 744, deviceHeight: 1133, pixelRatio: 2 },
	{ deviceWidth: 768, deviceHeight: 1024, pixelRatio: 2 },
	{ deviceWidth: 810, deviceHeight: 1080, pixelRatio: 2 },
	{ deviceWidth: 820, deviceHeight: 1080, pixelRatio: 2 },
	{ deviceWidth: 834, deviceHeight: 1194, pixelRatio: 2 },
	{ deviceWidth: 834, deviceHeight: 1112, pixelRatio: 2 },
	{ deviceWidth: 1024, deviceHeight: 1366, pixelRatio: 2 },
];

function appleStartupMedia (
	screen: AppleScreen,
	orientation: 'portrait' | 'landscape',
): string {
	return `(device-width: ${screen.deviceWidth}px) and (device-height: ${screen.deviceHeight}px) and (-webkit-device-pixel-ratio: ${screen.pixelRatio}) and (orientation: ${orientation})`;
}

function appleStartupSizes (): IconSize[] {
	const sizes: IconSize[] = [];
	const seen = new Set<string>();
	for (const screen of APPLE_SCREENS) {
		const pixelWidth = screen.deviceWidth * screen.pixelRatio;
		const pixelHeight = screen.deviceHeight * screen.pixelRatio;
		const portraitKey = `${pixelWidth}x${pixelHeight}`;
		if (!seen.has(portraitKey)) {
			seen.add(portraitKey);
			sizes.push({
				width: pixelWidth,
				height: pixelHeight,
				htmlMediaContent: appleStartupMedia(screen, 'portrait'),
			});
		}
		const landscapeKey = `${pixelHeight}x${pixelWidth}`;
		if (!seen.has(landscapeKey)) {
			seen.add(landscapeKey);
			sizes.push({
				width: pixelHeight,
				height: pixelWidth,
				htmlMediaContent: appleStartupMedia(screen, 'landscape'),
			});
		}
	}
	return sizes;
}

export const platformDefaults = <Record<IconPlatforms, Partial<Exclude<IconOptions, boolean>>>>{
	android: {
		platformName: 'android-chrome',
		sizes: [
			{ width: 36, height: 36 },
			{ width: 48, height: 48 },
			{ width: 72, height: 72 },
			{ width: 96, height: 96 },
			{ width: 144, height: 144 },
			{ width: 192, height: 192 },
			{ width: 256, height: 256 },
			{ width: 384, height: 384 },
			{ width: 512, height: 512 },
		],
	},
	appleIcon: {
		platformName: 'apple-touch-icon',
		nameSeparator: '-',
		transparent: false,
		background: true,
		sizes: [
			{ width: 57, height: 57 },
			{ width: 60, height: 60 },
			{ width: 72, height: 72 },
			{ width: 76, height: 76 },
			{ width: 114, height: 114 },
			{ width: 120, height: 120 },
			{ width: 144, height: 144 },
			{ width: 152, height: 152 },
			{ width: 167, height: 167 },
			{ width: 180, height: 180 },
			{ width: 1024, height: 1024 },
			{
				templateNameOverride: '{{platformName}}.png',
				width: 180,
				height: 180,
			},
			{
				templateNameOverride: '{{platformName}}-precomposed.png',
				width: 180,
				height: 180,
			},
		],
	},
	appleStartup: {
		platformName: 'apple-touch-startup-image',
		nameSeparator: '-',
		transparent: false,
		background: true,
		sizes: appleStartupSizes(),
	},
	coast: {
		platformName: 'coast',
		nameSeparator: '-',
		transparent: false,
		background: true,
		sizes: [
			{ width: 228, height: 228 },
		],
	},
	favicons: {
		platformName: 'favicon',
		nameSeparator: '-',
		sizes: [
			{ width: 16, height: 16 },
			{ width: 32, height: 32 },
			{ width: 48, height: 48 },
			{ width: 16, height: 16, type: 'ico' },
			{ width: 24, height: 24, type: 'ico' },
			{ width: 32, height: 32, type: 'ico' },
			{ width: 48, height: 48, type: 'ico' },
			{ width: 64, height: 64, type: 'ico' },
		],
	},
	firefox: {
		platformName: 'firefox_app',
		nameSeparator: '_',
		transparent: false,
		background: true,
		mask: true,
		overlayGlow: true,
		sizes: [
			{ width: 60, height: 60 },
			{ width: 128, height: 128 },
			{ width: 512, height: 512 },
		],
	},
	windows: {
		platformName: 'mstile',
		nameSeparator: '-',
		sizes: [
			{ width: 70, height: 70 },
			{ width: 144, height: 144 },
			{ width: 150, height: 150 },
			{ width: 310, height: 150 },
			{ width: 310, height: 310 },
		],
	},
	yandex: {
		platformName: 'yandex-browser',
		nameSeparator: '-',
		sizes: [
			{ width: 50, height: 50 },
		],
	},
};
