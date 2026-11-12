const TITLES = { stream: 'Streaming', synth: 'Synthesized', off: 'Silent' } as const;

/** A small indicator light: dim when silent, brighter as the sound gets louder. */
export function LedPulse({ level, source }: { level: number; source: 'stream' | 'synth' | null }) {
  const key = source ?? 'off';
  const opacity = source === null ? 0.2 : 0.4 + 0.6 * Math.min(1, Math.max(0, level) * 3);
  return (
    <span
      data-testid="led"
      data-source={key}
      data-level={level.toFixed(2)}
      title={TITLES[key]}
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${source === 'synth' ? 'bg-accent' : source === 'stream' ? 'bg-emerald-400' : 'bg-muted'}`}
      style={{ opacity }}
    />
  );
}
