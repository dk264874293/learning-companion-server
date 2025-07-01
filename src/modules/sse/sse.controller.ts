import { Controller, Get, StreamableFile, Response } from '@nestjs/common';
import { SseService, ServerSentEvent } from './sse.service';
import { Response as ExpressResponse } from 'express';
import { Observable } from 'rxjs';

@Controller('sse')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Get()
  getEvents(@Response({ passthrough: true }) res: ExpressResponse): Observable<ServerSentEvent> {
    // 设置 SSE 响应头
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // 返回可观察对象，NestJS 会自动处理数据流
    return this.sseService.subscribe();
  }
}    