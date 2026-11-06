/**
 * 残り時間を `00:47` 形式に整形する。
 * 負の値は0として扱う。
 */
export function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * ユーザーが見た目上の1文字と感じる単位で数える。
 * 絵文字などのサロゲートペアを1文字として扱う。
 */
export function countCharacters(value: string): number {
  return Array.from(value).length;
}

/**
 * 回答として送信できるか。
 * 空白だけの回答は無効。前後の空白は送信時に除去する。
 */
export function isValidAnswer(value: string, maxLength = 20): boolean {
  const trimmed = value.trim();
  const length = countCharacters(trimmed);

  return length > 0 && length <= maxLength;
}
