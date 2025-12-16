export class PromptTemplate {
  static fromTemplate(template: string) {
    return new PromptTemplate(template);
  }

  template: string;

  constructor(template: string) {
    this.template = template;
  }

  pipe(model: any) {
    return {
      invoke: async ({ content }: { content: string }) => ({
        content,
        model,
        template: this.template,
      }),
    };
  }
}
