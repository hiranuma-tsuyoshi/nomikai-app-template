/**
 * 回答の表記揺れを吸収する。
 * - NFKC（全角英数字→半角、半角カナ→全角カナ）
 * - 前後・内部の空白除去
 * - カタカナ→ひらがな
 * - 小文字化
 * - 末尾の句読点・記号除去
 */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[ァ-ヶ]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    )
    .toLowerCase()
    .replace(/[。、．，!！?？]+$/g, "");
}
