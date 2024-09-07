"use client";

import React, {
  useEffect,
  useState,
  type MouseEvent,
  useCallback,
} from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { UnifiedAccessControlConditions } from "@lit-protocol/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHourglassHalf } from "@fortawesome/free-solid-svg-icons";

type Data = {
  description: string;
  message?: [string, string, UnifiedAccessControlConditions];
  publicMessage?: string;
  error?: string;
  date?: number;
  sendDate?: number;
  image?: string;
};

function WaitingComponent() {
  return (
    <div className="flex flex-row items-center space-x-2">
      {/* Spinning Hourglass Icon */}
      <FontAwesomeIcon
        icon={faHourglassHalf}
        className="text-gray-600 animate-spin"
      />
      <div className="text-gray-800">Waiting for the future...</div>
    </div>
  );
}

export default function Read() {
  const { cid, hash } = useParams();
  const [data, setData] = useState<Data | undefined>();

  const getData = useCallback(async () => {
    if (data?.publicMessage) {
      return;
    }
    const newData = await fetch(`/api/read/${cid}/${hash}`).then((res) => {
      if (!res.ok) {
        return {
          description: "Message Not Found, maybe you're in the wrong Universe!",
          error: "Message not found or invalid URL",
        };
      }
      return res.json();
    });
    setData(newData);
  }, [cid, hash, data]);

  useEffect(() => {
    if (data) {
      return;
    }
    getData();
  }, [data, getData]);

  useEffect(() => {
    if (data?.publicMessage || !data?.date) {
      return;
    }
    const interval = setInterval(() => {
      if (Date.now() > (data?.date || Date.now()) + 1000) {
        getData();
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  const onTryAgain = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      getData();
    },
    [getData]
  );

  // Format the date
  const readableDate = data?.date ? new Date(data.date).toLocaleString() : null;
  const sendDate = data?.sendDate
    ? new Date(data.sendDate).toLocaleString()
    : null;
  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-4 bg-gray-50">
      {/* Image as stamp, above the letter */}
      {data?.image && (
        <div className="w-32 h-32 md:w-64 md:h-64 mb-4">
          <img
            src={data.image}
            alt="Stamp"
            className="w-full h-full object-contain border-2 border-gray-300 shadow-md"
          />
        </div>
      )}
      {data?.error ? (
        <div className="text-center bg-red-100 text-red-800 p-6 rounded-lg shadow-lg">
          <h1 className="text-4xl font-bold mb-4">Error</h1>
          <p className="text-lg">
            Please wait for time to pass until {readableDate || "N/A"}
          </p>
        </div>
      ) : null}
      <div className="relative bg-transparent w-full max-w-4xl min-h-[60vh] p-10">
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-lg border border-gray-200 min-h-[60vh]">
          {/* Email-like header */}
          <div className="text-left mb-6">
            <p className="text-sm text-gray-600 mb-1">
              <strong>Date Send:</strong> {sendDate || "N/A"}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Date Received:</strong> {readableDate || "N/A"}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              <strong>From:</strong> Unknown Sender
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>To:</strong> The Future
            </p>
          </div>

          {/* Subject */}
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Subject: About the future
          </h2>

          {/* Markdown Message */}
          {data?.publicMessage ? (
            <div className="text-left">
              <ReactMarkdown className="prose lg:prose-xl prose-slate text-gray-900">
                {data?.publicMessage || "No message found."}
              </ReactMarkdown>
            </div>
          ) : (
            <WaitingComponent />
          )}
        </div>
      </div>
    </div>
  );
}
