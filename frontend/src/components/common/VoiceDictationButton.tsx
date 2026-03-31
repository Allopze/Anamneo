'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FiMic, FiMicOff } from 'react-icons/fi';

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface Props {
  onTranscript: (text: string) => void;
}

export default function VoiceDictationButton({ onTranscript }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const SpeechRecognition = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
  }, []);

  useEffect(() => {
    setSupported(Boolean(SpeechRecognition));
  }, [SpeechRecognition]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!supported) return null;

  const handleToggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition!();
    recognition.lang = 'es-CL';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();

      if (transcript) {
        onTranscript(transcript);
      }
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        listening
          ? 'border-status-red/30 bg-status-red/10 text-status-red hover:bg-status-red/20'
          : 'border-status-yellow/60 bg-status-yellow/30 text-accent-text hover:bg-status-yellow/40'
      }`}
      title={listening ? 'Detener dictado' : 'Dictado por voz'}
    >
      {listening ? <FiMicOff className="h-3.5 w-3.5" /> : <FiMic className="h-3.5 w-3.5" />}
      {listening ? 'Escuchando…' : 'Dictado'}
    </button>
  );
}
