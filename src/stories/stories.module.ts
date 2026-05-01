import { Module } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { StoriesController } from './stories.controller';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Module({
  controllers: [StoriesController],
  providers: [StoriesService, CloudinaryService,],
})
export class StoriesModule {}
