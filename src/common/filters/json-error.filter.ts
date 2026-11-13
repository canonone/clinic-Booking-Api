import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { TooManyRequests } from '../exceptions/too-many-requests.exception';
import { ErrorSchema } from '../schemas/error.schema';

/** Errors raised by Express middleware (e.g. the JSON body parser) rather than by Nest. */
type MiddlewareError = Partial<Error> & { type?: string; status?: number };
/** Shape of the body Nest attaches to an HttpException. */
type HttpExceptionBody = string | { message?: string | string[] };

/** Every error leaves the API as {"error": "<message>"}. */
@Catch()
export class JsonErrorFilter implements ExceptionFilter {
  private log = new Logger('errors');

  catch(e: HttpException | MiddlewareError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'internal server error';
    if (e instanceof HttpException) {
      status = e.getStatus();
      const r = e.getResponse() as HttpExceptionBody;
      message = typeof r === 'string' ? r : Array.isArray(r.message) ? r.message.join(', ') : r.message ?? e.message;
      if (status === 404 && /^Cannot /.test(message)) message = 'not found';
    } else if (e.type === 'entity.parse.failed' || e.status === 400) {
      status = 400;
      message = 'invalid JSON body';
    } else if (e.type === 'entity.too.large') {
      status = 413;
      message = 'body too large';
    } else {
      this.log.error(e.stack ?? String(e));
    }
    if (e instanceof TooManyRequests) {
      for (const [k, v] of Object.entries(e.headers)) res.setHeader(k, v);
    }
    const body: ErrorSchema = { error: message };
    res.status(status).json(body);
  }
}
