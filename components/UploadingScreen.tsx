import React from 'react';
import { UploadProgress } from '../types';

interface UploadingScreenProps {
  progress: UploadProgress;
}

const UploadingScreen: React.FC<UploadingScreenProps> = ({ progress }) => {
  const getMessage = (stage: string) => {
    switch (stage) {
      case 'initializing': return '初期化中...';
      case 'creating_store': return 'RAGストアを作成中...';
      case 'uploading': return 'ファイルをアップロード中...';
      case 'analyzing': return 'ドキュメントを分析中...';
      default: return '処理中...';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 max-w-lg mx-auto text-center">
      <div className="w-24 h-24 mb-8 relative">
        {/* Custom SVG Spinner */}
        <svg className="animate-spin text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-2">{getMessage(progress.stage)}</h2>
      <p className="text-slate-600 mb-8">しばらくお待ちください。AIが資料を読み込んでいます。</p>

      {/* Progress Bar with Stripes */}
      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden shadow-inner">
        <div 
          className="h-full bg-orange-500 animate-progress-stripes relative transition-all duration-500 ease-out"
          style={{ 
            width: `${progress.progress}%`,
            backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
            backgroundSize: '1rem 1rem'
          }}
        ></div>
      </div>
      <div className="mt-2 text-right text-sm font-bold text-orange-600">{progress.progress}%</div>
    </div>
  );
};

export default UploadingScreen;
