import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
};

export default function MobileNav({ items, currentPageName }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="md:hidden">
            {/* Hamburger button */}
            <button
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                style={{
                    position: 'fixed',
                    top: '14px',
                    right: '14px',
                    zIndex: 60,
                    background: 'rgba(44,43,43,0.9)',
                    border: `1px solid ${CU.orange}`,
                    borderRadius: '8px',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: CU.orange,
                }}
            >
                <Menu className="w-5 h-5" />
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 70 }}
                        />
                        {/* Panel */}
                        <motion.nav
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                            style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: '74%',
                                maxWidth: '300px',
                                background: CU.charcoal,
                                borderLeft: `2px solid ${CU.orange}`,
                                zIndex: 80,
                                display: 'flex',
                                flexDirection: 'column',
                                paddingTop: 'env(safe-area-inset-top)',
                            }}
                        >
                            <div className="flex items-center justify-between px-5 py-4">
                                <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: 'white' }}>
                                    ⚽ UnityCup
                                </span>
                                <button
                                    onClick={() => setOpen(false)}
                                    aria-label="Close menu"
                                    style={{ color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none' }}
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex flex-col px-2 overflow-y-auto">
                                {items.map(item => {
                                    const Icon = item.icon;
                                    const isActive = currentPageName === item.name;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={`/${item.name}`}
                                            onClick={() => setOpen(false)}
                                            className="flex items-center gap-3 px-4 py-3 rounded-lg"
                                            style={{
                                                textDecoration: 'none',
                                                fontFamily: "'Raleway', sans-serif",
                                                fontWeight: isActive ? 700 : 500,
                                                color: isActive ? CU.orange : 'rgba(255,255,255,0.8)',
                                                background: isActive ? 'rgba(255,184,28,0.12)' : 'transparent',
                                            }}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span style={{ fontSize: '0.95rem' }}>{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </motion.nav>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}