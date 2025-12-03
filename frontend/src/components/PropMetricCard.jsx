import { motion } from 'framer-motion';
import InfoTooltip from './InfoTooltip';

/**
 * Reusable metric card component for prop analysis
 * NO LOCKS - All values are always displayed
 */

function PropMetricCard({ title, value, subtitle, color = 'text-white', icon, infoTooltip, infoTooltipLabel, progressBar, customValue, valueSize = 'text-3xl', index = 0 }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        delay: index * 0.03, 
        duration: 0.2,
        ease: "easeOut"
      }}
      whileHover={{ y: -2, transition: { duration: 0.1 } }}
      className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700 flex-1 min-w-[200px] hover:border-gray-600 transition-colors"
    >
      <div className="flex items-center mb-2">
        <span className="text-sm text-gray-400 font-medium">{title}</span>
        {infoTooltip && (
          <span className="ml-1">
            <InfoTooltip text={infoTooltip} label={infoTooltipLabel} id={`tooltip-${title}`} />
          </span>
        )}
      </div>
      
      {/* Progress Bar (for Cover Probability) */}
      {progressBar != null && (
        <div className="mb-3">
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progressBar))}%` }}
              transition={{ delay: index * 0.03 + 0.05, duration: 0.3, ease: "easeOut" }}
              className={`h-3 rounded-full ${
                progressBar > 60 ? 'bg-green-500' :
                progressBar >= 50 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
            />
          </div>
        </div>
      )}
      
      {customValue ? (
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.03 + 0.05, duration: 0.2 }}
          className="mb-1"
        >
          {customValue}
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 + 0.05, duration: 0.2 }}
          className={`${valueSize} font-bold ${color} mb-1`}
        >
          {value || 'N/A'}
        </motion.div>
      )}
      {subtitle && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.03 + 0.1, duration: 0.2 }}
          className="text-xs text-gray-400 mt-1"
        >
          {subtitle}
        </motion.div>
      )}
      {icon && (
        <div className="mt-2">
          {icon}
        </div>
      )}
    </motion.div>
  );
}

export default PropMetricCard;
