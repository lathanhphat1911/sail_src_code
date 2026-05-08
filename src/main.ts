import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/admin')) {
      return next();
    }
    express.json()(req, res, () => {
      express.urlencoded({ extended: true })(req, res, next);
    });
  });


  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      console.log('Lỗi Validation tại Backend:', JSON.stringify(errors, null, 2));
      return new BadRequestException(errors);
    },
  }));
  
  app.enableCors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0'); 
  
  console.log(`Khoang máy đang chạy tại Port: ${port}`);
}
bootstrap();