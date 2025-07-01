import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface ServerSentEvent {
  id?: string;
  type?: string;
  data: string | object;
  retry?: number;
}

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly eventSubject = new Subject<ServerSentEvent>();
  private readonly clients = new Set<Subject<ServerSentEvent>>();

  // 客户端订阅 SSE
  subscribe(): Observable<ServerSentEvent> {
    const client = new Subject<ServerSentEvent>();
    this.clients.add(client);
    
    // 当客户端取消订阅时清理
    const subscription = this.eventSubject.subscribe(client);
    client.subscribe({
      complete: () => {
        this.clients.delete(client);
        subscription.unsubscribe();
      }
    });
    
    return client.asObservable();
  }

  // 向所有客户端广播事件
  broadcast(event: ServerSentEvent): void {
    this.eventSubject.next(event);
  }

  // 向特定类型的客户端发送事件
  sendToType(eventType: string, event: ServerSentEvent): void {
    this.eventSubject.next({
      ...event,
      type: eventType
    });
  }

  // 模块销毁时清理资源
  onModuleDestroy(): void {
    this.clients.forEach(client => client.complete());
    this.clients.clear();
    this.eventSubject.complete();
  }

  // 将事件对象格式化为 SSE 文本格式
  formatEvent(event: ServerSentEvent): string {
    let message = '';
    
    if (event.id) {
      message += `id: ${event.id}\n`;
    }
    
    if (event.type) {
      message += `event: ${event.type}\n`;
    }
    
    if (event.retry) {
      message += `retry: ${event.retry}\n`;
    }
    
    // 处理数据
    const data = typeof event.data === 'object' 
      ? JSON.stringify(event.data) 
      : event.data;
    
    // 多行数据需要每行以 data: 开头
    if (data.includes('\n')) {
      message += data.split('\n').map(line => `data: ${line}`).join('\n') + '\n';
    } else {
      message += `data: ${data}\n`;
    }
    
    return message + '\n';
  }
}    