import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SseService, ServerSentEvent } from './sse.service';

@Injectable()
export class SseInterceptor implements NestInterceptor {
  constructor(private readonly sseService: SseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        // 将响应数据转换为 SSE 格式
        if (data as ServerSentEvent) {
          return this.sseService.formatEvent(data);
        }
        
        // 默认处理
        return this.sseService.formatEvent({
          data
        });
      }),
    );
  }
}    