import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email;
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  // Upsert user_identity — email is unique, so this is idempotent
  const { error: identityError } = await supabase
    .from("user_identities")
    .upsert({ email, email_verified: false }, { onConflict: "email" });

  if (identityError) {
    return NextResponse.json({ error: "failed to create identity" }, { status: 500 });
  }

  // Create a fresh claim token (one-time use, 24h expiry)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: claimToken, error: tokenError } = await supabase
    .from("email_claim_tokens")
    .insert({ email, expires_at: expiresAt })
    .select()
    .single();

  if (tokenError || !claimToken) {
    return NextResponse.json({ error: "failed to create token" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const claimUrl = `${appUrl}/claim?token=${claimToken.token}`;

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: "Summer Weekends <noreply@resend.dev>",
      to: email,
      subject: "Verify your email — Summer Weekends",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">Verify your email</h2>
          <p style="color:#555;margin:0 0 24px">
            Click below to confirm your email and sync your availability across all your Summer Weekends groups.
          </p>
          <a href="${claimUrl}" style="display:inline-block;background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Verify email →
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">
            This link expires in 24 hours. If you didn't request this, you can ignore it.
          </p>
        </div>
      `,
    });
    if (emailError) {
      console.error("[send-claim] email error:", emailError);
    }
  } else {
    // Dev: log the link instead of sending
    console.log("[dev] claim link:", claimUrl);
  }

  return NextResponse.json({ ok: true });
}
