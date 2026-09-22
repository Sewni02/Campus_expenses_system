import './Dashboard.css';

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="dash-page">
      <div className="dash-header">
        <h1 className="dash-title">Welcome, {user?.name || 'User'}!</h1>
        <span className="dash-role">{user?.role}</span>
      </div>
      <div className="dash-info-card">
        This is your main dashboard. (Role-based content coming next.)
      </div>
    </div>
  );
}

export default Dashboard;