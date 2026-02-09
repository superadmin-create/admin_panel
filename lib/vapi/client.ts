"use client";

import Vapi from "@vapi-ai/web";

// Initialize Vapi with the public API key
// The public key is safe to expose in the browser
export function getVapiClient(): Vapi {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set. Please add it to your .env file."
    );
  }

  // Initialize Vapi client
  const vapi = new Vapi(publicKey);

  return vapi;
}

// Note: We don't use a singleton pattern in VapiSession component
// to avoid state conflicts. Each session gets a fresh instance.
// This function is kept for backwards compatibility but should not be used
// in the VapiSession component.

// Export a singleton instance (DEPRECATED - use new Vapi() directly)
let vapiInstance: Vapi | null = null;

export function getVapiInstance(): Vapi {
  if (!vapiInstance) {
    vapiInstance = getVapiClient();
  }
  return vapiInstance;
}
