export type BotCaptureResult = {
  captureId: string;
  postId: string;
  platform: string;
  deduplicated: boolean;
  saved: boolean;
};

export class CaptureClient {
  private readonly baseUrl: URL;
  private readonly request: typeof fetch;

  constructor(baseUrl: string, request: typeof fetch = fetch) {
    this.baseUrl = new URL(baseUrl);
    this.request = request;
  }

  async save(input: {
    url: string;
    channel: 'bot';
    submitterPseudonym: string;
    note: string | null;
  }): Promise<BotCaptureResult> {
    const endpoint = new URL('/api/captures', this.baseUrl);
    const response = await this.request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: input.url,
        captureChannel: input.channel,
        sourceLane: 'personalized',
        selectionMethod: 'user_shared',
        submitterPseudonym: input.submitterPseudonym,
        discoverySurface: 'shared',
        note: input.note,
      }),
    });
    const payload = await response.json() as BotCaptureResult & { message?: string };
    if (!response.ok) throw new Error(payload.message ?? `Capture API returned HTTP ${response.status}`);
    return payload;
  }
}

