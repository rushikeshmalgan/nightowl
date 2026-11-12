import { useEffect, useRef } from 'react';

/** Draws the live audio signal as a single thin line. Flat when nothing plays. */
export function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext?.('2d') ?? null;
    if (!canvas || !context) return;

    const { width, height } = canvas;
    const stroke = getComputedStyle(canvas).color || '#f59e0b';

    const drawFlat = () => {
      context.clearRect(0, 0, width, height);
      context.strokeStyle = stroke;
      context.globalAlpha = 0.35;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
      context.globalAlpha = 1;
    };

    if (!analyser || !active || typeof requestAnimationFrame !== 'function') {
      drawFlat();
      return;
    }

    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const draw = () => {
      analyser.getByteTimeDomainData(samples);
      context.clearRect(0, 0, width, height);
      context.strokeStyle = stroke;
      context.lineWidth = 1.25;
      context.beginPath();
      const step = width / (samples.length - 1);
      for (let i = 0; i < samples.length; i++) {
        const y = (samples[i] / 255) * height;
        if (i === 0) context.moveTo(0, y);
        else context.lineTo(i * step, y);
      }
      context.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      drawFlat();
    };
  }, [analyser, active]);

  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={48}
      aria-label="Audio waveform"
      className="block h-12 w-full border border-line bg-canvas text-accent"
    />
  );
}
