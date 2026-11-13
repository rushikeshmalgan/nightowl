import { asContext, FakeAudioContext } from '../../test/fakeAudio';
import { createSynth, fillPinkNoise } from './synth';
import { AUDIO_TRACKS } from './tracks';

function lag1(samples: Float32Array): number {
  let mean = 0;
  for (const s of samples) mean += s;
  mean /= samples.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < samples.length; i++) {
    const d = samples[i] - mean;
    den += d * d;
    if (i > 0) num += d * (samples[i - 1] - mean);
  }
  return num / den;
}

describe('AUDIO_TRACKS', () => {
  it('lists the three ambient tracks with their stream files', () => {
    expect(AUDIO_TRACKS).toEqual([
      { id: 'lofi', name: 'Lo-Fi', file: 'lofi.mp3' },
      { id: 'rain', name: 'Rain', file: 'rain.mp3' },
      { id: 'pink', name: 'Pink Noise', file: 'pink.mp3' },
    ]);
  });
});

describe('fillPinkNoise', () => {
  it('stays within the sample range', () => {
    const out = new Float32Array(16384);
    fillPinkNoise(out);
    let min = Infinity;
    let max = -Infinity;
    for (const s of out) {
      min = Math.min(min, s);
      max = Math.max(max, s);
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.1);
  });

  it('is correlated from sample to sample, unlike white noise', () => {
    const pink = new Float32Array(16384);
    fillPinkNoise(pink);
    expect(lag1(pink)).toBeGreaterThan(0.3);

    const white = new Float32Array(16384);
    for (let i = 0; i < white.length; i++) white[i] = Math.random() * 2 - 1;
    expect(Math.abs(lag1(white))).toBeLessThan(0.1);
  });
});

describe('createSynth', () => {
  it('builds the lo-fi pad from several oscillators', () => {
    const ctx = new FakeAudioContext();
    createSynth(asContext(ctx), 'lofi', ctx.destination as unknown as AudioNode);
    expect(ctx.started('oscillator').length).toBeGreaterThanOrEqual(2);
  });

  it('builds rain from noise, with no pitched oscillators above the sub-audio range', () => {
    const ctx = new FakeAudioContext();
    createSynth(asContext(ctx), 'rain', ctx.destination as unknown as AudioNode);
    expect(ctx.started('bufferSource').length).toBeGreaterThanOrEqual(1);
    for (const osc of ctx.started('oscillator')) expect(osc.frequency.value).toBeLessThan(20);
  });

  it('builds pink noise from exactly one looped buffer', () => {
    const ctx = new FakeAudioContext();
    createSynth(asContext(ctx), 'pink', ctx.destination as unknown as AudioNode);
    const sources = ctx.started('bufferSource');
    expect(sources).toHaveLength(1);
    expect(sources[0].loop).toBe(true);
    expect(ctx.started('oscillator')).toHaveLength(0);
  });

  it('gives each track a different node graph', () => {
    const shape = (id: 'lofi' | 'rain' | 'pink') => {
      const ctx = new FakeAudioContext();
      createSynth(asContext(ctx), id, ctx.destination as unknown as AudioNode);
      return `${ctx.started('oscillator').length}/${ctx.started('bufferSource').length}/${ctx.of('filter').length}`;
    };
    expect(new Set([shape('lofi'), shape('rain'), shape('pink')]).size).toBe(3);
  });

  it('reaches the destination', () => {
    const ctx = new FakeAudioContext();
    createSynth(asContext(ctx), 'pink', ctx.destination as unknown as AudioNode);
    const reached = ctx.nodes.some((node) => node.connect.mock.calls.some((call) => call[0] === ctx.destination));
    expect(reached).toBe(true);
  });

  it.each(['lofi', 'rain', 'pink'] as const)('stops every source and disconnects every node of %s', (id) => {
    const ctx = new FakeAudioContext();
    const handle = createSynth(asContext(ctx), id, ctx.destination as unknown as AudioNode);
    const created = ctx.nodes.filter((node) => node !== ctx.destination);
    handle.stop();
    for (const source of [...ctx.started('oscillator'), ...ctx.started('bufferSource')]) {
      expect(source.stop).toHaveBeenCalled();
    }
    for (const node of created) expect(node.disconnect).toHaveBeenCalled();
  });

  it('can be stopped twice without throwing', () => {
    const ctx = new FakeAudioContext();
    const handle = createSynth(asContext(ctx), 'lofi', ctx.destination as unknown as AudioNode);
    handle.stop();
    expect(() => handle.stop()).not.toThrow();
  });
});
