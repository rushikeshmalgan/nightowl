import React, { useState, useEffect, useRef } from 'react';
import { 
  Moon, Sun, Eye, FileText, Image as ImageIcon, Layers, Upload, Sliders, 
  ZoomIn, ZoomOut, RotateCcw, Sparkles, BookOpen, ChevronLeft, ChevronRight, 
  Maximize2, Volume2, VolumeX, Shield, Settings, Check, Download, Info, Focus, 
  Play, Pause, FastForward, Bookmark, HardDrive, WifiOff, Users, Music, 
  Radio, Clock, Trash2, Zap, RefreshCw, Type, Compass, EyeOff, Crosshair
} from 'lucide-react';

export default function App() {
  // --- THEME & FILTERS STATE ---
  const [themeMode, setThemeMode] = useState('midnight'); // midnight, sepia, oled, warmSlate, crimson
  const [warmth, setWarmth] = useState(35); // Blue light filter %
  const [brightness, setBrightness] = useState(90);
  const [contrast, setContrast] = useState(105);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [bionicReading, setBionicReading] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);

  // --- READING FOCUS & AUTOMATION ---
  const [focusMode, setFocusMode] = useState(false);
  const [focusY, setFocusY] = useState(250);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const readerContainerRef = useRef(null);

  // --- TTS NARRATOR (Web Speech API) ---
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);

  // --- DOCUMENT & CACHE STATE ---
  const [activeTab, setActiveTab] = useState('reader'); // reader, layers, storage, audio
  const [documents, setDocuments] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(8);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [storageUsed, setStorageUsed] = useState('0.8 MB');

  // --- AMBIENT AUDIO ENGINE (Web Audio API) ---
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentSoundTrack, setCurrentSoundTrack] = useState('space'); // space, rain, ocean, noise, crickets
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const audioCtxRef = useRef(null);
  const audioNodesRef = useRef([]);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // --- SIMULATED LIVE READERS ---
  const [liveReaders, setLiveReaders] = useState(1428);
  const [recentPulse, setRecentPulse] = useState('Tokyo Hub +12 readers');

  // --- PSD MOCK LAYERS ---
  const [psdLayers, setPsdLayers] = useState([
    { id: 1, name: 'Background Grid & Guidelines', type: 'vector', visible: true, opacity: 100 },
    { id: 2, name: 'Night Reader Header Component', type: 'group', visible: true, opacity: 100 },
    { id: 3, name: 'Ambient Warmth Overlay (Filter)', type: 'adjustment', visible: true, opacity: 80 },
    { id: 4, name: 'Typography & Code View', type: 'text', visible: true, opacity: 100 },
    { id: 5, name: 'UI Control Widgets', type: 'group', visible: true, opacity: 90 },
    { id: 6, name: 'Dark Contrast Gradient Mask', type: 'layer', visible: true, opacity: 75 }
  ]);

  // Initial Sample Documents
  const samples = [
    {
      id: 'sample-pdf',
      name: 'Sleep & Night Ergonomics.pdf',
      type: 'pdf',
      pages: 8,
      size: '2.4 MB',
      updatedAt: 'Just now',
      content: `NIGHT READING & OCULAR ERGONOMICS
A Comprehensive Guide to Low-Light Information Consumption

Abstract:
Extended reading in low ambient illumination poses unique challenges to circadian biology and visual fatigue. Photopic visual system transitions to scotopic or mesopic states require calibrated luminance thresholds. This document presents optimal screen tuning parameters, blue-spectrum attenuation strategies, and focus techniques.

1. Circadian Rhythms and Short-Wavelength Suppression
Exposure to high-intensity blue light (wavelength 450-480nm) during evening hours suppresses melatonin production via intrinsically photosensitive retinal ganglion cells (ipRGCs). Utilizing low-correlated color temperature (CCT) shifts—such as amber and warmth filters—significantly minimizes nocturnal alertness spikes and promotes natural sleep onset post-reading.

2. Luminance Ratio Optimization
To prevent asthenopia (eyestrain), contrast ratios should be maintained within a comfortable range rather than extreme harsh whites on deep blacks. Utilizing muted charcoal (#12131C) or warm sepia bases reduces stark glare while preserving textual acuity.

3. The Focus Line Technique
Visual distraction in dense multi-paragraph documents is mitigated through horizontal line isolation. By dimming peripheral lines, reading speed increases by up to 22% while reducing cognitive fatigue during late-night sessions.`
    },
    {
      id: 'sample-psd',
      name: 'Mobile App Wireframe.psd',
      type: 'psd',
      pages: 1,
      size: '14.8 MB',
      updatedAt: '2 hours ago',
      content: 'PSD File Loaded: 6 Layers detected. Switch to the "Layer Inspector" tab to toggle individual layers, check opacities, and isolate night-mode graphics.'
    },
    {
      id: 'sample-txt',
      name: 'Nocturne Engine Specs.txt',
      type: 'txt',
      pages: 3,
      size: '42 KB',
      updatedAt: 'Yesterday',
      content: `[NOCTURNE READER ENGINE v3.0]

--- SYSTEM CONFIGURATION ---
+ Storage Mode: 100% Offline IndexedDB & LocalCache
+ Audio Synthesizer: Web Audio API Oscillator Matrix
+ Spectral Warmth Threshold: 2200K - 4500K

--- SHORTCUT CHEATSHEET ---
  - Arrow Left / Right : Turn Pages
  - Arrow Up / Down   : Move Focus Line
  - F Key             : Toggle Focus Line Ruler
  - S Key             : Toggle TTS Voice Reader
  - A Key             : Toggle Ambient Audio`
    }
  ];

  // Load / Sync LocalStorage Cache on Mount
  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem('nocturne_cached_docs');
      if (savedDocs) {
        const parsed = JSON.parse(savedDocs);
        setDocuments(parsed);
        setCurrentFile(parsed[0] || samples[0]);
      } else {
        setDocuments(samples);
        setCurrentFile(samples[0]);
        localStorage.setItem('nocturne_cached_docs', JSON.stringify(samples));
      }

      const savedTheme = localStorage.getItem('nocturne_theme');
      if (savedTheme) setThemeMode(savedTheme);

      const savedWarmth = localStorage.getItem('nocturne_warmth');
      if (savedWarmth) setWarmth(Number(savedWarmth));
    } catch (e) {
      setDocuments(samples);
      setCurrentFile(samples[0]);
    }
  }, []);

  // Sync Settings to Cache
  useEffect(() => {
    try {
      localStorage.setItem('nocturne_theme', themeMode);
      localStorage.setItem('nocturne_warmth', warmth.toString());
      calculateStorageUsage();
    } catch (e) {}
  }, [themeMode, warmth, documents]);

  const calculateStorageUsage = () => {
    try {
      const str = localStorage.getItem('nocturne_cached_docs') || '';
      const sizeMB = (str.length * 2 / (1024 * 1024)).toFixed(2);
      setStorageUsed(`${sizeMB} MB`);
    } catch (e) {
      setStorageUsed('1.2 MB');
    }
  };

  // Simulated Live Readers Fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      const delta = Math.floor(Math.random() * 7) - 3;
      setLiveReaders(prev => Math.max(1200, prev + delta));
      
      const hubs = ['London', 'Berlin', 'Tokyo', 'San Francisco', 'Toronto', 'Seoul', 'Sydney'];
      const randomHub = hubs[Math.floor(Math.random() * hubs.length)];
      setRecentPulse(`${randomHub} Hub ${delta >= 0 ? '+' : ''}${delta} night owls`);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // Auto-Scroll Loop
  useEffect(() => {
    let scrollInterval;
    if (autoScroll && readerContainerRef.current) {
      scrollInterval = setInterval(() => {
        if (readerContainerRef.current) {
          readerContainerRef.current.scrollTop += scrollSpeed;
        }
      }, 50);
    }
    return () => clearInterval(scrollInterval);
  }, [autoScroll, scrollSpeed]);

  // Sleep Timer Countdown
  useEffect(() => {
    if (sleepTimerMinutes <= 0) return;
    const timer = setTimeout(() => {
      stopAudio();
      setSleepTimerMinutes(0);
    }, sleepTimerMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [sleepTimerMinutes]);

  // WEB AUDIO API - AMBIENT SOUND SYNTHESIZER
  const startAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      stopAudioNodes();
      const ctx = audioCtxRef.current;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(audioVolume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      audioNodesRef.current.push(masterGain);

      if (currentSoundTrack === 'space' || currentSoundTrack === 'rain') {
        // Binaural Drone / Space Synth
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(currentSoundTrack === 'space' ? 110 : 80, ctx.currentTime);
        osc2.frequency.setValueAtTime(currentSoundTrack === 'space' ? 112 : 82.5, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);

        osc1.start();
        osc2.start();
        audioNodesRef.current.push(osc1, osc2);
      } else {
        // Pink / White Ambient Noise Generator
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(currentSoundTrack === 'ocean' ? 300 : 800, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();
        audioNodesRef.current.push(whiteNoise);
      }

      setAudioPlaying(true);
      drawAudioVisualizer();
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  };

  const stopAudioNodes = () => {
    audioNodesRef.current.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    audioNodesRef.current = [];
  };

  const stopAudio = () => {
    stopAudioNodes();
    setAudioPlaying(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const toggleAudio = () => {
    if (audioPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  // Audio Spectrum Visualizer Canvas
  const drawAudioVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#6366f1';
      step += 0.05;

      const bars = 24;
      const barWidth = canvas.width / bars;

      for (let i = 0; i < bars; i++) {
        const height = audioPlaying 
          ? Math.sin(step + i * 0.3) * 12 + Math.cos(step * 0.7 + i) * 8 + 20 
          : 4;
        const x = i * barWidth;
        const y = canvas.height - height;
        
        ctx.fillStyle = i % 2 === 0 ? '#818cf8' : '#4f46e5';
        ctx.fillRect(x, y, barWidth - 2, height);
      }
      animFrameRef.current = requestAnimationFrame(render);
    };
    render();
  };

  // WEB SPEECH TTS VOICE NARRATOR
  const toggleTTS = () => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-Speech is not supported in this browser.");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      if (!currentFile?.content) return;
      const utterance = new SpeechSynthesisUtterance(currentFile.content);
      utterance.rate = speechRate;
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  // Render Bionic Reading Text Transformer
  const renderBionicText = (text) => {
    if (!bionicReading) return text;
    return text.split(' ').map((word, wIdx) => {
      const mid = Math.ceil(word.length / 2);
      const head = word.slice(0, mid);
      const tail = word.slice(mid);
      return (
        <React.Fragment key={wIdx}>
          <strong className="font-extrabold text-white">{head}</strong>
          {tail}{' '}
        </React.Fragment>
      );
    });
  };

  // Handle Drag & Drop File Upload to Cache
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();

      reader.onload = (event) => {
        const fileContent = event.target.result || `Content of ${file.name}`;
        const newDoc = {
          id: Date.now().toString(),
          name: file.name,
          type: ext === 'psd' ? 'psd' : ext === 'pdf' ? 'pdf' : 'txt',
          pages: ext === 'pdf' ? 6 : 1,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          updatedAt: 'Just now',
          content: typeof fileContent === 'string' ? fileContent : `[Binary ${ext.toUpperCase()} File Cached locally]`
        };
        const updated = [newDoc, ...documents];
        setDocuments(updated);
        setCurrentFile(newDoc);
        setCurrentPage(1);
        setTotalPages(newDoc.pages);
        try {
          localStorage.setItem('nocturne_cached_docs', JSON.stringify(updated));
        } catch (err) {}
      };

      if (ext === 'txt' || ext === 'md' || ext === 'json' || ext === 'csv') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    }
  };

  // Add Bookmark
  const addBookmark = () => {
    if (!currentFile) return;
    const bm = {
      id: Date.now(),
      fileName: currentFile.name,
      page: currentPage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setBookmarks([bm, ...bookmarks]);
  };

  // Theme Styling Map
  const getThemeStyle = () => {
    switch (themeMode) {
      case 'sepia':
        return {
          bg: 'bg-[#1b1713]',
          paper: 'bg-[#26211c] text-[#d6c7b2]',
          border: 'border-[#3a3229]',
          accent: 'text-[#e5a95d]',
          button: 'bg-[#3a3229] hover:bg-[#4a4035] text-[#e5a95d]'
        };
      case 'oled':
        return {
          bg: 'bg-black',
          paper: 'bg-black text-[#a0a0a0]',
          border: 'border-[#222222]',
          accent: 'text-[#60a5fa]',
          button: 'bg-[#141414] hover:bg-[#242424] text-[#60a5fa]'
        };
      case 'crimson':
        return {
          bg: 'bg-[#120505]',
          paper: 'bg-[#1c0a0a] text-[#f87171]',
          border: 'border-[#3b1212]',
          accent: 'text-[#ef4444]',
          button: 'bg-[#2d0d0d] hover:bg-[#3d1212] text-[#ef4444]'
        };
      case 'warmSlate':
        return {
          bg: 'bg-[#0f172a]',
          paper: 'bg-[#1e293b] text-[#cbd5e1]',
          border: 'border-[#334155]',
          accent: 'text-[#38bdf8]',
          button: 'bg-[#334155] hover:bg-[#475569] text-[#38bdf8]'
        };
      case 'midnight':
      default:
        return {
          bg: 'bg-[#0c0d14]',
          paper: 'bg-[#151724] text-[#c3c7db]',
          border: 'border-[#23263b]',
          accent: 'text-[#818cf8]',
          button: 'bg-[#202438] hover:bg-[#2a2f4a] text-[#818cf8]'
        };
    }
  };

  const currentTheme = getThemeStyle();

  return (
    <div className={`min-h-screen ${currentTheme.bg} text-gray-200 flex flex-col font-sans transition-colors duration-300 relative select-none`}>
      
      {/* AMBER & CRIMSON NIGHT VISION SPECTRUM OVERLAY */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 transition-opacity duration-300"
        style={{
          backgroundColor: themeMode === 'crimson' ? '#ff0000' : '#ff9300',
          opacity: warmth * 0.0035,
          mixBlendMode: 'multiply'
        }}
      />

      {/* TOP NAVBAR */}
      <header className={`h-16 border-b ${currentTheme.border} px-4 flex items-center justify-between shrink-0 bg-opacity-80 backdrop-blur z-20`}>
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Moon className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide text-white flex items-center gap-2">
              NOCTURNE <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">100% LOCAL CACHE</span>
            </h1>
            <p className="text-xs text-gray-400 flex items-center gap-2">
              <WifiOff className="w-3 h-3 text-emerald-400" /> Offline First Document Engine
            </p>
          </div>
        </div>

        {/* LIVE READERS COUNTER & PULSE WIDGET */}
        <div className="hidden lg:flex items-center space-x-3 bg-black/40 px-3.5 py-1.5 rounded-full border border-gray-800 text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-gray-200 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-emerald-400">{liveReaders.toLocaleString()}</span> Night Owls Reading
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400 text-[11px] font-mono">{recentPulse}</span>
        </div>

        {/* ACTIONS & THEME SELECTOR */}
        <div className="flex items-center space-x-3">
          <label className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${currentTheme.border} ${currentTheme.button} cursor-pointer flex items-center gap-2 transition-all`}>
            <Upload className="w-3.5 h-3.5" />
            <span>Open File</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.psd,.txt,.doc,.docx,.png,.jpg,.md,.json" 
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  const f = e.target.files[0];
                  const newDoc = {
                    id: Date.now().toString(),
                    name: f.name,
                    type: f.name.endsWith('.psd') ? 'psd' : 'txt',
                    pages: 3,
                    size: `${(f.size / 1024).toFixed(1)} KB`,
                    updatedAt: 'Just now',
                    content: `Uploaded file ${f.name} stored in browser offline cache.`
                  };
                  const updated = [newDoc, ...documents];
                  setDocuments(updated);
                  setCurrentFile(newDoc);
                  try {
                    localStorage.setItem('nocturne_cached_docs', JSON.stringify(updated));
                  } catch (err) {}
                }
              }}
            />
          </label>

          {/* Color Theme Selector */}
          <div className={`flex items-center p-1 rounded-lg border ${currentTheme.border} bg-black/20 text-xs`}>
            {[
              { id: 'midnight', label: 'Midnight' },
              { id: 'sepia', label: 'Sepia' },
              { id: 'oled', label: 'OLED' },
              { id: 'crimson', label: 'Crimson' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setThemeMode(t.id)}
                className={`px-2.5 py-1 rounded-md transition-all ${themeMode === t.id ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR - FILES & LOCAL CACHE MANAGER */}
        <aside className={`w-64 border-r ${currentTheme.border} p-4 flex flex-col justify-between shrink-0 hidden md:flex`}>
          <div className="space-y-4 overflow-y-auto">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1 flex items-center justify-between">
                <span>Cached Documents</span>
                <HardDrive className="w-3 h-3 text-indigo-400" />
              </h2>
              <div className="space-y-1.5">
                {documents.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setCurrentFile(s);
                      setCurrentPage(1);
                      setTotalPages(s.pages);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                      currentFile?.id === s.id 
                        ? `${currentTheme.border} bg-indigo-950/40 text-indigo-300 font-medium` 
                        : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {s.type === 'psd' ? (
                        <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : s.type === 'pdf' ? (
                        <FileText className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <p className="text-xs truncate">{s.name}</p>
                        <p className="text-[10px] text-gray-500">{s.size}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bookmarks Section */}
            {bookmarks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1 flex items-center gap-1.5">
                  <Bookmark className="w-3 h-3 text-amber-400" />
                  <span>Night Bookmarks</span>
                </h3>
                <div className="space-y-1">
                  {bookmarks.map((bm) => (
                    <div 
                      key={bm.id} 
                      className="p-2 rounded bg-black/30 text-xs border border-gray-800 flex justify-between items-center"
                    >
                      <span className="truncate text-gray-300">{bm.fileName} (P.{bm.page})</span>
                      <span className="font-mono text-[10px] text-gray-500">{bm.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Storage Cache Info Footer */}
          <div className={`p-3.5 rounded-xl border ${currentTheme.border} bg-black/30 text-xs space-y-2`}>
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <HardDrive className="w-3.5 h-3.5" /> Offline Cache
              </span>
              <span className="font-mono text-xs">{storageUsed}</span>
            </div>
            <p className="text-[10px] text-gray-500">Documents stored strictly on local device storage.</p>
            <button 
              onClick={() => {
                localStorage.removeItem('nocturne_cached_docs');
                setDocuments(samples);
                setCurrentFile(samples[0]);
                calculateStorageUsage();
              }}
              className="w-full text-center text-[10px] text-red-400 hover:text-red-300 mt-1"
            >
              Clear Cached Files
            </button>
          </div>
        </aside>

        {/* CENTER VIEWPORT / READER CANVAS */}
        <main 
          className="flex-1 flex flex-col relative overflow-hidden bg-black/40"
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {/* DRAG AND DROP OVERLAY */}
          {isDragOver && (
            <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm z-40 border-2 border-dashed border-indigo-500 flex flex-col items-center justify-center text-white space-y-3">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-lg font-medium">Drop document to store in local offline cache</p>
            </div>
          )}

          {/* VIEWPORT TOOLBAR */}
          <div className={`h-12 border-b ${currentTheme.border} px-4 flex items-center justify-between text-xs`}>
            {/* View Mode Tabs */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setActiveTab('reader')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${activeTab === 'reader' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Reader</span>
              </button>
              
              {currentFile?.type === 'psd' && (
                <button
                  onClick={() => setActiveTab('layers')}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${activeTab === 'layers' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>PSD Layers</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('audio')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${activeTab === 'audio' ? 'bg-indigo-600 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Night Ambience</span>
              </button>
            </div>

            {/* Reading Assistance Controls */}
            <div className="flex items-center space-x-2">
              {/* Text to Speech Voice Reader */}
              <button 
                onClick={toggleTTS}
                className={`px-2.5 py-1 rounded-lg border ${currentTheme.border} flex items-center gap-1.5 transition-all ${isSpeaking ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'text-gray-400 hover:text-white'}`}
                title="Narrate Text (Web Speech API)"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isSpeaking ? 'Speaking...' : 'TTS Voice'}</span>
              </button>

              {/* Bionic Reading Toggle */}
              <button 
                onClick={() => setBionicReading(!bionicReading)}
                className={`px-2.5 py-1 rounded-lg border ${currentTheme.border} flex items-center gap-1.5 transition-all ${bionicReading ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
                title="Bold first letters for faster night scanning"
              >
                <Type className="w-3.5 h-3.5" />
                <span>Bionic</span>
              </button>

              {/* Auto Scroll Toggle */}
              <button 
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-2.5 py-1 rounded-lg border ${currentTheme.border} flex items-center gap-1.5 transition-all ${autoScroll ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{autoScroll ? 'Scrolling' : 'Auto Scroll'}</span>
              </button>

              {/* Focus Line Toggle */}
              <button 
                onClick={() => setFocusMode(!focusMode)} 
                className={`px-2.5 py-1 rounded-lg border ${currentTheme.border} flex items-center gap-1.5 transition-all ${focusMode ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'text-gray-400 hover:text-white'}`}
              >
                <Focus className="w-3.5 h-3.5" />
                <span>Ruler</span>
              </button>

              {/* Zoom Controls */}
              <div className={`flex items-center border ${currentTheme.border} rounded-lg overflow-hidden`}>
                <button 
                  onClick={() => setZoomLevel(Math.max(60, zoomLevel - 10))}
                  className="px-2 py-1 hover:bg-white/10 text-gray-300"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-gray-300">{zoomLevel}%</span>
                <button 
                  onClick={() => setZoomLevel(Math.min(180, zoomLevel + 10))}
                  className="px-2 py-1 hover:bg-white/10 text-gray-300"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* MAIN DISPLAY CANVAS */}
          <div 
            ref={readerContainerRef}
            className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start relative"
            onMouseMove={(e) => {
              if (focusMode) {
                const rect = e.currentTarget.getBoundingClientRect();
                setFocusY(e.clientY - rect.top);
              }
            }}
          >
            {/* FOCUS RULER OVERLAY */}
            {focusMode && (
              <div 
                className="pointer-events-none absolute left-0 right-0 z-30 transition-all duration-75"
                style={{ top: `${focusY}px` }}
              >
                <div 
                  className="fixed inset-0 bg-black/60 pointer-events-none"
                  style={{
                    clipPath: `polygon(0 0, 100% 0, 100% ${focusY - 30}px, 0 ${focusY - 30}px, 0 ${focusY + 30}px, 100% ${focusY + 30}px, 100% 100%, 0 100%)`
                  }}
                />
                <div className="h-[60px] -mt-[30px] border-y border-indigo-400/40 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.15)] flex items-center justify-between px-4">
                  <span className="text-[10px] font-mono text-indigo-400/80">FOCUS RULER ACTIVE</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: DOCUMENT READER */}
            {activeTab === 'reader' && (
              <div 
                className={`w-full max-w-3xl min-h-[600px] rounded-2xl border ${currentTheme.border} ${currentTheme.paper} p-8 md:p-12 shadow-2xl transition-all duration-200 relative overflow-hidden`}
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                  fontFamily: dyslexicFont ? 'Comic Sans MS, sans-serif' : 'inherit'
                }}
              >
                {/* Header Metadata */}
                <div className={`pb-6 mb-6 border-b ${currentTheme.border} flex justify-between items-start`}>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">{currentFile?.name}</h2>
                    <p className="text-xs text-gray-400 mt-1">Page {currentPage} of {totalPages} • Offline Cached</p>
                  </div>
                  <button 
                    onClick={addBookmark}
                    className="p-2 rounded-lg border border-gray-700 hover:bg-white/10 text-amber-400 flex items-center gap-1.5 text-xs"
                  >
                    <Bookmark className="w-4 h-4" /> Bookmark
                  </button>
                </div>

                {/* Render Text / Bionic Content */}
                <div 
                  className="space-y-4 whitespace-pre-wrap leading-relaxed text-justify"
                  style={{ 
                    fontSize: `${fontSize}px`, 
                    lineHeight: lineHeight 
                  }}
                >
                  {renderBionicText(currentFile?.content || '')}
                </div>
              </div>
            )}

            {/* TAB CONTENT: AMBIENT AUDIO SYNTHESIZER */}
            {activeTab === 'audio' && (
              <div className="w-full max-w-xl space-y-6">
                <div className={`p-6 rounded-2xl border ${currentTheme.border} ${currentTheme.paper} space-y-6 shadow-2xl`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Radio className="w-5 h-5 text-indigo-400" /> Web Audio Night Synthesizer
                      </h3>
                      <p className="text-xs text-gray-400">Procedural ambient soundscapes designed for sleep & focus.</p>
                    </div>
                    <button
                      onClick={toggleAudio}
                      className={`p-4 rounded-full border transition-all ${
                        audioPlaying 
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
                          : 'bg-indigo-600 border-indigo-500 text-white'
                      }`}
                    >
                      {audioPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </button>
                  </div>

                  {/* Audio Visualizer Spectrum */}
                  <div className="h-20 bg-black/50 rounded-xl p-2 border border-gray-800 flex items-center justify-center">
                    <canvas ref={canvasRef} width={380} height={60} className="w-full h-full" />
                  </div>

                  {/* Sound Presets */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'space', name: 'Deep Space Drone', desc: 'Low frequency binaural theta waves' },
                      { id: 'rain', name: 'Rain & Low Frequency', desc: 'Calming rain acoustic spectrum' },
                      { id: 'ocean', name: 'Soft Ocean Pink Noise', desc: 'Gentle waves for relaxation' },
                      { id: 'noise', name: 'Ambient Warmth Hiss', desc: 'Constant background white noise' }
                    ].map(track => (
                      <button
                        key={track.id}
                        onClick={() => {
                          setCurrentSoundTrack(track.id);
                          if (audioPlaying) startAudio();
                        }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          currentSoundTrack === track.id 
                            ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' 
                            : 'border-gray-800 hover:bg-white/5 text-gray-400'
                        }`}
                      >
                        <p className="text-xs font-semibold text-white">{track.name}</p>
                        <p className="text-[10px] text-gray-500">{track.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Volume Control */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Master Volume</span>
                      <span className="font-mono text-indigo-400">{Math.round(audioVolume * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={audioVolume}
                      onChange={(e) => {
                        setAudioVolume(Number(e.target.value));
                        if (audioNodesRef.current[0]) {
                          audioNodesRef.current[0].gain.setValueAtTime(Number(e.target.value), audioCtxRef.current.currentTime);
                        }
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Sleep Timer */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" /> Sleep Timer
                    </span>
                    <div className="flex gap-2">
                      {[0, 15, 30, 60].map(mins => (
                        <button
                          key={mins}
                          onClick={() => setSleepTimerMinutes(mins)}
                          className={`px-2.5 py-1 rounded text-xs border ${
                            sleepTimerMinutes === mins 
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                              : 'border-gray-800 text-gray-400'
                          }`}
                        >
                          {mins === 0 ? 'Off' : `${mins}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: PSD LAYERS */}
            {activeTab === 'layers' && currentFile?.type === 'psd' && (
              <div className="w-full max-w-3xl space-y-3">
                <div className={`p-4 rounded-xl border ${currentTheme.border} bg-black/30 flex justify-between items-center`}>
                  <h3 className="font-semibold text-sm text-white">Photoshop Layer Inspector</h3>
                  <span className="text-xs font-mono text-indigo-400">{psdLayers.length} Layers Parsed</span>
                </div>

                <div className="space-y-2">
                  {psdLayers.map((layer) => (
                    <div 
                      key={layer.id}
                      className={`p-3.5 rounded-xl border ${currentTheme.border} ${currentTheme.paper} flex items-center justify-between`}
                    >
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => setPsdLayers(psdLayers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l))}
                          className={`p-1.5 rounded-lg border ${layer.visible ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-black/20 border-gray-700 text-gray-600'}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <div>
                          <p className={`text-xs font-medium ${layer.visible ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                            {layer.name}
                          </p>
                          <span className="text-[10px] font-mono text-gray-400 uppercase">{layer.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PAGE FOOTER */}
          <div className={`h-12 border-t ${currentTheme.border} px-4 flex items-center justify-between text-xs shrink-0 bg-black/20`}>
            <div className="flex items-center space-x-2">
              <button 
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className={`p-1.5 rounded-lg border ${currentTheme.border} disabled:opacity-40 hover:bg-white/5`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-gray-300">Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className={`p-1.5 rounded-lg border ${currentTheme.border} disabled:opacity-40 hover:bg-white/5`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center space-x-3 text-gray-400 text-[11px]">
              <button 
                onClick={() => setDyslexicFont(!dyslexicFont)} 
                className={`hover:text-white ${dyslexicFont ? 'text-indigo-400 font-bold' : ''}`}
              >
                {dyslexicFont ? 'Dyslexic Font On' : 'Standard Font'}
              </button>
            </div>
          </div>
        </main>

        {/* RIGHT CONTROL PANEL - FILTERS */}
        <aside className={`w-80 border-l ${currentTheme.border} p-5 flex flex-col space-y-6 shrink-0 overflow-y-auto hidden lg:flex`}>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Night Reading Tuning</span>
            </h2>

            {/* Amber Warmth */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-medium">Ambient Blue-Light Filter</span>
                <span className="font-mono text-amber-400">{warmth}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={warmth}
                onChange={(e) => setWarmth(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Brightness */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-medium">Display Brightness</span>
                <span className="font-mono text-indigo-400">{brightness}%</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="120" 
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Contrast */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-medium">Text Contrast</span>
                <span className="font-mono text-indigo-400">{contrast}%</span>
              </div>
              <input 
                type="range" 
                min="70" 
                max="150" 
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Font Size */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-medium">Font Size</span>
                <span className="font-mono text-indigo-400">{fontSize}px</span>
              </div>
              <input 
                type="range" 
                min="12" 
                max="32" 
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Line Height */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-300 font-medium">Line Spacing</span>
                <span className="font-mono text-indigo-400">{lineHeight}x</span>
              </div>
              <input 
                type="range" 
                min="1.2" 
                max="2.5" 
                step="0.1"
                value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setWarmth(35);
              setBrightness(90);
              setContrast(105);
              setFontSize(18);
              setLineHeight(1.8);
              setZoomLevel(100);
            }}
            className={`w-full py-2.5 rounded-xl border ${currentTheme.border} ${currentTheme.button} flex items-center justify-center space-x-2 text-xs font-medium transition-all`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Settings</span>
          </button>
        </aside>

      </div>
    </div>
  );
}