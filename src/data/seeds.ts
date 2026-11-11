/** Documents added to the library the first time the app runs. */
export const SEED_DOCS: Array<{ name: string; text: string }> = [
  {
    name: 'Sleep & Night Ergonomics.md',
    text: `NIGHT READING & OCULAR ERGONOMICS
A Comprehensive Guide to Low-Light Information Consumption

Abstract:
Extended reading in low ambient illumination poses unique challenges to circadian biology and visual fatigue. Photopic visual system transitions to scotopic or mesopic states require calibrated luminance thresholds. This document presents optimal screen tuning parameters, blue-spectrum attenuation strategies, and focus techniques.

1. Circadian Rhythms and Short-Wavelength Suppression
Exposure to high-intensity blue light (wavelength 450-480nm) during evening hours suppresses melatonin production via intrinsically photosensitive retinal ganglion cells (ipRGCs). Utilizing low-correlated color temperature (CCT) shifts—such as amber and warmth filters—significantly minimizes nocturnal alertness spikes and promotes natural sleep onset post-reading.

2. Luminance Ratio Optimization
To prevent asthenopia (eyestrain), contrast ratios should be maintained within a comfortable range rather than extreme harsh whites on deep blacks. Utilizing muted charcoal (#12131C) or warm sepia bases reduces stark glare while preserving textual acuity.

3. The Focus Line Technique
Visual distraction in dense multi-paragraph documents is mitigated through horizontal line isolation. By dimming peripheral lines, reading speed increases by up to 22% while reducing cognitive fatigue during late-night sessions.`,
  },
  {
    name: 'Nocturne Engine Specs.txt',
    text: `[NOCTURNE READER ENGINE v3.0]

--- SYSTEM CONFIGURATION ---
+ Storage Mode: 100% Offline IndexedDB & LocalCache
+ Audio Synthesizer: Web Audio API Oscillator Matrix
+ Spectral Warmth Threshold: 2200K - 4500K

--- SHORTCUT CHEATSHEET ---
  - Arrow Left / Right : Turn Pages
  - Arrow Up / Down   : Move Focus Line
  - F Key             : Toggle Focus Line Ruler
  - S Key             : Toggle TTS Voice Reader
  - A Key             : Toggle Ambient Audio`,
  },
];
