import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Reflector } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationPipe, ForbiddenException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

process.env.TZ = process.env.APP_TIMEZONE || 'UTC';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('Dokumentasi lengkap untuk semua endpoint API aplikasi ini.')
    .setVersion('1.0')
    .addBearerAuth() // Tambahkan autentikasi JWT di Swagger
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Mengambil daftar origin yang diizinkan dari environment variable
  const rawOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:4000', 'https://dlinzi.web.id'];

  if (process.env.FRONTEND_URL) {
    rawOrigins.push(process.env.FRONTEND_URL);
  }

  // Sanitasi origin: hilangkan whitespace & trailing slash di akhir URL
  const allowedOrigins = rawOrigins
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Izinkan request non-browser / same-origin tanpa header Origin
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.trim().replace(/\/$/, '');

      const isAllowed =
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(normalizedOrigin) ||
        (process.env.NODE_ENV !== 'production' && normalizedOrigin.endsWith('.trycloudflare.com'));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new ForbiddenException('Akses diblokir oleh sistem keamanan CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, Accept, X-Requested-With, X-Tenant-ID',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
