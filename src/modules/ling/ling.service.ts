import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatConfig, Ling } from '@bearbobo/ling';
import makeQuestionPrompt from 'src/lib/prompts/make-question.tpl';
import quickAnswerPrompt from 'src/lib/prompts/quick-answer.tpl';

@Injectable()
export class LingService implements OnModuleDestroy {
  private ling: Ling;
  private config: ChatConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      model_name: this.configService.get('VITE_KIMI_MODEL_NAME'),
      api_key: this.configService.get('VITE_KIMI_API_KEY'),
      endpoint: this.configService.get('VITE_KIMI_END_POINT'),
      sse: true,
    };
    
  }

  async createChatStream(question: string) {
    const ling = new Ling(this.config);
    const bot = ling.createBot();
    bot.addPrompt(makeQuestionPrompt);
    bot.chat(question);
    ling.close();
    return { bot, stream: ling.stream as unknown as NodeJS.ReadableStream };
  }
  async quickAnswer(question: string,query:string,searchResults?:string) {
    const ling = new Ling(this.config);
    const bot = ling.createBot('quick-answer', {}, 
      { response_format: { type: 'text' } }); 
    bot.addPrompt(quickAnswerPrompt,
        { gender:'female', age: '6', }); 
    if (searchResults) bot.addPrompt(`参考资料:\n${searchResults}`);
    bot.chat(question); 
    ling.close();
    
    return { bot, stream:ling.stream as unknown as NodeJS.ReadableStream };
  }


  close() {
    this.ling.close();
  }

  onModuleDestroy() {
    this.close();
  }
}    