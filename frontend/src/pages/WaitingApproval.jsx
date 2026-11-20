import { logout } from '../utils/session';
import './WaitingApproval.css';

function WaitingApproval() {
  return (
    <div className="wa-page">
      <div className="wa-icon">⏳</div>
      <h2 className="wa-title">Waiting for Approval</h2>
      <p className="wa-text">
        Your account has been created successfully, but it's currently under review.
        Please wait for a Super Admin to approve your access before you can use the system.
      </p>
      <button
        className="wa-back-btn"
        onClick={async () => {
          await logout();
          window.location.href = '/login';
        }}
      >
        Back to Login
      </button>
    </div>
  );
}

export default WaitingApproval;