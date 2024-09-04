import { type NextRequest, NextResponse } from "next/server";
import { type ClientOptions, OpenAI } from "openai";
import { Base64 } from "js-base64";
import imageCompression from "browser-image-compression";
import { stringToHex } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export async function handler(req: NextRequest) {
  // const isBot =
  //   /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|ia_archiver|twitterbot|frame|whatsapp|telegram|discord|skype|slack|line|zoom|linkedinbot|embedly|pinterest|vkShare|discordbot|facebookexternalhit/i.test(
  //     req.headers.get("user-agent") || "bot"
  //   );
  // if (!isBot) {
  //   recordEvent({ name: "Frame", event: "Click" }, req.headers);
  //   return NextResponse.redirect("https://bookorbot.com");
  // }
  recordEvent({ name: "Frame", event: "View" }, req.headers);
  try {
    let [_ignore, cid, hash] =
      /\/api\/frame\/([^\/]*)\/([^\?]*)(\?.*|$)/.exec(req.url) || [];
    if (!cid || !hash) {
      [_ignore, cid, hash] =
        /\?a=([^\/]*)&b=([^\?&]*)(&|$).*/.exec(req.url) || [];
      if (!cid || !hash) {
        throw new Error("Invalid path");
      }
    }
    let image = `https://ipfs.io/ipfs/${cid}`;
    const encoder = new TextEncoder();
    const checkHash = Base64.fromUint8Array(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", encoder.encode(`${image}-haha`))
      )
    )
      .replace(/\+/g, "-") // Replace + with -
      .replace(/\//g, "_") // Replace / with _
      .replace(/=+$/, ""); // Remove trailing =
    if (checkHash !== hash) {
      throw new Error("Invalid path");
    }
    let titles = [];
    let description =
      "Shipstone Lab’s ‘Book or Bot Quiz’ tests your literary skills. Read a paragraph from a classic book, then choose what you think comes next: one option is from the author, the other from our bot. You’ll face three questions from three different books. If you guess correctly, our bot will mint a unique image that combines the themes of all three books just for you!";
    const data: {
      properties?: Record<string, string>;
      description?: string;
      image: string;
    } = await fetch(image)
      .then((res) => {
        if (!res.ok) {
          return null;
        }
        if (res.headers.get("Content-Type") === "application/json") {
          return res.json();
        }
        res.body?.cancel();
        return null;
      })
      .catch(() => null);
    if (data) {
      titles = Object.entries(data.properties || {})
        .filter(([id]) => id.startsWith("title"))
        .map(([id, title]) => title);
      if (data.description) {
        description = data.description;
      }
      image = data.image;
    }
    const title = "Book or Bot Quiz";
    const url = "https://bookorbot.com";
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${image}" />
    <meta property="fc:frame:button:1" content="Play Game" />
    <meta property="fc:frame:post_url" content="${url}/api/frame/${cid}/${hash}?initialPath=${encodeURI(
        `${url}/api/frame`
      )}" />
    <meta property="fc:frame:button:1:action" content="link" />
    <meta property="fc:frame:button:1:target" content="${url}" />
    <meta property="fc:frame:image:aspect_ratio" content="1:1" />

    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:description" content="${description}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta property="twitter:domain" content="bookorbot.com" />
    <meta property="twitter:url" content="${url}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
  </head>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as { message: string }).message },
      { status: 500 }
    );
  }
}

export async function recordEvent(
  event: Record<string, unknown>,
  headers: Headers
) {
  const object = Object.fromEntries(headers.entries());
  return fetch("https://plausible.io/api/event", {
    method: "POST",
    headers: {
      ...object,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...event, domain: "bookorbot.com" }),
  });
}
