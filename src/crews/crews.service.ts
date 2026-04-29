import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCrewDto } from './dto/create-crew.dto';
import { transaction_status } from '@prisma/client';
import { CreateInviteDto } from './dto/invite.crew.dto';
import { randomBytes } from 'crypto';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class CrewsService {
  private expo = new Expo();
  constructor(private prisma: PrismaService) {}

  private async notifyCaptain(crewId: string, memberId: string, amount: number) {
    try {
      const captainMembership = await this.prisma.memberships.findFirst({
        where: { crew_id: crewId, role: 'CAPTAIN' },
        include: { users: true }
      });

      const captainToken = captainMembership?.users?.expo_push_token;
      if (!captainToken || !Expo.isExpoPushToken(captainToken)) return; // Bỏ qua nếu Captain chưa cài app/chưa có token

      const member = await this.prisma.users.findUnique({ where: { id: memberId } });

      const messages = [{
        to: captainToken,
        sound: 'default' as const,
        title: 'Ting Ting! Tiền vào quỹ',
        body: `Thuyền viên ${member?.full_name || 'Ai đó'} vừa đóng ${amount.toLocaleString('vi-VN')}đ.`,
        data: { crewId: crewId },
      }];

      await this.expo.sendPushNotificationsAsync(messages);
      console.log('📡 Đã bắn tín hiệu cho Thuyền trưởng!');
    } catch (error) {
      console.error('Lỗi bắn radar:', error);
    }
  }

  async findAll() {
    const crews = await this.prisma.crews.findMany({
      select: {
        id: true,
        name: true,
        color: true,
      },
      orderBy: {
        created_at: 'desc',
      }
    });

    return crews.map(crew => ({
      id: crew.id,
      name: crew.name,
      color: crew.color || '#2563eb',
      newPosts: 0, 
      hasUnread: false,
    }));
  }

  async findById(id: string) {
    return this.prisma.crews.findUnique({
      where: {id},
      include: {
        users: true,
      },
    });
  }

  async create(userId: string, data: CreateCrewDto) {
    const targetAmount = data.amount ? parseFloat(data.amount) : 0;

    return this.prisma.$transaction(async (tx) => {
        const newCrew = await tx.crews.create({
        data: {
          name: data.name,
          goal: targetAmount,
          description: data.description,
          color: data.color || '#3b82f6',
          owner_id: userId,
        },
      });

      await tx.memberships.create({
        data: {
          user_id: userId,
          crew_id: newCrew.id,
          role: 'CAPTAIN',
        },
      });

      return newCrew;
    });
  }

  async getMyCrews(userId: string) {
    return await this.prisma.crews.findMany({
      where: {
        OR: [
          { owner_id: userId }, 
          { 
            memberships: { 
              some: { user_id: userId }
            } 
          }
        ]
      },
      orderBy: {
        updated_at: 'desc'
      }
    });
  }
  async createInviteCode(userId: string, crewId: string, dto: CreateInviteDto) {
    const crew = await this.prisma.crews.findUnique({ where: { id: crewId } });
    if (!crew) throw new NotFoundException('Hạm đội không tồn tại!');
    if (crew.owner_id !== userId) throw new BadRequestException('Chỉ Thuyền trưởng mới có quyền đổi mã mời!');

    const code = randomBytes(3).toString('hex').toUpperCase();
    let expiresAt: Date | null = null;
    if (dto.expires_in_hours) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + dto.expires_in_hours);
    }

    return this.prisma.$transaction(async (tx) => {
      
      await tx.invite_codes.deleteMany({
        where: { crew_id: crewId }
      });

      return tx.invite_codes.create({
        data: {
          code,
          crew_id: crewId,
          created_by: userId,
          expires_at: expiresAt,
          usage_limit: dto.usage_limit || null,
        },
      });
    });
  }

  async getInvitePreview(code: string) {
    const invite = await this.prisma.invite_codes.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        crews: {
          include: {
            users: { // Đây là owner của crew (theo schema của bạn)
              select: { full_name: true }
            },
            _count: {
              select: { memberships: true } // Lấy số lượng thành viên
            }
          }
        }
      }
    });

    // Nếu không thấy mã hoặc mã thuộc về một hạm đội đã bị xóa
    if (!invite || !invite.crews) {
      throw new NotFoundException('Mã hải trình không tồn tại hoặc đã hết hạn!');
    }

    // Trả về đúng format mà Frontend đang chờ (previewData)
    return {
      name: invite.crews.name,
      color: invite.crews.color,
      goal: invite.crews.goal,
      ownerName: invite.crews.users?.full_name || 'Ẩn danh',
      memberCount: invite.crews._count.memberships,
      currency: invite.crews.currency
    };
  }

  async joinByCode(userId: string, code: string) {
    const invite = await this.prisma.invite_codes.findUnique({
      where: { code: code.toUpperCase() },
      include: { crews: true }
    });

    if (!invite || !invite.crew_id) {
      throw new NotFoundException('Mã hải trình không hợp lệ hoặc thuyền đã bị giải tán!');
    }

    if (!invite) throw new NotFoundException('Mã hải trình không tồn tại!');

    if (invite.expires_at && new Date() > invite.expires_at) {
      throw new BadRequestException('Mã này đã hết hạn hiệu lực!');
    }

    if (invite.usage_limit && (invite.times_used ?? 0) >= invite.usage_limit) {
      throw new BadRequestException('Mã này đã đạt giới hạn người tham gia!');
    }
    
    const existingMember = await this.prisma.memberships.findUnique({
      where: { user_id_crew_id: { user_id: userId, crew_id: invite.crew_id } }
    });
    if (existingMember) throw new BadRequestException('Bạn đã có mặt trên boong tàu này rồi!');

    const targetCrewId = invite.crew_id;
    
    return this.prisma.$transaction(async (tx) => {
      await tx.memberships.create({
        data: {
          user_id: userId,
          crew_id: targetCrewId,
          role: 'MEMBER',
        },
      });

      await tx.invite_codes.update({
        where: { id: invite.id },
        data: { times_used: { increment: 1 } }
      });

      return invite.crews; 
    });
  }

  async getDetail(crewId: string) {
    const crew = await this.prisma.crews.findUnique({
      where: { id: crewId },
      include: {
        bank_accounts: true,
        crew_periods: {
          orderBy: { start_date: 'asc' } 
        },
        memberships: {
          include: { users: true } 
        },
        transactions: {
          where: { status: 'SUCCESS' },
          orderBy: { created_at: 'desc' },
          take: 5, 
          include: { users: true }
        },
        stories: {
          where: { status: 'ACTIVE' },
          orderBy: { created_at: 'desc' },
          include: { users: true }
        }
      }
    });

    if (!crew) throw new NotFoundException('Không tìm thấy hạm đội');

    const now = new Date();
    const currentPeriod = crew.crew_periods.find(p => p.end_date >= now) || crew.crew_periods[0];
    const membersData = await Promise.all(crew.memberships.map(async (member) => {
      let periodContribution = 0;
      
      if (currentPeriod) {
        const periodTx = await this.prisma.transactions.aggregate({
          where: {
            crew_id: crewId,
            user_id: member.user_id,
            status: 'SUCCESS',
            type: 'DEPOSIT',
            created_at: { gte: currentPeriod.start_date, lte: currentPeriod.end_date }
          },
          _sum: { amount: true }
        });
        periodContribution = Number(periodTx._sum.amount || 0);
      }

      return {
        id: member.user_id,
        name: member.users?.full_name || 'Thủy thủ ẩn danh',
        role: member.role,
        totalContribution: Number(member.total_contribution || 0),
        periodContribution: periodContribution,
        color: '#3b82f6', // Màu mặc định (có thể random hoặc lấy từ bảng users)
      };
    }));

    // 4. Định dạng Nhật ký giao dịch
    const logsData = crew.transactions.map(tx => ({
      id: tx.id,
      action: tx.type === 'IN' ? 'deposit' : 'withdraw',
      note: tx.note || (tx.type === 'IN' ? 'Đóng quỹ' : 'Chi quỹ'),
      user: tx.users?.full_name || 'Hệ thống',
      date: tx.created_at.toISOString().split('T')[0], // YYYY-MM-DD
      amount: Number(tx.amount),
    }));

    // 5. Trả về format chuẩn cho Frontend
    return {
      id: crew.id,
      name: crew.name,
      balance: Number(crew.total_balance || 0),
      goal: Number(crew.goal || 0),
      periodsCount: crew.crew_periods.length, // 💥 CỰC KỲ QUAN TRỌNG ĐỂ FE CHECK
      currentPeriod: currentPeriod ? {
        id: currentPeriod.id,
        name: currentPeriod.name,
        deadline: currentPeriod.end_date.toISOString().split('T')[0],
        minAmount: Number(currentPeriod.min_amount_per_member || 0)
      } : null,
      members: membersData,
      logs: logsData,
      bankAccount: crew.bank_accounts ? {
        bin: crew.bank_accounts.bank_bin,
        accountNo: crew.bank_accounts.account_number,
        accountName: crew.bank_accounts.account_name
      } : null,
      feed: crew.stories.map(s => ({
         id: s.id,
         image: s.media_url,
         user: s.users?.full_name || 'Ẩn danh',
         avatar: '#ef4444',
         date: s.created_at.toISOString().split('T')[0],
         caption: s.caption,
         likes: 0 
      }))
    };
  }

  async linkBankAccount(crewId: string, bankAccountId: string) {
    return this.prisma.crews.update({
      where: { id: crewId },
      data: { bank_account_id: bankAccountId },
    });
  }

  async getCrewLogs(crewId: string) {
    const transactions = await this.prisma.transactions.findMany({
      where: { 
        crew_id: crewId, 
        status: 'SUCCESS'
      },
      include: { users: true },
      orderBy: { created_at: 'desc' } 
    });

    return transactions.map(tx => ({
      id: tx.id,
      userId: tx.user_id,
      user: tx.users?.full_name || 'Hệ thống',
      action: tx.type === 'IN' ? 'deposit' : 'withdraw',
      amount: Number(tx.amount),
      note: tx.note || (tx.type === 'IN' ? 'Đóng quỹ' : 'Chi quỹ'),
      createdAt: tx.created_at, 
    }));
  }

  async reportDeposit(crewId: string, userId: string, amount: number) {
    // 💥 1. Tìm kỳ hạn đang mở
    const activePeriod = await this.prisma.crew_periods.findFirst({
      where: {
        crew_id: crewId,
        is_active: true,
      },
    });

    if (!activePeriod) {
      throw new BadRequestException('Hiện tại không có kỳ đóng quỹ nào đang mở!');
    }

    const currentContributions = await this.prisma.transactions.aggregate({
      where: {
        crew_id: crewId,
        user_id: userId,
        period_id: activePeriod.id,
        type: 'DEPOSIT',
        status: { in: ['SUCCESS', 'PENDING'] } 
      },
      _sum: { amount: true }
    });

    const totalSubmitted = Number(currentContributions._sum.amount || 0);
    const targetAmount = Number(activePeriod.min_amount_per_member || 0);

    if (totalSubmitted >= targetAmount) {
      throw new BadRequestException('Bạn đã nộp đủ chỉ tiêu của kỳ này');
    }

    const missingAmount = targetAmount - totalSubmitted;
    if (amount > missingAmount) {
      throw new BadRequestException(`Bạn chỉ còn thiếu ${missingAmount.toLocaleString('vi-VN')}đ. Vui lòng nhập đúng số tiền!`);
    }

    return this.prisma.transactions.create({
      data: {
        crew_id: crewId,
        user_id: userId,
        period_id: activePeriod.id,
        type: 'DEPOSIT',
        amount: amount,
        status: 'PENDING', 
        note: 'Báo cáo nộp quỹ',
      }
    });
  }

  async approveDeposit(transactionId: string) {
    const tx = await this.prisma.transactions.findUnique({
      where: { id: transactionId }
    });

    if (!tx || tx.status !== 'PENDING' || !tx.crew_id || !tx.user_id) {
      throw new BadRequestException('Giao dịch không hợp lệ hoặc đã được xử lý');
    }

    const safeCrewId = tx.crew_id;
    const safeUserId = tx.user_id;
    const safeAmount = Number(tx.amount);

    return this.prisma.$transaction(async (prisma) => {
      const updatedTx = await prisma.transactions.update({
        where: { id: transactionId },
        data: { status: 'SUCCESS' }
      });

      await prisma.crews.update({
        where: { id: safeCrewId },
        data: { total_balance: { increment: safeAmount } }
      });

      await prisma.memberships.updateMany({
        where: { 
          crew_id: safeCrewId, 
          user_id: safeUserId 
        },
        data: { total_contribution: { increment: safeAmount } }
      });

      this.notifyCaptain(safeCrewId, safeUserId, safeAmount);

      return updatedTx;
    });
  }
}