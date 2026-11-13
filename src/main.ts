import 'dotenv/config'; // loads .env locally; real env vars (e.g. on Render) take precedence
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.disable('x-powered-by');
  // Public web page (static). It asks the user for the API key; the key is never baked into the page.
  app.useStaticAssets(join(process.cwd(), 'public'));
  return app;
}

async function bootstrap() {
  if (!process.env.API_KEY) throw new Error('API_KEY is required');
  const app = await createApp();
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
if (require.main === module) bootstrap();
