import '@testing-library/jest-dom/vitest';

// cmdk needs these, and jsdom does not provide them.
if (typeof window !== 'undefined') {
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
