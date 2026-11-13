import { HttpException } from '@nestjs/common';

export class TooManyRequests extends HttpException {
  headers: Record<string, string>;
  constructor(retryAfter: number) {
    super('too many booking attempts for this email, try again later', 429);
    this.headers = { 'Retry-After': String(retryAfter) };
  }
}
