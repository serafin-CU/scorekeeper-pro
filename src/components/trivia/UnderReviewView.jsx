import React from 'react';
import { Wrench } from 'lucide-react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

export default function UnderReviewView() {
    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6 flex flex-col items-center justify-center min-h-64 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: CU.orange + '20' }}>
                <Wrench className="w-7 h-7" style={{ color: CU.orange }} />
            </div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: CU.charcoal, margin: 0 }}>
                Under review
            </h1>
            <p style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.95rem', color: '#6b7280', maxWidth: '22rem' }}>
                We are having some technical issues. Daily Trivia is temporarily unavailable while we review the questions. Please check back soon!
            </p>
        </div>
    );
}