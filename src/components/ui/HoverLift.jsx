import React from 'react';
import { motion } from 'framer-motion';

/**
 * HoverLift — wraps any card/content to add a smooth hover lift + shadow.
 *
 * Usage:
 *   <HoverLift><div className="...your card...">...</div></HoverLift>
 *
 * Props:
 *   as       — motion element to render (default 'div')
 *   className
 *   glow     — accent color for the hover border glow (optional)
 */
export default function HoverLift({ children, className = '', glow, style, ...props }) {
    return (
        <motion.div
            className={className}
            style={style}
            initial={{ y: 0 }}
            whileHover={{
                y: -4,
                boxShadow: glow
                    ? `0 12px 28px -8px rgba(0,0,0,0.18), 0 0 0 1px ${glow}55`
                    : '0 12px 28px -8px rgba(0,0,0,0.18)',
            }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            {...props}
        >
            {children}
        </motion.div>
    );
}