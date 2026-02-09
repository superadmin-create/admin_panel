/**
 * Utility to stop any active Vapi calls
 * This ensures calls are stopped when navigating away from viva page
 */

// Extend globalThis to persist across module reloads
declare global {
  // eslint-disable-next-line no-var
  var __activeVapiInstances: Set<any> | undefined;
  // eslint-disable-next-line no-var
  var __activeMediaStreams: Set<MediaStream> | undefined;
  // eslint-disable-next-line no-var
  var __activeVapiInstance: any;
}

// Use globalThis to persist across module reloads in development
function getVapiInstances(): Set<any> {
  if (!globalThis.__activeVapiInstances) {
    globalThis.__activeVapiInstances = new Set<any>();
  }
  return globalThis.__activeVapiInstances;
}

function getMediaStreams(): Set<MediaStream> {
  if (!globalThis.__activeMediaStreams) {
    globalThis.__activeMediaStreams = new Set<MediaStream>();
  }
  return globalThis.__activeMediaStreams;
}

export function registerVapiInstance(vapi: any): () => void {
  const instances = getVapiInstances();
  instances.add(vapi);
  console.log("[VapiCleanup] Registered Vapi instance, total:", instances.size);

  // Return cleanup function
  return () => {
    instances.delete(vapi);
    console.log("[VapiCleanup] Unregistered Vapi instance, remaining:", instances.size);
  };
}

// Track media streams so we can stop the ACTUAL streams, not create new ones
export function registerMediaStream(stream: MediaStream): void {
  const streams = getMediaStreams();
  streams.add(stream);
  console.log("[VapiCleanup] Registered media stream, total:", streams.size);
}

export function stopAllMediaStreams(): void {
  const streams = getMediaStreams();
  console.log("[VapiCleanup] Stopping all media streams, count:", streams.size);

  streams.forEach((stream) => {
    try {
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("[VapiCleanup] Stopped track:", track.kind, track.label);
      });
    } catch (err) {
      console.error("[VapiCleanup] Error stopping stream:", err);
    }
  });

  streams.clear();
  console.log("[VapiCleanup] All media streams cleared");
}

export function stopAllVapiCalls(): void {
  const instances = getVapiInstances();
  console.log("[VapiCleanup] Stopping all active Vapi calls, count:", instances.size);

  // Also check global backup instance
  if (typeof window !== "undefined" && globalThis.__activeVapiInstance) {
    const globalVapi = globalThis.__activeVapiInstance;
    if (globalVapi && typeof globalVapi.stop === "function") {
      console.log("[VapiCleanup] Found global Vapi instance, adding to stop list");
      instances.add(globalVapi);
    }
  }

  // Also check VapiSession singleton
  if (typeof globalThis !== "undefined" && (globalThis as any).__vapiSingleton) {
    const singleton = (globalThis as any).__vapiSingleton;
    if (singleton && typeof singleton.stop === "function") {
      console.log("[VapiCleanup] Found VapiSession singleton, adding to stop list");
      instances.add(singleton);
    }
  }

  // Force stop all instances regardless of state
  instances.forEach((vapi) => {
    try {
      if (vapi && typeof vapi.stop === "function") {
        console.log("[VapiCleanup] Stopping Vapi instance...");
        vapi.stop();
        console.log("[VapiCleanup] Vapi stop() called successfully");
      }
    } catch (err) {
      console.error("[VapiCleanup] Error stopping Vapi call:", err);
    }
  });

  instances.clear();

  // Clear global backup
  if (typeof window !== "undefined") {
    delete globalThis.__activeVapiInstance;
  }

  // Clear VapiSession singleton and flags
  if (typeof globalThis !== "undefined") {
    (globalThis as any).__vapiSingleton = null;
    (globalThis as any).__vapiCallStarted = false;
    (globalThis as any).__vapiInitInProgress = false;
  }

  // Also stop all tracked media streams
  stopAllMediaStreams();

  console.log("[VapiCleanup] All Vapi instances and media streams cleared");
}

// Export function to get active instances count (for debugging)
export function getActiveVapiInstancesCount(): number {
  return getVapiInstances().size;
}
