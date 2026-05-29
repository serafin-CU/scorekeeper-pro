import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { CU } from '@/components/feed/feedConstants';

function CompactPost({ post }) {
    const name = post.author_name || 'Anonymous';
    const initials = name.charAt(0).toUpperCase();
    const timeAgo = post.created_date
        ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
        : '';

    return (
        <div className="flex gap-3 py-2.5 px-3 rounded-lg" style={{ background: '#f9fafb' }}>
            {post.author_avatar_url ? (
                <img src={post.author_avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold"
                    style={{ background: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}>
                    {initials}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>{name}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>· {timeAgo}</span>
                </div>
                <p className="text-sm mt-0.5 line-clamp-2 break-words" style={{ fontFamily: "'Raleway', sans-serif", color: '#4b5563' }}>
                    {post.content}
                </p>
            </div>
        </div>
    );
}

export default function DashboardFeedPreview() {
    const { data: posts = [] } = useQuery({
        queryKey: ['dashFeedPosts'],
        queryFn: () => base44.entities.FeedPost.list('-created_date', 5)
    });

    if (posts.length === 0) {
        return (
            <div className="text-center py-6 text-sm" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                No posts yet.{' '}
                <Link to="/Feed" style={{ color: CU.magenta, textDecoration: 'underline' }}>Share something!</Link>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {posts.map(post => <CompactPost key={post.id} post={post} />)}
        </div>
    );
}