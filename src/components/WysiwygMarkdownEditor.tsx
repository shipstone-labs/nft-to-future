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
import { motion } from "framer-motion";

export type Props = {
  onSend: (message: string, date: Date) => void;
  onNextView: () => void;
  sending?: boolean;
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

const WysiwygMarkdownEditor = ({ onSend, sending, onNextView }: Props) => {
  const [markdown, setMarkdown] = useState("");
  const [dateError, setDateError] = useState("");
  const [publishDate, setPublishDate] = useState(
    new Date(Date.now() + 30 * 60000)
  ); // Default to today
  const simpleMDERef = useRef<EasyMDE | null>(null);

  // Initialize SimpleMDE once
  useLayoutEffect(() => {
    if (simpleMDERef.current) {
      return;
    }
    simpleMDERef.current = new EasyMDE({
      minHeight: "500px",
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

  // Animation variants for the crumbling effect
  const crumbleVariants = {
    hidden: { opacity: 1, scale: 1, rotate: 0 },
    crumbling: {
      opacity: 0,
      scale: 0.5, // Shrinks the form
      rotate: 45, // Add rotation for a "crumbling" effect
      transition: { duration: 1.5, ease: "easeInOut" }, // Duration and easing for smooth animation
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate={sending ? "crumbling" : "hidden"}
      variants={crumbleVariants}
      onAnimationComplete={onNextView} // Trigger TimeMachine after the animation
      className="md:px-8 rounded-lg"
    >
      <div className="mx-auto mt-10 rounded-lg shadow-lg h-100 w-11/12 max-w-5xl">
        <textarea
          id="markdown-editor"
          disabled={sending}
          readOnly={sending}
          style={{ display: "none" }}
        />

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
              readOnly={sending}
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
            disabled={sending}
            onClick={() =>
              onSend(simpleMDERef.current?.value() || "", new Date(publishDate))
            }
            className="flex items-center px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Encrypt
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default WysiwygMarkdownEditor;
