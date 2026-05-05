import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '5mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const corsOrigins = (() => {
    const raw = process.env.FRONTEND_URL || 'http://localhost:5173';
    const fromEnv = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const devExtras =
      process.env.NODE_ENV !== 'production' ? ['http://127.0.0.1:5173', 'http://localhost:5173'] : [];
    return [...new Set([...fromEnv, ...devExtras])];
  })();
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API Rover escuchando en http://localhost:${port}`);
}
bootstrap();
