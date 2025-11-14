document.addEventListener('DOMContentLoaded', () => {
  // The auth-guard.js script handles redirection.
  // If this code runs, the user is authenticated.
  // We can directly initialize the page functionality.
  initializeBroadcastPage();
});

// Individual message functionality
let selectedUser = null;

// Load users for individual messaging
function loadUsersForMessaging() {
  const token = localStorage.getItem('adminToken');
  fetch('/api/admin/all-users', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
      const userList = document.getElementById('messageUserList');
      userList.innerHTML = '';
      data.users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item-modern';
        userDiv.style.cssText = `
          background-color: #f8f9fa;
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 10px;
          border: 1px solid #dee2e6;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        userDiv.innerHTML = `
          <div>
            <strong style="color: #333;">${user.username}</strong><br>
            <small style="color: #666;">${user.isActivated ? 'Activated' : 'Not Activated'} • ${new Date(user.signupDate).toLocaleDateString()}</small>
          </div>
          <div style="font-size: 18px;">👤</div>
        `;
        userDiv.addEventListener('click', () => selectUserForMessage(user, userDiv));
        userList.appendChild(userDiv);
      });
    });
}

// Select user for message
function selectUserForMessage(user, element) {
  selectedUser = user;
  const userItems = document.querySelectorAll('.user-item-modern');
  userItems.forEach(item => {
    item.style.backgroundColor = '#f8f9fa';
    item.style.borderColor = '#dee2e6';
  });

  element.style.backgroundColor = '#e3f2fd';
  element.style.borderColor = '#2196f3';
}

// Filter users in search
document.getElementById('messageUserSearch').addEventListener('input', filterMessageUsers);

function filterMessageUsers() {
  const searchTerm = document.getElementById('messageUserSearch').value.toLowerCase();
  const userItems = document.querySelectorAll('.user-item-modern');

  userItems.forEach(item => {
    const username = item.querySelector('strong').textContent.toLowerCase();
    if (username.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Send individual message
document.getElementById('sendIndividualMessage').addEventListener('click', sendIndividualMessage);

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

  const token = localStorage.getItem('adminToken');
  fetch('/api/admin/send-individual-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ userId: selectedUser.id, message })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert('Message sent successfully');
      document.getElementById('individualMessage').value = '';
      selectedUser = null;
      const userItems = document.querySelectorAll('.user-item-modern');
      userItems.forEach(item => {
        item.style.backgroundColor = '#f8f9fa';
        item.style.borderColor = '#dee2e6';
      });
    } else {
      alert(result.error);
    }
  });
}

// Message management functionality
function loadMessageStats() {
  const token = localStorage.getItem('adminToken');
  fetch('/api/admin/message-stats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById('totalMessages').textContent = data.total;
      document.getElementById('recentMessagesCount').textContent = data.recent;
      document.getElementById('oldMessagesCount').textContent = data.old;
    });
}

function loadAllMessages() {
  const token = localStorage.getItem('adminToken');
  fetch('/api/admin/all-messages', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
      const messagesList = document.getElementById('messages');
      messagesList.innerHTML = '';
      data.notifications.forEach(notification => {
        const li = document.createElement('li');        
        li.style.cssText = `
          background: white;
          margin-bottom: 10px;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #e1e5e9;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        li.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <strong style="color: #333;">${notification.username}</strong>
            <small style="color: #666;">${notification.type} • ${new Date(notification.date).toLocaleString()}</small>
          </div>
          <div style="color: #555; line-height: 1.4;">${notification.message}</div>
        `;
        messagesList.appendChild(li);
      });
    });
}

// Toggle messages view
document.getElementById('toggleMessagesView').addEventListener('click', () => {
  const messagesListDiv = document.getElementById('messagesList');
  if (messagesListDiv.style.display === 'none') {
    loadAllMessages();
    messagesListDiv.style.display = 'block';
  } else {
    messagesListDiv.style.display = 'none';
  }
});

// Clear old messages
document.getElementById('clearOldMessagesBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all old messages? This action cannot be undone.')) {
    const token = localStorage.getItem('adminToken');
    fetch('/api/admin/clear-old-messages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(result => {
        alert(result.message);
        loadMessageStats();
      });
  }
});

function initializeBroadcastPage() {
  // Send broadcast notification
  document.getElementById('sendNotificationBtn').addEventListener('click', async () => {
    const message = document.getElementById('notificationMessage').value;
    if (!message) {
      alert('Please enter a message');
      return;
    }
    const token = localStorage.getItem('adminToken');
    const response = await fetch('/api/admin/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message })
    });
    const result = await response.json();
    if (response.ok) {
      alert('Notification sent to all users');
      document.getElementById('notificationMessage').value = '';
    } else {
      alert(result.error);
    }
  });

  loadUsersForMessaging();
  loadMessageStats();
}
