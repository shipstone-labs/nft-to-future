"use client";

import React, {
  type ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css"; // Import the editor's CSS

export type Props = {
  onSend: (message: string, date: Date) => void;
};

// Helper function: Converts a Date object (UTC) to local datetime string (YYYY-MM-DDTHH:MM)
const toLocalDateTimeString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000; // Offset in milliseconds
  const localISOTime = new Date(date.getTime() - tzOffset)
    .toISOString()
    .slice(0, 16); // Adjust to local time and format
  return localISOTime;
};

// Helper function: Converts local datetime string (YYYY-MM-DDTHH:MM) to Date object in UTC
const toUTCDate = (localDateTimeString: string) => {
  return new Date(localDateTimeString);
};

const WysiwygMarkdownEditor = ({ onSend }: Props) => {
  const [markdown, setMarkdown] = useState("");
  const [dateError, setDateError] = useState("");
  const [publishDate, setPublishDate] = useState(new Date()); // Default to today
  const simpleMDERef = useRef<EasyMDE | null>(null);

  // Initialize SimpleMDE once
  useLayoutEffect(() => {
    if (simpleMDERef.current) {
      return;
    }
    simpleMDERef.current = new EasyMDE({
      element: document.getElementById(
        "markdown-editor"
      ) as HTMLTextAreaElement,
      initialValue: "# Hello, future!",
      spellChecker: false,
      placeholder: "Write your message...",
    });
  }, []);

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdown(value);
  }, []);

  const handleDateChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    console.log(value);
    try {
      setDateError("");
      const newValue = toUTCDate(value);
      if (newValue.getTime() < Date.now() + 30 * 60000) {
        setDateError("Date and time must be at least 30 minutes in the future");
        return;
      }
      setPublishDate(newValue);
    } catch (error) {
      setDateError("Invalid date format");
    }
  }, []);

  return (
    <div className="mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg w-11/12 max-w-5xl">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        NFT to the Future Message
      </h2>

      <textarea id="markdown-editor" />

      <div className="flex justify-between items-center mt-6">
        <div>
          <label
            htmlFor="publish-date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Message will be public on:
          </label>
          <input
            type="datetime-local"
            id="publish-date"
            value={toLocalDateTimeString(publishDate)}
            onChange={handleDateChange}
            className={`p-2 border ${
              dateError ? "border-red-500" : "border-gray-300"
            } rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500`}
            aria-invalid={!!dateError} // Screen reader accessibility
          />
          {dateError && (
            <p className="mt-1 text-sm text-red-600" id="date-error">
              {dateError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            onSend(simpleMDERef.current?.value() || "", new Date(publishDate))
          }
          className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default WysiwygMarkdownEditor;
