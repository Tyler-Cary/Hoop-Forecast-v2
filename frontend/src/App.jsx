import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Home from './components/Home';
import PlayerDetail from './components/PlayerDetail';

function App() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  return (
    <div className="min-h-screen bg-gray-900">
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="bg-gray-900 text-white py-4 shadow-lg border-b border-gray-800 sticky top-0 z-50 backdrop-blur-sm bg-gray-900/95"
      >
        <div className="container mx-auto px-4 flex items-center justify-between">
          <motion.h1 
            className="text-2xl font-bold text-white"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            ⛈️🏀 HoopForecast
          </motion.h1>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
        <AnimatePresence mode="wait">
          {selectedPlayer ? (
            <motion.div
              key="player-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <PlayerDetail 
                player={selectedPlayer} 
                onBack={() => setSelectedPlayer(null)} 
              />
            </motion.div>
          ) : (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Home onSelectPlayer={setSelectedPlayer} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="bg-gray-900 text-white py-6 border-t border-gray-800"
      >
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          <p>Powered by ESPN API, NBA.com API & The Odds API</p>
          <p className="mt-1">For entertainment purposes only</p>
        </div>
      </motion.footer>
    </div>
  );
}

export default App;

