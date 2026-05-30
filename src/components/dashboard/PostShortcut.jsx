import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine } from 'lucide-react';

const CU = {
    magenta: '#AA0061',
    charcoal: '#2C2B2B',
};

export default function PostShortcut() {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate('/Feed')}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
            style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer' }}
        >
            <div style={{ padding: '8px', borderRadius: '8px', background: CU.magenta + '18' }}>
                <PenLine className="w-5 h-5" style={{ color: CU.magenta }} />
            </div>
            <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.95rem', color: '#9ca3af' }}>
                What's on your mind? ⚽
            </span>
        </button>
    );
}