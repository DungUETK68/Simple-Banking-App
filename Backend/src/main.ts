import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestContext } from './utils/request-context';

import { JsonLogger } from './common/logger/json.logger';
import * as crypto from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Chờ logger custom khởi tạo
  });
  
  app.useLogger(new JsonLogger());

  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req['requestId'] = requestId;
    RequestContext.run(req, next);
  });
  
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
