import React from 'react';

const CU = {
    orange: '#FFB81C',
    charcoal: '#2C2B2B',
};

function Section({ heading, children }) {
    return (
        <section className="mb-8">
            <h2
                style={{ fontFamily: "'Raleway', sans-serif", color: CU.charcoal }}
                className="text-lg font-bold mb-3"
            >
                {heading}
            </h2>
            <div className="space-y-3 text-slate-700 text-[0.95rem] leading-relaxed" style={{ fontFamily: "'Raleway', sans-serif" }}>
                {children}
            </div>
        </section>
    );
}

export default function Rules() {
    return (
        <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 sm:p-10">
                <h1
                    style={{ fontFamily: "'DM Serif Display', serif", color: CU.charcoal }}
                    className="text-2xl sm:text-3xl mb-8 pb-4 border-b border-slate-200"
                >
                    CookUnity FIFA WC 2026 Prode – Terms &amp; Conditions
                </h1>

                <Section heading="1. Eligibility">
                    <p>Only active full-time CookUnity independent contractors and employees are eligible to participate. Freelancers and short-term contractors are not eligible to participate. Eligibility is determined by CookUnity, and participants must remain active full-time independent contractors or employees at the time the reward is awarded and redeemed. Participation constitutes acceptance of these Terms &amp; Conditions.</p>
                </Section>

                <Section heading="2. Rewards for Top 3">
                    <p>Rewards are awarded to the top 3 participants based on total Prode points accumulated throughout the tournament. In the event of a tie in points, CookUnity will apply a tie-breaker criterion at its discretion.</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>1st Place: One week at the CookUnity destination of your choice (up to $3,000)</li>
                        <li>2nd Place: One-year subscription to a wellness app or wellness activity of choice (subject to maximum cap), OR a one-year subscription to Oura + Oura Ring (up to $700)</li>
                        <li>3rd Place: Dinner at a CookUnity chef restaurant of choice; if unavailable in your city, an alternative restaurant of choice for up to 2 people (up to $300)</li>
                    </ul>
                </Section>

                <Section heading="3. Final Standings &amp; Announcement">
                    <p>Final standings are subject to review and verification after the conclusion of the tournament. Winners will be officially announced on [Insert date]. CookUnity reserves the right to correct any scoring errors identified during review prior to confirming the final winners.</p>
                </Section>

                <Section heading="4. Travel Conditions (1st Place)">
                    <ul className="list-disc pl-6 space-y-2">
                        <li>The travel prize is contingent on the winner obtaining all required travel documents, including a valid passport and any applicable visa(s). Securing eligible visas is the sole responsibility of the winner.</li>
                        <li>If the winner cannot obtain the required visa(s) or travel documentation, the travel prize is forfeited and will not be substituted, transferred, or exchanged for cash or any other reward.</li>
                        <li>Travel must be completed within the validity period specified by CookUnity. Dates are subject to availability.</li>
                        <li>Travel-related costs beyond the stated budget cap are the responsibility of the winner.</li>
                    </ul>
                </Section>

                <Section heading="5. No Cash Redemption">
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Prizes cannot be redeemed for cash or any monetary equivalent, in whole or in part.</li>
                        <li>Unused portions of any reward hold no cash value and will not be reimbursed or paid out.</li>
                        <li>Prizes are non-transferable and may not be sold, assigned, or exchanged.</li>
                    </ul>
                </Section>

                <Section heading="6. Budget Caps">
                    <p>Each reward is subject to the maximum cap indicated. Any expense exceeding the applicable cap is the responsibility of the winner.</p>
                </Section>

                <Section heading="7. Substitutions">
                    <p>CookUnity reserves the right to substitute a reward of equal or comparable value if any component becomes unavailable.</p>
                </Section>

                <Section heading="8. Taxes">
                    <p>Winners are responsible for any taxes or fees arising from receipt of the reward, where applicable.</p>
                </Section>

                <Section heading="9. General">
                    <p>CookUnity reserves the right to amend, suspend, or cancel this Prode or modify these Terms &amp; Conditions at any time. CookUnity's decisions on all matters relating to the Prode and rewards are final</p>
                </Section>
            </div>
        </div>
    );
}