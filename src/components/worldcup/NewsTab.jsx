import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Newspaper } from 'lucide-react';
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
            <div className="text-center py-16 rounded-2xl border flex flex-col items-center gap-3" style={{ borderColor: '#e5e7eb', color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                <Newspaper className="w-8 h-8" style={{ color: '#d1d5db' }} />
                No news yet. Check back soon for the latest World Cup updates!
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