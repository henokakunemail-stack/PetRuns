import { Controller, Get, Post, Body } from '@nestjs/common';
import { SpeciesService } from './species.service';
import { CreateSpeciesDto } from './dto/create-species.dto';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Species')
@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Get()
  findAll() {
    return this.speciesService.findAll();
  }

  @Post()
  @Roles('ADMIN') // data master — hanya admin
  create(@Body() dto: CreateSpeciesDto) {
    return this.speciesService.create(dto);
  }
}
