import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BreedsService } from './breeds.service';
import { CreateBreedDto } from './dto/create-breed.dto';

@ApiTags('Breeds')
@Controller('breeds')
export class BreedsController {
  constructor(private readonly breedsService: BreedsService) {}

  @Get()
  findAll(@Query('speciesId') speciesId?: string) {
    return this.breedsService.findAll(speciesId);
  }

  @Post()
  create(@Body() dto: CreateBreedDto) {
    return this.breedsService.create(dto);
  }
}
