interface OTPData {
  otp: string;
  expiresAt: number;
  email: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __otpStorage: Map<string, OTPData> | undefined;
  // eslint-disable-next-line no-var
  var __otpCleanupInitialized: boolean | undefined;
}

function getMemoryStorage(): Map<string, OTPData> {
  if (!globalThis.__otpStorage) {
    globalThis.__otpStorage = new Map<string, OTPData>();
    console.log("[OTP Storage] Initialized new in-memory storage");
  }
  return globalThis.__otpStorage;
}

if (typeof globalThis.__otpCleanupInitialized === "undefined") {
  globalThis.__otpCleanupInitialized = true;
  setInterval(() => {
    const storage = getMemoryStorage();
    const now = Date.now();
    let cleanedCount = 0;
    const entries = Array.from(storage.entries());
    for (const [email, data] of entries) {
      if (data.expiresAt < now) {
        storage.delete(email);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`[OTP Storage] Cleaned up ${cleanedCount} expired OTPs`);
    }
  }, 60000);
}

export async function storeOTP(
  email: string,
  otp: string,
  expiresInMs: number
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const storage = getMemoryStorage();
  storage.set(normalizedEmail, {
    otp: otp.trim(),
    expiresAt: Date.now() + expiresInMs,
    email: normalizedEmail,
  });
  console.log(`[OTP Storage] Stored OTP for: ${normalizedEmail}`);
}

export async function getOTP(email: string): Promise<OTPData | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const storage = getMemoryStorage();
  const data = storage.get(normalizedEmail);

  if (!data) {
    console.log(`[OTP Storage] No OTP found for: ${normalizedEmail}`);
    return null;
  }

  if (data.expiresAt < Date.now()) {
    storage.delete(normalizedEmail);
    console.log(`[OTP Storage] OTP expired for: ${normalizedEmail}`);
    return null;
  }

  return data;
}

export async function verifyAndClearOTP(
  email: string,
  otp: string
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOTP = otp.trim();

  try {
    const storedData = await getOTP(normalizedEmail);

    if (!storedData) {
      console.log(`[OTP Storage] No OTP to verify for: ${normalizedEmail}`);
      return false;
    }

    if (storedData.otp === normalizedOTP) {
      await clearOTP(normalizedEmail);
      console.log(`[OTP Storage] OTP verified and cleared for: ${normalizedEmail}`);
      return true;
    }

    console.log(`[OTP Storage] OTP mismatch for: ${normalizedEmail}`);
    return false;
  } catch (error) {
    console.error("[OTP Storage] Error verifying OTP:", error);
    return false;
  }
}

export async function clearOTP(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const storage = getMemoryStorage();
  storage.delete(normalizedEmail);
  console.log(`[OTP Storage] Cleared OTP for: ${normalizedEmail}`);
}
