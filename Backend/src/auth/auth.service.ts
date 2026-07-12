import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../entities/user.entity';
import { Account } from '../entities/account.entity';
import { Session } from '../entities/session.entity';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
    constructor(private dataSource: DataSource,
        private jwtService: JwtService,
        private configService: ConfigService
    ) { }

    async register(registerDto: RegisterDto) {
        const { email, password, fullName } = registerDto;

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const existingUser = await queryRunner.manager.findOne(User, { where: { email } });
            if (existingUser) {
                throw new ConflictException('Email này đã tồn tại.');
            }

            const salt = await bcrypt.genSalt();
            const passwordHash = await bcrypt.hash(password, salt);

            const user = new User();
            user.email = email;
            user.fullName = fullName;
            user.passwordHash = passwordHash;
            const savedUser = await queryRunner.manager.save(user);

            const account = new Account();
            account.user = savedUser;
            account.accountNumber = Math.random().toString().slice(2, 12);
            await queryRunner.manager.save(account);

            await queryRunner.commitTransaction();

            return {
                message: 'Đăng ký tài khoản thành công.',
                userId: savedUser.id,
            }
        } catch (error) {
            await queryRunner.rollbackTransaction();

            if (error instanceof ConflictException) {
                throw error;
            }

            throw new InternalServerErrorException('Đăng ký thất bại, vui lòng thử lại.');
        } finally {
            await queryRunner.release();
        }
    }

    async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
        const { email, password } = loginDto;

        try {
            const user = await this.dataSource.manager.findOne(User, { where: { email } });
            if (!user) {
                throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
            }

            if (user.status === 'locked') {
                throw new UnauthorizedException('Tài khoản của bạn đã bị khóa bởi Admin.');
            }

            if (user.lockUntil && user.lockUntil > new Date()) {
                const lockTime = user.lockUntil.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                throw new UnauthorizedException(`Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau ${lockTime}`);
            }

            const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordMatch) {
                user.failedLoginAttempts += 1;
                if (user.failedLoginAttempts >= 5) {
                    user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
                    await this.dataSource.manager.save(user);
                    throw new UnauthorizedException('Tài khoản bị khóa 15 phút do nhập sai mật khẩu quá 5 lần.');
                }
                await this.dataSource.manager.save(user);
                throw new UnauthorizedException(`Email hoặc mật khẩu không đúng. Bạn còn ${5 - user.failedLoginAttempts} lần thử.`);
            }

            if (user.failedLoginAttempts > 0 || user.lockUntil) {
                user.failedLoginAttempts = 0;
                user.lockUntil = null;
                await this.dataSource.manager.save(user);
            }

            const tokens = await this.generateTokens(user, ipAddress, userAgent);

            return {
                message: 'Đăng nhập thành công.',
                data: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    user: {
                        id: user.id,
                        fullName: user.fullName,
                        email: user.email,
                        role: user.role
                    }
                }
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            throw new InternalServerErrorException('Lỗi trong quá trình đăng nhập, vui lòng thử lại.');
        }
    }

    private async generateTokens(user: User, ipAddress?: string, userAgent?: string, existingSessionId?: string) {
        // Create or reuse session
        let session = new Session();
        if (existingSessionId) {
            const existing = await this.dataSource.manager.findOne(Session, { where: { id: existingSessionId } });
            if (existing) session = existing;
        } else {
            session.user = user;
            session.userId = user.id;
            session.ipAddress = ipAddress || '';
            session.userAgent = userAgent || '';
            session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            session = await this.dataSource.manager.save(session);
        }

        const payload = { sub: user.id, email: user.email, role: user.role, sessionId: session.id };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<any>('JWT_SECRET')!,
                expiresIn: this.configService.get<any>('JWT_EXPIRATION', '15m'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<any>('JWT_REFRESH_SECRET')!,
                expiresIn: this.configService.get<any>('JWT_REFRESH_EXPIRATION', '7d'),
            }),
        ]);

        const salt = await bcrypt.genSalt();
        const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

        session.refreshTokenHash = refreshTokenHash;
        session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.dataSource.manager.save(session);

        return { accessToken, refreshToken };
    }

    async refreshToken(refreshDto: RefreshTokenDto, ipAddress?: string, userAgent?: string) {
        const { refreshToken } = refreshDto;

        try {
            let payload: any;
            try {
                payload = await this.jwtService.verifyAsync(refreshToken, {
                    secret: this.configService.get<string>('JWT_REFRESH_SECRET')!
                });
            } catch (error) {
                throw new UnauthorizedException('Invalid or expired refresh token');
            }

            const sessionId = payload.sessionId;
            if (!sessionId) {
                throw new UnauthorizedException('Access Denied');
            }

            const session = await this.dataSource.manager.findOne(Session, {
                where: { id: sessionId },
                relations: { user: true }
            });

            if (!session || !session.user || session.expiresAt < new Date()) {
                throw new UnauthorizedException('Session expired or invalid');
            }

            const isRefreshTokenMatch = await bcrypt.compare(refreshToken, session.refreshTokenHash);
            if (!isRefreshTokenMatch) {
                throw new UnauthorizedException('Access Denied');
            }


            if (ipAddress) session.ipAddress = ipAddress;
            if (userAgent) session.userAgent = userAgent;

            const tokens = await this.generateTokens(session.user, session.ipAddress, session.userAgent, session.id);

            return {
                message: 'Token refreshed successfully',
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new InternalServerErrorException('System error. Please try again later.');
        }
    }

    async logout(sessionId: string) {
        try {
            if (sessionId) {
                await this.dataSource.manager.delete(Session, { id: sessionId });
            }
            return { message: 'Đăng xuất thành công' };
        } catch (error) {
            throw new InternalServerErrorException('Có lỗi xảy ra khi đăng xuất');
        }
    }

    async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
        const { oldPassword, newPassword } = changePasswordDto;

        try {
            const user = await this.dataSource.manager.findOne(User, { where: { id: userId } });
            if (!user) {
                throw new UnauthorizedException('Người dùng không tồn tại.');
            }

            const isPasswordMatch = await bcrypt.compare(oldPassword, user.passwordHash);
            if (!isPasswordMatch) {
                throw new UnauthorizedException('Mật khẩu cũ không chính xác.');
            }

            const salt = await bcrypt.genSalt();
            user.passwordHash = await bcrypt.hash(newPassword, salt);
            await this.dataSource.manager.save(user);

            await this.dataSource.manager.delete(Session, { userId: user.id });

            return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new InternalServerErrorException('Lỗi hệ thống khi đổi mật khẩu.');
        }
    }
}
