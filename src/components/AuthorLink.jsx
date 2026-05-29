import React from 'react';
import { Link } from 'react-router-dom';

// Wraps author avatar/name so clicking navigates to the public profile.
// Renders a non-link span when no userId is available.
export default function AuthorLink({ userId, className = '', children, style }) {
    if (!userId) {
        return <span className={className} style={style}>{children}</span>;
    }
    return (
        <Link to={`/Profile/${userId}`} className={className} style={{ textDecoration: 'none', cursor: 'pointer', ...style }}>
            {children}
        </Link>
    );
}