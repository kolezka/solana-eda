import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Creating NestJS application...');
  const app = await NestFactory.create(AppModule);
  console.log('NestJS application created');

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });
  console.log('CORS enabled');

  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  console.log('ValidationPipe configured');

  // Configure Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Solana EDA API')
    .setDescription('Event-Driven Architecture API for Solana blockchain monitoring, liquidity tracking, and automated trading.')
    .setVersion('1.0')
    .addTag('events', 'Real-time events and event subscriptions')
    .addTag('workers', 'Worker status and management')
    .addTag('trading', 'Trading operations and settings')
    .addTag('positions', 'Position management and portfolio tracking')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer(`http://localhost:${process.env.PORT || 3000}`, 'Local development')
    .addServer('/api', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Solana EDA API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
  });

  const port = process.env.PORT || 3000;
  console.log(`About to listen on port ${port}...`);
  await app.listen(port);
  console.log(`Server listening on port ${port}`);

  console.log(`API server running on port ${port}`);
  console.log(`WebSocket endpoint: ws://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/docs`);
  console.log(`OpenAPI JSON: http://localhost:${port}/api/docs-json`);
}

bootstrap();
