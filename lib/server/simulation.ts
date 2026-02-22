function chooseAction(agentName: string): Record<string, unknown> {
  const templates: Record<string, Record<string, unknown>[]> = {
    PlannerAgent: [
      {
        action: "http_message_sign",
        method: "POST",
        authority: "travel-api.example",
        path: "/v1/flights/search",
        contentDigest: "sha-256=:f7f4d8d9d3a4d85ce1766fb4f5f6fa2b:",
        requestId: "req-planner-001",
      },
      {
        action: "http_message_sign",
        method: "POST",
        authority: "hotel-api.example",
        path: "/v1/hotels/quote",
        contentDigest: "sha-256=:f7a37c9f8f391fb5a96a2ea2ac5f8f14:",
        requestId: "req-planner-002",
      },
    ],
    ToolAgent: [
      {
        action: "http_message_sign",
        method: "GET",
        authority: "weather-api.example",
        path: "/v2/forecast?city=SFO",
        contentDigest: "sha-256=:47deqpj8hbsatf4dztx52en4f0c2v6wz:",
        requestId: "req-tool-001",
      },
      {
        action: "http_message_sign",
        method: "POST",
        authority: "payments-api.example",
        path: "/v1/settlements/prepare",
        contentDigest: "sha-256=:00f74f03f09d9157f7e5c0e6a0b2d733:",
        requestId: "req-tool-002",
      },
    ],
    default: [
      {
        action: "http_message_sign",
        method: "POST",
        authority: "ops-api.example",
        path: "/v1/tasks/schedule",
        contentDigest: "sha-256=:f4f58f9be3f7d9a52de35b4f5f61c849:",
        requestId: "req-default-001",
      },
    ],
  };

  const pool = templates[agentName] ?? templates.default;
  const index = Math.floor(Date.now() / 1000) % pool.length;
  return pool[index];
}

export async function generateAgentAction(agentName: string): Promise<{
  payload: Record<string, unknown>;
  source: "deterministic";
}> {
  return {
    payload: chooseAction(agentName),
    source: "deterministic",
  };
}
