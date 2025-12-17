
/**
 * Utility functions for Audio Processing
 */

// Basic base64 decode for raw PCM
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Float32 audio data to Int16 PCM for Gemini API
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}

// Convert Int16 PCM (from Gemini) to Float32 for Web Audio API
export function int16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    const s = int16Array[i];
    float32Array[i] = s < 0 ? s / 0x8000 : s / 0x7FFF;
  }
  return float32Array;
}

export const createAudioContext = (sampleRate: number) => {
  return new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
};

// Worklet code for audio processing
// Optimized to use TypedArrays and avoid memory allocation in the hot loop
const audioWorkletCode = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // ~256ms at 16kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputChannel = input[0];
      
      // Efficient copying
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
        
        // When buffer is full, send it
        if (this.bufferIndex >= this.bufferSize) {
          // Send a copy of the buffer to avoid race conditions
          this.port.postMessage(this.buffer.slice());
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;

export const getAudioWorkletBlobUrl = () => {
  const blob = new Blob([audioWorkletCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};
