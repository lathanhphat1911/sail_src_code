import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateBulkPeriodsDto } from './dto/create-crew-period.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CrewPeriodsService {
  constructor(private prisma: PrismaService) {}

  async createBulk(userId: string, dto: CreateBulkPeriodsDto) {
    await this.prisma.crew_periods.deleteMany({
      where: { crew_id: dto.crewId }
    });

    const dataToInsert = dto.periods.map((period, index) => {
      const startDate = index === 0 
        ? new Date() 
        : new Date(dto.periods[index - 1].deadline);

      return {
        crew_id: dto.crewId,
        name: period.name,
        start_date: startDate,
        end_date: new Date(period.deadline),
        min_amount_per_member: period.amount,
        is_active: true,
      };
    });

    const result = await this.prisma.crew_periods.createMany({
      data: dataToInsert,
    });

    return { message: 'Đã lưu kế hoạch thành công', count: result.count };
  }

  async findByCrew(crewId: string) {
    return this.prisma.crew_periods.findMany({
      where: { crew_id: crewId },
      orderBy: { end_date: 'asc' }, 
    });
  }

  async getPeriodsWithStats(crewId: string) {
    const periods = await this.prisma.crew_periods.findMany({
      where: { crew_id: crewId },
      orderBy: { start_date: 'asc' }
    });

    const memberships = await this.prisma.memberships.findMany({
      where: { crew_id: crewId, status: 'ACTIVE' },
      include: { users: true }
    });

    const transactions = await this.prisma.transactions.findMany({
      where: { 
        crew_id: crewId, 
        status: { in: ['SUCCESS', 'PENDING'] } 
      }
    });

    const now = new Date();

    return periods.map(period => {
      const isCurrent = period.start_date <= now && period.end_date >= now;

      // 🔥 CHIA LẠI TIỀN CHO TỪNG KỲ (Bám theo số lượng member)
      const memberCount = memberships.length || 1;
      const actualMinPerMember = Math.ceil(Number(period.min_amount_per_member) / memberCount);

      const members = memberships.map(m => {
        const userTxs = transactions.filter(tx => 
          tx.user_id === m.user_id && 
          String(tx.type).trim().toUpperCase() === 'DEPOSIT' &&
          tx.period_id === period.id 
        );

        const paidAmount = userTxs
          .filter(tx => tx.status === 'SUCCESS')
          .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const pendingTxsRaw = userTxs.filter(tx => tx.status === 'PENDING');
        const pendingAmount = pendingTxsRaw.reduce((sum, tx) => sum + Number(tx.amount), 0);
        
        const pendingTxs = pendingTxsRaw.map(tx => ({
          id: tx.id,
          amount: Number(tx.amount),
          date: tx.created_at ? new Date(tx.created_at).toLocaleDateString('vi-VN') : 'Vừa xong'
        }));

        const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899'];
        const nameStr = m.users?.full_name || 'Thủy thủ ẩn danh';
        const colorIndex = nameStr.charCodeAt(0) % colors.length;

        const joinDate = m.created_at || new Date(); 
        const isJoinedLate = period.end_date && joinDate > period.end_date;

        const requiredAmount = isJoinedLate ? 0 : actualMinPerMember;

        return {
          id: m.user_id,
          name: nameStr,
          role: m.role,
          avatarColor: colors[colorIndex], 
          paidAmount: paidAmount,
          pendingAmount: pendingAmount, 
          pendingTxs: pendingTxs,
          isJoinedLate: isJoinedLate, // Cờ báo cho Frontend
          requiredAmount: requiredAmount // Chỉ tiêu thực tế
        };
      });

      return {
        id: period.id,
        name: period.name,
        deadline: period.end_date ? new Date(period.end_date).toLocaleDateString('vi-VN') : 'Không có hạn',
        minAmount: actualMinPerMember,
        isCurrent: isCurrent,
        members: members
      };
    });
  }
  
}