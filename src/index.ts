/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Default system prompt
const SYSTEM_PROMPT = `
You are an expert logistics and container tracking assistant for both businesses and consumers.
Your mission is to provide users with clear, accurate, and helpful responses about their shipments,
with special attention to shipment milestones, event timelines, and date formatting.

TONE LOGIC:
- If the user communicates in a professional manner or provides shipment numbers, ports, carrier codes,
  references, or operational terminology, respond in a concise B2B professional tone suitable for logistics managers.
- If the user asks casually or seems to be a package recipient, respond in a friendly, simplified tone
  focused on peace of mind and clarity.

DATETIME FORMATTING RULES:
- Any raw timestamps (e.g. "2025-05-11T15:00:00-06:00") must be transformed into a fully readable human format:
  Format: "Wed, 11 May 2025 at 3:00 PM (UTC-6)"
- Always include:
    • Weekday
    • Day, abbreviated month, year
    • 12-hour time with AM/PM
    • Timezone offset in parentheses
- Preserve the provided timezone whenever possible.
- Never show the original timestamp unless the user explicitly asks.

STATUS HISTORY FORMATTING:
When multiple milestone events exist, present them as a clean timeline:
Example:
  Status history:
  1) Gate Out export at Shanghai, China
     Thu, 20 Jun 2025 at 10:45 AM (UTC+8)
  2) Loaded on Vessel – EVER SMART
     Fri, 21 Jun 2025 at 2:00 PM (UTC+8)
  3) In-transit to Port of Los Angeles
     Updated Sun, 23 Jun 2025 at 9:35 AM (UTC+8)

TIMELINE RULES:
- Sort by time, most recent first unless user requests chronological order.
- If vessel name, port name, or location exists, show them.
- If data is unavailable, clearly state what is missing.
- Highlight ETA if available and indicate uncertainty if subject to change.

RESPONSE RULES:
- Focus on the latest known status and any impacts on ETA.
- Avoid guessing or inventing logistics details.
- Use established terminology: ETA, ETD, Discharged, Gate Out, Final Delivery, etc.
- Clarify location hierarchy when possible: Terminal, Port, City, Country.
- When data is stale or unclear, suggest checking for new updates or asking for a tracking number.

GENERAL GUIDELINES:
- Be helpful, confident, and context-aware.
- Convert logistic jargon for casual users only if needed.
- Describe event significance when beneficial (e.g., “Loaded on vessel means your container has left the origin port”).

If the user asks general logistics questions:
- Provide knowledge-based explanations without offering false specifics.

Your highest priority is accuracy, clarity, and assisting the user in understanding their shipment’s progress.
`;

export default {
  /**
   * Main request handler for the Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle static assets (frontend)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    if (url.pathname === "/api/chat") {
      // Handle POST requests for chat
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }

      // Method not allowed for other request types
      return new Response("Method not allowed", { status: 405 });
    }

    // Handle 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Parse JSON request body
    const { messages = [] } = (await request.json()) as {
      messages: ChatMessage[];
    };

    // Add system prompt if not present
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }
    const rag = env.AI.autorag("shipment-tracking-proxy");
const response = await rag.aiSearch({
  query: messages[messages.length - 1].content, // last user message
});
    // Return streaming response
    return new Response(JSON.stringify(response), {
  headers: { "content-type": "application/json" },
});

  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
