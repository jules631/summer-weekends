import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { token, member_tokens } = body ?? {};

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  // Find the claim token — must be unused and not expired
  const { data: claimToken, error: findError } = await supabase
    .from("email_claim_tokens")
    .select()
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (findError || !claimToken) {
    return NextResponse.json({ error: "invalid or expired link" }, { status: 400 });
  }

  // Mark token as used
  await supabase
    .from("email_claim_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", claimToken.id);

  // Upsert user_identity — mark email as verified
  const { data: identity, error: identityError } = await supabase
    .from("user_identities")
    .upsert({ email: claimToken.email, email_verified: true }, { onConflict: "email" })
    .select()
    .single();

  if (identityError || !identity) {
    return NextResponse.json({ error: "identity error" }, { status: 500 });
  }

  // Link any member_tokens the client sent (all groups this person joined)
  if (Array.isArray(member_tokens) && member_tokens.length > 0) {
    await supabase
      .from("members")
      .update({ user_identity_id: identity.id })
      .in("member_token", member_tokens);
  }

  return NextResponse.json({ user_token: identity.user_token });
}
