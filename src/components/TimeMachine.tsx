import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  targetDate?: Date;
  imageUrl?: string;
  waiting?: boolean;
};

const TimeMachine = ({ targetDate, imageUrl, waiting }: Props) => {
  const [showImage, setShowImage] = useState(false);

  // Check if the current date matches or exceeds the target date
  useEffect(() => {
    if (waiting || waiting === undefined || !targetDate) {
      return;
    }
    const renderTime = Date.now();
    const duration = targetDate ? targetDate.getTime() - Date.now() : 0;
    const checkDate = () => {
      const currentDate = new Date(
        ((Date.now() - renderTime) / duration) * 5000
      );
      if (currentDate >= targetDate) {
        setShowImage(true);
      }
    };

    // Check immediately and set interval for real-time checking (optional)
    checkDate();
    const interval = setInterval(checkDate, 100); // Every second

    return () => {
      clearInterval(interval);
    };
  }, [targetDate, waiting]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      {showImage ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        >
          <img
            src={imageUrl}
            alt="Time Machine Reveal"
            className="w-64 h-64 object-cover rounded-lg shadow-lg"
          />
        </motion.div>
      ) : (
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800">
            Waiting for the right time...
          </h1>
        </div>
      )}
    </div>
  );
};

export default TimeMachine;
