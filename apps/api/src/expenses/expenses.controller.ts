import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Audit, Roles } from '../common/decorators/metadata.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateExpenseDto,
  ExpenseSummaryQueryDto,
  ExpensesQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { ExpensePeriod, ExpensesService } from './expenses.service';

const PERIODS: ExpensePeriod[] = ['day', 'week', 'month', 'all'];

@Controller({ path: 'expenses', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get('summary')
  summary(@Query() query: ExpenseSummaryQueryDto) {
    const period = PERIODS.includes(query.period as ExpensePeriod)
      ? (query.period as ExpensePeriod)
      : 'month';
    return this.expenses.summary(period, query.origin);
  }

  @Get()
  findAll(@Query() query: ExpensesQueryDto) {
    return this.expenses.findAll(query);
  }

  @Post()
  @Audit('CREATE', 'Expense')
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.expenses.create(dto, user?.id);
  }

  @Patch(':id')
  @Audit('UPDATE', 'Expense')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(id, dto);
  }

  @Delete(':id')
  @Audit('DELETE', 'Expense')
  remove(@Param('id') id: string) {
    return this.expenses.remove(id);
  }
}
