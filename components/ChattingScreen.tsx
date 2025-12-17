import React, { useEffect, useRef, useState } from 'react';
import { MicStatus, ChatMessage } from '../types';
import { genAI, getLiveConfig } from '../services/geminiService';
import { createAudioContext, getAudioWorkletBlobUrl, float32ToInt16, decodeBase64 } from '../services/audioService';
import { LiveServerMessage } from '@google/genai';

interface ChattingScreenProps {
  documentContext: string | null; // extracted text content
  title: string;
  isSample: boolean;
  onClose: () => void;
}

const ChattingScreen: React.FC<ChattingScreenProps> = ({ documentContext, title, isSample, onClose }) => {
  const [micStatus, setMicStatus] = useState<MicStatus>(MicStatus.Idle);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Real-time transcript state
  const [liveInput, setLiveInput] = useState<string>("");
  const [liveOutput, setLiveOutput] = useState<string>("");

  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Accumulation refs
  const accumulatedInputRef = useRef<string>("");
  const accumulatedOutputRef = useRef<string>("");

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, liveInput, liveOutput]);

  useEffect(() => {
    connectToLiveAPI();
    
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanText = (text: string) => {
    return text.replace(/<.*?>/g, '').trim();
  };

  const disconnect = async () => {
    setIsConnected(false);
    setIsConnecting(false);
    setMicStatus(MicStatus.Idle);

    if (sessionRef.current) {
        sessionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    activeSourcesRef.current.clear();
    
    nextStartTimeRef.current = 0;
  };

  const connectToLiveAPI = async () => {
    try {
      setIsConnecting(true);
      setMicStatus(MicStatus.Idle);
      nextStartTimeRef.current = 0;
      
      accumulatedInputRef.current = "";
      accumulatedOutputRef.current = "";
      setLiveInput("");
      setLiveOutput("");

      const audioCtx = createAudioContext(24000);
      audioContextRef.current = audioCtx;
      
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true
      }});
      mediaStreamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = inputCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      
      const workletUrl = getAudioWorkletBlobUrl();
      await inputCtx.audioWorklet.addModule(workletUrl);
      
      const workletNode = new AudioWorkletNode(inputCtx, 'audio-processor');
      workletNodeRef.current = workletNode;
      
      source.connect(workletNode);
      workletNode.connect(inputCtx.destination);

      const config = getLiveConfig(documentContext, isSample, title);
      
      const sessionPromise = genAI.live.connect({
        model: config.model,
        config: config.config as any,
        callbacks: {
            onopen: () => {
                console.log("Connected to Gemini Live");
                setIsConnected(true);
                setIsConnecting(false);
                setMicStatus(MicStatus.Listening);
                
                workletNode.port.onmessage = (event) => {
                    const float32Data = event.data;
                    const int16Data = float32ToInt16(float32Data);
                    let binary = '';
                    const bytes = new Uint8Array(int16Data.buffer);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64Data = btoa(binary);

                    sessionPromise.then(session => {
                        session.sendRealtimeInput({
                            media: {
                                mimeType: "audio/pcm;rate=16000",
                                data: base64Data
                            }
                        });
                    });
                };
            },
            onmessage: async (message: LiveServerMessage) => {
                const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    setMicStatus(MicStatus.Speaking);
                    const pcmBytes = decodeBase64(audioData);
                    
                    const float32Data = new Float32Array(pcmBytes.length / 2);
                    const dataView = new DataView(pcmBytes.buffer);
                    for (let i = 0; i < float32Data.length; i++) {
                        const int16 = dataView.getInt16(i * 2, true);
                        float32Data[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
                    }

                    const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
                    buffer.getChannelData(0).set(float32Data);
                    
                    const source = audioCtx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioCtx.destination);
                    
                    const currentTime = audioCtx.currentTime;
                    const startTime = Math.max(nextStartTimeRef.current, currentTime);
                    
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + buffer.duration;
                    
                    activeSourcesRef.current.add(source);
                    source.onended = () => {
                        activeSourcesRef.current.delete(source);
                        if (activeSourcesRef.current.size === 0) {
                             setMicStatus(prev => prev === MicStatus.Speaking ? MicStatus.Listening : prev);
                        }
                    };
                }

                if (message.serverContent?.outputTranscription?.text) {
                    const text = message.serverContent.outputTranscription.text;
                    accumulatedOutputRef.current += text;
                    setLiveOutput(cleanText(accumulatedOutputRef.current));
                }
                
                if (message.serverContent?.inputTranscription?.text) {
                    const text = message.serverContent.inputTranscription.text;
                    accumulatedInputRef.current += text;
                    setLiveInput(cleanText(accumulatedInputRef.current));
                }

                const turnComplete = message.serverContent?.turnComplete;
                if (turnComplete) {
                   setMicStatus(MicStatus.Listening);
                   
                   const cleanInput = cleanText(accumulatedInputRef.current);
                   if (cleanInput) {
                        const newUserMsg: ChatMessage = {
                            id: Date.now().toString() + '-user',
                            role: 'user',
                            text: cleanInput,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, newUserMsg]);
                   }
                   accumulatedInputRef.current = "";
                   setLiveInput("");

                   const cleanOutput = cleanText(accumulatedOutputRef.current);
                   if (cleanOutput) {
                        const newModelMsg: ChatMessage = {
                            id: Date.now().toString() + '-model',
                            role: 'model',
                            text: cleanOutput,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, newModelMsg]);
                   }
                   accumulatedOutputRef.current = "";
                   setLiveOutput("");
                }
                
                const interrupted = message.serverContent?.interrupted;
                if (interrupted) {
                    console.log("Interrupted!");
                    activeSourcesRef.current.forEach(s => s.stop());
                    activeSourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                    setMicStatus(MicStatus.Listening);

                    const cleanOutput = cleanText(accumulatedOutputRef.current);
                    if (cleanOutput) {
                        const newModelMsg: ChatMessage = {
                            id: Date.now().toString() + '-model-interrupted',
                            role: 'model',
                            text: cleanOutput + " ...",
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, newModelMsg]);
                    }
                    
                    const cleanInput = cleanText(accumulatedInputRef.current);
                    if (cleanInput) {
                         const newUserMsg: ChatMessage = {
                             id: Date.now().toString() + '-user',
                             role: 'user',
                             text: cleanInput,
                             timestamp: Date.now()
                         };
                         setMessages(prev => [...prev, newUserMsg]);
                    }

                    accumulatedInputRef.current = "";
                    accumulatedOutputRef.current = "";
                    setLiveInput("");
                    setLiveOutput("");
                }
            },
            onclose: () => {
                console.log("Session closed");
                setIsConnected(false);
                setIsConnecting(false);
            },
            onerror: (e) => {
                console.error("Session error", e);
                setMicStatus(MicStatus.Error);
                setIsConnected(false);
                setIsConnecting(false);
            }
        }
      });
      
      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error("Failed to connect", err);
      setMicStatus(MicStatus.Error);
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    connectToLiveAPI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMicClick = () => {
    if (isConnecting) return;
    if (isConnected) {
        disconnect();
    } else {
        connectToLiveAPI();
    }
  };

  // --- Visualizer Logic Helpers ---
  const getOrbColor = () => {
      if (micStatus === MicStatus.Speaking) return 'from-pink-500 to-rose-400';
      if (micStatus === MicStatus.Listening) return 'from-blue-400 to-cyan-300';
      if (micStatus === MicStatus.Thinking) return 'from-amber-300 to-yellow-500';
      if (micStatus === MicStatus.Error) return 'from-gray-500 to-gray-400';
      // Default / Idle
      return 'from-slate-300 to-slate-200';
  };

  const getOrbAnimation = () => {
      if (micStatus === MicStatus.Speaking) return 'animate-breathing';
      if (micStatus === MicStatus.Listening) return 'animate-pulse';
      if (micStatus === MicStatus.Thinking) return 'animate-spin-slow';
      return '';
  };

  return (
    // CHANGED: Use fixed positioning to force full viewport coverage
    <div className="fixed inset-0 z-50 flex flex-col w-full h-[100dvh] bg-gradient-to-br from-orange-100 via-rose-100 to-amber-200">
      
      {/* Header - CHANGED: Use absolute positioning for the close button to guarantee visibility */}
      <header className="flex-none w-full p-6 flex justify-between items-center z-[60] relative">
        <div className="flex-1 min-w-0 pr-24">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="flex-none w-2 h-2 rounded-full bg-slate-900"></span>
              <span className="truncate max-w-full">{title}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium pl-4 uppercase tracking-widest opacity-70">
            {isConnecting ? 'Initializing...' : isConnected ? 'Connected to Gemini Live' : 'Offline'}
          </p>
        </div>
        
        {/* Absolute positioned close button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 px-5 py-2.5 rounded-full bg-white/90 shadow-md border border-white/50 flex items-center gap-2 text-slate-700 hover:bg-white hover:text-rose-600 hover:shadow-lg transition-all group z-[70]"
        >
            <span className="text-sm font-bold tracking-wide hidden sm:inline">会話を終了する</span>
            <span className="text-sm font-bold tracking-wide sm:hidden">終了</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-rose-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </header>

      {/* Main Visualizer Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative pb-4 w-full overflow-hidden">
        
        {/* Connection Status Pill */}
        <div className="mb-8 relative z-10">
             <div className={`
                px-4 py-1.5 rounded-full text-xs font-bold tracking-[0.2em] uppercase border backdrop-blur-md transition-all duration-500 flex items-center gap-2 shadow-sm
                ${isConnecting ? 'bg-amber-50/80 border-amber-200 text-amber-700 animate-pulse' : ''}
                ${!isConnecting && isConnected && micStatus === MicStatus.Listening ? 'bg-cyan-50/80 border-cyan-200 text-cyan-800' : ''}
                ${!isConnecting && isConnected && micStatus === MicStatus.Speaking ? 'bg-rose-50/80 border-rose-200 text-rose-800' : ''}
                ${!isConnecting && !isConnected ? 'bg-slate-100/80 border-slate-200 text-slate-500' : ''}
             `}>
                {isConnecting && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                )}
                {isConnecting ? "INITIALIZING AI..." : micStatus === MicStatus.Idle ? "Paused" : micStatus}
             </div>
        </div>

        {/* The Spatial Orb */}
        <div className="relative group cursor-pointer z-10" onClick={handleMicClick}>
            
            {/* Outer Glow Ring */}
            <div className={`absolute inset-[-20px] rounded-full blur-2xl opacity-40 transition-all duration-700 bg-gradient-to-r ${getOrbColor()} ${micStatus === MicStatus.Speaking ? 'scale-150' : 'scale-100'}`}></div>
            
            {/* Ripple Effect when Listening or Connecting */}
            {(isConnecting || (micStatus === MicStatus.Listening && !isConnecting)) && (
                <div className={`absolute inset-[-10px] rounded-full border border-current opacity-30 animate-ripple ${isConnecting ? 'text-amber-400' : 'text-cyan-400'}`}></div>
            )}
            
            {/* Second Ripple for connecting to make it look busy */}
            {isConnecting && (
                <div className="absolute inset-[-20px] rounded-full border border-amber-400 opacity-20 animate-ripple animation-delay-500"></div>
            )}

            {/* Core Orb */}
            <div className={`
                relative w-40 h-40 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center
                bg-gradient-to-br 
                ${isConnecting ? 'from-amber-100 to-amber-200' : getOrbColor()}
                ${getOrbAnimation()}
                ${isConnecting ? 'scale-95' : 'hover:scale-105'}
            `}>
                {/* Inner Glass shine */}
                <div className="absolute top-0 left-0 w-full h-full rounded-full bg-white/20 blur-sm"></div>
                
                {/* Icon Layer */}
                <div className="relative z-10 text-white drop-shadow-lg">
                    {isConnecting ? (
                        <div className="flex flex-col items-center">
                            <svg className="animate-spin h-10 w-10 text-amber-600 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : !isConnected ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-80" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                        </svg>
                    ) : micStatus === MicStatus.Speaking ? (
                        <div className="flex gap-1 items-end h-8">
                             <div className="w-1.5 h-3 bg-white rounded-full animate-bounce"></div>
                             <div className="w-1.5 h-6 bg-white rounded-full animate-bounce animation-delay-200"></div>
                             <div className="w-1.5 h-4 bg-white rounded-full animate-bounce animation-delay-400"></div>
                             <div className="w-1.5 h-7 bg-white rounded-full animate-bounce"></div>
                        </div>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </div>
            </div>
            
            <div className="mt-8 text-center flex flex-col items-center">
                 {isConnecting ? (
                    <div className="space-y-1 animate-pulse">
                        <p className="text-slate-700 text-sm font-bold tracking-wide">
                           音声AIを準備しています...
                        </p>
                        <p className="text-slate-400 text-xs">
                           初回接続には時間がかかる場合があります
                        </p>
                    </div>
                 ) : (
                    <p className="text-slate-600 text-sm font-medium tracking-wide opacity-80">
                        {isConnected ? 'Tap to Pause' : 'Tap to Start'}
                    </p>
                 )}
            </div>
        </div>

      </main>

      {/* Spatial Sheet (Transcript) */}
      {/* Changed height from 35% to 50% to show more history */}
      <div className="flex-none h-[50%] glass rounded-t-[2.5rem] border-t border-white/40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] relative overflow-hidden transition-all duration-500 ease-in-out w-full z-20">
        
        {/* Decorative sheen */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>

        <div className="flex-1 h-full overflow-y-auto p-8 pt-8 scrollbar-hide">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {messages.length === 0 && !liveInput && !liveOutput && (
                    <div className="text-center text-slate-400 text-sm tracking-wide font-light py-8">
                        Conversation history appears here
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div 
                            className={`max-w-[85%] px-6 py-4 rounded-3xl text-sm leading-relaxed backdrop-blur-sm shadow-sm border
                            ${msg.role === 'user' 
                                ? 'bg-slate-800/90 text-white rounded-tr-sm border-transparent' 
                                : 'bg-white/60 text-slate-800 rounded-tl-sm border-white/50'}`}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}

                {/* Live Typing Indicators */}
                {liveInput && (
                    <div className="flex justify-end animate-pulse">
                        <div className="max-w-[85%] px-6 py-4 rounded-3xl text-sm leading-relaxed shadow-sm bg-slate-800/50 text-white/90 rounded-tr-sm backdrop-blur-sm border border-transparent">
                            {liveInput}
                        </div>
                    </div>
                )}
                {liveOutput && (
                    <div className="flex justify-start animate-pulse">
                        <div className="max-w-[85%] px-6 py-4 rounded-3xl text-sm leading-relaxed shadow-sm bg-white/40 text-slate-700 rounded-tl-sm backdrop-blur-sm border border-white/30">
                            {liveOutput}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChattingScreen;