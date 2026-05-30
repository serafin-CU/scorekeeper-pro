import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Globe, ChevronRight } from 'lucide-react';

const CU = {
    blue: '#475CC7',
    charcoal: '#2C2B2B',
};

export default function WCNewsTeaser() {
    const { data: articles = [] } = useQuery({
        queryKey: ['dashWCNews'],
        queryFn: () => base44.entities.WorldCupNews.list('-publishedAt', 2),
    });

    return (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" style={{ color: CU.blue }} />
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1rem', color: CU.charcoal }}>Latest World Cup News</span>
                </div>
                <Link to="/WorldCup">
                    <button className="flex items-center gap-1 text-xs" style={{ fontFamily: "'Raleway', sans-serif", color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                        See all news <ChevronRight className="w-3 h-3" />
                    </button>
                </Link>
            </div>
            <div className="p-4">
                {articles.length === 0 ? (
                    <Link to="/WorldCup" className="block text-center py-4 text-sm" style={{ color: CU.blue, fontFamily: "'Raleway', sans-serif", textDecoration: 'underline' }}>
                        Stay tuned for the latest updates →
                    </Link>
                ) : (
                    <div className="space-y-2">
                        {articles.map(a => (
                            <Link key={a.id} to="/WorldCup" className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: '#f9fafb', textDecoration: 'none' }}>
                                {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />}
                                <div className="min-w-0">
                                    <div className="truncate" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 600, fontSize: '0.875rem', color: CU.charcoal }}>{a.title}</div>
                                    {a.summary && <div className="truncate" style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.75rem', color: '#9ca3af' }}>{a.summary}</div>}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}