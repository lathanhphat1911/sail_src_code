import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AchievementsService } from './achievements.service';

@Controller('achievements')
@UseGuards(AuthGuard('jwt'))
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  async list(@Request() req: { user?: { userId: string } }) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    const data = await this.achievementsService.listForUser(userId);
    return { statusCode: 200, message: 'OK', data };
  }

  @Post(':id/equip')
  async equip(
    @Request() req: { user?: { userId: string } },
    @Param('id') achievementId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    const data = await this.achievementsService.equip(userId, achievementId);
    return { statusCode: 200, message: 'Đã trang bị thành tựu', data };
  }

  @Delete('equip')
  async unequip(@Request() req: { user?: { userId: string } }) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Không tìm thấy người dùng');
    }
    const data = await this.achievementsService.unequip(userId);
    return { statusCode: 200, message: 'Đã gỡ trang bị', data };
  }
}
