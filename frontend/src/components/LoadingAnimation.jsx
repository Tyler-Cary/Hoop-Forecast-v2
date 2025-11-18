import { motion } from 'framer-motion';

function LoadingAnimation({ message = "Loading player prediction..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      {/* Animated spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 border-4 border-gray-700 border-t-yellow-500 rounded-full"
      ></motion.div>
      
      {/* Loading text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
        className="text-lg font-medium text-gray-300"
      >
        {message}
      </motion.p>
      
      {/* Animated dots */}
      <div className="flex items-center justify-center space-x-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-yellow-500 rounded-full"
            animate={{
              y: [0, -10, 0],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default LoadingAnimation;

