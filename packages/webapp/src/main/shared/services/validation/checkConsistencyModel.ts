import { BACKEND_URL } from '../../constants/constant';

export interface ConsistencyStreamMessage {
  sat: boolean | null;
  done: boolean;
  message: string;
  scope?: number;
  errors?: string[];
  warnings?: string[];
}

export async function checkConsistencyStream(
  model: object,
  title: string,
  onMessage: (data: ConsistencyStreamMessage) => void,
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/semantic-consistency-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, model }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onMessage(data);
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }
}
