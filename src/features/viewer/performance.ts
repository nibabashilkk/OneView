export async function yieldToMainThread(timeout = 40): Promise<void> {
  const schedulerObject = (globalThis as typeof globalThis & {
    scheduler?: { yield?: () => Promise<void> };
  }).scheduler;

  if (schedulerObject?.yield) {
    await schedulerObject.yield();
    return;
  }

  if (typeof requestIdleCallback === "function") {
    await new Promise<void>((resolve) => {
      requestIdleCallback(() => resolve(), { timeout });
    });
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function forEachInBatches<T>(
  items: Iterable<T> | ArrayLike<T>,
  callback: (item: T, index: number) => void | Promise<void>,
  batchSize = 40,
): Promise<void> {
  const values = Array.from(items as ArrayLike<T>);
  for (let index = 0; index < values.length; index += 1) {
    await callback(values[index], index);
    if ((index + 1) % batchSize === 0 && index + 1 < values.length) {
      await yieldToMainThread();
    }
  }
}

export function isLargeDocument(lineCount: number, sizeBytes: number): boolean {
  return lineCount >= 8_000 || sizeBytes >= 700 * 1024;
}
