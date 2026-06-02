import { IsString, IsNumber, IsIn } from 'class-validator';

export class StoreWebhookDto {
  @IsString()
  eventId: string;

  @IsString()
  userId: string;

  @IsIn([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'CANCELLATION',
    'UN_CANCELLATION',
    'BILLING_ISSUE',
    'EXPIRATION',
  ])
  type: string;

  @IsNumber()
  eventTimeMs: number;

  @IsString()
  productId: string;
}