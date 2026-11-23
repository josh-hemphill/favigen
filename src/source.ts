import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import sharp from 'sharp';
import { imageWork } from './image-work.js';

export const maxPixels = 32_000_000;
const maxSourceBytes = 16 * 1024 * 1024;
const svgNamespace = 'http://www.w3.org/2000/svg';
const svgElements = new Set([
	'svg', 'g', 'defs', 'title', 'desc', 'symbol', 'use',
	'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
	'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
]);

export type IconSource = string | Uint8Array | ArrayBuffer;

export interface PreparedSource {
	readonly id: string;
	readonly format: 'png' | 'svg' | 'jpeg' | 'webp';
	readonly width: number;
	readonly height: number;
	readonly hasAlpha: boolean;
}

export interface Rectangle {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface SourceData {
	bytes: Buffer;
	svg?: string;
	alphaBounds?: Rectangle;
}

const prepared = new WeakMap<PreparedSource, SourceData>();

export function sourceData (source: PreparedSource): SourceData {
	const data = prepared.get(source);
	if (!data) throw new TypeError('Expected a source from prepareSource()');
	return data;
}

export function digest (bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function readSource (input: IconSource): Promise<Buffer> {
	if (typeof input === 'string') {
		const chunks: Buffer[] = [];
		let size = 0;
		for await (const chunk of createReadStream(input)) {
			size += chunk.length;
			if (size > maxSourceBytes) throw new Error('Source exceeds 16 MiB');
			chunks.push(chunk);
		}
		return Buffer.concat(chunks, size);
	}

	const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
	if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected a file path or image bytes');
	if (bytes.byteLength > maxSourceBytes) throw new Error('Source exceeds 16 MiB');
	return Buffer.from(bytes);
}

function parseSvg (xml: string) {
	if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('SVG document types and entities are unsupported');
	const parser = new DOMParser({ onError: (_level, message) => { throw new Error(message) } });
	const doc = parser.parseFromString(xml, 'image/svg+xml');
	for (let child = doc.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === 7 && child.nodeName !== 'xml') {
			throw new Error('SVG processing instructions are unsupported');
		}
	}
	const root = doc.documentElement;
	if (!root || root.localName !== 'svg' || root.namespaceURI !== svgNamespace) {
		throw new Error('Expected an SVG root with the SVG namespace');
	}

	const elements = doc.getElementsByTagName('*');
	if (elements.length > 50_000) throw new Error('SVG exceeds 50,000 elements');
	for (let i = 0; i < elements.length; i++) {
		const element = elements.item(i);
		if (!element) continue;
		if (element.namespaceURI !== svgNamespace || !svgElements.has(element.localName ?? '')) {
			throw new Error(`Unsupported SVG element <${element.tagName}>. Outline text and export a self-contained SVG or PNG`);
		}
		for (let j = 0; j < element.attributes.length; j++) {
			const attr = element.attributes.item(j);
			if (!attr) continue;
			const value = attr.value.trim();
			if (attr.namespaceURI === 'http://www.w3.org/2000/xmlns/') continue;
			if (/^on/i.test(attr.localName ?? attr.name) || attr.name === 'xml:base') {
				throw new Error(`Unsupported SVG attribute ${attr.name}`);
			}
			if (attr.localName === 'href' && !/^#[\w.-]+$/.test(value)) {
				throw new Error('SVG references must point to fragments in the same file');
			}
			// Reject CSS escape and comment forms before inspecting URL functions.
			const withoutLocalUrls = value.replace(/url\(\s*(['"]?)#[\w.-]+\1\s*\)/gi, '');
			if (/url\s*\(|\\|\/\*|@import/i.test(withoutLocalUrls)) {
				throw new Error('SVG styles may only refer to local fragments');
			}
		}
		for (let child = element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType === 7) throw new Error('SVG processing instructions are unsupported');
		}
	}
	return root;
}

async function alphaBounds (bytes: Buffer): Promise<Rectangle> {
	const { data, info } = await sharp(bytes, { limitInputPixels: maxPixels })
		.autoOrient().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	let left = info.width;
	let top = info.height;
	let right = -1;
	let bottom = -1;

	for (let y = 0; y < info.height; y++) {
		for (let x = 0; x < info.width; x++) {
			if (data[(y * info.width + x) * info.channels + info.channels - 1] === 0) continue;
			left = Math.min(left, x);
			top = Math.min(top, y);
			right = Math.max(right, x);
			bottom = y;
		}
	}
	if (bottom < 0) throw new Error('Artwork is fully transparent');
	return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function svgCandidate (bytes: Buffer): boolean {
	let start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
	while (start < bytes.length) {
		const byte = bytes[start];
		if (byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x20) break;
		start++;
	}
	return bytes[start] === 0x3c;
}

function supportedRasterHeader (bytes: Buffer): boolean {
	return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
		|| (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
		|| (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
}

export function assertVisible (pixels: Buffer, channels: number): void {
	for (let index = channels - 1; index < pixels.length; index += channels) {
		if (pixels[index] !== 0) return;
	}
	throw new Error('Artwork is fully transparent in this viewport. Try a tighter crop, smoother resampling, or alternate artwork.');
}

/** Validate and snapshot local artwork. Subsequent file edits cannot change this snapshot. */
export async function prepareSource (input: IconSource): Promise<PreparedSource> {
	const label = typeof input === 'string' ? input : 'image bytes';
	try {
		const bytes = await readSource(input);
		if (!bytes.length) throw new Error('Source is empty');

		const svg = svgCandidate(bytes) ? parseSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) : undefined;
		if (!svg && !supportedRasterHeader(bytes)) throw new Error('Expected a static SVG, PNG, JPEG, or WebP image');

		const serializer = new XMLSerializer();
		const validated = svg ? Buffer.from(serializer.serializeToString(svg)) : bytes;
		const metadata = await imageWork(validated.length, () => sharp(validated, { limitInputPixels: maxPixels }).metadata());
		const { format, pages, autoOrient, hasAlpha } = metadata;
		if (format !== 'png' && format !== 'svg' && format !== 'jpeg' && format !== 'webp') {
			throw new Error('Expected a static SVG, PNG, JPEG, or WebP image');
		}
		if (format === 'svg' && !svg) throw new Error('SVG must be self-contained UTF-8 XML');
		if ((pages ?? 1) > 1 || (format === 'png' && isAnimatedPng(bytes))) {
			throw new Error('Animated images are unsupported');
		}
		const { width, height } = autoOrient;
		if (!width || !height || width * height > maxPixels) throw new Error('Invalid source dimensions');
		if (svg) {
			svg.setAttribute('width', String(width));
			svg.setAttribute('height', String(height));
			svg.removeAttribute('x');
			svg.removeAttribute('y');
		}
		// Visibility of vector artwork is evaluated at the chosen crop and target size.
		const svgMarkup = svg ? serializer.serializeToString(svg) : undefined;
		let bounds;
		if (!svgMarkup) {
			// Metadata can succeed on incomplete raster files. Validate that the pixels decode.
			bounds = await imageWork(bytes.length + width * height * 8, async () => {
				if (hasAlpha) return alphaBounds(bytes);
				await sharp(bytes, { limitInputPixels: maxPixels }).stats();
			});
		}
		const source = Object.freeze({ id: digest(bytes), format, width, height, hasAlpha });
		prepared.set(source, { bytes, svg: svgMarkup, alphaBounds: bounds });
		return source;
	} catch (cause) {
		throw new Error(`Could not prepare ${label}: ${(cause as Error).message}`, { cause });
	}
}

function isAnimatedPng (bytes: Buffer): boolean {
	for (let offset = 8; offset + 12 <= bytes.length;) {
		const type = bytes.toString('ascii', offset + 4, offset + 8);
		if (type === 'acTL') return true;
		if (type === 'IDAT') return false;
		offset += bytes.readUInt32BE(offset) + 12;
	}
	return false;
}
