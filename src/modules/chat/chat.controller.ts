/*
 * @Author: 汪培良 rick_wang@yunquna.com
 * @Date: 2025-06-27 16:15:52
 * @LastEditors: 汪培良 rick_wang@yunquna.com
 * @LastEditTime: 2025-07-03 18:18:32
 * @FilePath: /AI-project/berarbobo-server/src/modules/chat/chat.controller.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Controller, Get, Post, Query,Body, Res,Header } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import {RadioDto} from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

    @Get('make-question')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive') 
    async makeQuestion(
        @Query('question') question: string,
        @Res() res: Response,
    ) { 
        await this.chatService.streamQuestion(question, res);
    }

    @Get('get-answers')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive') 
    async getAnswers(
        @Query('question') question: string,
        @Res() res: Response,
    ) { 
        await this.chatService.getAnswers(question, res);
    }

    @Get('generate-image')
    async generateImage(@Query('question') question: string,){
       return await this.chatService.generateImage(question);
    }

    @Get('generate')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive') 
    async generate(@Query('question') question: string,@Query('query') query:string, @Res() res: Response,){
        await this.chatService.generateChat(question, query, res);
        
    }

    @Post('generate-audio')
    async generateAudio(@Body() body:RadioDto){
        return await this.chatService.generateAudio(body);
    }

    @Get('get-audio')
    @Header('Content-Type', 'audio/mpeg')
    async getAudio(@Query('id') id:string, @Res() res: Response){
         const { stream, headers } = await this.chatService.getAudio(id);
         res.status(200)
            .set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': headers['Content-Length'],
                'Content-Range': headers['Content-Range'],
                'Cache-Control': 'no-cache'
            });
    
        stream.pipe(res);
    }
}    