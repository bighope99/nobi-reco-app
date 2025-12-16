export class ChatGoogleGenerativeAI {
  model: string;
  temperature: number;
  apiKey?: string;

  constructor(config: { model: string; temperature?: number; apiKey?: string }) {
    this.model = config.model;
    this.temperature = config.temperature ?? 0;
    this.apiKey = config.apiKey;
  }
}
