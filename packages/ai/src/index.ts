export interface SourceReference {
  assetId: string;
  excerpt: string;
  score: number;
}
export interface AIRequest {
  prompt: string;
  sources: SourceReference[];
  signal?: AbortSignal;
}
export interface AIGateway {
  generate(request: AIRequest): AsyncIterable<string>;
}
export interface RetrievalAdapter {
  search(query: string, limit: number): Promise<SourceReference[]>;
}
/** The provider is intentionally injected; no canned responses or implicit API calls. */
export async function* generateWithSources(
  gateway: AIGateway,
  retrieval: RetrievalAdapter,
  prompt: string,
  signal?: AbortSignal,
) {
  if (!prompt.trim()) throw new Error('A prompt is required');
  signal?.throwIfAborted();
  const sources = await retrieval.search(prompt, 8);
  for await (const chunk of gateway.generate({ prompt, sources, signal })) {
    signal?.throwIfAborted();
    yield { text: chunk, sources };
  }
}
