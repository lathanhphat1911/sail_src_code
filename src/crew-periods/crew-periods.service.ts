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
        status: { in: ['SUCCESS', 'PENDING'] },
        type: { in: ['DEPOSIT', 'IN'] } 
      }
    });

    // Lấy Goal để tính toán
    const crew = await this.prisma.crews.findUnique({
      where: { id: crewId },
      select: { goal: true }
    });
    const totalGoal = Number(crew?.goal || 0);
    const periodTotalGoal = totalGoal / (periods.length || 1);

    // 💥 1. TÍNH TOÁN FAIR SHARE LUỸ KẾ (ĐỒNG BỘ VỚI getDetail)
    let cumulativeGoal = 0;
    const cumFairShares: Map<string, number>[] = []; 

    periods.forEach((period, index) => {
      cumulativeGoal += periodTotalGoal;

      // Tìm giao dịch thành công đầu tiên của kỳ này để chốt sổ thành viên
      const pTxs = transactions.filter(tx => tx.period_id === period.id && tx.status === 'SUCCESS');
      
      // Mặc định chốt sổ sau 24h từ lúc bắt đầu kỳ, trừ khi có người nộp tiền sớm hơn
      let cutoffTime = new Date(period.start_date).getTime() + (24 * 60 * 60 * 1000); 
      if (pTxs.length > 0) {
        const earliestTxTime = Math.min(...pTxs.map(t => new Date(t.created_at).getTime()));
        cutoffTime = earliestTxTime + 60000; // Chốt sổ tại lúc nộp tiền + 1 phút du di
      }

      const activeMembers = memberships.filter(m => {
        const joinDate = (m as any).created_at ? new Date((m as any).created_at).getTime() : new Date().getTime();
        return joinDate <= cutoffTime;
      });

      const finalActiveMembers = activeMembers.length > 0 ? activeMembers : memberships;
      const fairShare = cumulativeGoal / (finalActiveMembers.length || 1);

      const userShares = new Map<string, number>();
      memberships.forEach(m => {
        const isActive = finalActiveMembers.some(activeM => activeM.user_id === m.user_id);
        userShares.set(m.user_id, isActive ? fairShare : 0);
      });
      cumFairShares.push(userShares);
    });

    const now = new Date();
    let userSurplus = new Map<string, number>(); 

    // 💥 2. MAP DỮ LIỆU TỪNG KỲ
    return periods.map((period, index) => {
      const isCurrent = period.start_date <= now && period.end_date >= now;

      const members = memberships.map(m => {
        const userId = m.user_id;

        // Tính Required Amount (Bù trừ luỹ kế)
        const currentCumShare = cumFairShares[index].get(userId) || 0;
        const prevCumShare = index === 0 ? 0 : (cumFairShares[index - 1].get(userId) || 0);
        let baseRequired = Math.ceil(currentCumShare - prevCumShare);
        if (baseRequired < 0) baseRequired = 0;

        // Cờ Joined Late cho UI
        const joinDate = (m as any).created_at ? new Date((m as any).created_at).getTime() : new Date().getTime();
        // Lấy cutoffTime giống hệt logic trên
        const pTxs = transactions.filter(tx => tx.period_id === period.id && tx.status === 'SUCCESS');
        let cutoffTime = new Date(period.start_date).getTime() + (24 * 60 * 60 * 1000);
        if (pTxs.length > 0) {
          cutoffTime = Math.min(...pTxs.map(t => new Date(t.created_at).getTime())) + 60000;
        }
        const isJoinedLate = joinDate > cutoffTime;

        // Tiền nộp trong kỳ này
        const userTxs = transactions.filter(tx => tx.user_id === userId && tx.period_id === period.id);
        const paidInThisPeriod = userTxs.filter(tx => tx.status === 'SUCCESS').reduce((sum, tx) => sum + Number(tx.amount), 0);
        
        // Tiền dư mang sang (Bringover)
        const surplusFromPrev = userSurplus.get(userId) || 0;
        const effectivePaid = paidInThisPeriod + surplusFromPrev;

        // Tính Surplus mới cho kỳ sau
        let newSurplus = 0;
        if (effectivePaid > baseRequired) {
           newSurplus = effectivePaid - baseRequired;
        }
        userSurplus.set(userId, newSurplus); 

        const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899'];
        const nameStr = m.users?.full_name || 'Thủy thủ ẩn danh';
        const colorIndex = nameStr.charCodeAt(0) % colors.length;

        return {
          id: userId,
          name: nameStr,
          role: m.role,
          avatarColor: colors[colorIndex],
          paidAmount: effectivePaid,
          pendingAmount: userTxs.filter(tx => tx.status === 'PENDING').reduce((sum, tx) => sum + Number(tx.amount), 0),
          pendingTxs: userTxs.filter(tx => tx.status === 'PENDING').map(tx => ({
            id: tx.id,
            amount: Number(tx.amount),
            date: tx.created_at ? new Date(tx.created_at).toLocaleDateString('vi-VN') : 'Vừa xong'
          })),
          isJoinedLate: isJoinedLate,
          requiredAmount: baseRequired
        };
      });

      // Lấy display minAmount cho Header
      const headerMinAmount = Math.ceil((cumFairShares[index].get(memberships[0].user_id) || 0) - (index === 0 ? 0 : (cumFairShares[index-1].get(memberships[0].user_id) || 0)));

      return {
        id: period.id,
        name: period.name,
        deadline: period.end_date ? new Date(period.end_date).toLocaleDateString('vi-VN') : 'Không có hạn',
        minAmount: headerMinAmount,
        isCurrent: isCurrent,
        members: members
      };
    });
  }
}