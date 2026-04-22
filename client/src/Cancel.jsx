import { Link } from "react-router-dom";
import "./Status.css";

function Cancel() {
  return (
    <div className="status-container" style={{ "--status-color": "#ef4444" }}>
      <div className="status-card">
        <div className="status-icon">❌</div>
        <h1 className="status-title">Payment Cancelled</h1>
        <p className="status-message">
          The payment process was cancelled. No charges were made. 
          If you encountered an issue, feel free to try again or contact support.
        </p>
        <Link to="/disclaimer" className="status-button">Try Again</Link>
      </div>
    </div>
  );
}

export default Cancel;
