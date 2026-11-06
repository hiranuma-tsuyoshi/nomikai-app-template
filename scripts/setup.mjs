import { randomInt } from "node:crypto";
import { constants } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

const envPath = ".env.local";

try {
  await access(envPath, constants.F_OK);
  console.error(`${envPath} は既に存在します。上書きする場合は先に削除してください。`);
  process.exit(1);
} catch {
  // ファイルが無い場合だけ続行する
}

const rl = createInterface({ input, output });

async function ask(label, envName) {
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv.trim();
  const value = await rl.question(label);
  return value.trim();
}

const url = (await ask(
  "Supabase URL (https://xxxx.supabase.co): ",
  "NEXT_PUBLIC_SUPABASE_URL",
)).replace(/\/+$/, "");

const serviceKey = await ask(
  "Supabase service_role key: ",
  "SUPABASE_SERVICE_ROLE_KEY",
);

rl.close();

try {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("https required");
} catch {
  console.error("Supabase URL は https:// で始まるURLを指定してください。");
  process.exit(1);
}

if (!serviceKey.startsWith("eyJ") && !serviceKey.startsWith("sb_secret_")) {
  console.error("service_role key の形式が正しくありません。");
  process.exit(1);
}

try {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) {
    console.warn(
      `警告: Supabaseへの接続確認が HTTP ${response.status} を返しました。URLとキーを確認してください。`,
    );
  }
} catch (error) {
  console.warn(`警告: Supabaseへ接続できませんでした: ${error.message}`);
}

const hostKey = String(randomInt(10_000_000, 100_000_000));

const lines = [
  `NEXT_PUBLIC_SUPABASE_URL=${url}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
  `HOST_KEY=${hostKey}`,
  "ROOM_CODE=4821",
  "TEAM_COUNT=5",
  "TEAM_CAPACITY=7",
  "STAGE_REQUIRE_TOKEN=1",
];

await writeFile(envPath, `${lines.join("\n")}\n`, {
  encoding: "utf8",
  mode: 0o600,
});

console.log(`\n${envPath} を作成しました。`);
console.log(`HOST_KEY: ${hostKey}`);
console.log("\n次の手順:");
console.log("  1. Supabase で migrations を実行する (docs/SETUP.md)");
console.log("  2. npm run dev");
console.log("  3. http://localhost:3000/api/health で store.backend が supabase になることを確認");
