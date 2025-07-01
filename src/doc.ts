/*
 * @Author: 汪培良 rick_wang@yunquna.com
 * @Date: 2024-12-16 10:08:31
 * @LastEditors: 汪培良 rick_wang@yunquna.com
 * @LastEditTime: 2024-12-16 10:18:49
 * @FilePath: /xar_gameserver/src/doc.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as process from 'node:process';
import * as packageConfig from '../package.json';

export const generateDocument = (app) => {
  // if (process.env['API_DOC'] === 'true') {
  const options = new DocumentBuilder()
    .setTitle('bobo server api')
    .setDescription(packageConfig.description)
    .setVersion(packageConfig.version)
    .addBearerAuth()
    .addTag('bobo')
    .build();

  const document = SwaggerModule.createDocument(app, options);

  const swaggerUiOptions = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  SwaggerModule.setup('api-doc', app, document, swaggerUiOptions);
  // }
};
