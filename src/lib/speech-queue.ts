// Speech queue singleton - survives Next.js hot reloads
// MCP server POSTs text here, web UI reads via SSE

type SpeechListener = (text: string) => void;

interface SpeechQueue {
  listeners: Set<SpeechListener>;
}

const globalForSpeech = globalThis as unknown as {
  speechQueue?: SpeechQueue;
};

function getQueue(): SpeechQueue {
  if (!globalForSpeech.speechQueue) {
    globalForSpeech.speechQueue = {
      listeners: new Set(),
    };
  }
  return globalForSpeech.speechQueue;
}

export function enqueueSpeech(text: string) {
  const queue = getQueue();
  for (const listener of queue.listeners) {
    try {
      listener(text);
    } catch {
      queue.listeners.delete(listener);
    }
  }
}

export function addSpeechListener(cb: SpeechListener): () => void {
  const queue = getQueue();
  queue.listeners.add(cb);
  return () => {
    queue.listeners.delete(cb);
  };
}
