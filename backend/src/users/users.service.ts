import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username: username.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  async createUser(username: string, plainPassword: string, displayName?: string): Promise<User> {
    const normalized = username.trim().toLowerCase();
    const hash = await bcrypt.hash(plainPassword, 10);
    const user = this.repo.create({
      username: normalized,
      passwordHash: hash,
      displayName: displayName?.trim() || null,
    });
    return this.repo.save(user);
  }

  async ensureSeedAdmin(): Promise<void> {
    const n = await this.repo.count();
    if (n > 0) return;
    const username = (process.env.INITIAL_ADMIN_USERNAME || 'rover_admin').trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD || 'RoverSJ23!2026';
    await this.createUser(username, password, 'Administrador');
  }

  async updatePasswordHash(userId: string, newPlainPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPlainPassword, 10);
    await this.repo.update({ id: userId }, { passwordHash: hash });
  }

  async updateUsername(userId: string, newUsername: string): Promise<void> {
    await this.repo.update({ id: userId }, { username: newUsername });
  }
}
