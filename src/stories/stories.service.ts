import { Injectable } from '@nestjs/common';
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

    if (myCrewIds.length === 0) return []; // Chưa vào nhóm nào thì feed trống

    // 2. Kéo tất cả bài viết thuộc các nhóm đó
    const feed = await this.prisma.stories.findMany({
      where: {
        crew_id: { in: myCrewIds },
        status: 'ACTIVE' // Lọc các bài chưa bị xóa
      },
      include: {
        users: { select: { full_name: true, avatar_url: true } }, // Info người đăng
        crews: { select: { name: true, color: true } }            // Info nhóm
      },
      orderBy: { created_at: 'desc' }, // Mới nhất lên đầu
      take: 20 // Lấy tạm 20 bài gần nhất (phân trang tính sau cho đỡ rối)
    });

    // 3. Format lại dữ liệu cho Frontend dễ đọc
    return feed.map(post => ({
      id: post.id,
      crewName: post.crews?.name,
      userName: post.users?.full_name || 'Ẩn danh',
      avatar: post.crews?.color || '#3b82f6', // Lấy màu nhóm làm màu avatar tạm
      image: post.media_url,
      caption: post.caption,
      comments: 0, // Nếu mày có bảng comments thì query thêm đếm vào đây
      createdAt: post.created_at
    }));
  }
}
