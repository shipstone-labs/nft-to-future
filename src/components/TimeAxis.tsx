import React from "react";
import { motion } from "framer-motion";

const TimeAxis = () => {
  // Array representing the months for labels

  return (
    <div className="relative h-full flex flex-col justify-center items-end space-y-2">
      {Array.from({ length: 30 }, (_, i) => (
        <motion.div
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          key={i}
          className={`w-1 ${
            i % 5 === 0 ? "h-1 w-8 bg-gray-700" : "h-2 w-6 bg-gray-500"
          }`}
          initial={{ y: 100 }}
          animate={{ y: -200 }}
          transition={{
            // biome-ignore lint/style/useNumberNamespace: <explanation>
            repeat: Infinity,
            duration: 5, // You can adjust this duration
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
};

export default TimeAxis;
