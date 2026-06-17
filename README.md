# Voice Agent RAG File Search

## アプリ概要

- PDF、TXT、Markdown の内容をもとに音声で会話できる React アプリ
- Gemini Files API でドキュメントを解析し、Gemini Live API で低遅延の音声対話を行う
- ブラウザのマイク入力と AI 音声出力をリアルタイムに扱う

## アプリの仕様と挙動

- 初期画面でファイルをアップロードするか、内蔵サンプルを選択する
- アップロードしたファイルからタイトルと本文を抽出し、会話用コンテキストとして使う
- チャット画面では入力音声と AI 応答の文字起こしを表示する
- ユーザーの発話割り込み時は再生中の AI 音声を停止する

## 構成

- `App.tsx`: 画面状態とドキュメント処理フロー
- `components/WelcomeScreen.tsx`: ファイル選択とサンプル選択
- `components/UploadingScreen.tsx`: アップロードと解析の進捗表示
- `components/ChattingScreen.tsx`: Live API 接続、音声入出力、会話ログ
- `services/geminiService.ts`: Files API、本文抽出、Live API 設定
- `services/audioService.ts`: PCM 変換、Base64 変換、AudioWorklet
- `constants.ts`: システム指示と内蔵サンプル内容

```text
Browser
  -> File upload / sample selection
  -> Gemini Files API text extraction
  -> Gemini Live API voice session
  -> Web Audio API playback and transcript UI
```

## 開発メモ

- Vite + React + TypeScript の構成
- API キーは `vite.config.ts` の定義に合わせて `GEMINI_API_KEY` を使う
- 利用できるスクリプトは `package.json` を参照
