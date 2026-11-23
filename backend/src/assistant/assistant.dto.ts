import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export const voices = {
  svetlana: 'ru-RU-SvetlanaNeural',
  dmitry: 'ru-RU-DmitryNeural',
  dariya: 'ru-RU-DariyaNeural',
} as const;
export type Voice = keyof typeof voices;

export class TurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class ChatDto {
  @IsArray()
  @ArrayMaxSize(11)
  @ValidateNested({ each: true })
  @Type(() => TurnDto)
  messages!: TurnDto[];
}

export class SpeechDto {
  @IsIn(Object.keys(voices))
  voice!: Voice;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;
}
