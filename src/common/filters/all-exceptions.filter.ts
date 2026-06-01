import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Tentukan status code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Ambil detail error message
    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      const resResponse = exception.getResponse();

      if (typeof resResponse === 'object' && resResponse !== null) {
        // Di sini triknya: Ambil properti 'message' dari dalam objek error DTO NestJS
        message = (resResponse as any).message || resResponse;
      } else {
        message = exception.message;
      }
    }

    // Samakan strukturnya dengan interceptor suksesmu, tapi success: false
    response.status(status).json({
      success: false,
      statusCode: status,
      message: message, // Ini akan langsung berupa array pesan error atau string tunggal
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
