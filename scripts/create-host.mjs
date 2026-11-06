import { hash } from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const loginId = process.env.HOST_LOGIN_ID ?? "host";
const password = process.env.HOST_PASSWORD;

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(1);
}

if (!password || password.length < 8) {
  console.error("HOST_PASSWORD (8+ chars) is required.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const passwordHash = await hash(password, 12);

const { error } = await supabase.from("host_users").upsert(
  {
    login_id: loginId,
    password_hash: passwordHash,
  },
  { onConflict: "login_id" },
);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`Host user "${loginId}" is ready.`);
