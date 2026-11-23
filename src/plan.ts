import { arch, platform } from 'node:process';
import sharp from 'sharp';
import { digest, sourceData } from './source.js';
import type { PreparedSource, Rectangle } from './source.js';
import { validOutputName } from './utils.js';

export type IconRole = 'favicon' | 'touch' | 'app';
export type IconPurpose = 'any' | 'maskable';
export type IconSize = Readonly<{ width: number; height: number }>;

export interface IconSpec {
	readonly id: string;
	readonly name: string;
	readonly role: IconRole;
	readonly mimeType: 'image/png' | 'image/vnd.microsoft.icon';
	readonly sizes: readonly IconSize[];
	readonly purpose?: IconPurpose;
	readonly sourceId: string;
	readonly recipeKey: string;
}

export interface RenderOptions {
	readonly fit?: 'contain' | 'cover';
	readonly position?: readonly [x: number, y: number];
	readonly crop?: readonly [left: number, top: number, width: number, height: number];
	readonly padding?: number;
	readonly background?: string;
	readonly resample?: 'smooth' | 'nearest';
	readonly trim?: boolean;
}

export interface IconOverride extends RenderOptions {
	readonly source?: PreparedSource;
	readonly name?: string;
}

export interface PlanOptions {
	readonly profile?: 'web' | 'pwa';
	readonly ids?: readonly string[];
	readonly render?: RenderOptions;
	readonly variants?: Partial<Record<IconRole, IconOverride>>;
	readonly targets?: Readonly<Record<string, IconOverride | undefined>>;
}

export interface IconDiagnostic {
	readonly code: 'small-icon-aspect-ratio' | 'raster-upscale';
	readonly sourceId: string;
	readonly targetIds: readonly string[];
	readonly message: string;
}

export interface IconPlan {
	readonly ids: readonly string[];
	readonly icons: readonly IconSpec[];
	readonly diagnostics: readonly IconDiagnostic[];
}

interface Preset {
	id: string;
	name: string;
	role: IconRole;
	sides: number[];
	purpose?: IconPurpose;
	ico?: boolean;
}

const web: Preset[] = [
	{ id: 'favicon.ico', name: 'favicon.ico', role: 'favicon', sides: [16, 32, 48], ico: true },
	{ id: 'favicon.32', name: 'favicon-32.png', role: 'favicon', sides: [32] },
	{ id: 'favicon.48', name: 'favicon-48.png', role: 'favicon', sides: [48] },
	{ id: 'touch.180', name: 'apple-touch-icon.png', role: 'touch', sides: [180] },
];

const app: Preset[] = (['any', 'maskable'] as const).flatMap((purpose) =>
	[192, 512].map((side) => ({
		id: `app.${purpose}.${side}`,
		name: purpose === 'any' ? `icon-${side}.png` : `icon-maskable-${side}.png`,
		role: 'app',
		sides: [side],
		purpose,
	})));

export interface PlaneRecipe {
	width: number;
	height: number;
	input: Rectangle;
	scaledWidth: number;
	scaledHeight: number;
	visible: Rectangle;
	left: number;
	top: number;
	background: string;
	kernel: 'lanczos3' | 'nearest';
}

interface PlannedTarget {
	spec: IconSpec;
	source: PreparedSource;
	planes: { recipe: PlaneRecipe; key: string }[];
}

const planned = new WeakMap<IconPlan, ReadonlyMap<string, PlannedTarget>>();
const backend = [platform, arch, Object.entries(sharp.versions).sort(([a], [b]) => a.localeCompare(b))];

export function getTargets (plan: IconPlan): ReadonlyMap<string, PlannedTarget> {
	const targets = planned.get(plan);
	if (!targets) throw new TypeError('Expected a plan from planIcons()');
	return targets;
}

function inUnitInterval (value: number): boolean {
	return Number.isFinite(value) && value >= 0 && value <= 1;
}

function cropRectangle (source: PreparedSource, options: RenderOptions): Rectangle {
	const data = sourceData(source);
	if (options.trim && source.format === 'svg') throw new Error('Use a crop or viewBox for SVG artwork');
	const bounds = (options.trim && data.alphaBounds) || {
		left: 0, top: 0, width: source.width, height: source.height,
	};
	const [left, top, width, height] = options.crop ?? [0, 0, 1, 1];
	if (![left, top, width, height].every(inUnitInterval)
		|| width === 0 || height === 0 || left + width > 1 || top + height > 1) {
		throw new RangeError('Crop must be [left, top, width, height] within the source rectangle');
	}

	const x0 = bounds.left + left * bounds.width;
	const y0 = bounds.top + top * bounds.height;
	const x1 = bounds.left + (left + width) * bounds.width;
	const y1 = bounds.top + (top + height) * bounds.height;
	if (x1 <= x0 || y1 <= y0) throw new RangeError('Crop is too small to represent at source dimensions');
	return source.format === 'svg'
		? { left: x0, top: y0, width: x1 - x0, height: y1 - y0 }
		: {
			left: Math.floor(x0),
			top: Math.floor(y0),
			width: Math.ceil(x1) - Math.floor(x0),
			height: Math.ceil(y1) - Math.floor(y0),
		};
}

function makePlane (input: Rectangle, side: number, target: Preset, options: RenderOptions): PlaneRecipe {
	const maskable = target.purpose === 'maskable';
	const opaque = maskable || target.role === 'touch';
	const fit = options.fit ?? 'contain';
	const position = options.position ?? [0.5, 0.5];
	const padding = options.padding ?? (target.role === 'touch' ? 0.08 : 0);
	const background = (options.background ?? (opaque ? '#ffffff' : 'transparent')).toLowerCase();
	if (fit !== 'contain' && fit !== 'cover') throw new Error(`Unsupported fit for ${target.id}`);
	if (position.length !== 2 || ![position[0], position[1]].every(inUnitInterval)) {
		throw new RangeError('Position must be [x, y] with values between 0 and 1');
	}
	if (!Number.isFinite(padding) || padding < 0 || padding > 0.45) {
		throw new RangeError('Padding must be between 0 and 0.45');
	}
	if (background === 'transparent' ? opaque : !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(background)) {
		throw new Error(`Invalid background for ${target.id}. Use a solid hex color or transparent where allowed`);
	}
	if (maskable && (fit !== 'contain' || position[0] !== 0.5 || position[1] !== 0.5)) {
		throw new Error('Maskable icons require centered contain fit');
	}
	if (options.resample !== undefined && options.resample !== 'nearest' && options.resample !== 'smooth') {
		throw new Error(`Unsupported resampling option for ${target.id}`);
	}
	const normalizedBackground = background.length === 4
		? '#' + Array.from(background.slice(1), (hex) => hex.repeat(2)).join('')
		: background;

	const inset = Math.round(side * padding);
	const inner = side - 2 * inset;
	const contain = Math.min(inner / input.width, inner / input.height);
	const scale = fit === 'cover'
		? Math.max(inner / input.width, inner / input.height)
		: Math.min(contain, maskable ? (0.8 * side - Math.SQRT2) / Math.hypot(input.width, input.height) : contain);
	const round = fit === 'cover' ? Math.ceil : Math.floor;
	const scaledWidth = Math.max(1, round(input.width * scale));
	const scaledHeight = Math.max(1, round(input.height * scale));
	if (!Number.isSafeInteger(scaledWidth) || !Number.isSafeInteger(scaledHeight)) {
		throw new RangeError('Crop is too small to scale to the target dimensions');
	}
	const [x, y] = position;
	return {
		width: side,
		height: side,
		input,
		scaledWidth,
		scaledHeight,
		visible: {
			left: Math.floor(Math.max(0, scaledWidth - inner) * x),
			top: Math.floor(Math.max(0, scaledHeight - inner) * y),
			width: Math.min(scaledWidth, inner),
			height: Math.min(scaledHeight, inner),
		},
		left: inset + Math.floor(Math.max(0, inner - scaledWidth) * x),
		top: inset + Math.floor(Math.max(0, inner - scaledHeight) * y),
		background: normalizedBackground,
		kernel: options.resample === 'nearest' ? 'nearest' : 'lanczos3',
	};
}

/** Plan browser and app icons without resizing or encoding any pixels. */
export function planIcons (source: PreparedSource, options: PlanOptions = {}): IconPlan {
	sourceData(source);
	const profile = options.profile ?? 'web';
	if (profile !== 'web' && profile !== 'pwa') throw new Error(`Unknown icon profile: ${profile}`);

	const presets = profile === 'pwa' ? [...web, ...app] : web;
	const byId = new Map(presets.map((target) => [target.id, target]));
	const ids = options.ids ?? presets.map((target) => target.id);
	const targets = new Map<string, PlannedTarget>();
	const names = new Set<string>();
	const warnings = new Map<string, IconDiagnostic>();
	for (const id of Object.keys(options.targets ?? {})) {
		if (!byId.has(id)) throw new Error(`Unknown icon override: ${id}`);
	}
	for (const id of ids) {
		const preset = byId.get(id);
		if (!preset || targets.has(id)) throw new Error(`Unknown or duplicate icon ID: ${id}`);
		const override = { ...options.render, ...options.variants?.[preset.role], ...options.targets?.[id] };
		const artwork = override.source ?? source;
		const name = override.name ?? preset.name;
		const nameKey = name.toLowerCase();
		if (!validOutputName(name) || names.has(nameKey) || !nameKey.endsWith(preset.ico ? '.ico' : '.png')) {
			throw new Error(`Invalid or duplicate output name for ${id}: ${name}`);
		}
		names.add(nameKey);
		const input = cropRectangle(artwork, override);
		const planes = preset.sides.map((side) => {
			const recipe = makePlane(input, side, preset, override);
			return { recipe, key: digest(JSON.stringify(['favigen-png-2', backend, artwork.id, recipe])) };
		});
		const sizes = Object.freeze(preset.sides.map((side) => Object.freeze({ width: side, height: side })));
		const spec: IconSpec = Object.freeze({
			id, name, role: preset.role, purpose: preset.purpose, sizes,
			mimeType: preset.ico ? 'image/vnd.microsoft.icon' : 'image/png',
			sourceId: artwork.id,
			recipeKey: preset.ico ? digest(JSON.stringify(['favigen-ico-1', planes.map((plane) => plane.key)])) : planes[0].key,
		});
		targets.set(id, { spec, source: artwork, planes });

		const warningsForTarget: Array<[IconDiagnostic['code'], string]> = [];
		if (preset.role === 'favicon' && Math.max(input.width / input.height, input.height / input.width) > 3) {
			warningsForTarget.push(['small-icon-aspect-ratio', 'This artwork may be hard to read at favicon size. Try a role-specific crop or a square mark.']);
		}
		if (artwork.format !== 'svg' && preset.role !== 'favicon'
			&& planes.some(({ recipe }) => recipe.scaledWidth > input.width || recipe.scaledHeight > input.height)) {
			warningsForTarget.push(['raster-upscale', 'The raster source is smaller than its rendered artwork. Use a larger raster image or SVG for sharper icons.']);
		}
		for (const [code, message] of warningsForTarget) {
			const key = `${code}:${artwork.id}`;
			const existing = warnings.get(key);
			warnings.set(key, { code, sourceId: artwork.id, targetIds: [...existing?.targetIds ?? [], id], message });
		}
	}
	const plan = Object.freeze({
		ids: Object.freeze([...targets.keys()]),
		icons: Object.freeze([...targets.values()].map((target) => target.spec)),
		diagnostics: Object.freeze([...warnings.values()].map((warning) => Object.freeze({
			...warning, targetIds: Object.freeze([...warning.targetIds]),
		}))),
	});
	planned.set(plan, targets);
	return plan;
}
