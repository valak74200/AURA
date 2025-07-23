// AudioWorklet processor for real-time audio analysis
class AudioAnalysisProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.sampleRate = sampleRate; // AudioWorklet global
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // Pass audio through (for monitoring)
    if (input.length > 0 && output.length > 0) {
      for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
        output[channel].set(input[channel]);
      }
    }

    // Process input for analysis
    if (input.length > 0 && input[0].length > 0) {
      const inputChannel = input[0];
      
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;

        // When buffer is full, send it for analysis
        if (this.bufferIndex >= this.bufferSize) {
          // Convert to unsigned byte array for backend analysis (0-255)
          const audioArray = new Uint8Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            // Convert from [-1, 1] float to [0, 255] uint8
            audioArray[j] = Math.max(0, Math.min(255, Math.round((this.buffer[j] + 1) * 127.5)));
          }

          // Send audio data to main thread
          this.port.postMessage({
            type: 'audioData',
            audioArray: Array.from(audioArray),
            sampleRate: this.sampleRate,
            duration: this.bufferSize / this.sampleRate
          });

          this.bufferIndex = 0;
        }
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('audio-analysis-processor', AudioAnalysisProcessor);