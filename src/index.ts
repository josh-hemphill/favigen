import Jimp from 'jimp/*';
import subslate from 'subslate';
import { defaultIconOptions, defaultOptions, IconOptions, iconPlatforms, defaultIconSize, IconSize } from './defaults.js';
import { toHtmlItem } from './html-defaults.js';
import { platformDefaults } from './platform-defaults.js';
import { IconsMap, IconId, NormalizedIcons } from './types.js';
import { uResolve } from './utils.js';
import toIco from 'to-ico';
import { generateIcon } from './generate-icon.js';
import { stringifyManifest } from './manifests-defaults.js';

export const config = platformDefaults;

type Image = Jimp
type IconOption = Exclude<IconOptions,boolean>
type IconResult = { name: string, contents: Buffer }

type ManifestResult = { name: string, contents: string }

type AlterImgHook = (img: Jimp, def: IconSize & NormalizedIcons, runBuiltinTransforms: () => void) => void
type AfterCreateHook = (icon: IconResult, iconDef: NormalizedIcons) => void

type IconsReturnType = Promise<IconResult[]>
type ManifestReturnType = Promise<ManifestResult[]>
type HtmlReturnType = Promise<string[]>

const resolveAll = async <T>(arr: (T | Promise<T>)[]) => Promise.all(arr);
const isPositiveNum = (num: number | null): num is number => !!num && num > 0 ;
const iconOptionHWisNum = (opt: IconOption): opt is IconOption & {
	height: number;
	width: number;
} => isPositiveNum(opt?.height) && isPositiveNum(opt?.width);

export class Favigen {
	iconsMap: IconsMap;
	options: Omit<typeof defaultOptions,'icons'> & {icons:undefined};
	source: Image | Promise<Image> | undefined;

	constructor (source: string | ArrayBuffer | Buffer, options?: Partial<typeof defaultOptions>) {
		this.iconsMap = new Map();
		this.options = {...options,...defaultOptions,icons:undefined};

		if (source) {
			if (typeof source === 'string') {
				this.source = Jimp.read(uResolve(process.cwd(),source));
			} else if (source instanceof Buffer) {
				this.source = Jimp.read(source);
			} else if (source instanceof ArrayBuffer) {
				this.source = Jimp.read(Buffer.from(source));
			}
		}

		for (const platformName of iconPlatforms) {
			const uIconOption = options?.icons?.[platformName];
			let icnO = {...defaultIconOptions, ...(platformDefaults?.[platformName] || {})};
			if (uIconOption === false) {
				continue;
			} else if (typeof uIconOption === 'object') {
				icnO = {...icnO, ...uIconOption};
			}
			if (icnO?.sizes?.length) {
				const ico: IconSize[] = [];
				for (const size of icnO.sizes) {
					const lSize = {...defaultIconSize, ...size};
					if (lSize.disable) continue;
					const iconFileName = <IconId>subslate(
						icnO.templateName,
						{...icnO, ...lSize},
						{startStopPairs: ['{{','}}']},
					);
					if (lSize.type === 'ico') {
						ico.push(lSize);
					} else if (lSize.type === 'png') {
						this.iconsMap.set(iconFileName,{
							...icnO,
							type: lSize.type,
							height: lSize.height,
							width: lSize.width,
							path: '',
							platform: platformName,
						});
					}
				}
				if (ico.length) {
					const lIconOpts = {...icnO,sizes: ico,type: 'ico' as const};
					const iconFileName = <IconId>subslate(
						icnO.templateName,
						lIconOpts,
						{startStopPairs: ['{{','}}']},
					);
					this.iconsMap.set(iconFileName,{
						...lIconOpts,
						path: '',
						platform: platformName,
					});
				}
			}
			if (iconOptionHWisNum(icnO)) {
				const iconFileName = <IconId>subslate(
					icnO.templateName,
					{...icnO, type: 'png'},
					{startStopPairs: ['{{','}}']},
				);
				this.iconsMap.set(iconFileName,{
					...icnO,
					type: 'png',
					path: '',
					platform: platformName,
				});
			}
		}
	}

	transformIcons (cb: (iconId: IconId, iconDef: NormalizedIcons) => void): void {
		for (const [fileName,icon] of this.iconsMap.entries()) {
			cb(fileName,icon);
			if (icon.disable) {
				this.iconsMap.delete(fileName);
			}
		}
	}

	async getIcons (afterCreate: AfterCreateHook, alterImg?: AlterImgHook): Promise<void>
	async getIcons (): Promise<IconResult[]>
	async getIcons (afterCreate?: AfterCreateHook, alterImg?: AlterImgHook): Promise<void | IconResult[]> {
		const iconResults: IconResult[] = [];
		if (this.source) {
			const source = await this.source;
			for (const [fileName,iconDef] of this.iconsMap.entries()) {
				const sizes: ( IconSize & NormalizedIcons )[] = [];

				if (iconDef.type === 'ico' && iconDef?.sizes?.length)
					sizes.push(...iconDef.sizes
						.filter((v): v is (IconSize & {height: number, width: number}) => !!v.width && !!v.height && v.width * v.height > 0)
						.map((v) => ({...iconDef,...v})));

				if (iconDef.type === 'png') sizes.push(iconDef);

				const sizedImgs: Promise<Buffer>[] = [];

				for (const size of sizes) {
					const iconImg = source.clone();
					const transformImg = () => {
						sizedImgs.push(generateIcon(size,iconImg));
					};

					if (alterImg) {
						alterImg(iconImg,size,transformImg);
					} else {
						transformImg();
					}
				}

				const resSizedImgs = await resolveAll(sizedImgs);

				let finalIconImg: Buffer;

				if (resSizedImgs.length === 1) {
					finalIconImg = resSizedImgs[0];
				} else if (resSizedImgs.length > 1) {
					finalIconImg = await toIco(resSizedImgs);
				} else {
					continue;
				}

				if (afterCreate) {
					afterCreate({
						name: fileName,
						contents: finalIconImg,
					},iconDef);
				} else {
					const iconResult = {
						name: fileName,
						contents: finalIconImg,
					};
					Object.defineProperty(iconResult,'iconDef',{
						value: iconDef,
					});
					iconResults.push(iconResult);
				}
			}
		}
		if (iconResults.length) return iconResults;
	}
	get images (): IconsReturnType {
		return this.getIcons();
	}

	async getManifests (cb: () => ManifestResult[]): ManifestReturnType {
		stringifyManifest({
			platform: 'android',
			'data': {},
			'filename': 'hi.json' as const,
			'filetype': 'json',
		});
		return cb();
	}
	get files (): ManifestReturnType {
		return this.getManifests(() => [{
			name: 'hi',
			contents: 'hi',
		}]);
	}

	async getHtml (cb: () => string[]): HtmlReturnType {
		return cb();
	}
	get html (): HtmlReturnType {
		toHtmlItem({});
		return this.getHtml(() => ['hi']);
	}
}
