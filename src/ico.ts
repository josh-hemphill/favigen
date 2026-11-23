/** Pack PNG-encoded planes into an ICO without decoding or resizing them again. */
export function encodeIco (planes: readonly Buffer[]): Buffer {
	const directory = Buffer.alloc(6 + planes.length * 16);
	directory.writeUInt16LE(1, 2);
	directory.writeUInt16LE(planes.length, 4);
	let fileOffset = directory.length;
	for (const [index, plane] of planes.entries()) {
		const entry = 6 + index * 16;
		const width = plane.readUInt32BE(16);
		const height = plane.readUInt32BE(20);
		if (!width || !height || width > 256 || height > 256) {
			throw new RangeError('ICO frames must be between 1 and 256 pixels on each side');
		}
		directory[entry] = width % 256;
		directory[entry + 1] = height % 256;
		directory.writeUInt16LE(1, entry + 4);
		directory.writeUInt16LE(32, entry + 6);
		directory.writeUInt32LE(plane.length, entry + 8);
		directory.writeUInt32LE(fileOffset, entry + 12);
		fileOffset += plane.length;
	}
	return Buffer.concat([directory, ...planes], fileOffset);
}
