import { Injectable, UnauthorizedException } from '@nestjs/common';

const DEMO_USERS = [
  {
    id: 'demo-user-1',
    name: 'Demo Patient',
    email: 'patient@demo.com',
    password: '123456',
    role: 'user',
  },
  {
    id: 'demo-aidant-1',
    name: 'Demo Aidant',
    email: 'aidant@demo.com',
    password: '123456',
    role: 'aidant',
    linkedUserId: 'demo-user-1',
  },
];

@Injectable()
export class AuthService {
  login(email: string, password: string) {
    const normalizedEmail = email?.trim().toLowerCase();
    const account = DEMO_USERS.find(
      (user) => user.email === normalizedEmail && user.password === password,
    );

    if (!account) {
      throw new UnauthorizedException('Identifiants de demonstration invalides');
    }

    const { password: _password, ...user } = account;

    return {
      token: `demo-${user.role}-token`,
      user,
    };
  }
}
