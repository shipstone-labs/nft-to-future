"use client";

import dynamic from "next/dynamic";

export const MessageForm = dynamic(() => import("./WysiwygMarkdownEditor"), {
  ssr: false,
});
