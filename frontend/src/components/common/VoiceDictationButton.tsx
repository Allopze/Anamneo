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
  label?: string;
}

export default function VoiceDictationButton({ onTranscript, label = 'Dictar' }: Props) {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_VOICE_DICTATION !== 'false';
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  if (!enabled || !supported) return null;

  const handleToggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition!();
    setError(null);
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
        setError(null);
      }
    };
    recognition.onerror = (event) => {
      const errorCode = event?.error;
      setError(errorCode === 'not-allowed' || errorCode === 'service-not-allowed'
        ? 'Permiso de microfono denegado'
        : 'No se pudo iniciar el dictado');
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError('No se pudo iniciar el dictado');
      setListening(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={listening}
        aria-label={listening ? 'Detener dictado por voz' : 'Iniciar dictado por voz'}
        className={`inline-flex min-h-10 touch-manipulation items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/25 ${
          listening
            ? 'border-status-red/40 bg-status-red/10 text-status-red-text hover:bg-status-red/15'
            : 'border-frame/15 bg-surface-elevated text-ink hover:border-frame/30 hover:bg-surface-base'
        }`}
        title={listening ? 'Detener dictado' : 'Dictado por voz'}
      >
        {listening ? <FiMicOff className="h-4 w-4" /> : <FiMic className="h-4 w-4" />}
        {listening ? 'Escuchando…' : label}
      </button>
      {error ? (
        <span role="status" className="max-w-44 text-right text-xs text-status-red-text">
          {error}
        </span>
      ) : null}
    </span>
  );
}
