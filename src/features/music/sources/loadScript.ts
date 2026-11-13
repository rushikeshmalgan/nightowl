const pending = new Map<string, Promise<void>>();

/** Adds a third-party script once. Later calls for the same URL share the first load. */
export function loadScript(src: string): Promise<void> {
  const existing = pending.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending.delete(src);
      script.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
  pending.set(src, promise);
  return promise;
}
