import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Reflector } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationPipe } from '@nestjs/common';

process.env.TZ = process.env.APP_TIMEZONE || 'UTC';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  // app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  // app.enableCors({
  //   origin: process.env.FRONTEND_URL,
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  //   allowedHeaders: 'Content-Type, Authorization',
  //   credentials: true, // kalau pakai cookie / auth header
  // });
  app.enableCors({
    origin: 'http://localhost:3000', // ganti dengan domain frontend kamu
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // method yang diizinkan
    allowedHeaders: 'Content-Type, Authorization', // header yang diizinkan
    credentials: true, // kalau pakai cookie / JWT di header
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
