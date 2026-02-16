import { NextResponse } from "next/server";
import { verifyAndClearOTP } from "@/lib/utils/otp-storage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
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

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOTP = otp.trim();

    if (!/^\d{6}$/.test(normalizedOTP)) {
      return NextResponse.json(
        { error: "OTP must be 6 digits" },
        { status: 400 }
      );
    }

    console.log(`[Verify OTP] Verifying OTP for email: ${normalizedEmail}`);

    const isValid = await verifyAndClearOTP(normalizedEmail, normalizedOTP);

    if (!isValid) {
      console.log(`[Verify OTP] OTP verification failed for: ${normalizedEmail}`);
    } else {
      console.log(`[Verify OTP] OTP verification successful for: ${normalizedEmail}`);
    }

    if (isValid) {
      return NextResponse.json({
        verified: true,
        message: "OTP verified successfully",
      });
    } else {
      return NextResponse.json(
        {
          verified: false,
          error: "Invalid or expired OTP",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in verify-otp route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
