import { IconOptions, IconPlatforms, ImgTypes } from './defaults.js';

export type IconId = `${string}${'-'|'_'}${number}x${number}.${ImgTypes}`
type IconOption = Extract<IconOptions,Record<string,unknown>>
type NormalizedIconProps = {
	path: string;
	platform: IconPlatforms;
	disable?: boolean,
}
export type PngIcons = Omit<IconOption,'sizes'> & NormalizedIconProps & {
	type: 'png';
	height: number;
	width: number;
}
export type IcoIcons = Omit<IconOption,'width'|'height'> & NormalizedIconProps & {
	type: 'ico';
}
export type NormalizedIcons = PngIcons | IcoIcons

export type IconsMap = Map<IconId,NormalizedIcons>

type ValidFileTypes = 'json' | 'xml'

export type ManifestDef = {
	platform: IconPlatforms,
	filetype: ValidFileTypes,
	filename: `${string}.${ValidFileTypes | 'webapp'}`,
	data: Record<string,unknown>
}
export type HtmlDef = {
	platform: IconPlatforms,
	data: Record<number,Record<string,unknown>>
}
