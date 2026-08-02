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
  // Keamanan CORS Best Practice
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      // 1. Izinkan akses jika tidak ada origin (Postman, S2S, Mobile App native)
      if (!origin) return callback(null, true);

      // 2. Cek apakah origin cocok dengan whitelist (termasuk Cloudflare tunnel saat dev)
      const isAllowed = allowedOrigins.includes(origin) || 
                        (process.env.NODE_ENV !== 'production' && origin.endsWith('.trycloudflare.com'));

      if (isAllowed) {
        callback(null, true); // Aman, lolos
      } else {
        callback(new Error('Akses diblokir oleh sistem keamanan CORS')); // Blokir hacker
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
