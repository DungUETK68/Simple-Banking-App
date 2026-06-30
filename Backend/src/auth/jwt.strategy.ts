import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private configService: ConfigService, private dataSource: DataSource) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false, // bao loi neu token het han
            secretOrKey: configService.get<string>('JWT_SECRET')!,
        });
    }

    // khi giai ma thanh cong
    async validate(payload: any) {
        const user = await this.dataSource.manager.findOne(User, {
            where: { id: payload.sub }
        });

        if (!user || user.status === 'locked') {
            throw new UnauthorizedException('Token is invalid or user is locked');
        }

        // gan vao req.user
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName
        };
    }
}