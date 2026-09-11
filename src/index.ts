import { resolve as resolvePath } from 'path';
import Jimp from 'jimp';
import toIco from 'to-ico';
import {
	defaultIconOptions,
	defaultIconSize,
	defaultOptions,
	iconPlatforms,
	IconPlatforms,
	IconSize,
	ResolvedOptions,
	UserOptions,
} from './defaults.js';
import { generateIcon } from './generate-icon.js';
import { getHtmlDefaults } from './html-defaults.js';
import { getManifestDefaults, serializeManifests } from './manifests-defaults.js';
import { platformDefaults } from './platform-defaults.js';
import {
	FavigenResponse,
	HtmlTag,
	IconId,
	IconResult,
	IconsMap,
	IcoIcons,
	ManifestResult,
	NamedIconChoice,
	NormalizedIcons,
	PlatformIconChoice,
	PngIcons,
} from './types.js';
import {
	isPositiveNum,
	renderHtmlTag,
	resolveTemplateName,
} from './utils.js';

export const config = {
	defaults: defaultOptions,
	platforms: platformDefaults,
};

type Image = Jimp
type AfterCreateHook = (icon: IconResult, iconDef: NormalizedIcons) => void
type AlterImgHook = (img: Jimp, def: IconSize & NormalizedIcons, runBuiltinTransforms: () => void) => void
export type FavigenSource = string | Buffer | ArrayBuffer

const resolveAll = async <T>(arr: (T | Promise<T>)[]) => Promise.all(arr);

function choiceNames (choice: PlatformIconChoice): Map<string, NamedIconChoice> | null {
	if (!Array.isArray(choice)) return null;
	return new Map(choice.map((item) => {
		const name = typeof item === 'string' ? item : item.name;
		return [name, item];
	}));
}

function mergeChoiceOverrides (
	base: Record<string, unknown>,
	choice: NamedIconChoice | undefined,
): Record<string, unknown> {
	if (!choice || typeof choice === 'string') return base;
	return {
		...base,
		...Object.fromEntries(Object.entries(choice).filter(([key]) => key !== 'name')),
	};
}

function assertSource (source: unknown): asserts source is FavigenSource {
	if (source === undefined || source === null || source === '') {
		throw new Error('No source provided');
	}
	if (Array.isArray(source)) {
		if (!source.length) {
			throw new Error('No source provided');
		}
		throw new Error('Invalid source type provided');
	}
	if (
		typeof source !== 'string' &&
		!Buffer.isBuffer(source) &&
		!(source instanceof ArrayBuffer)
	) {
		throw new Error('Invalid source type provided');
	}
}

function loadSource (source: FavigenSource): Promise<Image> {
	if (typeof source === 'string') {
		return Jimp.read(resolvePath(process.cwd(), source)).catch((error: unknown) => {
			const err = error as NodeJS.ErrnoException;
			if (err?.code === 'ENOENT') throw error;
			throw new Error('Invalid image buffer');
		});
	}
	const buffer = source instanceof ArrayBuffer ? Buffer.from(source) : source;
	if (!buffer.length) {
		return Promise.reject(new Error('Invalid image buffer'));
	}
	return Jimp.read(buffer).catch(() => {
		throw new Error('Invalid image buffer');
	});
}

function resolveOptions (options: UserOptions = {}): ResolvedOptions {
	return {
		...defaultOptions,
		...options,
		icons: { ...defaultOptions.icons, ...options.icons },
		files: {
			android: { ...defaultOptions.files.android, ...options.files?.android },
			windows: { ...defaultOptions.files.windows, ...options.files?.windows },
			yandex: { ...defaultOptions.files.yandex, ...options.files?.yandex },
			firefox: { ...defaultOptions.files.firefox, ...options.files?.firefox },
		},
		output: { ...defaultOptions.output, ...options.output },
	};
}

function buildIconsMap (options: ResolvedOptions): { iconsMap: IconsMap; enabledPlatforms: Set<IconPlatforms> } {
	const iconsMap: IconsMap = new Map();
	const enabledPlatforms = new Set<IconPlatforms>();

	for (const platformName of iconPlatforms) {
		const uIconOption = options.icons[platformName];
		if (uIconOption === false) continue;
		enabledPlatforms.add(platformName);

		const selectedNames = choiceNames(uIconOption);
		const merged = {
			...defaultIconOptions,
			...(platformDefaults[platformName] || {}),
			...(typeof uIconOption === 'object' && !Array.isArray(uIconOption) ? uIconOption : {}),
		};

		const icoSizes: IconSize[] = [];
		if (merged.sizes?.length) {
			for (const size of merged.sizes) {
				const lSize = { ...defaultIconSize, ...size };
				if (lSize.disable) continue;
				const values = { ...merged, ...lSize };
				const iconFileName = resolveTemplateName(merged.templateName, lSize, values);
				if (selectedNames && !selectedNames.has(iconFileName)) {
					continue;
				}
				const overrides = selectedNames
					? mergeChoiceOverrides({ ...merged, ...lSize }, selectedNames.get(iconFileName))
					: { ...merged, ...lSize };

				if (lSize.type === 'ico') {
					icoSizes.push({ ...lSize, ...overrides });
				} else if (isPositiveNum(lSize.height) && isPositiveNum(lSize.width)) {
					iconsMap.set(iconFileName, {
						...overrides,
						name: iconFileName,
						type: 'png',
						height: lSize.height,
						width: lSize.width,
						path: options.path,
						platform: platformName,
						pixelArt: options.pixel_art,
					} as unknown as PngIcons);
				}
			}
		}

		if (icoSizes.length) {
			const icoOverrides = selectedNames?.get(`${merged.platformName}.ico`);
			if (!selectedNames || icoOverrides) {
				const lIconOpts = mergeChoiceOverrides(
					{ ...merged, sizes: icoSizes, type: 'ico' as const },
					icoOverrides,
				);
				const iconFileName = resolveTemplateName(
					merged.templateName,
					{ type: 'ico', templateNameOverride: '' },
					lIconOpts,
				);
				if (!selectedNames || selectedNames.has(iconFileName)) {
					iconsMap.set(iconFileName, {
						...lIconOpts,
						name: iconFileName,
						type: 'ico',
						sizes: icoSizes,
						path: options.path,
						platform: platformName,
					} as unknown as IcoIcons);
				}
			}
		}

		if (
			!merged.sizes?.some((size) => isPositiveNum(size.height) || isPositiveNum(size.width)) &&
			isPositiveNum(merged.height) &&
			isPositiveNum(merged.width)
		) {
			const iconFileName = resolveTemplateName(
				merged.templateName,
				{ type: 'png' },
				{ ...merged, type: 'png' },
			);
			if (!selectedNames || selectedNames.has(iconFileName)) {
				iconsMap.set(iconFileName, {
					...merged,
					name: iconFileName,
					type: 'png',
					path: options.path,
					platform: platformName,
				} as unknown as PngIcons);
			}
		}
	}

	return { iconsMap, enabledPlatforms };
}

export class Favigen {
	iconsMap: IconsMap;
	options: ResolvedOptions;
	source: Image | Promise<Image> | undefined;
	enabledPlatforms: Set<IconPlatforms>;

	constructor (source: FavigenSource, options: UserOptions = {}) {
		assertSource(source);
		this.options = resolveOptions(options);
		this.source = loadSource(source);
		const built = buildIconsMap(this.options);
		this.iconsMap = built.iconsMap;
		this.enabledPlatforms = built.enabledPlatforms;
	}

	transformIcons (cb: (iconId: IconId, iconDef: NormalizedIcons) => void): this {
		const next: IconsMap = new Map();
		for (const [fileName, icon] of this.iconsMap.entries()) {
			cb(fileName, icon);
			if (icon.disable) continue;
			next.set(icon.name || fileName, icon);
		}
		this.iconsMap = next;
		return this;
	}

	setPublicPath (path: string): this {
		const previous = this.options.path;
		this.options.path = path;
		for (const icon of this.iconsMap.values()) {
			if (!icon.href && (icon.path === previous || icon.path === '')) {
				icon.path = path;
			}
		}
		return this;
	}

	setIconHref (iconId: IconId, href: string): this {
		const icon = this.iconsMap.get(iconId);
		if (!icon) {
			throw new Error(`Unknown icon '${iconId}'`);
		}
		icon.href = href;
		return this;
	}

	async getIcons (afterCreate?: AfterCreateHook, alterImg?: AlterImgHook): Promise<IconResult[]> {
		const iconResults: IconResult[] = [];
		if (!this.source) return iconResults;
		const source = await this.source;

		for (const [fileName, iconDef] of this.iconsMap.entries()) {
			const sizes: (IconSize & NormalizedIcons)[] = [];

			if (iconDef.type === 'ico' && iconDef.sizes?.length) {
				sizes.push(...iconDef.sizes
					.filter((size): size is (IconSize & { height: number; width: number }) =>
						!!size.width && !!size.height && size.width * size.height > 0)
					.map((size) => ({ ...iconDef, ...size })));
			}

			if (iconDef.type === 'png') sizes.push(iconDef);

			const sizedImgs: Promise<Buffer>[] = [];

			for (const size of sizes) {
				const iconImg = source.clone();
				const transformImg = () => {
					sizedImgs.push(generateIcon(size, iconImg, this.options));
				};

				if (alterImg) {
					alterImg(iconImg, size, transformImg);
				} else {
					transformImg();
				}
			}

			const resSizedImgs = await resolveAll(sizedImgs);
			if (!resSizedImgs.length) continue;

			const finalIconImg = resSizedImgs.length === 1
				? resSizedImgs[0]
				: await toIco(resSizedImgs);

			const iconResult: IconResult = {
				name: iconDef.name || fileName,
				contents: finalIconImg,
			};

			if (afterCreate) {
				afterCreate(iconResult, iconDef);
			} else {
				iconResults.push(iconResult);
			}
		}

		return iconResults;
	}

	get images (): Promise<IconResult[]> {
		return this.getIcons();
	}

	getManifests (): ManifestResult[] {
		return serializeManifests(getManifestDefaults(this.options, this.iconsMap));
	}

	get files (): Promise<ManifestResult[]> {
		return Promise.resolve(this.getManifests());
	}

	getHtmlTags (): HtmlTag[] {
		return getHtmlDefaults(this.options, this.iconsMap, this.enabledPlatforms);
	}

	getHtml (): string[] {
		return this.getHtmlTags().map(renderHtmlTag);
	}

	get html (): Promise<string[]> {
		return Promise.resolve(this.getHtml());
	}

	async generate (): Promise<FavigenResponse> {
		const images = this.options.output.images ? await this.getIcons() : [];
		const files = this.options.output.files ? this.getManifests() : [];
		const htmlTags = this.options.output.html ? this.getHtmlTags() : [];
		return {
			images,
			files,
			html: htmlTags.map(renderHtmlTag),
			htmlTags,
		};
	}
}

/** One-shot helper matching the common `{ images, files, html }` integration shape. */
export async function favigen (
	source: FavigenSource,
	options?: UserOptions,
): Promise<FavigenResponse> {
	return new Favigen(source, options).generate();
}

export default favigen;

export type {
	FavigenResponse,
	HtmlTag,
	IconResult,
	ManifestResult,
	NormalizedIcons,
	UserOptions,
};
export type { IconPlatforms } from './defaults.js';
