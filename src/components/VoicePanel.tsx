import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';

const SUGGESTIONS = [
  'Brief me on today',
  'What am I ignoring?',
  "What does Sarah need from me?",
  "What's overdue?",
];

export default function VoicePanel() {
  const { voiceOpen, toggleVoice, tasks, projects, currentUser } = useStore();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!voiceOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') toggleVoice(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [voiceOpen, toggleVoice]);

  if (!voiceOpen) return null;

  const getContextSummary = (query: string): string => {
    const activeTasks = tasks.filter((t) => t.status !== 'done');
    const overdue = activeTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
    const within72 = activeTasks.filter((t) => t.flags?.some(f => f.flagId === 'flag-72h'));
    const questions = activeTasks.filter((t) => t.flags?.some(f => f.flagId === 'flag-questions'));
    const high = activeTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');

    const q = query.toLowerCase();

    if (q.includes('brief') || q.includes('today')) {
      const lines: string[] = [];
      if (within72.length) lines.push(`You have ${within72.length} task${within72.length > 1 ? 's' : ''} marked within 72 hours: ${within72.map((t) => t.title).join(', ')}.`);
      if (overdue.length) lines.push(`${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue: ${overdue.map((t) => t.title).join(', ')}.`);
      if (questions.length) lines.push(`Sarah has ${questions.length} question${questions.length > 1 ? 's' : ''} for you.`);
      if (!within72.length && !overdue.length && !questions.length) lines.push(`All clear. Nothing urgent today.`);
      return lines.join(' ');
    }

    if (q.includes('ignoring') || q.includes('neglect')) {
      const neglected = high.filter((t) => {
        const updated = new Date(t.updatedAt);
        const days = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
        return days > 5;
      });
      if (neglected.length === 0) return 'No high-priority tasks have been neglected. You\'re on top of things.';
      return `You have ${neglected.length} high-priority task${neglected.length > 1 ? 's' : ''} that haven\'t been touched in over 5 days: ${neglected.map((t) => t.title).join(', ')}.`;
    }

    if (q.includes('sarah') || q.includes('questions')) {
      if (questions.length === 0) return 'Sarah has no questions for you right now.';
      return `Sarah has ${questions.length} question${questions.length > 1 ? 's' : ''} for you: ${questions.map((t) => t.title).join(', ')}.`;
    }

    if (q.includes('overdue')) {
      if (overdue.length === 0) return 'Nothing is overdue. Great work.';
      return `You have ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}: ${overdue.map((t) => t.title).join(', ')}.`;
    }

    return `You have ${activeTasks.length} active tasks across ${projects.length} projects. ${overdue.length > 0 ? `${overdue.length} are overdue.` : 'Nothing overdue.'} ${within72.length > 0 ? `${within72.length} need attention within 72 hours.` : ''}`;
  };

  const handleQuery = (query: string) => {
    if (!query.trim()) return;
    setTranscript(query);
    setLoading(true);
    setResponse('');

    setTimeout(() => {
      const result = getContextSummary(query);
      setResponse(result);
      setLoading(false);

      // Text to speech
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(result);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    }, 600);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Try Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setListening(false);
      handleQuery(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg mx-4 mb-8 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Volume2 size={15} className="text-brand-400" />
            <span className="text-sm font-semibold text-white">Voice AI</span>
          </div>
          <button onClick={toggleVoice} className="p-1 rounded text-white/30 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Suggestions */}
          {!transcript && (
            <div className="flex flex-wrap gap-2 mb-5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleQuery(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white/80 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Transcript */}
          {transcript && (
            <div className="mb-4">
              <p className="text-xs text-white/30 mb-1">You said</p>
              <p className="text-sm text-white/70 bg-white/[0.04] rounded-xl px-4 py-3">{transcript}</p>
            </div>
          )}

          {/* Response */}
          {loading && (
            <div className="flex items-center gap-2 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <span className="text-sm text-white/30">Thinking...</span>
            </div>
          )}
          {response && !loading && (
            <div className="mb-4">
              <p className="text-xs text-white/30 mb-1">Response</p>
              <p className="text-sm text-white/80 bg-brand-600/10 border border-brand-500/20 rounded-xl px-4 py-3 leading-relaxed">{response}</p>
            </div>
          )}

          {/* Mic button */}
          <div className="flex items-center justify-center pt-2">
            <button
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                listening
                  ? 'bg-red-500 shadow-lg shadow-red-500/40 scale-110'
                  : 'bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/30 hover:scale-105'
              }`}
            >
              {listening ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
            </button>
          </div>
          <p className="text-center text-xs text-white/20 mt-2">
            {listening ? 'Listening... release to send' : 'Hold to speak'}
          </p>
        </div>
      </div>
    </div>
  );
}
