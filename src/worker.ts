import { corsResponse, jsonResponse, errorResponse } from "./cors";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ANTHROPIC_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse();
    }

    // Health check
    if (url.pathname === "/health") {
      return jsonResponse({ status: "ok", service: "azure-diagram-builder" });
    }

    // Proxy /api/anthropic to Anthropic API
    if (url.pathname === "/api/anthropic" && request.method === "POST") {
      try {
        const apiKey = env.ANTHROPIC_API_KEY;

        if (!apiKey) {
          return errorResponse("API key not configured.", 401);
        }

        const body = await request.json();

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        return jsonResponse(data, response.status);
      } catch (e) {
        return errorResponse("Proxy error: " + (e instanceof Error ? e.message : "unknown"), 500);
      }
    }

    // SVG download endpoint
    if (url.pathname === "/download" && request.method === "POST") {
      try {
        const { svg, filename } = await request.json() as { svg: string; filename: string };
        return new Response(svg, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml",
            "Content-Disposition": `attachment; filename="${filename || "azure-diagram.svg"}"`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch {
        return errorResponse("Download error", 500);
      }
    }

    // Serve static assets (Vite build output)
    return env.ASSETS.fetch(request);
  },
};
