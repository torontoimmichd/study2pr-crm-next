/**
 * ask-immigration-ai — Supabase Edge Function
 * Powers the KnowledgeAI chat interface.
 *
 * Calls the Anthropic API (claude-haiku-4-5) with a Canadian immigration
 * expert system prompt and the conversation history from the frontend.
 *
 * Required Supabase secret:
 *   ANTHROPIC_API_KEY  — set via: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * Deploy:
 *   supabase functions deploy ask-immigration-ai --project-ref ocnsavosheduqzmeyvcd
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert Canadian immigration consultant and RCIC (Regulated Canadian Immigration Consultant) assistant working for Study2PR Immigration.

Your role is to:
1. Provide accurate, up-to-date information about Canadian immigration pathways (Express Entry, PNP, Study Permits, Work Permits, Family Sponsorship, Refugee claims, etc.)
2. Explain IRCC processes, timelines, and requirements clearly
3. Calculate or estimate CRS scores, processing times, and eligibility
4. Advise on document requirements for different visa categories
5. Explain the difference between immigration programs and which applies to a specific situation
6. Provide guidance on maintaining status, extensions, and renewals

Important guidelines:
- Always clarify you are providing general information, not legal advice
- For specific case advice, recommend consulting a licensed RCIC or immigration lawyer
- Base answers on IRCC official policies and the Immigration and Refugee Protection Act (IRPA)
- Be specific with timeframes, fees, and requirements when you know them
- If information may be outdated, note that the user should verify with IRCC's official website
- Keep responses concise but comprehensive — use bullet points and structure for clarity
- Be warm and professional — remember clients are often stressed about their immigration journey

You have deep knowledge of:
- Express Entry system (CRS scoring, draws, ITAs)
- Provincial Nominee Programs (all provinces and territories)
- Study permits and PGWP
- Work permits (LMIA, LMIA-exempt, CUSMA/USMCA, IEC)
- Permanent Residence pathways
- Canadian citizenship requirements
- Spousal/family sponsorship
- Refugee and humanitarian programs
- IRCC processing times and portals (IRCC portal, GCKey, IRCC Web Form)
- Biometrics, medical exams, police certificates requirements
- Inadmissibility issues and H&C applications`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { messages } = await req.json() as { messages: Message[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Call Anthropic Messages API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", response.status, errorBody);
      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? "I couldn't generate a response. Please try again.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
