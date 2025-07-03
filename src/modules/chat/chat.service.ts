import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CozeAPI, RoleType } from '@coze/api';
import { ChatConfig, Ling } from '@bearbobo/ling';
import { Response } from 'express';
import { LingService } from '@/modules/ling/ling.service';
import { SearchService } from '@/modules/search/search.service';
import { RadioDto } from './chat.dto'
import { writeFileSync } from 'fs';
import makeQuestionPrompt from 'src/lib/prompts/make-question.tpl';
import quickAnswerPrompt from 'src/lib/prompts/quick-answer.tpl';
import outlinePrompt from 'src/lib/prompts/outline.tpl'
import subTopicsPrompt from 'src/lib/prompts/sub-topics.tpl'
import articleTpl from 'src/lib/prompts/article.tpl'
import podcastTpl from 'src/lib/prompts/podcast.tpl'

interface AudioBuffers {
  [key: string]: Buffer;
}
const audioBuffers: AudioBuffers = {};
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
            model_name: this.configService.get('DP_MODEL_NAME'),
            api_key: this.configService.get('DP_API_KEY'),
            endpoint: this.configService.get('DP_END_POINT'),
            // model_name: this.configService.get('VITE_KIMI_MODEL_NAME'),
            // api_key: this.configService.get('VITE_KIMI_API_KEY'),
            // endpoint: this.configService.get('VITE_KIMI_END_POINT'),
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
    const quickAnswerBot = ling.createBot('quick-answer', 
        {       
        // max_tokens: 4096 * 4,  
    }, 
    {        response_format: { type: 'text' }    });
    quickAnswerBot.addPrompt(quickAnswerPrompt, userConfig);

    const outlineBot = ling.createBot('outline');
    outlineBot.addPrompt(outlinePrompt, userConfig);

    outlineBot.addFilter('image_prompt'); 
    outlineBot.addListener('string-response', 
        ({ uri, delta }) => { 
            ling.handleTask(
                async () => { 
                    if (uri.includes('image_prompt')) { 
                        console.log('delta', delta)
                        // const res = await this.generateImage(`A full-size picture suitable as a cover for children's picture books that depicts ${delta}. DO NOT use any text or symbols.`);
                        // console.log('res', res)
                        // ling.sendEvent({ uri: 'cover_image', delta: res.output });
                    } });
            });
    outlineBot.addListener('inference-done', 
        (content) => { 
            const outline = JSON.parse(content); 
            delete outline.image_prompt; 
            const bot = ling.createBot(); 
            bot.addPrompt(subTopicsPrompt, userConfig); 
            bot.addFilter(/\/subtopics\//); 
            bot.chat(JSON.stringify(outline));
            bot.addListener('inference-done', (content) => {           
                 const { topics } = JSON.parse(content);            
                 for (let i = 0; i < topics.length; i++) {                
                    const topic = topics[i];                
                    const bot = ling.createBot(`topics/${i}`);                
                    bot.addPrompt(articleTpl, userConfig);                
                    bot.addFilter({                    
                        article_paragraph: true,                    
                        image_prompt: true,                
                    });      
                    bot.addListener('string-response', (res) => {
                        const { uri, delta } = res
                        console.log('uri', uri)
                        if(uri.endsWith('article_paragraph')){
                            console.log('article_paragraph', delta)
                            const podcastBot = ling.createBot('', undefined, { 
                                quiet: true, 
                                response_format: { type: 'text' } 
                            });
                            podcastBot.addPrompt(podcastTpl, userConfig); 
                            podcastBot.chat(delta); 
                            podcastBot.addListener('inference-done', (content) => { 
                                console.log(content); 
                                ling.handleTask(async () => { 
                                        // const tmpId = await this.generateAudio({ input:content }); 
                                        // console.log('create audio', `/chat/get-audio?id=${tmpId}`); 
                                        // ling.sendEvent({ uri: `topics/${i}/audio`, delta: `/chat/get-audio?id=${tmpId}` }); 
                                }); 
                            });
                        }
                    })          
                    bot.addListener('inference-done', (content) => {                    
                        console.log('inference-done', JSON.parse(content));                
                    });                
                    bot.chat(JSON.stringify(topic));            
                }        
            });
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
    if ('locked' in stream && stream.locked) {
        throw new Error('流已被锁定');
      }
    const reader = (stream as unknown as ReadableStream).getReader();
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
        console.log('generateImage', res)
        return JSON.parse(res.data)
    } catch (error) {
        console.log('generate Image error', error)
        return new Error('generate Image error')
    }
  
  }
  async generateAudio (data)  {
    const { input, voice_id } = data;
    const endpoint = 'https://api.coze.cn/v1/audio/speech';
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VITE_COZE_API_KET}`,
    };

    const payload = {
        input: input,
        voice_id: voice_id || process.env.VITE_COZE_VOICE_ID,
        response_format:'mp3'
    };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API请求失败: ${res.status} - ${errorText}`);
    }
     const audioBuffer = await res.arrayBuffer();
      writeFileSync(`./audio_${Date.now()}.mp3`, Buffer.from(audioBuffer));
      // 替换原来的json解析方式
    const tmpId = Math.random().toString(36).substring(7);          
    audioBuffers[tmpId] = Buffer.from(audioBuffer);
    return tmpId
}

    async getAudio(tmpId) {
        const audioData = audioBuffers[tmpId]; 
        const buffer = audioData;
        const bufferSize = audioData.length;
        
        // 处理范围请求
        let start = 0;
        let end = bufferSize - 1;

        const contentLength = end - start + 1;
        const readable = new Readable({
            read() {
                this.push(buffer.subarray(start, end + 1));
                this.push(null);
            }
        });

        return {
            stream: readable,
            headers: {
                'Content-Length': contentLength,
                'Content-Range': `bytes ${start}-${end}/${bufferSize}`,
                'Cache-Control': 'max-age=3600'
            }
        };
        // if (!audioData) { 
        //     throw new Error('audio not found');
        // }
        // return audioData
    }

  private async *readStream(reader: ReadableStreamDefaultReader, signal: AbortSignal) {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break;
      yield value;
    }
  }
}    