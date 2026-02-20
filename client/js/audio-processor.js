/**
 * AudioWorklet Processor — streams PCM Float32 chunks to main thread
 * Used for low-latency audio capture without ScriptProcessorNode
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.buffer.length) {
        this.port.postMessage(this.buffer.slice());
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
