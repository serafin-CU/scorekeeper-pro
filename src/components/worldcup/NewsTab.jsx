import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Newspaper, ArrowRight } from 'lucide-react';
import NewsCard from './NewsCard';

/* ── News tab: World Cup news feed ───────────────────────── */
export default function NewsTab() {
    const { data: articles = [], isLoading } = useQuery({
        queryKey: ['worldCupNews'],
        queryFn: () => base44.entities.WorldCupNews.list('-publishedAt'),
    });

    if (isLoading) {
        return (
            <div className="flex items-center gap-3 py-16 justify-center" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af' }}>
                <Loader2 className="w-5 h-5 animate-spin" /> Loading news...
            </div>
        );
    }

    if (articles.length === 0) {
        return (
            <div className="text-center py-16 px-6 rounded-2xl border flex flex-col items-center" style={{ borderColor: '#e5e7eb', fontFamily: "'Raleway', sans-serif" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#FFB81C20' }}>
                    <Newspaper className="w-8 h-8" style={{ color: '#FFB81C' }} />
                </div>
                <p className="text-lg font-bold mb-1" style={{ color: '#2C2B2B', fontFamily: "'DM Serif Display', serif" }}>
                    Stay tuned!
                </p>
                <p className="text-sm flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
                    Follow us for breaking news <ArrowRight className="w-4 h-4" />
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {articles.map(article => (
                <NewsCard key={article.id} article={article} />
            ))}
        </div>
    );
}