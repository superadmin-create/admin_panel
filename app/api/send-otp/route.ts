import { NextResponse } from "next/server";
import { Resend } from "resend";
import { storeOTP, getOTP, clearOTP } from "@/lib/utils/otp-storage";
import { getOTPEmailHTML, getOTPEmailText } from "@/lib/utils/email-templates";

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const resendClient = getResendClient();
    if (!resendClient) {
      console.error("RESEND_API_KEY is not configured");
      return NextResponse.json(
        { error: "Email service is not configured" },
        { status: 500 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingOTP = await getOTP(normalizedEmail);
    if (existingOTP) {
      console.log(`[Send OTP] OTP already exists for ${normalizedEmail}, rate limiting`);
      return NextResponse.json(
        {
          error: "An OTP has already been sent. Please wait before requesting a new one.",
        },
        { status: 429 }
      );
    }

    const otp = generateOTP();

    await storeOTP(normalizedEmail, otp, 5 * 60 * 1000);
    console.log(`[Send OTP] OTP stored for ${normalizedEmail}`);

    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "AI Viva <onboarding@resend.dev>";

      const { data, error } = await resendClient.emails.send({
        from: fromEmail,
        to: email,
        subject: "Your Viva Verification Code",
        html: getOTPEmailHTML(otp),
        text: getOTPEmailText(otp),
      });

      if (error) {
        console.error("Resend API error:", error);
        await clearOTP(normalizedEmail);
        return NextResponse.json(
          { error: "Failed to send email" },
          { status: 500 }
        );
      }

      console.log("OTP email sent successfully:", data);

      return NextResponse.json({
        success: true,
        message: "OTP sent successfully",
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      await clearOTP(normalizedEmail);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in send-otp route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
