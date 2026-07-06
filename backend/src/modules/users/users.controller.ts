import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

interface RequestingUser {
  id: string;
  role: string[];
}

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getUser(@Param('id') id: string, @CurrentUser() requester: RequestingUser) {
    this.assertSelfOrAdmin(id, requester);
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() requester: RequestingUser,
  ) {
    this.assertSelfOrAdmin(id, requester);
    return this.usersService.update(id, dto);
  }

  /** Profil (termasuk alamat & koordinat) bersifat privat — hanya pemilik akun atau admin. */
  private assertSelfOrAdmin(targetUserId: string, requester: RequestingUser): void {
    if (requester.id !== targetUserId && !requester.role.includes('ADMIN')) {
      throw new ForbiddenException('Anda hanya bisa mengakses profil Anda sendiri');
    }
  }
}
