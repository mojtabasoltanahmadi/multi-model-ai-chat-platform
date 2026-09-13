import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'ایمیل معتبر وارد کنید.' })
  email: string;

  @IsString({ message: 'رمز عبور باید متن باشد.' })
  @MinLength(1, { message: 'رمز عبور الزامی است.' })
  password: string;
}
