import { IconOptions, IconPlatforms, IconSize } from './defaults.js';

export type IconId = string

type IconOption = Extract<IconOptions, Record<string, unknown>>

type NormalizedIconProps = {
	name: string;
	path: string;
	platform: IconPlatforms;
	href?: string;
	disable?: boolean;
}

export type PngIcons = Omit<IconOption, 'sizes'> & NormalizedIconProps & {
	type: 'png';
	height: number;
	width: number;
}

export type IcoIcons = Omit<IconOption, 'width' | 'height'> & NormalizedIconProps & {
	type: 'ico';
	sizes: IconSize[];
}

export type NormalizedIcons = PngIcons | IcoIcons

export type IconsMap = Map<IconId, NormalizedIcons>

export type ManifestDef = {
	platform: IconPlatforms;
	filetype: 'json' | 'xml';
	filename: string;
	data: Record<string, unknown>;
}

export type HtmlTag = {
	tag: string;
	attrs: Record<string, string | boolean | undefined>;
	platform: IconPlatforms;
}

export type IconResult = {
	name: string;
	contents: Buffer;
}

export type ManifestResult = {
	name: string;
	contents: string;
}

export type FavigenResponse = {
	images: IconResult[];
	files: ManifestResult[];
	html: string[];
	htmlTags: HtmlTag[];
}

export type NamedIconChoice = string | {
	name: string;
	background?: string | boolean;
	offset?: number;
	sizes?: IconSize[];
	transparent?: boolean;
	rotate?: boolean;
}

export type PlatformIconChoice =
	| boolean
	| (Partial<IconOption> & { sizes?: IconSize[] })
	| NamedIconChoice[]
