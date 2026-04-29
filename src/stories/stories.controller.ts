import { Controller, Get, Post, Body, Patch, Param, Delete, UnauthorizedException, Req } from '@nestjs/common';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}


  @Get('feed')
  async getMyFeed(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub; 

    if (!userId) {
      throw new UnauthorizedException('Không tìm thấy thông tin Thuyền trưởng. Vui lòng đăng nhập lại!');
    }

    const feedData = await this.storiesService.getMyFeed(userId);
    
    return {
      statusCode: 200,
      message: 'Lấy bảng tin thành công',
      data: feedData
    };
  }
}
