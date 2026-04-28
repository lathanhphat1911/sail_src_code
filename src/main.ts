import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      console.log('❌ Lỗi Validation tại Backend:', JSON.stringify(errors, null, 2));
      return new BadRequestException(errors);
    },
  }));
  
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  
  await app.listen(port, '0.0.0.0'); 
  console.log(`Khoang máy đang chạy tại Port: ${port}`);
}
bootstrap();