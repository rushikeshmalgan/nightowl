import { useCallback, useEffect, useState } from 'react';

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  const synth = (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  const hasUtterance = typeof (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance === 'function';
  return synth && hasUtterance ? synth : null;
}

/**
 * Reads `text` aloud with the Web Speech API. When the browser has no speech
 * synthesis, `supported` is false and `toggle` does nothing, so callers can
 * disable the control instead of showing an alert.
 */
export function useTts(text: string, rate: number): { supported: boolean; speaking: boolean; toggle(): void } {
  const [speaking, setSpeaking] = useState(false);
  const supported = getSynth() !== null;

  const toggle = useCallback(() => {
    const synth = getSynth();
    if (!synth) return;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    if (text.trim() === '') return;
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  }, [speaking, text, rate]);

  // Stop reading when the component goes away or the text changes.
  useEffect(() => {
    return () => {
      getSynth()?.cancel();
      setSpeaking(false);
    };
  }, [text]);

  return { supported, speaking, toggle };
}
