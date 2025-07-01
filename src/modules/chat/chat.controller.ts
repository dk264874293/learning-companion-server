/*
 * @Author: 汪培良 rick_wang@yunquna.com
 * @Date: 2025-06-27 16:15:52
 * @LastEditors: 汪培良 rick_wang@yunquna.com
 * @LastEditTime: 2025-06-30 21:09:15
 * @FilePath: /AI-project/berarbobo-server/src/modules/chat/chat.controller.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Controller, Get, Query, Res,Header } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';


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
}    