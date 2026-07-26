import { Handler, Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module'; // adjust if your AppModule isn't at the root of src/

let cachedServer: Handler;

async function bootstrapServer(): Promise<Handler> {
  const expressApp = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  // Replicate here the same globals you have in your local main.ts
  nestApp.use(helmet());
  nestApp.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' });
  nestApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await nestApp.init();

  return serverlessExpress({ app: expressApp });
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  cachedServer = cachedServer ?? (await bootstrapServer());
  return cachedServer(event, context, () => {}) as Promise<APIGatewayProxyResult>;
};