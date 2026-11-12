export interface LoadStreamOptions {
  /** Supplies the element; tests pass a fake. */
  createAudio?: (url: string) => HTMLAudioElement;
  timeoutMs?: number;
}

/**
 * Prepares a looping audio element for a hosted track. Resolves once the
 * browser can start playing it; rejects on a load error or if nothing has
 * loaded within the timeout. `crossOrigin` is set so the audio can pass
 * through the Web Audio graph, which means the host must allow CORS.
 */
export function loadStream(url: string, opts: LoadStreamOptions = {}): Promise<HTMLAudioElement> {
  const { createAudio, timeoutMs = 5000 } = opts;
  const element = createAudio ? createAudio(url) : new Audio();
  element.crossOrigin = 'anonymous';
  element.loop = true;
  element.preload = 'auto';

  return new Promise<HTMLAudioElement>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      element.removeEventListener('canplay', onReady);
      element.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve(element);
    };
    const fail = (reason: string) => {
      cleanup();
      // Stop the browser fetching a stream nobody will play.
      element.removeAttribute('src');
      element.load();
      reject(new Error(reason));
    };
    const onError = () => fail('The audio stream could not be loaded.');
    const timer = setTimeout(() => fail('The audio stream took too long to load.'), timeoutMs);

    element.addEventListener('canplay', onReady);
    element.addEventListener('error', onError);
    if (!createAudio) element.src = url;
  });
}
