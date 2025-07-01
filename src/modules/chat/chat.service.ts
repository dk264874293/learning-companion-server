import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CozeAPI, RoleType } from '@coze/api';
import { ChatConfig, Ling } from '@bearbobo/ling';
import { Response } from 'express';
import { LingService } from '@/modules/ling/ling.service';
import { SearchService } from '@/modules/search/search.service';
import makeQuestionPrompt from 'src/lib/prompts/make-question.tpl';
import quickAnswerPrompt from 'src/lib/prompts/quick-answer.tpl';
import outlinePrompt from 'src/lib/prompts/outline.tpl'

declare global {
    interface ReadableStream<R = any> {
        readonly locked: boolean;
        clone(): ReadableStream<R>;
        getReader(): ReadableStreamDefaultReader<R>;
    }

    interface ReadableStreamDefaultReader<R = any> {
        read(): Promise<ReadableStreamReadResult<R>>;
        releaseLock(): void;
      }
}

@Injectable()
export class ChatService {
    private config: ChatConfig;

    private readonly CozeAPI = new CozeAPI({
        token: process.env.VITE_COZE_API_KET,
        baseURL: 'https://api.coze.cn',
    });
    constructor(
        private readonly lingService: LingService,
        private readonly searchService: SearchService,
        private readonly configService: ConfigService
    ) {
        this.config = {
            model_name: this.configService.get('VITE_KIMI_MODEL_NAME'),
            api_key: this.configService.get('VITE_KIMI_API_KEY'),
            endpoint: this.configService.get('VITE_KIMI_END_POINT'),
            sse: true,
        };
    }

  async generateChat(question: string,query:string, res: Response) {
    const userConfig = {
        gender: 'female',
        age: '6',
    };
    let searchResults = '';
    if (query) {
        const queries = query.split(';');
        const promises = queries.map((query) => this.searchService.search(query));

        searchResults = JSON.stringify(await Promise.all(promises));
    }
    const ling = new Ling(this.config);
    const quickAnswerBot = ling.createBot('quick-answer', {}, {
        response_format: { type: 'text' }
    });
    quickAnswerBot.addPrompt(quickAnswerPrompt, userConfig);

    const outlineBot = ling.createBot('outline');
    outlineBot.addPrompt(outlinePrompt, userConfig);

    outlineBot.addFilter('image_prompt'); 
    outlineBot.addListener('string-response', 
        ({ uri, delta }) => { 
            ling.handleTask(
                async () => { 
                    if (uri.includes('image_prompt')) { 
                        const { url } = await this.generateImage(`A full-size picture suitable as a cover for children's picture books that depicts ${delta}. DO NOT use any text or symbols.`);
                        ling.sendEvent({ uri: 'cover_image', delta: url });
                        console.log('url', url)
                    } });
            });

    if (searchResults) {
        quickAnswerBot.addPrompt(`参考资料:\n${searchResults}`);
        outlineBot.addPrompt(`参考资料:\n${searchResults}`);
    }

    quickAnswerBot.chat(question);
    outlineBot.chat(question);

    ling.close();

    // setting below headers for Streaming the data
    const reader = (ling.stream as unknown as ReadableStream).getReader();
    const abortController = new AbortController();
    const cleanup = () => {
        if (!reader || reader.closed) return;
        try {
            if ('releaseLock' in reader && !reader.closed) {
                reader.releaseLock();
            }
        } catch (e) {
            console.warn('锁释放异常:', e);
        }
        
        if (!abortController.signal.aborted) {
            abortController.abort();
        }
    };

    try {
        res.on('close', () => {
            if (!abortController.signal.aborted) {
                cleanup();
            }
        });
        for await (const chunk of this.readStream(reader, abortController.signal)) {
            res.write(chunk);
            if (abortController.signal.aborted) break;
        }
        res.end();
    } catch (err) {
        console.error('流处理失败:', err);
        res.status(500).end();
    } finally {
        if (!abortController.signal.aborted) {
            cleanup();
        }
    }
  }

  async streamQuestion(question: string,  res: Response) {
    const { stream } = await this.lingService.createChatStream(question);
    console.log('stream', question);
    if ('locked' in stream && stream.locked) {
        throw new Error('流已被锁定');
      }
    const reader = (stream as unknown as ReadableStream).getReader();
    const abortController = new AbortController();
    const cleanup = () => {
        console.log('cleanup', cleanup)
        if (!reader || reader.closed) return;
        
        try {
            if ('releaseLock' in reader && !reader.closed) {
                reader.releaseLock();
            }
        } catch (e) {
            console.warn('锁释放异常:', e);
        }
        
        if (!abortController.signal.aborted) {
            abortController.abort();
        }
    };

    try {
        res.on('close', () => {
            console.log('close');
            if (!abortController.signal.aborted) {
                cleanup();
            }
        });
        for await (const chunk of this.readStream(reader, abortController.signal)) {
            res.write(chunk);
            if (abortController.signal.aborted) break;
        }
        res.end();
    } catch (err) {
        console.error('流处理失败:', err);
        res.status(500).end();
    } finally {
        if (!abortController.signal.aborted) {
            cleanup();
        }
    }
  }

  async getAnswers(question: string,  res: Response) {
    let searchResults = ""
    if (question) { 
        const queries = question.split(';'); 
        const promises = queries.map((query) => this.searchService.search(query)); 
        searchResults = JSON.stringify(await Promise.all(promises)); 
    }
    console.log('searchResults', searchResults)
    const { stream } = await this.lingService.quickAnswer(question, searchResults);
   
    // if ('locked' in stream && stream.locked) {
    //     throw new Error('流已被锁定');
    // }
    const reader = (stream as unknown as ReadableStream).getReader();
    const abortController = new AbortController();
    const cleanup = () => {
        if (!reader) return;
        try {
            if (reader) {
                reader.releaseLock();
            }
        } catch (e) {
            console.warn('释放锁时警告:', e);
        }
        abortController.abort();
    };

    try {
        res.on('close', () => {
            if (!abortController.signal.aborted) {
                cleanup();
            }
        });

        for await (const chunk of this.readStream(reader, abortController.signal)) {
            res.write(chunk);
            if (abortController.signal.aborted) break;
        }
        res.end();
    } catch (err) {
        console.error('流处理失败:', err);
        res.status(500).end();
    } finally {
        if (!abortController.signal.aborted) {
            cleanup();
        }
    }
  }

  async generateImage(prompt: string) {
    try {
        const res = await this.CozeAPI.workflows.runs.create({
            workflow_id: '7520895713775190051',
            parameters: {
                "input": prompt
            }
        })
        console.log('generate Image', res)
        return JSON.parse(res.data)
    } catch (error) {
        console.log('generate Image error', error)
        return new Error('generate Image error')
    }
  
  }

  private async *readStream(reader: ReadableStreamDefaultReader, signal: AbortSignal) {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break;
      yield value;
    }
  }
}    