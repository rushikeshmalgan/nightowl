import { useCallback, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export interface ScrubberProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  title?: string;
}

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Clamp to the range and snap to the step grid, measured from `min`. */
function snap(raw: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, raw));
  const snapped = min + Math.round((clamped - min) / step) * step;
  const rounded = Number(snapped.toFixed(decimalsOf(step)));
  return Math.min(max, Math.max(min, rounded));
}

export function Scrubber({ label, value, min, max, step, format, onChange, disabled = false, title }: ScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const valueFromPointer = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return value;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return snap(min + ratio * (max - min), min, max, step);
    },
    [min, max, step, value],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onChange(valueFromPointer(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !dragging.current) return;
    const next = valueFromPointer(event.clientX);
    if (next !== value) onChange(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step;
        break;
      case 'PageUp':
        next = value + step * 10;
        break;
      case 'PageDown':
        next = value - step * 10;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    onChange(snap(next, min, max, step));
  };

  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const readout = format ? format(value) : String(value);

  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular-nums text-ink">{readout}</span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={readout}
        aria-disabled={disabled ? 'true' : undefined}
        title={title}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`relative h-4 touch-none select-none outline-none focus-visible:ring-1 focus-visible:ring-accent ${
          disabled ? 'cursor-not-allowed' : 'cursor-ew-resize'
        }`}
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-accent"
          style={{ width: `${percent}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-ink"
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  );
}
