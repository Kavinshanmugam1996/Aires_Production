import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

//comment added to check
const LandingPage = () => {
  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">AIRES LITE</h1>
        <p className="hero-tagline">
          The definitive AI Risk Assessment framework for forward-thinking executives. 
          Safeguard your innovation with confidence.
        </p>
        <Link to="/intake" className="cta-button">Begin Assessment Phase</Link>
      </section>

      {/* Value Proposition */}
      <section className="landing-section">
        <h2 className="section-title">Why AI Risk Assessment Matters</h2>
        <div className="value-grid">
          <div className="glass-card">
            <h3>Operational Integrity</h3>
            <p>Ensure your AI deployments are resilient against data breaches and algorithmic failures that can halt business operations.</p>
          </div>
          <div className="glass-card">
            <h3>Executive Accountability</h3>
            <p>Translate complex technical risks into clear business impacts, enabling informed decision-making at the board level.</p>
          </div>
          <div className="glass-card">
            <h3>Trust & Reputation</h3>
            <p>
              Demonstrate to stakeholders and clients that your organization handles AI with the highest standards of safety and ethics.
            </p>
          </div>
        </div>
      </section>

      {/* Product Explanation (3-Stage Process) */}
      <section className="landing-section" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <h2 className="section-title">The AIRES LITE Process</h2>
        <div className="process-steps">
          <div className="process-step">
            <div className="step-number">1</div>
            <h3>Secure Payment</h3>
            <p>Complete your purchase to unlock the full diagnostic assessment.</p>
          </div>
          <div className="process-step">
            <div className="step-number">2</div>
            <h3>Intake & Assessment</h3>
            <p>Provide organizational context and complete the 120+ point AI audit.</p>
          </div>
          <div className="process-step">
            <div className="step-number">3</div>
            <h3>Receive Report</h3>
            <p>Get a comprehensive AI risk profile and actionable remediation plan.</p>
          </div>
        </div>
      </section>

      {/* AI Risk Examples / Social Proof */}
      <section className="landing-section">
        <h2 className="section-title">The Cost of Unmanaged AI Risk</h2>
        <div className="value-grid">
          <div className="glass-card" style={{ borderLeft: '4px solid #ef4444' }}>
            <p style={{ fontStyle: 'italic' }}>"A major financial institution faced a <strong>$150M regulatory fine</strong> due to biased credit-scoring AI that was not properly audited."</p>
          </div>
          <div className="glass-card" style={{ borderLeft: '4px solid #ef4444' }}>
            <p style={{ fontStyle: 'italic' }}>"Supply chain disruptions caused by an unmonitored logistics AI led to a <strong>12% drop in quarterly revenue</strong> for a global retailer."</p>
          </div>
        </div>
      </section>

      {/* Why do this section */}
      <section className="landing-section">
        <h2 className="section-title">The Strategic Imperative</h2>
        <div className="value-grid">
          <div className="glass-card">
            <h3>Regulatory Drivers</h3>
            <p>Stay ahead of evolving AI regulations in your jurisdiction, minimizing legal liability and compliance costs.</p>
          </div>
          <div className="glass-card">
            <h3>Competitive Advantage</h3>
            <p>Differentiate your brand by proving that your AI innovation is governed, secure, and ready for scale.</p>
          </div>
        </div>
      </section>

      {/* Pricing Display */}
      <section className="landing-section" style={{ textAlign: 'center' }}>
        <h2 className="section-title">Simple, Transparent Pricing</h2>
        <div className="glass-card pricing-card">
          <h3>Full AIRES LITE Assessment</h3>
          <div className="price-tag">$49.99</div>
          <p>One-time comprehensive report</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0', color: 'rgba(255,255,255,0.6)' }}>
            <li>✓ 120+ Diagnostic Questions</li>
            <li>✓ Executive Summary Report</li>
            <li>✓ Actionable Remediation Plan</li>
          </ul>
          <Link to="/intake" className="cta-button" style={{ width: '100%', padding: '15px' }}>Get Started Now</Link>
        </div>
      </section>

      {/* Sample Output Preview Placeholder */}
      <section className="landing-section" style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
        <h2 className="section-title">Insightful Reporting</h2>
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>Example Report Visualization</p>
          <div style={{ height: '200px', background: 'linear-gradient(90deg, #6366f1 30%, #a855f7 60%, #444 60%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>AI RISK EXPOSURE: MODERATE</span>
          </div>
          <p style={{ marginTop: '20px' }}>Our proprietary scoring algorithm provides a high-level score across data integrity, model ethics, and operational security.</p>
        </div>
      </section>

      {/* Upsell / Help Access */}
      <section className="landing-section" style={{ textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>
          Need a more customized solution? <Link to="#" style={{ color: '#6366f1' }}>Contact Bizcom for SME or Enterprise versions.</Link>
        </p>
        <p style={{ marginTop: '10px' }}>
          <Link to="#" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}>View FAQs</Link> | Help Email: <a href="mailto:Info@bizcomgrp.com" style={{ color: 'rgba(255,255,255,0.7)' }}>Info@bizcomgrp.com</a>
        </p>
      </section>

      {/* Final CTA */}
      <section className="landing-section" style={{ textAlign: 'center', paddingBottom: '100px' }}>
        <Link to="/intake" className="cta-button">Ready to secure your AI?</Link>
      </section>
    </div>
  );
};

export default LandingPage;
