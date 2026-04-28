import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service'; // Chỉnh đường dẫn cho đúng

@Injectable()
export class CrewCronService {
  private readonly logger = new Logger(CrewCronService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('1 0 * * *') 
  async checkExpiredPeriods() {
    this.logger.log('Bắt đầu đi tuần tra các Hạm đội quá hạn đóng quỹ...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const expiredPeriods = await this.prisma.crew_periods.findMany({
      where: {
        end_date: { lt: new Date() }, 
        is_active: true,              
      },
      include: { crews: true }
    });

    for (const period of expiredPeriods) {
      if (!period.crew_id || period.crews?.status === 'FAILED') continue;

      let isPeriodFailed = false;
      const targetAmount = Number(period.min_amount_per_member);

      const memberships = await this.prisma.memberships.findMany({
        where: { crew_id: period.crew_id, status: 'ACTIVE' }
      });

      for (const member of memberships) {
        const transactions = await this.prisma.transactions.findMany({
          where: {
            crew_id: period.crew_id,
            user_id: member.user_id,
            type: 'DEPOSIT',
            status: 'SUCCESS', 
            created_at: { gte: period.start_date, lte: period.end_date }
          }
        });

        const totalPaid = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

        if (totalPaid < targetAmount) {
          isPeriodFailed = true;
          await this.notifyUser(member.user_id, 'Cảnh báo Đóng quỹ!', `Bạn đã không hoàn thành chỉ tiêu quỹ kỳ "${period.name}". Hạm đội bị ghi nhận 1 lần vi phạm!`);
        }
      }

      if (isPeriodFailed) {
        const currentFails = (period.crews?.failure_count || 0) + 1;
        
        if (currentFails >= 3) {
          await this.prisma.crews.update({
            where: { id: period.crew_id },
            data: { status: 'FAILED', failure_count: currentFails }
          });
          
          this.logger.warn(`Hạm đội ${period.crews?.name} đã CHÌM vì vi phạm 3 lần!`);
          
          for (const member of memberships) {
             await this.notifyUser(member.user_id, 'Tàu Đắm! 🏴‍☠️', `Hạm đội ${period.crews?.name} đã bị đánh chìm do vi phạm nộp quỹ 3 lần!`);
          }
        } else {
          await this.prisma.crews.update({
            where: { id: period.crew_id },
            data: { failure_count: currentFails }
          });
          
          for (const member of memberships) {
            await this.notifyUser(member.user_id, 'Cảnh cáo Hạm đội!', `Có thành viên không nộp đủ quỹ. Hạm đội ${period.crews?.name} đã vi phạm ${currentFails}/3 lần!`);
         }
        }
      }

      await this.prisma.crew_periods.update({
        where: { id: period.id },
        data: { is_active: false }
      });
    }
    
    this.logger.log('Đã tuần tra xong!');
  }

  private async notifyUser(userId: string, title: string, content: string) {
    await this.prisma.notifications.create({
      data: {
        user_id: userId,
        title: title,
        content: content,
        type: 'CREW_ALERT'
      }
    });
  }
}