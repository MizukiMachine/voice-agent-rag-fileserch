# Graffity AI Conversation Engine

このプロジェクトは、Google Gemini 2.0 Flash (Live API) を活用し、ユーザーがアップロードしたPDFなどのドキュメントの内容に基づいて、リアルタイムかつ低遅延で音声対話を行うAIアプリケーションです。

## 🚀 特徴

*   **リアルタイム音声対話:** Gemini Live API (Multimodal Live API) を使用し、人間のような自然で高速な音声会話を実現。
*   **ドキュメント解析 (RAGライク):** PDF/TXT/MDファイルをアップロードすると、その内容をコンテキストとして理解し、専門家のように回答します。
*   **Audio Worklet:** Web Audio APIのAudio Workletを使用し、ブラウザ上で効率的な音声処理（PCM変換・リサンプリング）を行います。
*   **Digital Zen UI:** "Calm Technology" をテーマにした、美しく没入感のあるモダンなUIデザイン。

## 🛠 技術スタック

*   **Frontend Framework:** React 19 + TypeScript
*   **Build Tool:** Vite (想定) / ESM modules (現在の構成はESM直接インポート)
*   **Styling:** Tailwind CSS (CDN/JIT)
*   **AI SDK:** Google GenAI SDK (`@google/genai`)
*   **Audio:** Web Audio API (AudioWorklet), MediaStream Recording API

## 📂 プロジェクト構成

```
.
├── index.html              # エントリーポイント (Tailwind設定含む)
├── index.tsx               # Reactルートマウント
├── App.tsx                 # メインアプリケーションコンポーネント (状態遷移管理)
├── types.ts                # TypeScript型定義
├── constants.ts            # 定数定義 (プロンプト、サンプルデータ)
├── metadata.json           # アプリ権限設定 (カメラ/マイク)
├── components/             # UIコンポーネント
│   ├── WelcomeScreen.tsx   # ファイルアップロード・初期画面
│   ├── UploadingScreen.tsx # ロード画面・進捗表示
│   └── ChattingScreen.tsx  # 音声対話メイン画面 (Live API接続・可視化)
└── services/               # ロジック・API通信
    ├── audioService.ts     # 音声処理 (Encoding/Decoding/AudioWorklet)
    └── geminiService.ts    # Gemini API通信 (Files API, Live API接続)
```

## 💻 ローカル開発環境のセットアップ

このプロジェクトをローカル環境 (VS Code等) で開発するための手順です。

### 1. 前提条件

*   Node.js (v18以上推奨)
*   npm または yarn
*   Google Cloud Project での Gemini API キーの取得

### 2. インストール

標準的な Vite + React プロジェクトとして構成する場合の例です。

```bash
# プロジェクトの作成 (まだ枠組みがない場合)
npm create vite@latest graffity-ai-voice -- --template react-ts
cd graffity-ai-voice

# 必要なパッケージのインストール
npm install @google/genai lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

※ 現在のコードベースは `index.html` からESMで直接ライブラリを読み込む構成になっています。ローカル開発時は `package.json` ベースの構成（上記）に移行することをお勧めします。その際、`index.html` の `<script type="importmap">` は不要になり、`import` 文は `node_modules` から解決されるようになります。

### 3. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、APIキーを設定してください。

```env
# .env
VITE_API_KEY=your_gemini_api_key_here
```

**注意:**
*   現在のコード (`services/geminiService.ts`) は `process.env.API_KEY` を参照しています。Viteを使用する場合は `import.meta.env.VITE_API_KEY` に書き換える必要があります。
*   セキュリティのため、APIキーは公開リポジトリにコミットしないでください。

### 4. アプリケーションの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` (デフォルト) を開いてください。

## ⚠️ 既知の制限事項とデプロイ時の注意

1.  **Files API の CORS 制限**
    *   `services/geminiService.ts` 内の `genAI.files.upload` は、Webブラウザから直接実行するとCORSエラーが発生する場合があります（特に本番環境）。
    *   **対策:** 本番運用時は、ファイルアップロード処理をバックエンドサーバー（Next.js API RoutesやCloud Functionsなど）経由で行うか、テキスト抽出をクライアントサイドで行いテキストデータとしてAIに渡す実装への変更を検討してください。

2.  **APIキーの露出**
    *   クライアントサイドのみで動作するアプリのため、APIキーがブラウザに配信されます。本番公開時は、Firebase App Checkなどの利用や、BFF (Backend for Frontend) パターンによるキーの隠蔽を強く推奨します。

## 📝 主な機能解説

### Audio Processing (`services/audioService.ts`)
Gemini Live APIは生のPCMデータ (16bit/24kHzなど) をやり取りします。ブラウザのWeb Audio API (Float32) との相互変換を行うため、`AudioWorklet` を使用してメインスレッドをブロックせずに高速な変換処理を実装しています。

### Gemini Live Connection (`components/ChattingScreen.tsx`)
WebSocket (内部的にはSDKが管理) を通じて常時接続を確立します。
*   `MicStatus` (Idle/Listening/Thinking/Speaking) に応じてUI（オーブのアニメーション）を制御しています。
*   ユーザーの発話が割り込まれた場合 (`interrupted`)、AIの発話を即座に停止する処理が含まれています。
