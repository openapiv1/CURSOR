"use server";

import { Sandbox } from "@e2b/desktop";
import { resolution } from "./tool";

// Pobierz klucz API E2B ze zmiennej środowiskowej
const E2B_API_KEY = process.env.E2B_API_KEY;

export const getDesktop = async (id?: string) => {
  try {
    if (!E2B_API_KEY) {
      throw new Error("E2B_API_KEY environment variable is required. Please set it in your .env file.");
    }
    console.log(`[DEBUG] getDesktop called with id: ${id}`);
    if (id) {
      try {
        console.log(`[DEBUG] Attempting to connect to existing sandbox: ${id}`);
        const connected = await Sandbox.connect(id, { apiKey: E2B_API_KEY });
        const isRunning = await connected.isRunning();
        console.log(`[DEBUG] Sandbox ${id} is running: ${isRunning}`);
        if (isRunning) {
          // Check if stream is already running before trying to start it
          if (connected.stream) {
            try {
              const url = connected.stream.getUrl();
              // Stream is already running if we have a URL
              if (!url) {
                await connected.stream.start();
              }
            } catch (e: any) {
              // Only try to start if error is not about stream already running
              if (!e?.message?.includes('already running')) {
                try {
                  await connected.stream.start();
                } catch (startError: any) {
                  // Ignore if stream is already running
                  if (!startError?.message?.includes('already running')) {
                    console.error('Failed to start stream:', startError);
                  }
                }
              }
            }
          }
          return connected;
        }
      } catch (connectError) {
        console.error("Error connecting to existing sandbox:", connectError);
        // Fall through to create a new one
      }
    }

    console.log(`[DEBUG] Creating new sandbox with API key: ${E2B_API_KEY?.substring(0, 10)}...`);
    const desktop = await Sandbox.create({
      resolution: [resolution.x, resolution.y], // Custom resolution
      timeoutMs: 300000, // Container timeout in milliseconds
      apiKey: E2B_API_KEY, // Bezpośrednio przekaż klucz API
      metadata: {}
    });
    console.log(`[DEBUG] New sandbox created with ID: ${desktop.sandboxId}`);
    if (desktop.stream) {
      console.log(`[DEBUG] Starting stream for sandbox: ${desktop.sandboxId}`);
      await desktop.stream.start();
      console.log(`[DEBUG] Stream started successfully`);
    }
    return desktop;
  } catch (error) {
    console.error("Error in getDesktop:", error);
    throw error;
  }
};

export const getDesktopURL = async (id?: string) => {
  try {
    const desktop = await getDesktop(id);
    const streamUrl = desktop.stream.getUrl();
    return { streamUrl, id: desktop.sandboxId };
  } catch (error) {
    console.error("Error in getDesktopURL:", error);
    throw error;
  }
};

export const killDesktop = async (id: string = "desktop") => {
  try {
    if (!id || id === "desktop") {
      console.log("No valid sandbox ID provided for killing");
      return;
    }
    
    // Try to connect directly to kill, don't use getDesktop
    try {
      const connected = await Sandbox.connect(id, { apiKey: E2B_API_KEY });
      await connected.kill();
      console.log(`Successfully killed sandbox: ${id}`);
    } catch (connectError: any) {
      // If sandbox doesn't exist, that's fine - it's already "killed"
      if (connectError?.message?.includes("doesn't exist") || 
          connectError?.message?.includes("404")) {
        console.log(`Sandbox ${id} already doesn't exist - no need to kill`);
        return;
      }
      throw connectError;
    }
  } catch (error) {
    console.error("Error in killDesktop:", error);
    // Don't throw - failing to kill a desktop shouldn't crash the app
  }
};
