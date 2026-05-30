import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, LogOut, Shield, MessageSquare, Trophy, Target, LayoutDashboard, User, Eye, EyeOff, Brain, Newspaper, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import AlbaChatWidget from '@/components/AlbaChatWidget';
import { FANTASY_ENABLED } from '@/config/features';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
    magenta: '#AA0061',
};

const ALL_NAV_ITEMS = [
    { name: 'Dashboard', label: 'Home', icon: LayoutDashboard },
    { name: 'ProdePredictions', label: 'Prode', icon: Target },
    { name: 'Feed', label: 'Feed', icon: Newspaper },
    { name: 'WorldCup', label: 'World Cup', icon: Globe },
    { name: 'Leaderboard', label: 'Standings', icon: Trophy },
    { name: 'Trivia', label: 'Trivia', icon: Brain },
    { name: 'AlbaChat', label: 'Alba 🤖', icon: MessageSquare },
    { name: 'Profile', label: 'Profile', icon: User }
];

export default function ParticipantLayout({ children, currentPageName }) {
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const [searchParams] = useSearchParams();
    const isAdmin = currentUser?.role === 'admin';
    const previewAsParticipant = isAdmin && searchParams.get('preview_as') === 'participant';
    const navItems = ALL_NAV_ITEMS.filter(item => !item.fantasyOnly || FANTASY_ENABLED || (isAdmin && !previewAsParticipant));

    const handleLogout = () => {
        base44.auth.logout();
    };

    return (
        <div className="min-h-screen" style={{ background: '#f9fafb' }}>
            <nav style={{ background: CU.charcoal, borderTop: `2px solid ${CU.orange}` }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <Link to="/Dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.25rem', color: 'white', lineHeight: 1 }}>⚽ UnityCup</span>
                                <span style={{ fontFamily: "'Raleway', sans-serif", fontSize: '0.7rem', color: CU.orange, lineHeight: 1 }}>FIFA World Cup 2026</span>
                            </Link>
                            <div className="hidden md:flex items-center gap-1">
                                {navItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = currentPageName === item.name;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={`/${item.name}`}
                                            style={{
                                                fontFamily: "'Raleway', sans-serif",
                                                fontWeight: isActive ? 700 : 500,
                                                color: isActive ? CU.orange : 'rgba(255,255,255,0.75)',
                                                padding: '0 12px',
                                                height: '64px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.875rem',
                                                textDecoration: 'none',
                                                transition: 'color 0.2s',
                                                position: 'relative'
                                            }}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {item.label}
                                            {isActive && (
                                                <motion.div
                                                    layoutId="navActiveUnderline"
                                                    style={{
                                                        position: 'absolute',
                                                        left: '8px',
                                                        right: '8px',
                                                        bottom: 0,
                                                        height: '3px',
                                                        borderRadius: '3px 3px 0 0',
                                                        background: CU.orange,
                                                        boxShadow: `0 0 8px ${CU.orange}, 0 0 14px ${CU.orange}aa`
                                                    }}
                                                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                                />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {isAdmin && !previewAsParticipant && (
                                <Link to="/AdminSystemTestHarness">
                                    <button
                                        style={{
                                            fontFamily: "'Raleway', sans-serif",
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                            color: 'white',
                                            border: '1px solid rgba(255,255,255,0.5)',
                                            borderRadius: '6px',
                                            padding: '5px 12px',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        Admin
                                    </button>
                                </Link>
                            )}
                            {isAdmin && (
                                <Link to={previewAsParticipant ? window.location.pathname : `${window.location.pathname}?preview_as=participant`}>
                                    <button
                                        style={{
                                            fontFamily: "'Raleway', sans-serif",
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                            color: previewAsParticipant ? CU.orange : 'white',
                                            border: `1px solid ${previewAsParticipant ? CU.orange : 'rgba(255,255,255,0.5)'}`,
                                            borderRadius: '6px',
                                            padding: '5px 10px',
                                            background: previewAsParticipant ? 'rgba(255,184,28,0.1)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        {previewAsParticipant ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        {previewAsParticipant ? '← Admin View' : '👁 Preview as User'}
                                    </button>
                                </Link>
                            )}
                            {currentUser && (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm hidden sm:block" style={{ fontFamily: "'Raleway', sans-serif", color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                                        {currentUser.email}
                                    </span>
                                    <button
                                        onClick={handleLogout}
                                        style={{
                                            fontFamily: "'Raleway', sans-serif",
                                            color: 'rgba(255,255,255,0.6)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.875rem',
                                            padding: '6px 8px',
                                            borderRadius: '6px'
                                        }}
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span className="hidden sm:inline">Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            <main>
                {children}
            </main>
            <AlbaChatWidget userName={currentUser?.display_name || currentUser?.full_name || ''} />
        </div>
    );
}