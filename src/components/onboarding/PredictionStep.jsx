import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

export default function PredictionStep({
    predictedWinnerTeamId, setPredictedWinnerTeamId,
    predictedTopScorer, setPredictedTopScorer,
    predictedTopAssister, setPredictedTopAssister,
    onNext, onSkip
}) {
    const [search, setSearch] = useState('');
    const { data: teams = [] } = useQuery({
        queryKey: ['teams'],
        queryFn: () => base44.entities.Team.list()
    });

    const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.fifa_code.toLowerCase().includes(search.toLowerCase())
    );

    const inputStyle = {
        fontFamily: "'Raleway', sans-serif",
        borderColor: CU.orange,
        background: 'white',
        color: CU.charcoal,
    };

    return (
        <div className="max-w-2xl w-full max-h-[640px] flex flex-col">
            <h1 className="text-4xl font-bold text-white mb-2 text-center" style={{ fontFamily: "'DM Serif Display', serif" }}>
                Make your call 🔮
            </h1>
            <p className="text-white/60 text-center mb-6" style={{ fontFamily: "'Raleway', sans-serif" }}>
                Lock in your World Cup predictions
            </p>

            <div className="overflow-y-auto pr-1 space-y-6">
                {/* World Cup Winner */}
                <div>
                    <label className="block text-white font-semibold mb-2 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        🏆 World Cup Winner
                    </label>
                    <div className="mb-3 flex gap-2 items-center">
                        <Search className="w-5 h-5 text-white/40 flex-shrink-0" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search teams..."
                            className="flex-1 px-4 py-2 rounded-lg text-sm border-2"
                            style={inputStyle}
                        />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[180px] overflow-y-auto">
                        {filtered.map((team) => (
                            <button
                                key={team.id}
                                onClick={() => setPredictedWinnerTeamId(team.id)}
                                className="px-3 py-2 rounded-xl font-semibold text-sm transition-all text-center"
                                style={{
                                    fontFamily: "'Raleway', sans-serif",
                                    background: predictedWinnerTeamId === team.id ? CU.orange + '33' : 'rgba(255,255,255,0.1)',
                                    color: 'white',
                                    border: predictedWinnerTeamId === team.id ? `2px solid ${CU.orange}` : '2px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div>{team.fifa_code}</div>
                                <div className="text-xs mt-0.5 opacity-80">{team.name}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top Scorer */}
                <div>
                    <label className="block text-white font-semibold mb-2 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        ⚽ Top Scorer
                    </label>
                    <input
                        type="text"
                        value={predictedTopScorer}
                        onChange={(e) => setPredictedTopScorer(e.target.value)}
                        placeholder="Player name"
                        className="w-full px-4 py-3 rounded-lg text-sm border-2"
                        style={inputStyle}
                    />
                </div>

                {/* Top Assister */}
                <div>
                    <label className="block text-white font-semibold mb-2 text-sm" style={{ fontFamily: "'Raleway', sans-serif" }}>
                        🎯 Top Assister
                    </label>
                    <input
                        type="text"
                        value={predictedTopAssister}
                        onChange={(e) => setPredictedTopAssister(e.target.value)}
                        placeholder="Player name"
                        className="w-full px-4 py-3 rounded-lg text-sm border-2"
                        style={inputStyle}
                    />
                </div>
            </div>

            <button
                onClick={onNext}
                className="w-full py-3 mt-6 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={{
                    fontFamily: "'Raleway', sans-serif",
                    background: CU.magenta,
                    cursor: 'pointer'
                }}
            >
                Next <ChevronRight className="w-4 h-4" />
            </button>

            <button
                onClick={onSkip}
                className="w-full py-2 mt-3 text-white/60 font-semibold hover:text-white/80 transition"
                style={{ fontFamily: "'Raleway', sans-serif" }}
            >
                Skip
            </button>
        </div>
    );
}