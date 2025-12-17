export enum AppStatus {
  Initializing = 'Initializing',
  Welcome = 'Welcome',
  Uploading = 'Uploading',
  Chatting = 'Chatting',
  Error = 'Error',
}

export enum MicStatus {
  Idle = 'Idle',
  Listening = 'Listening',
  Thinking = 'Thinking',
  Speaking = 'Speaking',
  Error = 'Error',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface GroundingSource {
  title?: string;
  uri?: string;
  text?: string; // For inline modal display
}

export interface UploadProgress {
  stage: 'initializing' | 'creating_store' | 'uploading' | 'analyzing';
  progress: number; // 0-100
}

export interface FileData {
  file: File;
  name: string;
  size: number;
}