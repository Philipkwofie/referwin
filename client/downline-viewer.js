document.addEventListener('DOMContentLoaded', () => {
  // The auth-guard.js script handles redirection.
  // If this code runs, the user is authenticated.
  document.getElementById('viewDownlinesBtn').addEventListener('click', viewDownlines);
});

function viewDownlines() {
  const username = document.getElementById('downlineUserSearch').value.trim();
  if (!username) {
    alert('Please enter a username');
    return;
  }

  const token = localStorage.getItem('adminToken');
  fetch(`/api/admin/user-downlines/${encodeURIComponent(username)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
      const resultsDiv = document.getElementById('downlineResults');
      resultsDiv.innerHTML = '';

      if (data.error) {
        resultsDiv.innerHTML = `<p style="color: red;">${data.error}</p>`;
        return;
      }

      const userInfo = document.createElement('div');
      userInfo.style.cssText = `
        background-color: #f8f9fa;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 10px;
        border: 1px solid #dee2e6;
      `;
      userInfo.innerHTML = `
        <h3>${data.user.username}</h3>
        <p><strong>Status:</strong> ${data.user.isActivated ? 'Activated' : 'Not Activated'}</p>
        <p><strong>Total Downlines:</strong> ${data.user.totalDownlines}</p>
        <p><strong>Activated Downlines:</strong> ${data.user.activatedDownlines}</p>
      `;
      resultsDiv.appendChild(userInfo);

      if (data.downlines.length === 0) {
        resultsDiv.innerHTML += '<p>No downlines found.</p>';
        return;
      }

      const downlinesList = document.createElement('div');
      downlinesList.innerHTML = '<h4>Downlines:</h4>';
      data.downlines.forEach(downline => {
        const downlineDiv = document.createElement('div');
        downlineDiv.style.cssText = `
          background-color: #f8f9fa;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          border-radius: 10px;
          border: 1px solid #dee2e6;
        `;
        downlineDiv.innerHTML = `
          <p><strong>${downline.username}</strong> - ${downline.isActivated ? 'Activated' : 'Not Activated'}</p>
          <p><small>Signup Date: ${new Date(downline.signupDate).toLocaleDateString()}</small></p>
          <p><small>Earnings: GHS ${parseFloat(downline.earnings).toFixed(2)}</small></p>
        `;
        downlinesList.appendChild(downlineDiv);
      });
      resultsDiv.appendChild(downlinesList);
    })
    .catch(error => {
      console.error('Error fetching downlines:', error);
      document.getElementById('downlineResults').innerHTML = '<p style="color: red;">Error loading downlines.</p>';
    });
}
