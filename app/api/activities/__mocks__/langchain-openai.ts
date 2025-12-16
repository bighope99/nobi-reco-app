export class ChatOpenAI {
  modelName: string;
  temperature: number;
  openAIApiKey?: string;

  constructor(config: any) {
    this.modelName = config.modelName;
    this.temperature = config.temperature;
    this.openAIApiKey = config.openAIApiKey;
  }
}
