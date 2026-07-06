import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PetsService, RequestingUser } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@ApiTags('Pets')
@ApiBearerAuth('access-token')
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get('owner/:ownerId')
  findByOwner(@Param('ownerId') ownerId: string, @CurrentUser() requester: RequestingUser) {
    return this.petsService.findAllByOwner(ownerId, requester);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() requester: RequestingUser) {
    return this.petsService.findById(id, requester);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePetDto, @CurrentUser('id') ownerId: string) {
    return this.petsService.create(ownerId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
    @CurrentUser() requester: RequestingUser,
  ) {
    return this.petsService.update(id, dto, requester);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() requester: RequestingUser) {
    return this.petsService.softDelete(id, requester);
  }
}
