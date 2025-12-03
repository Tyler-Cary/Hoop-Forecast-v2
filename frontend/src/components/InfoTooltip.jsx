import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Clean, modern info tooltip component
 * BettingPros-style with smooth animations
 */
function InfoTooltip({ text, label, id }) {
  const [isHovered, setIsHovered] = useState(false);
  const uniqueId = id || `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="relative inline-flex items-center z-50">
      <button
        type="button"
        className="inline-flex items-center justify-center focus:outline-none hover:opacity-80 transition-opacity"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={text || 'Information'}
      >
        <svg
          className={`w-[14px] h-[14px] transition-colors duration-200 ${
            isHovered ? 'text-gray-300' : 'text-gray-500'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
      
      {/* Tooltip */}
      <AnimatePresence mode="wait">
        {isHovered && (
          <motion.div
            key={uniqueId}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 pointer-events-none"
            style={{ 
              minWidth: '280px', 
              maxWidth: '400px',
              zIndex: 9999
            }}
          >
            <div 
              className="text-white text-sm rounded-lg px-4 py-3 shadow-2xl border border-gray-600 whitespace-normal relative" 
              style={{ 
                backgroundColor: '#111827',
                opacity: 1
              }}
            >
              {label && (
                <div className="font-bold mb-2 text-white text-base border-b border-gray-700 pb-1.5">
                  {label}
                </div>
              )}
              <div className="text-gray-200 leading-relaxed text-sm">
                {text}
              </div>
            </div>
            {/* Arrow pointing down at the icon - positioned at center of icon (7px from left edge of 14px icon) */}
            <div 
              className="absolute top-full -mt-0.5" 
              style={{ 
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000
              }}
            >
              <div 
                className="w-2.5 h-2.5 transform rotate-45" 
                style={{ 
                  backgroundColor: '#111827',
                  borderRight: '1px solid #4b5563',
                  borderBottom: '1px solid #4b5563',
                  opacity: 1
                }}
              ></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InfoTooltip;

