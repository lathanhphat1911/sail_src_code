import { Controller, Get, Post, Body, Patch, Param, Delete, UnauthorizedException, Req, UseGuards, UseInterceptors, Request, UploadedFile, BadRequestException } from '@nestjs/common';
import { StoriesService } from './stories.service';

import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}


  @UseGuards(AuthGuard('jwt')) 
  @Get('feed')
  async getMyFeed(@Req() req: any) {
    
    console.log("Thông tin Token giải mã được:", req.user);

    const userId = req.user?.userId; 

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

  @UseGuards(AuthGuard('jwt')) 
  @Post(':crewId')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/stories', 
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        cb(null, `story-${uniqueSuffix}${ext}`);
      }
    })
  }))
  async createStory(
    @Param('crewId') crewId: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string,
  ) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!userId) {
      throw new BadRequestException('Không lấy được User ID từ Token!');
    }

    // Nếu không cấu hình storage ở trên, biến file chỗ này sẽ là undefined đó!
    if (!file) {
      throw new BadRequestException('Không tìm thấy file ảnh được gửi lên!');
    }

    return this.storiesService.createStory(crewId, userId, file, caption);
  }
}

