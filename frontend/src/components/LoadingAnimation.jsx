function LoadingAnimation({ message = "Loading player prediction..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      {/* Loading text */}
      <p className="text-lg font-medium text-gray-300">
        {message}
      </p>
      
      {/* Animated dots */}
      <div className="flex items-center justify-center space-x-2">
        <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
}

export default LoadingAnimation;

