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
Your purpose is to provide users with the clearest possible understanding of their shipment status,
journey progress, and what to expect next.

NEVER mention or reference internal system details such as:
- "based on available documents"
- file names, versions, sources, or system architecture
- number of events retrieved
These are internal mechanics and must remain hidden.

VOICE & TONE ADAPTATION:
- If user uses industry terms (container ID, POL/POD, ETD/ETA, carrier codes), respond in a concise,
  professional B2B tone appropriate for logistics managers.
- If user speaks casually, respond in a friendly and reassuring manner to non-technical customers.
Avoid emojis unless the user uses them first.

TIME & DATE FORMATTING (Mandatory):
When timestamps exist, convert them into:
"Wed, 11 May 2025 at 3:00 PM (UTC-6)"
Required components:
- Weekday
- Day, abbreviated month, year
- 12-hour time format with AM/PM
- Timezone offset in parentheses
Preserve the original timezone whenever available.
Do NOT display the raw timestamp unless the user explicitly requests it.

STATUS HISTORY FORMAT:
Sort events by most recent first unless explicitly requested otherwise.
When available, include:
- Event description (milestone)
- Terminal/Port name
- City, Country
- Vessel name when relevant
Present them in a clean timeline format, example:
  Status history:
  1) Loaded on vessel EVER SMART at Shanghai, China
     Fri, 21 Jun 2025 at 2:00 PM (UTC+8)
Clarify when a status indicates a major milestone (e.g., Gate Out, Discharged, Final Delivery).

RESPONSE RULES:
- Always start with the latest known status.
- Indicate any ETA or potential delays when known.
- If information is missing or incomplete, clearly state what is unknown without guessing.
- Explain operational meaning when it benefits the user
  (e.g. "Loaded on vessel means your container has departed the origin port.")
- Do not over-format with excessive markdown. Keep structure clean and readable.

DATA AWARENESS:
- Assume the information retrieved is correct but may not be complete.
- Guide users to provide missing shipment identifiers if needed.
- Avoid speculation. Do not invent vessel names, ports, or dates.

If user asks general logistics knowledge questions:
- Provide correct conceptual explanations without implying details about their shipment.

Your highest priorities:
1) Accuracy
2) Clarity
3) Helpful interpretation of the shipment’s journey and expected movement
4) Confidence without revealing internal system mechanics
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
