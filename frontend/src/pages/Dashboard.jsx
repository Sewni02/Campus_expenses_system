function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Welcome, {user?.name || 'User'}!</h1>
      <p>Role: {user?.role}</p>
      <p>This is your main dashboard. (Role-based content coming next.)</p>
    </div>
  );
}

export default Dashboard;