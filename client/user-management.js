document.addEventListener('DOMContentLoaded', () => {
  // The auth-guard.js script handles redirection.
  // If this code runs, the user is authenticated.
  const manageUsersBtn = document.getElementById('manageUsersBtn');
  if (manageUsersBtn) {
    manageUsersBtn.addEventListener('click', createUserManagementModal);
  }

  // User search functionality on the user-management page
  const searchBtn = document.getElementById('searchUsersBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchUsers);
  }
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearSearch);
  }
});

let userManagementModal = null;

// Helper function to create authenticated fetch options
function getAuthFetchOptions(options = {}) {
  const token = localStorage.getItem('adminToken');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  return { ...options, headers };
}

let messageModal = null;

// Create user management modal
function createUserManagementModal() {
  userManagementModal = document.createElement('div');
  userManagementModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;

  userManagementModal.innerHTML = `
    <div style="
      background-color: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <h3 style="margin-top: 0; color: #333;">User Management</h3>
      <input type="text" id="userSearch" placeholder="Search users..." style="
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e1e5e9;
        border-radius: 10px;
        font-size: 1rem;
        margin-bottom: 1rem;
      ">
      <div id="userList" style="max-height: 400px; overflow-y: auto;"></div>
      <button id="closeUserModal" style="
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background: linear-gradient(45deg, #dc3545, #c82333);
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
      ">Close</button>
    </div>
  `;

  document.body.appendChild(userManagementModal);

  // Load all users
  loadAllUsers();

  // Search functionality
  document.getElementById('userSearch').addEventListener('input', filterUsers);

  // Close modal
  document.getElementById('closeUserModal').addEventListener('click', () => {
    document.body.removeChild(userManagementModal);
    userManagementModal = null;
  });
}

// Create message modal
function createMessageModal() {
  messageModal = document.createElement('div');
  messageModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;

  messageModal.innerHTML = `
    <div style="
      background-color: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <h3 style="margin-top: 0; color: #333;">Send Individual Message</h3>
      <input type="text" id="messageUserSearch" placeholder="Search users..." style="
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e1e5e9;
        border-radius: 10px;
        font-size: 1rem;
        margin-bottom: 1rem;
      ">
      <div id="messageUserList" style="max-height: 300px; overflow-y: auto; margin-bottom: 1rem;"></div>
      <textarea id="individualMessage" placeholder="Enter your message..." style="
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e1e5e9;
        border-radius: 10px;
        font-size: 1rem;
        margin-bottom: 1rem;
        min-height: 100px;
      "></textarea>
      <div style="display: flex; gap: 1rem;">
        <button id="sendIndividualMessage" style="
          flex: 1;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(45deg, #28a745, #20c997);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
        ">Send Message</button>
        <button id="closeMessageModal" style="
          flex: 1;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(45deg, #dc3545, #c82333);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
        ">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(messageModal);

  // Load all users for messaging
  loadUsersForMessaging();

  // Search functionality
  document.getElementById('messageUserSearch').addEventListener('input', filterMessageUsers);

  // Send message
  document.getElementById('sendIndividualMessage').addEventListener('click', sendIndividualMessage);

  // Close modal
  document.getElementById('closeMessageModal').addEventListener('click', () => {
    document.body.removeChild(messageModal);
    messageModal = null;
  });
}

// Load all users for management
function loadAllUsers() {
  fetch('/api/admin/all-users', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const userList = document.getElementById('userList');
      userList.innerHTML = '';
      data.users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
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
            <strong>${user.username}</strong> - ${user.isActivated ? 'Activated' : 'Not Activated'}<br>
            <small>Signed up: ${new Date(user.signupDate).toLocaleDateString()}</small>
          </div>
          <button class="toggle-activation-btn" data-user-id="${user.id}" data-activated="${user.isActivated}" style="
            padding: 0.5rem 1rem;
            background: ${user.isActivated ? 'linear-gradient(45deg, #dc3545, #c82333)' : 'linear-gradient(45deg, #28a745, #20c997)'};
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
          ">${user.isActivated ? 'Deactivate' : 'Activate'}</button>
        `;
        userList.appendChild(userDiv);

        // Add event listener
        const toggleBtn = userDiv.querySelector('.toggle-activation-btn');
        toggleBtn.addEventListener('click', () => toggleUserActivation(user.id, user.isActivated));
      });
    });
}

// Load users for messaging
function loadUsersForMessaging() {
  fetch('/api/admin/all-users', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const userList = document.getElementById('messageUserList');
      userList.innerHTML = '';
      data.users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.style.cssText = `
          background-color: #f8f9fa;
          padding: 1rem;
          margin-bottom: 0.5rem;
          border-radius: 10px;
          border: 1px solid #dee2e6;
          cursor: pointer;
          transition: background-color 0.3s;
        `;
        userDiv.innerHTML = `
          <div>
            <strong>${user.username}</strong> - ${user.isActivated ? 'Activated' : 'Not Activated'}<br>
            <small>Signed up: ${new Date(user.signupDate).toLocaleDateString()}</small>
          </div>
        `;
        userDiv.addEventListener('click', (e) => selectUserForMessage(user, e.currentTarget));
        userList.appendChild(userDiv);
      });
    });
}

// Filter users in management modal
function filterUsers() {
  const searchTerm = document.getElementById('userSearch').value.toLowerCase();
  const userItems = document.querySelectorAll('#userList .user-item');

  userItems.forEach(item => {
    const username = item.querySelector('strong').textContent.toLowerCase();
    if (username.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// User search functionality
function searchUsers() {
  const searchTerm = document.getElementById('userSearchInput').value.toLowerCase().trim();
  if (!searchTerm) {
    alert('Please enter a search term');
    return;
  }

  fetch('/api/admin/all-users', getAuthFetchOptions())
    .then(res => res.json())
    .then(data => {
      const resultsDiv = document.getElementById('searchResults');
      resultsDiv.innerHTML = '';

      if (!data.users || data.users.length === 0) {
        resultsDiv.innerHTML = '<p>No users found.</p>';
        return;
      }

      const filteredUsers = data.users.filter(user =>
        user.username.toLowerCase().includes(searchTerm) ||
        (user.email && user.email.toLowerCase().includes(searchTerm)) ||
        (user.phone && user.phone.toLowerCase().includes(searchTerm))
      );

      if (filteredUsers.length === 0) {
        resultsDiv.innerHTML = '<p>No users found matching the search criteria.</p>';
        return;
      }

      filteredUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-search-result';
        userDiv.style.cssText = `
          background-color: var(--card-bg);
          padding: 1rem;
          margin-bottom: 0.5rem;
          border-radius: 10px;
          border: 1px solid var(--card-border);
          color: var(--text-color);
        `;
        userDiv.innerHTML = `
          <div>
            <strong>Username:</strong> ${user.username}<br>
            <strong>Email:</strong> ${user.email || 'N/A'}<br>
            <strong>Phone:</strong> ${user.phone || 'N/A'}<br>
            <strong>Status:</strong> ${user.isActivated ? 'Activated' : 'Not Activated'}<br>
            <strong>Earnings:</strong> GHS ${user.earnings}<br>
            <strong>Referred Users:</strong> ${user.referredUsers.length}<br>
            <strong>Signup Date:</strong> ${new Date(user.signupDate).toLocaleDateString()}
          </div>
          <div style="margin-top: 0.5rem;">
            <button class="toggle-activation-btn modern-btn ${user.isActivated ? 'danger-btn' : 'success-btn'}" data-user-id="${user.id}" data-activated="${user.isActivated}">
              ${user.isActivated ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        `;
        resultsDiv.appendChild(userDiv);

        // Add event listeners
        const toggleBtn = userDiv.querySelector('.toggle-activation-btn');
        toggleBtn.addEventListener('click', () => toggleUserActivation(user.id, user.isActivated));
      });
    })
    .catch(error => {
      console.error('Error searching users:', error);
      document.getElementById('searchResults').innerHTML = '<p style="color: red;">Error loading search results.</p>';
    });
}

function clearSearch() {
  document.getElementById('userSearchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}

// Filter users in message modal
function filterMessageUsers() {
  const searchTerm = document.getElementById('messageUserSearch').value.toLowerCase();
  const userItems = document.querySelectorAll('#messageUserList .user-item');

  userItems.forEach(item => {
    const username = item.querySelector('strong').textContent.toLowerCase();
    if (username.includes(searchTerm)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// Toggle user activation
function toggleUserActivation(userId, currentlyActivated) {
  const action = currentlyActivated ? 'deactivate' : 'activate';
  fetch(`/api/admin/${action}/${userId}`, getAuthFetchOptions({ method: 'POST' }))
    .then(res => res.json())
    .then(result => {
      alert(result.message);
      loadAllUsers();
    });
}

// Select user for message
let selectedUser = null;
function selectUserForMessage(user, element) {
  selectedUser = user;
  const userItems = document.querySelectorAll('#messageUserList .user-item');
  userItems.forEach(item => {
    item.style.backgroundColor = '#f8f9fa';
  });

  element.style.backgroundColor = '#e3f2fd';
}

// Send individual message
function sendIndividualMessage() {
  if (!selectedUser) {
    alert('Please select a user first');
    return;
  }

  const message = document.getElementById('individualMessage').value;
  if (!message) {
    alert('Please enter a message');
    return;
  }

  fetch('/api/admin/send-individual-notification', getAuthFetchOptions({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selectedUser.id, message }) }))
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert('Message sent successfully');
      document.getElementById('individualMessage').value = '';
      selectedUser = null;
      const userItems = document.querySelectorAll('#messageUserList .user-item');
      userItems.forEach(item => {
        item.style.backgroundColor = '#f8f9fa';
      });
    } else {
      alert(result.error);
    }
  });
}
