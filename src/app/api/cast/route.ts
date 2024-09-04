import { type NextRequest, NextResponse } from "next/server";
import { NextApiRequest } from "next/types";
import { recordEvent } from "../frame/handler";

export const runtime = "edge";

export function POST(req: NextRequest) {
  return NextResponse.json({
    type: "form",
    title: "Book or Bot Quiz",
    url: "https://bookorbot.com?compose",
  });
}

export function GET(req: NextRequest) {
  // const isBot =
  //   /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebot|ia_archiver|twitterbot|frame|whatsapp|telegram|discord|skype|slack|line|zoom|linkedinbot|embedly|pinterest|vkShare|discordbot|facebookexternalhit/i.test(
  //     req.headers.get("user-agent") || "bot"
  //   );
  // if (!isBot) {
  //   recordEvent({ name: "Castaction", event: "Click" }, req.headers);

  //   return NextResponse.redirect("https://bookorbot.com");
  // }
  recordEvent({ name: "Castaction", event: "View" }, req.headers);
  return NextResponse.json({
    name: "Book or Bot Quiz",
    icon: "play",
    description: "Cast your win at the Book or Bot Quiz.",
    aboutUrl: "https://bookorbot.com",
    action: {
      type: "post",
    },
  });
}
