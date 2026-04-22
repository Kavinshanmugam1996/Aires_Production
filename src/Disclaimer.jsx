import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { useNavigate } from 'react-router-dom';
import './Disclaimer.css';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  'pk_test_51TJN1M3WttwGvPjen8IUDAMxgDxGidamOBBSPS1A25EJsu3u0fExwFPt7uJh8fgcGpwXU7rjp0tyQmkR1HsaMxwa009wZ1ET5G'
);

const Disclaimer = () => {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState({
    terms: false,
    timeframe: false,
    completion: false,
  });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);

  const checkoutRef = useRef(null);
  const containerRef = useRef(null);

  // Guard: must have come from the intake form
  useEffect(() => {
    const intakeData = localStorage.getItem('aires_intake_data');
    if (!intakeData) navigate('/', { replace: true });
  }, [navigate]);

  const handleCheckboxChange = (e) => {
    setAgreed({ ...agreed, [e.target.name]: e.target.checked });
  };

  const isAllChecked = agreed.terms && agreed.timeframe && agreed.completion;

  const handleProceed = async () => {
    if (!isAllChecked) return;
    setLoading(true);
    try {
      const intakeData = JSON.parse(localStorage.getItem('aires_intake_data') || '{}');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await fetch(`${API_URL}/embedded-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: intakeData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server error');
      setClientSecret(data.clientSecret);
      setShowModal(true);
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mount Stripe Embedded Checkout once modal is open and clientSecret is ready
  useEffect(() => {
    if (!showModal || !clientSecret || !containerRef.current) return;

    let checkout;
    (async () => {
      const stripe = await stripePromise;
      checkout = await stripe.initEmbeddedCheckout({ clientSecret });
      checkoutRef.current = checkout;
      checkout.mount(containerRef.current);
    })();

    return () => {
      if (checkoutRef.current) {
        checkoutRef.current.destroy();
        checkoutRef.current = null;
      }
    };
  }, [showModal, clientSecret]);

  const handleCloseModal = () => {
    if (checkoutRef.current) {
      checkoutRef.current.destroy();
      checkoutRef.current = null;
    }
    setShowModal(false);
    setClientSecret(null);
  };

  return (
    <div className="disclaimer-container">
      <div className="disclaimer-glass">
        <h1 className="disclaimer-title">Pre-Assessment Disclaimer & User Agreement</h1>

        <div className="disclaimer-content">
          <section>
            <h3>1. Assessment Overview</h3>
            <p>This assessment consists of 120+ questions designed to comprehensively evaluate your inputs and generate an accurate report. The questions may vary in complexity and are intended to gather detailed and meaningful information.</p>
          </section>
          <section>
            <h3>2. Time Flexibility</h3>
            <p>You are not required to complete the assessment in one sitting. You may start, pause, and resume the assessment at your convenience.</p>
          </section>
          <section>
            <h3>3. Completion Deadline</h3>
            <p>Once you begin the assessment, you will have a total of 3 days (72 hours) to complete all questions. After this time period, your session may expire, and incomplete responses may not be considered.</p>
          </section>
          <section>
            <h3>4. Report Generation Criteria</h3>
            <p>The final report will be generated only after all questions have been fully completed. Partial or incomplete submissions will not produce a report.</p>
          </section>
          <section>
            <h3>5. Data Accuracy Responsibility</h3>
            <p>You are responsible for ensuring that all information provided is accurate and complete. The quality and reliability of the generated report depend entirely on the accuracy of your responses.</p>
          </section>
          <section>
            <h3>6. User Commitment</h3>
            <p>By proceeding, you acknowledge and agree that:</p>
            <ul>
              <li>You understand the scope and length of the assessment.</li>
              <li>You will complete the assessment within the given timeframe.</li>
              <li>You accept that no report will be generated unless all questions are answered.</li>
            </ul>
          </section>
        </div>

        <div className="confirmation-section">
          <h3>Confirmation</h3>
          <p>Please confirm your agreement before proceeding:</p>
          <label className="checkbox-label">
            <input type="checkbox" name="terms" checked={agreed.terms} onChange={handleCheckboxChange} />
            <span>I have read and understood the above terms.</span>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="timeframe" checked={agreed.timeframe} onChange={handleCheckboxChange} />
            <span>I agree to complete the assessment within 3 days.</span>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="completion" checked={agreed.completion} onChange={handleCheckboxChange} />
            <span>I acknowledge that the report will only be generated after full completion.</span>
          </label>
        </div>

        <button
          className={`proceed-button ${isAllChecked ? 'enabled' : 'disabled'}`}
          onClick={handleProceed}
          disabled={!isAllChecked || loading}
        >
          {loading ? 'Initializing...' : 'Proceed to Payment'}
        </button>
      </div>

      {/* Stripe Embedded Checkout Modal */}
      {showModal && (
        <div
          className="checkout-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div className="checkout-modal">
            <button
              className="checkout-modal-close"
              onClick={handleCloseModal}
              aria-label="Close"
            >
              ✕
            </button>
            <div ref={containerRef} className="checkout-modal-body" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Disclaimer;
