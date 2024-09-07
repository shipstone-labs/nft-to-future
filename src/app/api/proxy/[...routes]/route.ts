import { type NextRequest, NextResponse } from "next/server";
import { PassThrough } from "node:stream";

export async function GET(req) {
  const response = await fetch(
    `${process.env.PINATA_GATEWAY}/ipfs/${req.nextUrl.pathname.replace(
      "/api/proxy/",
      ""
    )}?pinataGatewayToken=${process.env.PINATA_TOKEN}`,
    { cache: "no-store" }
  );

  // Get a reader to read the response body as a stream
  const reader = response?.body?.getReader();

  // If the response is not OK, return an error
  if (!response.ok || !reader) {
    return new Response("Failed to fetch resource", { status: 500 });
  }

  // Collect headers from the response
  const headers = {};
  for (const [key, value] of response.headers.entries()) {
    if (/content-type/i.test(key)) {
      headers[key] = value;
    }
  }

  // Create a new ReadableStream to manually handle the data chunks
  const stream = new ReadableStream({
    async start(controller) {
      // Continuously read the data from the response body
      while (true) {
        const { done, value } = await reader.read();

        // If there's no more data, close the stream
        if (done) {
          controller.close();
          break;
        }

        // Otherwise, enqueue the chunk into the stream
        controller.enqueue(value);
      }
    },
  });

  // Return the new ReadableStream with headers
  return new Response(stream, {
    headers,
  });
}
