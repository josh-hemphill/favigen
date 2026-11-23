import { randomUUID } from 'node:crypto';
import { mkdir, open, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { digest } from './source.js';

export interface IconCache {
	get(key: string): Uint8Array | undefined | Promise<Uint8Array | undefined>;
	set(key: string, value: Uint8Array): void | Promise<void>;
}

const mib = 1024 * 1024;
const validKey = /^[a-f0-9]{64}$/;

export type CacheErrorHandler = (error: Error) => void | Promise<void>;

export function notifyCacheError (report: CacheErrorHandler | undefined, error: unknown): void {
	try {
		void Promise.resolve(report?.(error instanceof Error ? error : new Error(String(error)))).catch(() => undefined);
	} catch {
		// Diagnostic callbacks do not make a cache miss fatal.
	}
}

function validateBudget (maxBytes: number): void {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('Invalid cache byte limit');
}

export function createMemoryCache (maxBytes = 64 * mib): IconCache {
	validateBudget(maxBytes);
	const entries = new Map<string, Uint8Array>();
	let total = 0;
	return {
		get (key) {
			const value = entries.get(key);
			if (value) {
				entries.delete(key);
				entries.set(key, value);
				return Uint8Array.from(value);
			}
		},
		set (key, value) {
			if (value.byteLength > maxBytes || !maxBytes) return;
			total -= entries.get(key)?.byteLength ?? 0;
			entries.delete(key);
			entries.set(key, Uint8Array.from(value));
			total += value.byteLength;

			for (const [oldKey, oldValue] of entries) {
				if (total <= maxBytes) break;
				entries.delete(oldKey);
				total -= oldValue.byteLength;
			}
		},
	};
}

export interface DiskCacheOptions {
	maxBytes?: number;
	maxAgeMs?: number;
	onError?: CacheErrorHandler;
}

/** Persist independently verifiable cache entries under an owned subdirectory. */
export function createDiskCache (directory: string, options: DiskCacheOptions = {}): IconCache {
	const root = resolve(directory, 'favigen-v1');
	const maxBytes = options.maxBytes ?? 256 * mib;
	const maxAgeMs = options.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000;
	validateBudget(maxBytes);
	if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) throw new RangeError('Invalid cache maximum age');
	let pending = Promise.resolve();

	function report (error: unknown) {
		const failure = error as NodeJS.ErrnoException;
		if (failure?.code !== 'ENOENT') notifyCacheError(options.onError, failure);
	}

	async function prune () {
		const now = Date.now();
		const entries = [];
		for (const entry of await readdir(root, { withFileTypes: true })) {
			if (!entry.isFile()) continue;
			const path = join(root, entry.name);
			const entryStat = await stat(path).catch(report);
			if (!entryStat) continue;

			if (validKey.test(entry.name)) {
				entries.push({ path, size: entryStat.size, mtimeMs: entryStat.mtimeMs });
			} else if (/^[a-f0-9]{64}\.[\da-f-]+\.tmp$/.test(entry.name) && now - entryStat.mtimeMs > maxAgeMs) {
				await rm(path, { force: true });
			}
		}
		let size = entries.reduce((total, entry) => total + entry.size, 0);
		entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
		for (const entry of entries) {
			if (size <= maxBytes && now - entry.mtimeMs <= maxAgeMs) break;
			await rm(entry.path, { force: true });
			size -= entry.size;
		}
	}

	return {
		async get (key) {
			if (!validKey.test(key) || !maxBytes) return;
			try {
				const file = await open(join(root, key), 'r');
				try {
					const entry = await file.stat();
					if (!entry.isFile() || entry.size <= 32 || entry.size > maxBytes || Date.now() - entry.mtimeMs > maxAgeMs) return;
					const record = await file.readFile();
					const bytes = record.subarray(32);
					if (digest(bytes) === record.subarray(0, 32).toString('hex')) return bytes;
					report(new Error(`Invalid Favigen cache entry: ${key}`));
				} finally {
					await file.close();
				}
			} catch (error) {
				report(error);
			}
		},
		set (key, value) {
			if (!validKey.test(key) || !maxBytes || value.byteLength + 32 > maxBytes) return;
			const record = Buffer.concat([Buffer.from(digest(value), 'hex'), value]);
			const temp = join(root, `${key}.${randomUUID()}.tmp`);
			pending = pending.catch(report).then(async () => {
				try {
					await mkdir(root, { recursive: true });
					await writeFile(temp, record, { flag: 'wx' });
					await rename(temp, join(root, key));
					await prune();
				} catch (error) {
					report(error);
				} finally {
					await rm(temp, { force: true }).catch(report);
				}
			});
			return pending;
		},
	};
}
