/**
 * ROUGH STUB — Assessment questionnaire page. Shows questions by category, collects answers, submits.
 * Restyle and rebuild as needed. Questions come from GET /api/assessment/questions.
 * All API calls go through api.js — don't change those.
 * Routes: /assessment (protected — requires Cognito token)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuestions, startAssessment, submitAssessment } from './api';
import { getToken } from './auth';
import './Assessment.css';

export default function Assessment() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    Promise.all([getQuestions(token), startAssessment(token)])
      .then(([qData, sessionData]) => {
        const qs = qData.questions;
        setQuestions(qs);
        setSessionId(sessionData.sessionId);
        const cats = [...new Set(qs.map(q => q.category))];
        setCategories(cats);
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const currentCategory = categories[categoryIndex];
  const currentQuestions = questions.filter(q => q.category === currentCategory);
  const answeredInCategory = currentQuestions.filter(q => answers[q.id] !== undefined).length;
  const allAnsweredInCategory = answeredInCategory === currentQuestions.length && currentQuestions.length > 0;
  const totalAnswered = Object.keys(answers).length;
  const progress = questions.length > 0 ? Math.round((totalAnswered / questions.length) * 100) : 0;
  const isLastCategory = categoryIndex === categories.length - 1;

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    setError('');
  };

  const handleNext = () => {
    if (!allAnsweredInCategory) {
      setError('Please answer all questions in this section before continuing.');
      return;
    }
    setError('');
    if (!isLastCategory) setCategoryIndex(i => i + 1);
  };

  const handleBack = () => {
    setError('');
    if (categoryIndex > 0) setCategoryIndex(i => i - 1);
  };

  const handleSubmit = async () => {
    if (totalAnswered < questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const token = getToken();
      const answersArray = questions.map(q => ({
        questionId: q.id,
        questionText: q.text,
        answer: answers[q.id] || '',
      }));
      await submitAssessment(token, sessionId, answersArray);
      navigate('/report');
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="assessment-container">
        <div className="assessment-loading">Loading assessment...</div>
      </div>
    );
  }

  return (
    <div className="assessment-container">
      <header className="assessment-header">
        <button className="back-link" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div className="assessment-logo">AIRES</div>
        <div className="assessment-progress-text">{totalAnswered}/{questions.length} answered</div>
      </header>

      <div className="assessment-progress-bar">
        <div className="assessment-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <main className="assessment-main">
        <div className="category-tabs">
          {categories.map((cat, i) => {
            const catQs = questions.filter(q => q.category === cat);
            const catAnswered = catQs.filter(q => answers[q.id] !== undefined).length;
            const complete = catAnswered === catQs.length;
            return (
              <button
                key={cat}
                className={`category-tab ${i === categoryIndex ? 'active' : ''} ${complete ? 'complete' : ''}`}
                onClick={() => { setError(''); setCategoryIndex(i); }}
              >
                {complete ? '✓ ' : ''}{cat}
              </button>
            );
          })}
        </div>

        <div className="questions-section">
          <h2 className="section-title">{currentCategory}</h2>
          <p className="section-count">{answeredInCategory} of {currentQuestions.length} answered in this section</p>

          {currentQuestions.map((q, idx) => (
            <div key={q.id} className={`question-card ${answers[q.id] ? 'answered' : ''}`}>
              <p className="question-text">
                <span className="question-number">Q{idx + 1}.</span> {q.text}
              </p>
              <div className="options-list">
                {q.options.map(opt => (
                  <label key={opt} className={`option-label ${answers[q.id] === opt ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => handleAnswer(q.id, opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="assessment-error">{error}</div>}

        <div className="assessment-actions">
          <button
            className="nav-button secondary"
            onClick={handleBack}
            disabled={categoryIndex === 0}
          >
            Previous
          </button>

          {isLastCategory ? (
            <button
              className="nav-button primary"
              onClick={handleSubmit}
              disabled={submitting || totalAnswered < questions.length}
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          ) : (
            <button
              className="nav-button primary"
              onClick={handleNext}
            >
              Next Section →
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
