import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type DefaultAchievement = {
  name: string;
  description: string | null;
  icon_url: string | null;
  condition_type: string | null;
};

const DEFAULT_ACHIEVEMENTS: DefaultAchievement[] = [
  {
    name: 'Thủy thủ mới',
    description: 'Gia nhập ít nhất 1 hạm đội.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/3176/3176361.png',
    condition_type: 'JOIN_CREWS_1',
  },
  {
    name: 'Liên minh hải trình',
    description: 'Gia nhập ít nhất 5 hạm đội.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/3176/3176361.png',
    condition_type: 'JOIN_CREWS_5',
  },
  {
    name: 'Thuyền trưởng',
    description: 'Tạo ít nhất 1 hạm đội.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828671.png',
    condition_type: 'CREATE_CREW_1',
  },
  {
    name: 'Đô đốc',
    description: 'Tạo ít nhất 3 hạm đội.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/1828/1828671.png',
    condition_type: 'CREATE_CREW_3',
  },
  {
    name: 'Khoảnh khắc đầu tiên',
    description: 'Đăng ít nhất 1 story.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2965/2965879.png',
    condition_type: 'POST_STORIES_1',
  },
  {
    name: 'Nhà báo biển',
    description: 'Đăng ít nhất 10 story.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2965/2965879.png',
    condition_type: 'POST_STORIES_10',
  },
  {
    name: 'Góp vốn đầu tiên',
    description: 'Có ít nhất 1 giao dịch nạp thành công.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2769/2769339.png',
    condition_type: 'FIRST_DEPOSIT',
  },
  {
    name: 'Kho báu triệu',
    description: 'Tổng nạp thành công đạt ít nhất 1.000.000 VND.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2769/2769339.png',
    condition_type: 'TOTAL_DEPOSIT_1M',
  },
  {
    name: 'Kho báu chục triệu',
    description: 'Tổng nạp thành công đạt ít nhất 10.000.000 VND.',
    icon_url: 'https://cdn-icons-png.flaticon.com/512/2769/2769339.png',
    condition_type: 'TOTAL_DEPOSIT_10M',
  },
];

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const row of DEFAULT_ACHIEVEMENTS) {
      const existing = await this.prisma.achievements.findFirst({
        where: { name: row.name },
      });
      if (existing) {
        await this.prisma.achievements.update({
          where: { id: existing.id },
          data: {
            description: row.description,
            icon_url: row.icon_url,
            condition_type: row.condition_type,
          },
        });
      } else {
        await this.prisma.achievements.create({ data: row });
      }
    }
    this.logger.log(`Seeded ${DEFAULT_ACHIEVEMENTS.length} default achievements`);
  }

  /** Unlock any achievements whose conditions are met (idempotent, never revokes). */
  async evaluateConditions(userId: string): Promise<void> {
    const achievements = await this.prisma.achievements.findMany({
      where: { condition_type: { not: null } },
    });

    const [
      activeMemberships,
      ownedCrews,
      activeStories,
      hasSuccessfulIn,
      depositSum,
    ] = await Promise.all([
      this.prisma.memberships.count({
        where: { user_id: userId, status: 'ACTIVE' },
      }),
      this.prisma.crews.count({
        where: { owner_id: userId, deleted_at: null },
      }),
      this.prisma.stories.count({
        where: { user_id: userId, status: 'ACTIVE' },
      }),
      this.prisma.transactions.findFirst({
        where: {
          user_id: userId,
          type: 'IN',
          status: 'SUCCESS',
        },
      }),
      this.prisma.transactions.aggregate({
        where: {
          user_id: userId,
          type: 'IN',
          status: 'SUCCESS',
        },
        _sum: { amount: true },
      }),
    ]);

    const totalDeposit = Number(depositSum._sum.amount ?? 0);

    for (const ach of achievements) {
      const ct = ach.condition_type;
      if (!ct) continue;

      let met = false;
      switch (ct) {
        case 'JOIN_CREWS_1':
          met = activeMemberships >= 1;
          break;
        case 'JOIN_CREWS_5':
          met = activeMemberships >= 5;
          break;
        case 'CREATE_CREW_1':
          met = ownedCrews >= 1;
          break;
        case 'CREATE_CREW_3':
          met = ownedCrews >= 3;
          break;
        case 'POST_STORIES_1':
          met = activeStories >= 1;
          break;
        case 'POST_STORIES_10':
          met = activeStories >= 10;
          break;
        case 'FIRST_DEPOSIT':
          met = !!hasSuccessfulIn;
          break;
        case 'TOTAL_DEPOSIT_1M':
          met = totalDeposit >= 1_000_000;
          break;
        case 'TOTAL_DEPOSIT_10M':
          met = totalDeposit >= 10_000_000;
          break;
        default:
          break;
      }

      if (met) {
        await this.prisma.user_achievements.upsert({
          where: {
            user_id_achievement_id: {
              user_id: userId,
              achievement_id: ach.id,
            },
          },
          create: {
            user_id: userId,
            achievement_id: ach.id,
          },
          update: {},
        });
      }
    }
  }

  async listForUser(userId: string) {
    await this.evaluateConditions(userId);

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { equipped_achievement_id: true },
    });

    const all = await this.prisma.achievements.findMany({
      orderBy: { name: 'asc' },
    });

    const unlockedRows = await this.prisma.user_achievements.findMany({
      where: { user_id: userId },
    });
    const unlockedByAchievementId = new Map(
      unlockedRows.map((r) => [r.achievement_id, r]),
    );

    return all.map((a) => {
      const ua = unlockedByAchievementId.get(a.id);
      const unlocked = !!ua;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        icon_url: a.icon_url,
        condition_type: a.condition_type,
        unlocked,
        unlocked_at: ua?.unlocked_at ?? null,
        is_equipped: user?.equipped_achievement_id === a.id,
      };
    });
  }

  async equip(userId: string, achievementId: string) {
    const ua = await this.prisma.user_achievements.findUnique({
      where: {
        user_id_achievement_id: {
          user_id: userId,
          achievement_id: achievementId,
        },
      },
    });
    if (!ua) {
      throw new ForbiddenException(
        'Bạn chưa mở khóa thành tựu này hoặc không tồn tại.',
      );
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: { equipped_achievement_id: achievementId },
    });

    return this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        equipped_achievement_id: true,
        equipped_achievement: {
          select: { id: true, name: true, icon_url: true },
        },
      },
    });
  }

  async unequip(userId: string) {
    await this.prisma.users.update({
      where: { id: userId },
      data: { equipped_achievement_id: null },
    });
    return { equipped_achievement_id: null as string | null };
  }
}
