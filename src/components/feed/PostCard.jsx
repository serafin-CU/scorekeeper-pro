import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CU } from './feedConstants';

export default function PostCard({ post }) {
    const name = post.author_name || 'Anonymous';
    const initials = name.charAt(0).toUpperCase();
    const timeAgo = post.created_date
        ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
        : '';

    return (
        <div className="rounded-xl p-4" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
            <div className="flex gap-3">
                {post.author_avatar_url ? (
                    <img src={post.author_avatar_url} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
                        style={{ background: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}>
                        {initials}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                            {name}
                        </span>
                        {post.author_department && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: CU.orange + '20', color: CU.charcoal, fontFamily: "'Raleway', sans-serif" }}>
                                {post.author_department}
                            </span>
                        )}
                        <span className="text-xs" style={{ color: '#9ca3af', fontFamily: "'Raleway', sans-serif" }}>
                            · {timeAgo}
                        </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap break-words"
                        style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}>
                        {post.content}
                    </p>
                </div>
            </div>
        </div>
    );
}