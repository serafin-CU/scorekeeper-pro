import React from 'react';
import { CU } from './wcTokens';

/* ── Single news article card ────────────────────────────── */
export default function NewsCard({ article }) {
    const published = article.publishedAt ? new Date(article.publishedAt) : null;

    return (
        <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            {article.imageUrl && (
                <img src={article.imageUrl} alt={article.title} className="w-full h-44 object-cover" />
            )}
            <div className="p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {article.category && (
                        <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: CU.orange + '20', color: CU.orangeRed, fontFamily: "'Raleway', sans-serif" }}
                        >
                            {article.category}
                        </span>
                    )}
                    {published && (
                        <span className="text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                            {published.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                </div>
                <h3 className="text-lg font-bold leading-snug mb-1" style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}>
                    {article.title}
                </h3>
                {article.summary && (
                    <p className="text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: '#6b7280' }}>
                        {article.summary}
                    </p>
                )}
                {article.source && (
                    <p className="text-xs mt-2" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                        {article.source}
                    </p>
                )}
            </div>
        </div>
    );
}