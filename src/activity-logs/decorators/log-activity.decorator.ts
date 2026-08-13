import { SetMetadata } from '@nestjs/common';

export const LOG_ACTIVITY_KEY = 'log_activity';

export interface LogActivityOptions {
  module: string;
  action?: string;
  description?: string;
}

export const LogActivity = (options: LogActivityOptions) =>
  SetMetadata(LOG_ACTIVITY_KEY, options);
