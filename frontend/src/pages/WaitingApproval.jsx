function WaitingApproval() {
  return (
    <div style={{ maxWidth: '500px', margin: '100px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: '60px', marginBottom: '20px' }}>⏳</div>
      <h2>Waiting for Approval</h2>
      <p style={{ color: '#666', lineHeight: '1.6' }}>
        Your account has been created successfully, but it's currently under review.
        Please wait for a Super Admin to approve your access before you can use the system.
      </p>
      <button
        onClick={() => {
          localStorage.clear();
          window.location.href = '/login';
        }}
        style={{
          marginTop: '20px',
          padding: '10px 24px',
          borderRadius: '8px',
          border: 'none',
          background: '#2563eb',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Back to Login
      </button>
    </div>
  );
}

export default WaitingApproval;