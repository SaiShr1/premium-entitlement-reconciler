import { IsArray, IsString } from 'class-validator';

export class MarketplaceRevokeDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}