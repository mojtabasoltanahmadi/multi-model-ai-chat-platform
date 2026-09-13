import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'ایمیل معتبر وارد کنید.' })
  email: string;

  @IsString({ message: 'رمز عبور باید متن باشد.' })
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' })
  @MaxLength(72, { message: 'رمز عبور نباید بیشتر از ۷۲ کاراکتر باشد.' })
  password: string;
}
