const queue: Array<{ bytes: number; resume: () => void }> = [];
const byteLimit = 256 * 1024 * 1024;
const jobLimit = 2;
let activeBytes = 0;
let activeJobs = 0;

function resumeWaitingJobs (): void {
	while (queue.length && activeJobs < jobLimit) {
		const job = queue[0];
		if (activeBytes + job.bytes > byteLimit) break;
		queue.shift();
		activeBytes += job.bytes;
		activeJobs++;
		job.resume();
	}
}

/** Share a concurrency limit and estimated decoded-image budget across probes and renders. */
export async function imageWork<T> (bytes: number, operation: () => Promise<T>): Promise<T> {
	if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > byteLimit) {
		throw new RangeError('Image processing exceeds the working pixel budget. Try a smaller source or narrower crop.');
	}
	await new Promise<void>((resume) => {
		queue.push({ bytes, resume });
		resumeWaitingJobs();
	});
	try {
		return await operation();
	} finally {
		activeBytes -= bytes;
		activeJobs--;
		resumeWaitingJobs();
	}
}
