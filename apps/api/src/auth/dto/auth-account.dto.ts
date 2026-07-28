import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Uppercase, UppercaseOptional } from '../../common/decorators/uppercase.decorator';

export class LoginCredentialsDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Uppercase()
  name?: string;

  @IsOptional()
  @IsString()
  @UppercaseOptional()
  phone?: string;
}

export class ChangeEmailDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
