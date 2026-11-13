import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { installMatchMedia, resetMedia } from './src/test/media';

// findBy* and waitFor default to 1 second, which a busy machine can exceed.
configure({ asyncUtilTimeout: 5000 });

// cmdk needs these, and jsdom does not provide them.
if (typeof window !== 'undefined') {
  // Every test starts on a desktop with a mouse; tests change that with setMedia().
  installMatchMedia();
  beforeEach(resetMedia);
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
