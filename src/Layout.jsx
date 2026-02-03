import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Users, FileText, Database, Settings, LogOut } from 'lucide-react';

export default function Layout({ children, currentPageName }) {
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const isAdmin = currentUser?.role === 'admin';

    const userNavItems = [
        { name: 'SquadManagement', label: 'My Squad', icon: Users }
    ];

    const adminNavItems = [
        { name: 'AdminSystemTestHarness', label: 'System Test Harness', icon: LayoutGrid },
        { name: 'AdminFantasyStatsViewer', label: 'Fantasy Stats Viewer', icon: FileText },
        { name: 'AdminFantasyLedgerViewer', label: 'Fantasy Ledger Viewer', icon: Database },
        { name: 'AdminMatchValidation', label: 'Match Validation', icon: Settings },
        { name: 'AdminMatchSourceLinks', label: 'Match Source Links', icon: Settings },
        { name: 'AdminDataSources', label: 'Data Sources', icon: Settings },
        { name: 'AdminIngestionMonitor', label: 'Ingestion Monitor', icon: Settings },
        { name: 'AdminManualOverride', label: 'Manual Override', icon: Settings },
        { name: 'AdminDevSeed', label: 'Dev Seed', icon: Settings }
    ];

    const navItems = isAdmin ? [...userNavItems, ...adminNavItems] : userNavItems;

    const handleLogout = () => {
        base44.auth.logout();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <div className="text-xl font-bold text-gray-900">
                                Fantasy Sports
                            </div>
                            <div className="hidden md:flex items-center gap-1">
                                {navItems.map(item => {
                                    const Icon = item.icon;
                                    const isActive = currentPageName === item.name;
                                    
                                    return (
                                        <Link
                                            key={item.name}
                                            to={createPageUrl(item.name)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-gray-100 text-gray-900'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                        {currentUser && (
                            <div className="flex items-center gap-4">
                                <div className="text-sm text-gray-700">
                                    {currentUser.email}
                                    {isAdmin && (
                                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                            ADMIN
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
            <main>
                {children}
            </main>
        </div>
    );
}