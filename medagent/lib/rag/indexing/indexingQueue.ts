type BackgroundTask = () => Promise<void>;

const queued = new Set<string>();

export function runInBackgroundQueue(key: string, task: BackgroundTask) {
  if (queued.has(key)) {
    return false;
  }

  queued.add(key);

  Promise.resolve()
    .then(() => task())
    .catch(() => {
      // Background tasks are best-effort and never throw into request path.
    })
    .finally(() => {
      queued.delete(key);
    });

  return true;
}

export function isBackgroundTaskQueued(key: string) {
  return queued.has(key);
}

export function clearBackgroundQueueForTests() {
  queued.clear();
}
