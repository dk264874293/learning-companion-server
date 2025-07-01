import { Post,Get, Controller, Body, Query } from '@nestjs/common';
import { ApiOperation,  } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { ApiTags } from '@nestjs/swagger';
import { SearchDto } from './/search.dto';

@ApiTags('搜索')
@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @ApiOperation({
        summary: '搜索',
        description: '搜索',
    })
    @Post('search')
    async search(@Body() body: SearchDto) {
        return await this.searchService.search(body.query);
    }

    @Get('make-question')
    async makeQuestion(@Query('query') query: string) {
        return await this.searchService.makeQuestion(query);
    }
}