import React from 'react';
import { Link } from 'react-router-dom';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
};

export default function MobileNav({ items, currentPageName }) {
    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex overflow-x-auto"
            style={{
                background: CU.charcoal,
                borderTop: `2px solid ${CU.orange}`,
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            {items.map(item => {
                const Icon = item.icon;
                const isActive = currentPageName === item.name;
                return (
                    <Link
                        key={item.name}
                        to={`/${item.name}`}
                        className="flex flex-col items-center justify-center flex-shrink-0 gap-1 py-2"
                        style={{
                            minWidth: '64px',
                            textDecoration: 'none',
                            color: isActive ? CU.orange : 'rgba(255,255,255,0.7)',
                            fontFamily: "'Raleway', sans-serif",
                        }}
                    >
                        <Icon className="w-5 h-5" />
                        <span style={{ fontSize: '0.625rem', fontWeight: isActive ? 700 : 500 }}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}