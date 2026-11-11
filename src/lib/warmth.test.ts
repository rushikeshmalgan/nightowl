import { KELVIN_DEFAULT, KELVIN_MAX, KELVIN_MIN, kelvinToOverlayOpacity, overlayColor } from './warmth';

describe('kelvinToOverlayOpacity', () => {
  it('is zero at the coolest setting', () => {
    expect(kelvinToOverlayOpacity(6500)).toBe(0);
  });

  it('is 0.35 at the warmest setting', () => {
    expect(kelvinToOverlayOpacity(2200)).toBe(0.35);
  });

  it('matches the prototype 35% warmth at the 5000K default', () => {
    expect(kelvinToOverlayOpacity(5000)).toBeCloseTo(0.1221, 3);
  });

  it('clamps values below the range', () => {
    expect(kelvinToOverlayOpacity(1000)).toBe(0.35);
  });

  it('clamps values above the range', () => {
    expect(kelvinToOverlayOpacity(9000)).toBe(0);
  });

  it('exposes the range constants', () => {
    expect([KELVIN_MIN, KELVIN_MAX, KELVIN_DEFAULT]).toEqual([2200, 6500, 5000]);
  });
});

describe('overlayColor', () => {
  it('is red for the crimson theme', () => {
    expect(overlayColor('crimson')).toBe('#ff0000');
  });

  it('is amber for every other theme', () => {
    expect(overlayColor('night')).toBe('#ff9300');
    expect(overlayColor('sepia')).toBe('#ff9300');
    expect(overlayColor('oled')).toBe('#ff9300');
  });
});
