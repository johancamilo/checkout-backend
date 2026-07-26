import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches, ValidateNested } from 'class-validator';

export class CardDto {
  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'card number must contain only 13-19 digits' })
  number!: string;

  @IsString()
  @Length(3, 4)
  cvc!: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])$/, { message: 'expMonth must be a two-digit month (01-12)' })
  expMonth!: string;

  @IsString()
  @Matches(/^\d{2}$/, { message: 'expYear must be a two-digit year' })
  expYear!: string;

  @IsString()
  @IsNotEmpty()
  cardHolder!: string;
}

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @ValidateNested()
  @Type(() => CardDto)
  card!: CardDto;
}
