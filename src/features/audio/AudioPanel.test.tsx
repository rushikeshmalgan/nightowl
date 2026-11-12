import { fireEvent, render, screen } from '@testing-library/react';
import type { AudioEngineState } from './engine';
import { AudioPanel } from './AudioPanel';
import { LedPulse } from './LedPulse';

const idle: AudioEngineState = { playing: false, trackId: 'lofi', volume: 0.5, source: null, error: null };

function setup(overrides: Partial<React.ComponentProps<typeof AudioPanel>> = {}) {
  const props = {
    state: idle,
    analyser: null,
    level: 0,
    sleep: { minutes: 0 as const, remainingMs: null, set: vi.fn() },
    onToggle: vi.fn(),
    onTrack: vi.fn(),
    onVolume: vi.fn(),
    ...overrides,
  };
  render(<AudioPanel {...props} />);
  return props;
}

describe('AudioPanel', () => {
  it('lists the three tracks and marks the current one', () => {
    setup({ state: { ...idle, trackId: 'rain' } });
    expect(screen.getByRole('button', { name: 'Lo-Fi' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Rain' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pink Noise' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('chooses a track', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pink Noise' }));
    expect(props.onTrack).toHaveBeenCalledWith('pink');
  });

  it('plays and pauses', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it('labels the button Pause while playing', () => {
    setup({ state: { ...idle, playing: true, source: 'synth' } });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('sets the volume as a percentage', () => {
    const props = setup();
    const slider = screen.getByRole('slider', { name: 'Volume' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(props.onVolume).toHaveBeenCalledWith(1);
  });

  it('offers the sleep timer choices and marks the active one', () => {
    const props = setup({ sleep: { minutes: 30, remainingMs: 29 * 60_000 + 5_000, set: vi.fn() } });
    for (const label of ['Off', '15m', '30m', '60m']) expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30m' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '15m' }));
    expect(props.sleep.set).toHaveBeenCalledWith(15);
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(props.sleep.set).toHaveBeenCalledWith(0);
  });

  it('shows the time left on the sleep timer', () => {
    setup({ sleep: { minutes: 30, remainingMs: 29 * 60_000 + 5_000, set: vi.fn() } });
    expect(screen.getByText('29:05')).toBeInTheDocument();
  });

  it('announces an engine error', () => {
    setup({ state: { ...idle, error: 'Audio is blocked until you click or press a key.' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Audio is blocked until you click or press a key.');
  });

  it('says where the sound comes from while playing', () => {
    setup({ state: { ...idle, playing: true, source: 'synth' } });
    expect(screen.getByText('Synthesized')).toBeInTheDocument();
  });
});

describe('LedPulse', () => {
  it('marks the synthesized fallback', () => {
    render(<LedPulse level={0.4} source="synth" />);
    const led = screen.getByTestId('led');
    expect(led).toHaveAttribute('data-source', 'synth');
    expect(led).toHaveAttribute('title', 'Synthesized');
  });

  it('marks a stream', () => {
    render(<LedPulse level={0.4} source="stream" />);
    expect(screen.getByTestId('led')).toHaveAttribute('data-source', 'stream');
  });

  it('is dim when nothing is playing and brighter with the level', () => {
    const { rerender } = render(<LedPulse level={0} source={null} />);
    const off = Number(screen.getByTestId('led').style.opacity);
    rerender(<LedPulse level={0.1} source="synth" />);
    const quiet = Number(screen.getByTestId('led').style.opacity);
    rerender(<LedPulse level={0.9} source="synth" />);
    const loud = Number(screen.getByTestId('led').style.opacity);
    expect(off).toBeLessThan(quiet);
    expect(quiet).toBeLessThan(loud);
    expect(loud).toBeLessThanOrEqual(1);
  });
});
