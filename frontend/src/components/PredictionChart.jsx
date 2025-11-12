import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

function PredictionChart({ stats, prediction }) {
  if (!stats || stats.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Recent Performance</h3>
        <p className="text-gray-500 text-center py-8">No game data available</p>
      </div>
    );
  }

  // Prepare chart data - stats come with Game 1 = most recent, Game 10 = oldest
  // We want to display most recent on the right, so we reverse the order
  const sortedStats = [...stats].sort((a, b) => (a.game_number || 0) - (b.game_number || 0));
  // Reverse so most recent (Game 1) is on the right
  const reversedStats = sortedStats.reverse();
  
  const chartData = reversedStats.map((game, index) => {
    // Use opponent abbreviation, or fallback
    const opponent = game.opponent && game.opponent !== 'N/A' ? game.opponent : `G${game.game_number || index + 1}`;
    return {
      name: opponent, // This will be the X-axis label
      gameNumber: game.game_number || index + 1,
      points: typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0,
      date: game.date?.split('T')[0] || '',
      opponent: game.opponent || 'N/A',
      fullLabel: `${opponent} (${game.points} pts)`
    };
  });

  // Calculate Y-axis domain with padding
  const allPoints = chartData.map(d => d.points);
  if (prediction != null) {
    allPoints.push(prediction);
  }
  const minPoints = Math.max(0, Math.min(...allPoints) - 5);
  const maxPoints = Math.max(...allPoints) + 5;

  return (
    <div className="bg-white rounded-lg shadow-xl p-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-6">
        Points Trend & Prediction
      </h3>
      
      <ResponsiveContainer width="100%" height={450}>
        <LineChart 
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis 
            domain={[minPoints, maxPoints]}
            label={{ value: 'Points', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
            stroke="#6b7280"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '10px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            formatter={(value, name, props) => {
              if (name === 'Prediction') {
                return [`${value.toFixed(1)} pts (Predicted)`, 'Prediction'];
              }
              const opponent = props.payload.opponent || 'N/A';
              return [`${value} pts vs ${opponent}`, 'Points Scored'];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                const date = payload[0].payload.date;
                return date ? `${label} - ${date}` : label;
              }
              return label;
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          
          {/* Historical games line */}
          <Line 
            type="monotone" 
            dataKey="points" 
            stroke="#8b5cf6" 
            strokeWidth={3}
            dot={{ fill: '#8b5cf6', r: 6, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 8 }}
            name="Points Scored"
            connectNulls={true}
          />
          
          {/* Prediction reference line */}
          {prediction != null && (
            <ReferenceLine 
              y={prediction} 
              stroke="#10b981" 
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ 
                value: `Predicted: ${prediction.toFixed(1)}`, 
                position: "top", 
                fill: '#10b981', 
                fontSize: 12,
                fontWeight: 'bold'
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 flex items-center justify-between text-sm">
        <p className="text-gray-600">
          Showing last {stats.length} games with linear regression prediction
        </p>
        {prediction != null && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500 border-dashed border-2"></div>
            <span className="text-gray-600">Predicted: <span className="font-semibold text-green-600">{prediction.toFixed(1)} pts</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PredictionChart;

