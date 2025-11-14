import { useState } from 'react';
import Home from './components/Home';
import PlayerDetail from './components/PlayerDetail';

function App() {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-900 text-white py-4 shadow-lg border-b border-gray-800">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">
            ⛈️🏀 HoopForecast
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen">
        {selectedPlayer ? (
          <PlayerDetail 
            player={selectedPlayer} 
            onBack={() => setSelectedPlayer(null)} 
          />
        ) : (
          <Home onSelectPlayer={setSelectedPlayer} />
        )}
      </main>

      <footer className="bg-gray-900 text-white py-6 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          <p>Powered by ESPN API, NBA.com API & The Odds API</p>
          <p className="mt-1">For entertainment purposes only</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

