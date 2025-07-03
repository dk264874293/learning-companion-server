/*
 * @Author: 汪培良 rick_wang@yunquna.com
 * @Date: 2025-07-03 10:45:30
 * @LastEditors: 汪培良 rick_wang@yunquna.com
 * @LastEditTime: 2025-07-03 13:20:57
 * @FilePath: /AI-project/berarbobo-server/src/modules/chat/chat.dto.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RadioDto {
  @ApiProperty({
    description: '语音文本',
    default: '你好'
  })
  @IsNotEmpty({ message: '语音文本不能为空' })
  input: string;

  @ApiProperty({
    description: '音色ID',
    default:"7426725529589514267"
  })
  @IsString({ message: '音色ID必须是字符串' })
  voice_id:string
}
