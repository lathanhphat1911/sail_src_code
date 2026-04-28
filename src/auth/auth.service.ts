import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'; // Chú ý check lại đường dẫn prisma cho chuẩn
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async hashData(data: string) {
    return bcrypt.hash(data, 10);
  }

  async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email }, // 💥 Dùng 'sub' chuẩn JWT
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' }, 
      ),
      this.jwtService.signAsync(
        { sub: userId, email },
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' }, 
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refreshSecretKey', 
      });

      // 💥 FIX 1: Tìm bằng payload.sub thay vì payload.userId
      const user = await this.prisma.users.findUnique({
        where: { id: payload.sub }, 
      });

      if (!user || !user.refresh_token) {
        throw new ForbiddenException('Access Denied');
      }

      if (user.refresh_token !== refreshToken) {
         throw new ForbiddenException('Access Denied');
      }

      // Tạo cặp token mới
      const tokens = await this.getTokens(user.id, user.email);

      // Cập nhật lại refresh token mới vào DB
      await this.prisma.users.update({
        where: { id: user.id },
        data: { refresh_token: tokens.refreshToken },
      });

      return tokens;

    } catch (error) {
      throw new UnauthorizedException('Refresh Token không hợp lệ hoặc đã hết hạn');
    }
  }

  async register(dto: RegisterDto) {
    const userExists = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });
    if (userExists) {
      throw new BadRequestException('Email này đã được sử dụng!');
    }

    const hashedPassword = await this.hashData(dto.password);
    const newUser = await this.prisma.users.create({
      data: {
        email: dto.email,
        password_hash: hashedPassword,
        full_name: dto.fullName,
      },
    });

    const tokens = await this.getTokens(newUser.id, newUser.email);
    
    // 💥 FIX 2: Lưu Refresh Token vào DB khi đăng ký
    await this.prisma.users.update({
      where: { id: newUser.id },
      data: { refresh_token: tokens.refreshToken },
    });

    // 💥 FIX 3: Trả về cục 'user' để Frontend lấy ID cất đi
    return {
      ...tokens,
      user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name }
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa!');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Mật khẩu không chính xác!');
    }

    const tokens = await this.getTokens(user.id, user.email);
    
    // 💥 FIX 2: Bắt buộc lưu Refresh Token vào DB để đối chiếu sau này
    await this.prisma.users.update({
      where: { id: user.id },
      data: { refresh_token: tokens.refreshToken },
    });

    // 💥 FIX 3: Trả về cục 'user' cho Frontend
    return {
      ...tokens,
      user: { id: user.id, email: user.email, full_name: user.full_name }
    };
  }

  async getProfile(userId: string) {
    return await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        created_at: true,
        _count: {
          select: { crews: true } 
        }
      }
    });
  }
}