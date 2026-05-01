import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { PrismaService } from '../prisma.service';


@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}
  create(createStoryDto: CreateStoryDto) {
    return 'This action adds a new story';
  }

  findAll() {
    return `This action returns all stories`;
  }

  findOne(id: number) {
    return `This action returns a #${id} story`;
  }

  update(id: number, updateStoryDto: UpdateStoryDto) {
    return `This action updates a #${id} story`;
  }

  remove(id: number) {
    return `This action removes a #${id} story`;
  }

  async getMyFeed(userId: string) {
    // 1. Tìm tất cả các nhóm mà user này đang tham gia
    const myMemberships = await this.prisma.memberships.findMany({
      where: { user_id: userId },
      select: { crew_id: true }
    });

    // Lấy ra mảng các ID của hạm đội
    const myCrewIds = myMemberships.map(m => m.crew_id);

    if (myCrewIds.length === 0) return [];

    // 2. Kéo tất cả bài viết thuộc các nhóm
    const feed = await this.prisma.stories.findMany({
      where: {
        crew_id: { in: myCrewIds },
        status: 'ACTIVE'
      },
      include: {
        users: { select: { full_name: true, avatar_url: true } },
        crews: { select: { name: true, color: true } }           
      },
      orderBy: { created_at: 'desc' }, 
      take: 20 
    });

    return feed.map(post => ({
      id: post.id,
      crewName: post.crews?.name,
      userName: post.users?.full_name || 'Ẩn danh',
      avatar: post.crews?.color || '#3b82f6', 
      image: post.media_url,
      caption: post.caption,
      comments: 0,
      createdAt: post.created_at
    }));
  }

  async createStory(crewId: string, userId: string, file: Express.Multer.File, caption: string) {
    const membership = await this.prisma.memberships.findFirst({
      where: { crew_id: crewId, user_id: userId, status: 'ACTIVE' }
    });

    if (!membership) {
      throw new BadRequestException('Bạn không thuộc hạm đội này để đăng khoảnh khắc');
    }

    const mediaUrl = `/uploads/stories/${file.filename}`;

    const newStory = await this.prisma.stories.create({
      data: {
        crew_id: crewId,
        user_id: userId,
        media_url: mediaUrl,
        caption: caption || '',
        status: 'ACTIVE',
      },
    });

    return {
      message: 'Đăng khoảnh khắc thành công',
      data: newStory
    };
  }
}
