import React, { useState } from 'react';
import { AppStatus, UploadProgress } from './types';
import WelcomeScreen from './components/WelcomeScreen';
import UploadingScreen from './components/UploadingScreen';
import ChattingScreen from './components/ChattingScreen';
import { processDocument } from './services/geminiService';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.Welcome);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ stage: 'initializing', progress: 0 });
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState<string>("New Chat");
  const [isSample, setIsSample] = useState(false);

  const handleStart = async (file: File | null, sample: boolean) => {
    setIsSample(sample);
    
    if (sample) {
      // Skip upload, go direct to chat
      setChatTitle("Graffity会社紹介");
      setStatus(AppStatus.Chatting);
      return;
    }

    if (!file) return;

    setStatus(AppStatus.Uploading);
    try {
      const { context, title } = await processDocument(file, (progress) => {
        setUploadProgress(progress);
      });
      setDocumentContext(context);
      setChatTitle(title);
      setStatus(AppStatus.Chatting);
    } catch (error) {
      console.error("Upload failed", error);
      setStatus(AppStatus.Error);
    }
  };

  const handleClose = async () => {
    // Cleanup - for text context we just clear state
    setDocumentContext(null);
    setStatus(AppStatus.Welcome);
  };

  const renderContent = () => {
    switch (status) {
      case AppStatus.Initializing:
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
      case AppStatus.Welcome:
        return <WelcomeScreen onStart={handleStart} />;
      case AppStatus.Uploading:
        return <UploadingScreen progress={uploadProgress} />;
      case AppStatus.Chatting:
        return (
          <ChattingScreen 
            documentContext={documentContext} 
            title={chatTitle}
            isSample={isSample}
            onClose={handleClose} 
          />
        );
      case AppStatus.Error:
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-8">
                <h2 className="text-3xl font-bold text-red-500 mb-4">エラーが発生しました</h2>
                <p className="text-slate-600 mb-8">ファイルの処理中または接続中に問題が発生しました。</p>
                <button 
                  onClick={() => setStatus(AppStatus.Welcome)}
                  className="px-6 py-3 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600"
                >
                    ホームに戻る
                </button>
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-300/20 rounded-full blur-3xl pointer-events-none"></div>
        
        {renderContent()}
    </div>
  );
};

export default App;