document.addEventListener('DOMContentLoaded', () => {
  // The auth-guard.js script handles redirection.
  // If this code runs, the user is authenticated.
  if (window.location.pathname.endsWith('ads_mise-ye.html')) {
    initializeDashboard();
  }
});

function initializeDashboard() {
  // Initial load
  loadStats();
  loadOnlineStats();
  loadUsers();
  loadWithdrawals();
  loadMessageStats();
  loadLeaderboard();
  loadWhatsappNumber();
  checkAdminRole();
}

// Helper function to create authenticated fetch options
function getAuthFetchOptions(options = {}) {
  const token = localStorage.getItem('adminToken');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  return { ...options, headers };
}

// Load admin stats
function loadStats() {
  fetch('/api/admin/stats', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      document.getElementById('totalSignups').textContent = data.totalSignups;
      document.getElementById('activatedCount').textContent = data.activated;
      document.getElementById('unactivatedCount').textContent = data.unactivated;

      // Simple text-based chart instead of Chart.js
      const chartDiv = document.getElementById('signupChart');
      chartDiv.innerHTML = `
        <div style="text-align: center; font-size: 1.2em;">
          <div style="background-color: #4CAF50; color: white; padding: 10px; margin: 5px;">Activated: ${data.activated}</div>
          <div style="background-color: #FF9800; color: white; padding: 10px; margin: 5px;">Unactivated: ${data.unactivated}</div>
        </div>
      `;
    });
}

// Load online users stats
function loadOnlineStats() {
  fetch('/api/admin/online-users', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      document.getElementById('totalOnline').textContent = data.totalOnline;
      document.getElementById('activatedOnline').textContent = data.activatedOnline;
      document.getElementById('nonActivatedOnline').textContent = data.nonActivatedOnline;

      const list = document.getElementById('onlineUsers');
      list.innerHTML = '';
      data.onlineUsers.forEach(user => {
        const li = document.createElement('li');
    li.textContent = `${user.username} - ${user.isActivated ? 'Activated' : 'Not Activated'} - Signed up: ${new Date(user.signupDate).toLocaleDateString()}`;
        list.appendChild(li);
      });
    });
}

// Toggle online users view
if (document.getElementById('toggleView')) {
  document.getElementById('toggleView').addEventListener('click', () => {
    const list = document.getElementById('onlineUsersList');
    list.style.display = list.style.display === 'none' ? 'block' : 'none';
  });
}

// Load users pending activation
function loadUsers() {
  fetch('/api/admin/users', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const usersDiv = document.getElementById('users');
      usersDiv.innerHTML = '';
      data.users.filter(u => !u.isActivated).forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.innerHTML = `
      <p></p>
          <button class="activate-btn" data-user-id="${user.id}">Activate</button>
        `;
        usersDiv.appendChild(userDiv);
    userDiv.querySelector('p').textContent = `${user.username} - Signed up: ${new Date(user.signupDate).toLocaleDateString()}`;

        // Add event listener to the button
        const activateBtn = userDiv.querySelector('.activate-btn');
        activateBtn.addEventListener('click', () => activateUser(user.id));
      });
    });
}

// Activate user
function activateUser(userId) {
  fetch(`/api/admin/activate/${userId}`, getAuthFetchOptions({ method: 'POST' }))
    .then(res => res.json())
    .then(result => {
      alert(result.message);
      loadUsers();
      loadStats();
    });
}

// Load pending withdrawals
function loadWithdrawals() {
  fetch('/api/admin/withdrawals', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('withdrawalList');
      const count = document.getElementById('pendingWithdrawalsCount');
      const pendingWithdrawals = data.withdrawals.filter(w => w.status === 'pending');
      count.textContent = pendingWithdrawals.length;
      list.innerHTML = '';
      pendingWithdrawals.forEach(withdrawal => {
        const li = document.createElement('li');
        li.innerHTML = `
          ${withdrawal.username} (${withdrawal.phone}) - GHS ${withdrawal.amount} - ${new Date(withdrawal.date).toLocaleDateString()}
          <button class="pay-btn" data-withdrawal-id="${withdrawal.id}">Mark as Paid</button>
        `;
        list.appendChild(li);

        // Add event listener to the button
        const payBtn = li.querySelector('.pay-btn');
        payBtn.addEventListener('click', () => payWithdrawal(withdrawal.id));
      });
    });
}

// Pay withdrawal
function payWithdrawal(withdrawalId) {
  fetch(`/api/admin/withdrawals/${withdrawalId}/pay`, getAuthFetchOptions({ method: 'POST' }))
    .then(res => res.json())
    .then(result => {
      alert(result.message);
      loadWithdrawals();
    });
}

// Load message stats
function loadMessageStats() {
  fetch('/api/admin/message-stats', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const totalEl = document.getElementById('totalMessages');
      const recentEl = document.getElementById('recentMessagesCount');
      const oldEl = document.getElementById('oldMessagesCount');
      if (totalEl) totalEl.textContent = data.total;
      if (recentEl) recentEl.textContent = data.recent;
      if (oldEl) oldEl.textContent = data.old;
    });
}

// Load all messages
function loadAllMessages() {
  fetch('/api/admin/all-messages', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const messagesList = document.getElementById('messages');
      messagesList.innerHTML = '';
      data.notifications.forEach(notification => {
        const li = document.createElement('li');
        const user = data.users.find(u => u.id === notification.userId);
        const username = user ? user.username : 'Unknown';
        li.innerHTML = `
          <strong>${username}</strong> (${notification.type}) - ${new Date(notification.date).toLocaleString()}<br>
          ${notification.message}
        `;
        messagesList.appendChild(li);
      });
    });
}

// Toggle messages view
if (document.getElementById('toggleMessagesView')) {
  document.getElementById('toggleMessagesView').addEventListener('click', () => {
    const messagesListDiv = document.getElementById('messagesList');
    if (messagesListDiv.style.display === 'none') {
      loadAllMessages();
      messagesListDiv.style.display = 'block';
    } else {
      messagesListDiv.style.display = 'none';
    }
  });
}

// Clear old messages
if (document.getElementById('clearOldMessagesBtn')) {
  document.getElementById('clearOldMessagesBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all old messages? This action cannot be undone.')) { // This fetch is missing credentials, but the route doesn't exist yet.
      fetch('/api/admin/clear-old-messages', getAuthFetchOptions({ method: 'POST' }))
        .then(res => res.json())
        .then(result => {
          alert(result.message);
          loadMessageStats();
        });
    }
  });
}



// Downline viewer functionality
if (document.getElementById('viewDownlinesBtn')) {
  document.getElementById('viewDownlinesBtn').addEventListener('click', viewDownlines);
}

function viewDownlines() {
  const username = document.getElementById('downlineUserSearch').value.trim();
  if (!username) {
    alert('Please enter a username');
    return;
  }

  fetch(`/api/admin/user-downlines/${encodeURIComponent(username)}`, getAuthFetchOptions())
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

// Leaderboard functionality
if (document.getElementById('refreshLeaderboardBtn')) {
  document.getElementById('refreshLeaderboardBtn').addEventListener('click', loadLeaderboard);
}

function loadLeaderboard() {
  fetch('/api/admin/leaderboard', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const leaderboardDiv = document.getElementById('leaderboardList');
      if (!leaderboardDiv) return;

      leaderboardDiv.innerHTML = '';

      if (data.leaderboard.length === 0) {
        leaderboardDiv.innerHTML = '<p>No users with activated downlines found.</p>';
        return;
      }

      data.leaderboard.forEach((user, index) => {
        const userDiv = document.createElement('div');
        userDiv.style.cssText = `
          background-color: #f8f9fa;
          padding: 1rem;
          margin-bottom: 0.5rem;
          border-radius: 10px;
          border: 1px solid #dee2e6;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        userDiv.innerHTML = `
          <div>
            <strong>#${index + 1} ${user.username}</strong><br>
            <small>Activated Downlines: ${user.activatedDownlines} | Total Downlines: ${user.totalDownlines} | Earnings: GHS ${parseFloat(user.earnings).toFixed(2)}</small>
          </div>
          <button class="reward-btn" data-username="${user.username}" style="
            padding: 0.5rem 1rem;
            background: linear-gradient(45deg, #28a745, #20c997);
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
          ">Reward</button>
        `;
        leaderboardDiv.appendChild(userDiv);

        // Add event listener for reward button
        const rewardBtn = userDiv.querySelector('.reward-btn');
        rewardBtn.addEventListener('click', () => rewardUser(user.username));
      });
    })
    .catch(error => {
      console.error('Error loading leaderboard:', error);
      const leaderboardList = document.getElementById('leaderboardList');
      if (leaderboardList) {
        leaderboardList.innerHTML = '<p style="color: red;">Error loading leaderboard.</p>';
      }
    });
}

function rewardUser(username) {
  const rewardAmount = prompt(`Enter reward amount for ${username}:`);
  if (!rewardAmount || isNaN(rewardAmount) || rewardAmount <= 0) {
    alert('Please enter a valid reward amount');
    return;
  }

  fetch(`/api/admin/reward/${encodeURIComponent(username)}`, {
    method: 'POST',
    ...getAuthFetchOptions({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: parseFloat(rewardAmount) }) })
  })
  .then(res => res.json())
  .then(result => {
    if (result.message) {
      alert(result.message);
      loadLeaderboard(); // Refresh leaderboard after reward
    } else {
      alert(result.error || 'Error rewarding user');
    }
  })
  .catch(error => {
    console.error('Error rewarding user:', error);
    alert('Error rewarding user');
  });
}

// Ad management functionality
if (document.getElementById('addAdBtn')) {
  document.getElementById('addAdBtn').addEventListener('click', addAd);
}

function addAd() {
  const title = document.getElementById('adTitle').value;
  const videoUrl = document.getElementById('adVideoUrl').value;
  const platform = document.getElementById('adPlatform').value;
  const description = document.getElementById('adDescription').value;

  if (!title || !videoUrl || !platform) {
    alert('Please fill in all required fields');
    return;
  }

  fetch('/api/admin/ads', {
    method: 'POST',
    ...getAuthFetchOptions({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, videoUrl, platform, description }) })
  })
  .then(res => res.json())
  .then(result => {
    if (result.message) {
      alert(result.message);
      document.getElementById('adTitle').value = '';
      document.getElementById('adVideoUrl').value = '';
      document.getElementById('adDescription').value = '';
      loadAdsList();
    } else {
      alert(result.error);
    }
  });
}

function loadAdsList() {
  fetch('/api/admin/ads', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('adsContainer');
      container.innerHTML = '';

      if (data.ads.length === 0) {
        container.innerHTML = '<p>No ads created yet.</p>';
        return;
      }

      data.ads.forEach(ad => {
        const adDiv = document.createElement('div');
        adDiv.className = 'ad-item';
        adDiv.innerHTML = `
          <h4>${ad.title}</h4>
          <p><strong>Platform:</strong> ${ad.platform}</p>
          <p><strong>Description:</strong> ${ad.description || 'No description'}</p>
          <p><strong>Created:</strong> ${new Date(ad.createdAt).toLocaleDateString()}</p>
          <p><strong>Active:</strong> ${ad.isActive ? 'Yes' : 'No'}</p>
          <button class="toggle-ad-btn" data-ad-id="${ad.id}" data-active="${ad.isActive}">${ad.isActive ? 'Deactivate' : 'Activate'}</button>
          <button class="delete-ad-btn" data-ad-id="${ad.id}">Delete</button>
        `;
        container.appendChild(adDiv);

        // Add event listeners
        const toggleBtn = adDiv.querySelector('.toggle-ad-btn');
        toggleBtn.addEventListener('click', () => toggleAd(ad.id, ad.isActive));

        const deleteBtn = adDiv.querySelector('.delete-ad-btn');
        deleteBtn.addEventListener('click', () => deleteAd(ad.id));
      });
    });
}

function toggleAd(adId, currentlyActive) {
  const newActive = !currentlyActive;
  fetch(`/api/admin/ads/${adId}`, {
    method: 'PUT',
    ...getAuthFetchOptions({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: newActive }) })
  })
  .then(res => res.json())
  .then(result => {
    if (result.message) {
      loadAdsList();
    } else {
      alert(result.error);
    }
  });
}

function deleteAd(adId) {
  if (!confirm('Are you sure you want to delete this ad?')) return;

  fetch(`/api/admin/ads/${adId}`, getAuthFetchOptions({ method: 'DELETE' }))
    .then(res => res.json())
    .then(result => {
      if (result.message) {
        loadAdsList();
      } else {
        alert(result.error);
      }
    });
}

function showSection(sectionId) {
  // Hide all sections
  const sections = document.querySelectorAll('main > section');
  sections.forEach(section => {
    section.style.display = 'none';
  });

  // Show selected section
  const selectedSection = document.getElementById(sectionId);
  if (selectedSection) {
    selectedSection.style.display = 'block';
  }

  // Update active nav link
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
  });
  const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  // Load data for specific sections
  // Ad management removed
}

// Refresh withdrawals
document.getElementById('refreshWithdrawals').addEventListener('click', loadWithdrawals);

// Load WhatsApp number
function loadWhatsappNumber() {
  fetch('/api/admin/whatsapp', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      document.getElementById('currentWhatsapp').textContent = data.number;
    })
    .catch(error => {
      console.error('Error loading WhatsApp number:', error);
      document.getElementById('currentWhatsapp').textContent = 'Error loading';
    });
}

// Update WhatsApp number
function updateWhatsappNumber() {
  const number = document.getElementById('whatsappInput').value.trim();
  if (!number) {
    alert('Please enter a WhatsApp number');
    return;
  }

  fetch('/api/admin/whatsapp', {
    method: 'POST',
    ...getAuthFetchOptions({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number }) })
  })
  .then(res => res.json())
  .then(result => {
    const messageDiv = document.getElementById('whatsappMessage');
    if (result.message) {
      messageDiv.innerHTML = `<p style="color: green;">${result.message}</p>`;
      document.getElementById('whatsappInput').value = '';
      loadWhatsappNumber(); // Refresh the displayed number
    } else {
      messageDiv.innerHTML = `<p style="color: red;">${result.error}</p>`;
    }
  })
  .catch(error => {
    console.error('Error updating WhatsApp number:', error);
    document.getElementById('whatsappMessage').innerHTML = '<p style="color: red;">Error updating WhatsApp number</p>';
  });
}

// Event listener for update button
if (document.getElementById('updateWhatsappBtn')) {
  document.getElementById('updateWhatsappBtn').addEventListener('click', updateWhatsappNumber);
}

// Check admin role and show admin management if master
function checkAdminRole() {
  fetch('/api/admin/check-role', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      if (data.role === 'master') {
        document.getElementById('admin-management').style.display = 'block';
        loadAdmins();
      }
    })
    .catch(error => {
      console.error('Error checking admin role:', error);
    });
}

// Load admins list
function loadAdmins() {
  fetch('/api/admin/admins', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('adminsContainer');
      container.innerHTML = '';

      if (data.admins.length === 0) {
        container.innerHTML = '<p>No admins found.</p>';
        return;
      }

      data.admins.forEach(admin => {
        const adminDiv = document.createElement('div');
        adminDiv.className = 'admin-item';
        adminDiv.style.cssText = `
          background-color: #f8f9fa;
          padding: 1rem;
          margin-bottom: 0.5rem;
          border-radius: 10px;
          border: 1px solid #dee2e6;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        adminDiv.innerHTML = `
          <div>
            <strong>${admin.username}</strong> - ${admin.role}<br>
            <small>Created: ${new Date(admin.createdAt).toLocaleDateString()}</small>
          </div>
          ${admin.role !== 'master' ? `<button class="delete-admin-btn" data-admin-id="${admin._id}">Delete</button>` : ''}
        `;
        container.appendChild(adminDiv);

        // Add event listener for delete button
        const deleteBtn = adminDiv.querySelector('.delete-admin-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => deleteAdmin(admin._id));
        }
      });
    })
    .catch(error => {
      console.error('Error loading admins:', error);
    });
}

// Delete admin
function deleteAdmin(adminId) {
  if (!confirm('Are you sure you want to delete this admin?')) return;

  fetch(`/api/admin/admins/${adminId}`, getAuthFetchOptions({ method: 'DELETE' }))
    .then(res => res.json())
    .then(result => {
      if (result.message) {
        alert(result.message);
        loadAdmins();
      } else {
        alert(result.error);
      }
    })
    .catch(error => {
      console.error('Error deleting admin:', error);
      alert('Error deleting admin');
    });
}

// Add new admin
if (document.getElementById('addAdminBtn')) {
  document.getElementById('addAdminBtn').addEventListener('click', () => {
    const username = document.getElementById('newAdminUsername').value;
    const password = document.getElementById('newAdminPassword').value;
    const role = document.getElementById('newAdminRole').value;

    if (!username || !password) {
      alert('Please fill in all fields');
      return;
    }

    fetch('/api/admin/create-admin', {
      method: 'POST',
      ...getAuthFetchOptions({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role }) })
    })
    .then(res => res.json())
    .then(result => {
      const messageDiv = document.getElementById('addAdminMessage');
      if (result.message) {
        messageDiv.innerHTML = `<p style="color: green;">${result.message}</p>`;
        document.getElementById('newAdminUsername').value = '';
        document.getElementById('newAdminPassword').value = '';
        loadAdmins();
      } else {
        messageDiv.innerHTML = `<p style="color: red;">${result.error}</p>`;
      }
    })
    .catch(error => {
      console.error('Error adding admin:', error);
      document.getElementById('addAdminMessage').innerHTML = '<p style="color: red;">Error adding admin</p>';
    });
  });
}
