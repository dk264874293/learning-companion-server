import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as TurndownService from 'turndown';
import { type ChatConfig, Ling } from '@bearbobo/ling';
import makeQuestionPrompt from '@/lib/prompts/make-question.tpl'

@Injectable()
export class SearchService {
    private turndown:any;
    constructor(
        private readonly httpService: HttpService,
        // private readonly turndownService: TurndownService
    ) {
        this.turndown = new TurndownService()
            .addRule('notLink', 
                { 
                    filter: ['a'], 
                    replacement: function (content) { return ''; },
                }).remove(
                    ['script', 'meta', 'style', 'link', 'head', 'a']
                );
    }
    async search(topic: string): Promise<any> {
        const query = JSON.stringify({
            q: topic,
            location: 'China',
            gl: 'cn',
            hl: 'zh-cn',
            num: 5,
          });
          try {
            const response = await this.httpService.post("https://google.serper.dev/search",
                query,
                {
                  headers: {
                    'X-API-KEY': process.env.VITE_SERPER_API_KEY,
                    'Content-Type': 'application/json',
                  },
                }
              ).toPromise()
              const data = response.data;
              console.log('response.data',data);
              let searchResult = '';
              if (data.answerBox) {
                searchResult += `${data.answerBox.snippet}\n\n${data.answerBox.snippetHighlighted?.join('\n')}\n\n`;
              }
              if (data.organic) {
                data.organic.forEach((result: any) => {
                  searchResult += `## ${result.title}\n${result.snippet}\n\n`;
                });
              }
            
              if (topic.includes('site:')) {
                let url = topic.split('site:')[1];
                if (!/^http(s)?:\/\//.test(url)) {
                  url = 'https://' + url.replace(/^\/\//, '');
                }
                const response = await this.httpService.get(url).toPromise();
                const content = this.turndown.turndown(response.data);
                if (content) {
                  searchResult += `##原文\n\n${content}\n\n`;
                }
              }
            
              return { query: topic, result: searchResult };
          } catch (error) {
            console.log(error);
            return { query: topic, result: '搜索失败' };
          }
          
    }

    async makeQuestion(query: string) {
        const ling = new Ling({
            model_name: process.env.VITE_KIMI_MODEL_NAME, 
            api_key: process.env.VITE_KIMI_API_KEY, 
            endpoint:process.env.VITE_KIMI_END_POINT, 
            sse: true,
        }); 
        const bot = ling.createBot(); 
        bot.addPrompt(makeQuestionPrompt); 
        bot.chat(query); 
        ling.close();
        console.log('ling.stream', ling.stream)
        return query
    }
}
