import React, { useState, useRef } from 'react';
import { FileData } from '../types';

interface WelcomeScreenProps {
  onStart: (file: File | null, isSample: boolean) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isSampleSelected, setIsSampleSelected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile({
        file,
        name: file.name,
        size: file.size
      });
      setIsSampleSelected(false);
    }
  };

  const handleSampleClick = async () => {
    setIsSampleSelected(true);
    setSelectedFile(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile({
        file,
        name: file.name,
        size: file.size
      });
      setIsSampleSelected(false);
    }
  };

  const startChat = () => {
    if (isSampleSelected) {
      onStart(null, true);
    } else if (selectedFile) {
      onStart(selectedFile.file, false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-6 py-12 relative z-10">
      
      {/* Header Section */}
      <div className="text-center mb-12 space-y-6 max-w-4xl mx-auto">
        {/* Badge removed */}

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 leading-[1.1] drop-shadow-sm">
          Graffity AI
          <span className="block mt-1 text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500 pb-2">
            Conversation Engine
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-700 font-medium max-w-2xl mx-auto leading-relaxed opacity-90">
          ドキュメントをアップロードして、<br className="hidden sm:block" />
          AIとリアルタイムに自然な音声対話を実現します。
        </p>
      </div>

      {/* Main Action Area */}
      <div className="w-full max-w-xl relative group">
        
        {/* Card Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-rose-400 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

        <div className="relative w-full bg-white/60 backdrop-blur-2xl rounded-[1.8rem] p-2 shadow-2xl ring-1 ring-white/50">
          <div className="bg-white/50 rounded-3xl p-6 md:p-8 border border-white/40">
            
            {/* File Drop Zone */}
            {!selectedFile && !isSampleSelected && (
              <div 
                className="border-2 border-dashed border-orange-200/60 rounded-2xl p-10 cursor-pointer hover:bg-orange-50/50 hover:border-orange-300 transition-all group/zone flex flex-col items-center justify-center text-center"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,.txt,.md"
                  onChange={handleFileSelect}
                />
                <div className="text-orange-400 group-hover/zone:text-orange-500 transition-colors mb-4 transform group-hover/zone:scale-110 duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="font-bold text-slate-700 text-lg">クリックしてファイルを選択</p>
                <p className="text-sm text-slate-500 mt-2 font-medium">またはファイルをここにドロップ (PDF, TXT, MD)</p>
              </div>
            )}

            {/* Selected State */}
            {(selectedFile || isSampleSelected) && (
              <div className="bg-orange-50/50 rounded-2xl p-5 flex items-center justify-between shadow-inner mb-6 border border-orange-100 ring-1 ring-orange-200/50">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-orange-400 to-rose-400 p-3 rounded-xl text-white shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">
                      {isSampleSelected ? "2025_Graffity紹介資料.pdf (サンプル)" : selectedFile?.name}
                    </p>
                    <p className="text-xs font-semibold text-orange-600/80 uppercase tracking-wider mt-0.5">
                      {isSampleSelected ? "PRESET DOCUMENT" : `${(selectedFile!.size / 1024 / 1024).toFixed(2)} MB`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedFile(null); setIsSampleSelected(false); }}
                  className="text-slate-400 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-4">
              <button 
                disabled={!selectedFile && !isSampleSelected}
                onClick={startChat}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl shadow-orange-500/20 transition-all transform duration-300 ${
                  (selectedFile || isSampleSelected)
                    ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600 hover:scale-[1.02] hover:shadow-orange-500/30' 
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                アップロードして音声チャットを開始
              </button>

              {!isSampleSelected && !selectedFile && (
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200/60"></div>
                  </div>
                  <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest">
                    <span className="px-4 text-slate-400 bg-white/0 backdrop-blur-sm rounded-full">Or Try Sample</span>
                  </div>
                </div>
              )}

              {!isSampleSelected && !selectedFile && (
                <button 
                  onClick={handleSampleClick}
                  className="group w-full py-3.5 rounded-xl border border-white/60 bg-white/40 text-slate-600 font-semibold hover:bg-white/80 hover:text-orange-600 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                >
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">📄</span>
                  2025_Graffity紹介資料（プリセット）
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;