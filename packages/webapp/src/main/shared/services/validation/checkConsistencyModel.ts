import { apiClient } from '../../api/api-client';

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
  await apiClient.postSSE<ConsistencyStreamMessage>('/semantic-consistency-check', { title, model }, onMessage);
}
