import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LingService } from './ling.service';

@Module({
  providers: [LingService, ConfigService],
  exports: [LingService],
})
export class LingModule {}    