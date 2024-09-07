import React, {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion } from "framer-motion";
import TimeAxis from "./TimeAxis"; // Import your TimeAxis component

type Props = {
  targetDate?: Date;
  imageUrl?: string;
  transmitting?: boolean;
};

const TimeMachine = ({
  targetDate,
  imageUrl,
  children,
}: PropsWithChildren<Props>) => {
  const [showImage, setShowImage] = useState(false);
  const [displayDate, setDisplayDate] = useState(new Date());
  const [imageLoaded, setImageLoaded] = useState(false);
  const FIXED_DURATION = 20000; // 10 seconds duration
  const startTime = useMemo(() => Date.now(), []);
  useEffect(() => {
    if (!targetDate) {
      return;
    }

    const endTime = startTime + FIXED_DURATION;
    const endDate = targetDate.getTime();
    const duration = endDate - startTime;

    const updateCountdown = () => {
      const now = Date.now();
      const progress = Math.max(now - startTime, FIXED_DURATION);

      const simulatedDate = new Date(
        Math.round(startTime + (progress / FIXED_DURATION) * duration)
      );
      setDisplayDate(simulatedDate);

      if (now >= endTime) {
        setShowImage(true);
        clearInterval(interval);
      }
    };

    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [targetDate, startTime]);

  const onLoaded = useCallback(() => {
    setImageLoaded(true);
  }, []);
  return (
    <div className="relative h-full flex flex-row">
      {/* Left-side main content */}
      <div className="flex-grow flex flex-col items-center w-full">
        {showImage && imageUrl ? (
          <>
            <div className="relative flex items-center justify-center h-[50%] w-auto">
              {/* Frame to show where the image will be */}

              {!imageLoaded && (
                <div className="absolute flex items-center">
                  <div className="loading-spinner animate-spin w-12 h-12 border-4 border-t-transparent border-gray-600 rounded-full" />
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
                className={`${
                  !imageLoaded ? "hidden" : ""
                } relative z-10 h-[75%] w-auto border-4 border-gray-300 rounded-lg shadow-lg`}
              >
                <img
                  src={imageUrl.replace("https://ipfs.io/ipfs/", "/api/proxy/")}
                  alt="Time Machine Reveal"
                  onLoad={onLoaded}
                  className="h-full w-auto object-contain rounded-lg shadow-lg"
                />
              </motion.div>
            </div>

            {/* Adjust for children */}
            <div className="max-w-full flex-grow flex-shrink">{children}</div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center flex-grow flex items-center justify-center"
          >
            <h1 className="text-3xl font-bold text-gray-800">
              Safely encrypting your message using LIT Protocol to be time
              locked and unreadable until {displayDate.toLocaleDateString()}{" "}
              {displayDate.toLocaleTimeString()}. Along the way creating a nice
              looking image for your NFT and preparing it ready for minting into
              your wallet.
            </h1>
          </motion.div>
        )}
      </div>

      {/* Right-side Time Axis */}
      {showImage ? null : (
        <div className="w-20 relative">
          <TimeAxis />
        </div>
      )}

      {/* Bottom right display of date/time */}
      {showImage ? null : (
        <div className="absolute bottom-4 right-4 text-sm text-gray-600">
          <div>
            Date: {displayDate.toLocaleDateString()}{" "}
            {displayDate.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeMachine;
