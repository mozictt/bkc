import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { ExpenseCategory } from './entities/expense-category.entity';
import { Transaction } from './entities/transaction.entity';
import { BudgetPlan } from './entities/budget-plan.entity';
import { FamilyMember } from './entities/family-member.entity';

// Services
import { CategoryService } from './services/category.service';
import { TransactionService } from './services/transaction.service';
import { BudgetService } from './services/budget.service';
import { FamilyMemberService } from './services/family-member.service';
import { DashboardService } from './services/dashboard.service';
import { ReportService } from './services/report.service';

// Controllers
import { CategoryController } from './controllers/category.controller';
import { TransactionController } from './controllers/transaction.controller';
import { BudgetController } from './controllers/budget.controller';
import { FamilyMemberController } from './controllers/family-member.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { ReportController } from './controllers/report.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseCategory,
      Transaction,
      BudgetPlan,
      FamilyMember,
    ]),
  ],
  controllers: [
    CategoryController,
    TransactionController,
    BudgetController,
    FamilyMemberController,
    DashboardController,
    ReportController,
  ],
  providers: [
    CategoryService,
    TransactionService,
    BudgetService,
    FamilyMemberService,
    DashboardService,
    ReportService,
  ],
  exports: [
    CategoryService,
    TransactionService,
  ],
})
export class RumahTanggaModule {}
