
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { UploadProgress } from "../types";
import { SAMPLE_DOC_CONTENT, SYSTEM_INSTRUCTION_BASE } from "../constants";

const API_KEY = process.env.API_KEY || '';

// Initialize GenAI client
export const genAI = new GoogleGenAI({ apiKey: API_KEY });

// Mime type detection
const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'txt': return 'text/plain';
    case 'md': return 'text/markdown';
    default: throw new Error(`Unsupported file type: .${ext}`);
  }
};

/**
 * Handles the upload and Text Extraction process.
 * Replaces RAG Store creation to avoid 500 errors and SDK compatibility issues.
 */
export const processDocument = async (
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<{ context: string, title: string }> => {
  
  onProgress({ stage: 'initializing', progress: 10 });
  const mimeType = getMimeType(file.name);
  
  // 1. Upload File using standard files API
  onProgress({ stage: 'uploading', progress: 30 });
  
  console.log("Uploading file...", file.name);
  const uploadResult = await genAI.files.upload({
      file: file,
      config: {
          displayName: file.name,
          mimeType: mimeType,
      }
  });
  
  const uploadedFile = (uploadResult as any).file || uploadResult;
  const fileResourceName = uploadedFile?.name;
  const fileUri = uploadedFile?.uri;

  if (!fileResourceName) {
      throw new Error("File upload failed: No resource name returned.");
  }
  
  console.log("File uploaded:", fileResourceName, "URI:", fileUri);

  // Poll for file processing completion
  let fileState = uploadedFile.state;
  while (fileState === 'PROCESSING') {
      await new Promise(r => setTimeout(r, 1000));
      const fileStatus = await genAI.files.get({ name: fileResourceName });
      fileState = fileStatus.state;
      console.log("File status:", fileState);
      if (fileState === 'FAILED') {
          throw new Error("File processing failed");
      }
  }

  // 2. Extract Text and Generate Title
  onProgress({ stage: 'analyzing', progress: 70 });
  console.log("Extracting content...");
  
  const model = 'gemini-2.5-flash';
  
  try {
      const extractionResult = await genAI.models.generateContent({
          model,
          contents: [
              {
                  fileData: {
                      fileUri: fileUri, // Use the full URI here, not just the name
                      mimeType: uploadedFile.mimeType || mimeType
                  }
              },
              {
                  text: "このドキュメントを分析してください。1. ドキュメントのタイトル（日本語10文字以内） 2. ドキュメントの全テキスト内容 を抽出してJSON形式で返してください。"
              }
          ],
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      title: { type: Type.STRING },
                      fullText: { type: Type.STRING }
                  },
                  required: ["title", "fullText"]
              }
          }
      });

      const result = JSON.parse(extractionResult.text || "{}");
      const title = result.title || file.name;
      const context = result.fullText || "";

      onProgress({ stage: 'analyzing', progress: 100 });
      return { context, title };

  } catch (e) {
      console.error("Extraction failed", e);
      // Fallback if JSON parsing fails or model refuses
      return { context: "Failed to extract text. Please rely on general knowledge.", title: file.name };
  }
};

/**
 * Prepare configuration for Live API
 */
export const getLiveConfig = (contextText: string | null, useSample: boolean, title: string) => {
    // 1. Define Persona
    let personaInstruction = "";
    if (useSample) {
        personaInstruction = `あなたはGraffity株式会社の会社紹介AIとして振る舞ってください。提供された資料に基づき、Graffityの魅力を伝えてください。`;
    } else {
        personaInstruction = `あなたは提供されたドキュメント「${title}」の専任解説AIとして振る舞ってください。`;
    }

    // 2. Prepare Content
    let docContent = "";
    if (useSample) {
        docContent = SAMPLE_DOC_CONTENT;
    } else if (contextText) {
        docContent = contextText;
    }

    // 3. Construct System Instruction with Recency Bias strategy
    // ORDER: [Persona] -> [Document Content] -> [Strict Rules (SYSTEM_INSTRUCTION_BASE)]
    // Putting rules LAST makes the model follow them strictly.
    
    let systemInstruction = personaInstruction;
    
    if (docContent) {
        systemInstruction += `\n\n[回答の根拠となる資料(Reference Document)]\n${docContent}`;
    }

    // Append the strict VUI rules at the very end
    systemInstruction += `\n\n${SYSTEM_INSTRUCTION_BASE}`;

    return {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            systemInstruction: systemInstruction,
            // Use Modality.AUDIO
            responseModalities: [Modality.AUDIO], 
            // Enable transcription
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: 'Puck'
                    }
                }
            }
        }
    };
};