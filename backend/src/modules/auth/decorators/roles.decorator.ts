import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Batasi akses endpoint ke role tertentu, misal: @Roles('ADMIN')
 * User bisa punya lebih dari satu role (role adalah array di schema),
 * jadi guard mengecek apakah salah satu role user cocok dengan salah satu role yang diminta.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
