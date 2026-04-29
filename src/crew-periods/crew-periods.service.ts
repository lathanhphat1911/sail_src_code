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

    // Tối ưu: Chỉ lấy các giao dịch nạp tiền (DEPOSIT / IN)
    const transactions = await this.prisma.transactions.findMany({
      where: { 
        crew_id: crewId, 
        status: { in: ['SUCCESS', 'PENDING'] },
        type: { in: ['DEPOSIT', 'IN'] } 
      }
    });

    // 1. Tính toán Tổng mục tiêu CỦA MỖI KỲ (periodTotalGoal)
    const crew = await this.prisma.crews.findUnique({
      where: { id: crewId },
      select: { goal: true }
    });
    const totalGoal = Number(crew?.goal || 0);
    const periodsCount = periods.length || 1;
    const periodTotalGoal = totalGoal / periodsCount; 

    // 2. TÍNH TOÁN CÔNG BẰNG LUỸ KẾ (CUMULATIVE FAIR SHARE)
    let cumulativeGoal = 0;
    const cumFairShares: Map<string, number>[] = []; 

    periods.forEach((period) => {
      cumulativeGoal += periodTotalGoal;

      // Tìm những người đã join tính đến lúc kỳ này kết thúc
      const activeMembers = memberships.filter(m => {
        const joinDate = (m as any).created_at || new Date();
        return !period.end_date || joinDate <= period.end_date;
      });

      const activeCount = activeMembers.length || 1;
      const fairShare = cumulativeGoal / activeCount;

      const userShares = new Map<string, number>();
      memberships.forEach(m => {
        const joinDate = (m as any).created_at || new Date();
        const isJoinedLate = period.end_date && joinDate > period.end_date;
        // Nếu vào sau khi kỳ kết thúc -> Mục tiêu kỳ đó = 0
        userShares.set(m.user_id, isJoinedLate ? 0 : fairShare);
      });
      cumFairShares.push(userShares);
    });

    const now = new Date();
    
    // 💥 BIẾN LƯU SỐ DƯ THỪA ĐỂ CHUYỂN TIẾP (BRINGOVER)
    let userSurplus = new Map<string, number>(); 

    return periods.map((period, index) => {
      const isCurrent = period.start_date <= now && period.end_date >= now;

      // Chỉ tiêu hiển thị ở Header (VD: Mục tiêu 166.667đ/người)
      const activeMembers = memberships.filter(m => {
        const joinDate = (m as any).created_at || new Date();
        return !period.end_date || joinDate <= period.end_date;
      });
      const periodDisplayMinAmount = Math.ceil(periodTotalGoal / (activeMembers.length || 1));

      const members = memberships.map(m => {
        const userId = m.user_id;

        // 💥 BƯỚC 1: Tính số tiền BẮT BUỘC ĐÓNG CỦA KỲ NÀY (Nhảy vọt cho người mới, giảm cho người cũ)
        const currentCumShare = cumFairShares[index].get(userId) || 0;
        const prevCumShare = index === 0 ? 0 : (cumFairShares[index - 1].get(userId) || 0);
        let baseRequired = Math.ceil(currentCumShare - prevCumShare);
        if (baseRequired < 0) baseRequired = 0;

        const joinDate = (m as any).created_at || new Date();
        const isJoinedLate = period.end_date && joinDate > period.end_date;

        // 💥 BƯỚC 2: Tính số tiền thực tế nộp VÀO ĐÚNG KỲ NÀY
        const userTxs = transactions.filter(tx => tx.user_id === userId && tx.period_id === period.id);

        const paidInThisPeriod = userTxs
          .filter(tx => tx.status === 'SUCCESS')
          .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const pendingTxsRaw = userTxs.filter(tx => tx.status === 'PENDING');
        const pendingAmount = pendingTxsRaw.reduce((sum, tx) => sum + Number(tx.amount), 0);
        const pendingTxs = pendingTxsRaw.map(tx => ({
          id: tx.id,
          amount: Number(tx.amount),
          date: tx.created_at ? new Date(tx.created_at).toLocaleDateString('vi-VN') : 'Vừa xong'
        }));

        // 💥 BƯỚC 3: GỘP SỐ DƯ TỪ KỲ TRƯỚC (BRINGOVER)
        const surplusFromPrev = userSurplus.get(userId) || 0;
        const effectivePaid = paidInThisPeriod + surplusFromPrev; 

        // 💥 BƯỚC 4: TÍNH LẠI SỐ DƯ ĐỂ MANG SANG KỲ SAU
        let newSurplus = 0;
        if (effectivePaid > baseRequired) {
           newSurplus = effectivePaid - baseRequired;
        }
        userSurplus.set(userId, newSurplus); 

        // UI Colors
        const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899'];
        const nameStr = m.users?.full_name || 'Thủy thủ ẩn danh';
        const colorIndex = nameStr.charCodeAt(0) % colors.length;

        return {
          id: userId,
          name: nameStr,
          role: m.role,
          avatarColor: colors[colorIndex],
          paidAmount: effectivePaid,    // Hiển thị số tiền gộp (Đã đóng + Dư chuyển sang)
          pendingAmount: pendingAmount,
          pendingTxs: pendingTxs,
          isJoinedLate: isJoinedLate,   
          requiredAmount: baseRequired  // Mục tiêu đã được điều chỉnh bù trừ
        };
      });

      return {
        id: period.id,
        name: period.name,
        deadline: period.end_date ? new Date(period.end_date).toLocaleDateString('vi-VN') : 'Không có hạn',
        minAmount: periodDisplayMinAmount,
        isCurrent: isCurrent,
        members: members
      };
    });
  }
  
}