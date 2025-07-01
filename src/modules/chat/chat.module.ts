import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LingService } from '@/modules/ling/ling.service'
import { SearchService } from '@/modules/search/search.service';

@Module({
    imports: [HttpModule],
    controllers: [ChatController],   
    providers: [ChatService,LingService,SearchService],
    exports: [ChatService, LingService,SearchService],
})
export class ChatModule {}    