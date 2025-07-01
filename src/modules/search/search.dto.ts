import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class SearchDto {
  @ApiProperty({
    description: '搜索内容',
  })
  @IsNotEmpty({ message: '搜索内容不能为空' })
  query: string;

  
}
