import React, {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";
import { motion } from "framer-motion";
import TimeAxis from "./TimeAxis"; // Import your TimeAxis component

type Props = {
  targetDate?: Date;
  imageUrl?: string;
  waiting?: boolean;
};

const PaperPlaneAnimation = () => {
  return (
    <motion.div
      className="relative"
      initial={{ x: "-100vw", rotate: 0 }} // Start off-screen to the left
      animate={{ x: "100vw", rotate: 20 }} // Fly across the screen to the right
      // biome-ignore lint/style/useNumberNamespace: <explanation>
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }} // Customize animation duration and repeat
    >
      <span role="img" aria-label="Paper Plane" className="text-6xl">
        🛫
      </span>
    </motion.div>
  );
};

const TimeMachine = ({
  targetDate,
  imageUrl,
  children,
}: PropsWithChildren<Props>) => {
  const [showImage, setShowImage] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [displayDate, setDisplayDate] = useState(new Date());
  const [imageLoaded, setImageLoaded] = useState(false);
  const FIXED_DURATION = 10000; // 10 seconds duration

  useEffect(() => {
    if (!targetDate) {
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + FIXED_DURATION;

    const updateCountdown = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / FIXED_DURATION, 1);
      setElapsedTime(progress * FIXED_DURATION);

      const simulatedDate = new Date(
        targetDate.getTime() - (1 - progress) * 1000 * 60 * 60 * 24 * 365
      );
      setDisplayDate(simulatedDate);

      if (now >= endTime) {
        setShowImage(true);
        clearInterval(interval);
      }
    };

    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [targetDate]);

  const onLoaded = useCallback(() => {
    setImageLoaded(true);
  }, []);
  return (
    <div className="relative full-minus h-full flex flex-row">
      {/* Left-side main content */}
      <div className="flex-grow flex flex-col items-center justify-center w-full">
        {showImage && imageUrl ? (
          <>
            {!imageLoaded && (
              <div className="absolute">
                <div className="loading-spinner" /> {/* Spiral animation */}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className={`${!imageLoaded ? "hidden" : ""}`}
            >
              <img
                src={imageUrl}
                alt="Time Machine Reveal"
                onLoad={onLoaded}
                className="h-[65%] w-auto object-contain rounded-lg shadow-lg"
              />
            </motion.div>
            <div className="max-w-full">{children}</div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Paper plane flying animation */}
            <PaperPlaneAnimation />

            <h1 className="text-4xl font-bold text-gray-800">
              Waiting for the right time...
            </h1>
          </motion.div>
        )}
      </div>

      {/* Right-side Time Axis */}
      <div className="w-20 relative">{showImage ? null : <TimeAxis />}</div>

      {/* Bottom right display of date/time */}
      <div className="absolute bottom-4 right-4 text-sm text-gray-600">
        <div>
          Date: {displayDate.toLocaleDateString()}{" "}
          {displayDate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default TimeMachine;
