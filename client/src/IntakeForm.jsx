import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './IntakeForm.css';

const IntakeForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    jurisdiction: '',
    contactName: '',
    contactPhone: '',
    contactRole: '',
    contactEmail: '',
    postNo: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    aiRegulated: '',
    reason: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const isFormValid = () => {
    const requiredFields = [
      'companyName', 'industry', 'jurisdiction', 'contactName', 
      'contactPhone', 'contactEmail', 'postNo', 'address', 
      'city', 'state', 'country', 'postalCode', 'aiRegulated'
    ];
    return requiredFields.every(field => formData[field].trim() !== '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid()) {
      // For now, we'll just navigate to the disclaimer.
      // In a real app, we might save this to context or local storage.
      localStorage.setItem('aires_intake_data', JSON.stringify(formData));
      navigate('/disclaimer');
    }
  };

  return (
    <div className="intake-container">
      <div className="intake-glass">
        <div style={{ marginBottom: '30px' }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to Overview</Link>
        </div>
        <h1 className="intake-title">Organizational Intake</h1>
        <p className="intake-subtitle">Please provide your organization's details to begin the assessment phase.</p>
        
        <form className="intake-form" onSubmit={handleSubmit}>
          {/* Company Details */}
          <div className="form-group">
            <label>Company Name *</label>
            <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} required placeholder="Acme Corp" />
          </div>
          
          <div className="form-group">
            <label>Industry *</label>
            <input type="text" name="industry" value={formData.industry} onChange={handleChange} required placeholder="Financial Services, Healthcare, etc." />
          </div>

          <div className="form-group">
            <label>Jurisdiction *</label>
            <input type="text" name="jurisdiction" value={formData.jurisdiction} onChange={handleChange} required placeholder="Country, State, or Province" />
          </div>

          <div className="form-group">
            <label>Post No *</label>
            <input type="text" name="postNo" value={formData.postNo} onChange={handleChange} required placeholder="e.g. Unit 402" />
          </div>

          <div className="form-group">
            <label>Address *</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange} required placeholder="Street Address" />
          </div>

          <div className="form-group">
            <label>City *</label>
            <input type="text" name="city" value={formData.city} onChange={handleChange} required placeholder="City" />
          </div>

          <div className="form-group">
            <label>State / Province *</label>
            <input type="text" name="state" value={formData.state} onChange={handleChange} required placeholder="State" />
          </div>

          <div className="form-group">
            <label>Country *</label>
            <input type="text" name="country" value={formData.country} onChange={handleChange} required placeholder="Country" />
          </div>

          <div className="form-group">
            <label>Postal Code *</label>
            <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} required placeholder="ZIP or Postal Code" />
          </div>

          {/* Contact Person */}
          <div className="form-group">
            <label>Contact Person Name *</label>
            <input type="text" name="contactName" value={formData.contactName} onChange={handleChange} required placeholder="John Doe" />
          </div>

          <div className="form-group">
            <label>Contact Email Address *</label>
            <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} required placeholder="john@company.com" />
          </div>

          <div className="form-group">
            <label>Contact Phone Number *</label>
            <input type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange} required placeholder="+1 (555) 000-0000" />
          </div>

          <div className="form-group">
            <label>Role in Company (Optional)</label>
            <input type="text" name="contactRole" value={formData.contactRole} onChange={handleChange} placeholder="e.g. CTO, Compliance Officer" />
          </div>

          {/* AI Regulatory Context */}
          <div className="form-group">
            <label>Is AI regulated in your industry? *</label>
            <select name="aiRegulated" value={formData.aiRegulated} onChange={handleChange} required>
              <option value="">Select an option</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Don't Know">Don't Know</option>
            </select>
          </div>

          <div className="form-group">
            <label>Reason for assessment (Optional)</label>
            <input type="text" name="reason" value={formData.reason} onChange={handleChange} placeholder="e.g. Internal audit, regulatory requirement" />
          </div>

          <div className="form-actions">
            <button type="submit" className="intake-next-button" disabled={!isFormValid()}>
              Continue to Disclaimer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IntakeForm;
