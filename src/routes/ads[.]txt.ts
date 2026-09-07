import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const ADS_TXT_CONTENT = "google.com, pub-3288061203330387, DIRECT, f08c47fec0942fa0\n";

export const Route = createFileRoute("/ads.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(ADS_TXT_CONTENT, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
