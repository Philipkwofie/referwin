// Prevent loading if server is not running (for development preview)
if (window.location.protocol === 'file:') {
  document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;"><h1>Server Required</h1><p>Please start the server to preview the site.</p></div>';
  throw new Error('Server not running');
}

let fullReferralLink = null;

// Function to open WhatsApp for account activation
function openWhatsAppForActivation(username, activationFee) {
  fetch('/api/admin/whatsapp')
    .then(res => res.json())
    .then(whatsappData => {
      if (!whatsappData.number || whatsappData.number === 'Please set a number') {
        alert('Admin contact information is not set up yet. Please try again later.');
        return;
      }

      const message = encodeURIComponent(`Hello, I want to activate my account. My username is ${username}. Please provide payment options for GHS ${activationFee}.`);
      let whatsappUrl;
      if (whatsappData.number.startsWith('https://')) {
        whatsappUrl = whatsappData.number;
        if (!whatsappUrl.includes('?text=')) {
          whatsappUrl += (whatsappUrl.includes('?') ? '&' : '?') + 'text=' + message;
        }
      } else if (/^[A-Z0-9]+$/.test(whatsappData.number)) {
        whatsappUrl = `https://wa.me/message/${whatsappData.number}?text=${message}`;
      } else {
        const cleanNumber = whatsappData.number.replace(/\D/g, '');
        whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
      }
      window.open(whatsappUrl, '_blank');
    })
    .catch(error => {
      console.error('Error fetching WhatsApp number:', error);
      alert('Unable to contact admin. Please try again later.');
    });
}

// Signup form
if (document.getElementById('signupForm')) {
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const referralCode = document.getElementById('referralCode').value;

    if (password.length < 8 || password.length > 16) {
      alert('Password must be 8-16 characters long');
      return;
    }

    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, phone, referralCode })
    });

    const result = await response.json();
    if (response.ok) {
      alert('Signup successful! Your referral code: ' + result.referralCode);
      window.location.href = 'login.html';
    } else {
      alert(result.error);
    }
  });

  // Show/hide password
  document.getElementById('showPassword').addEventListener('change', (e) => {
    const passwordField = document.getElementById('password');
    passwordField.type = e.target.checked ? 'text' : 'password';
  });
}

// Login form
if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (response.ok) {
      localStorage.setItem('userId', result.user.id);
      window.location.href = 'dashboard.html';
    } else {
      alert(result.message);
    }
  });

  // Show/hide password
  document.getElementById('showPassword').addEventListener('change', (e) => {
    const passwordField = document.getElementById('password');
    passwordField.type = e.target.checked ? 'text' : 'password';
  });
}

// Inactivity timeout
let inactivityTimer;
const INACTIVITY_TIMEOUT = 4 * 60 * 1000; // 4 minutes

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    localStorage.removeItem('userId');
    alert('You have been logged out due to inactivity.');
    window.location.href = 'login.html';
  }, INACTIVITY_TIMEOUT);
}

function setupActivityListeners() {
  ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
  });
}

// Dashboard
if (window.location.pathname.endsWith('dashboard.html')) {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    window.location.href = 'login.html';
  } else {
    setupActivityListeners();
    resetInactivityTimer();

    fetch(`/api/dashboard/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.isActivated) {
          document.querySelector('main').innerHTML = `
            <section class="dashboard-card activation-prompt">
              <h2>Account Not Activated</h2>
              <p>Your account is not activated. To access the full site features, you need to pay GHS ${data.activationFee} to activate your account.</p>
              <p>Contact the admin via WhatsApp for payment options.</p>
              <button id="activateBtn" class="btn">Activate Now</button>
            </section>
          `;
          document.getElementById('activateBtn').addEventListener('click', () => {
            openWhatsAppForActivation(data.username, data.activationFee);
          });
          return;
        }

        document.getElementById('activationStatus').textContent = data.isActivated
          ? `Activated - You can now refer others!`
          : `Pending Activation - Pay GHS ${data.activationFee} to activate your account.`;

        document.getElementById('earnings').textContent = `Earnings: GHS ${parseFloat(data.earnings).toFixed(2)}`;
        document.getElementById('referred').textContent = `Referred Users: ${data.referredUsers}`;

        if (data.referralLink) {
          fullReferralLink = data.referralLink;
          const username = data.referralLink.split('ref=')[1];
          document.getElementById('referralLink').textContent = username;
          document.getElementById('copyLink').dataset.fullLink = data.referralLink;
        } else {
          document.getElementById('referralLink').textContent = 'Activate your account to get referral link';
          document.getElementById('copyLink').disabled = true;
        }

        // Display downlines (recent)
        const activatedList = document.getElementById('activatedList');
        const pendingList = document.getElementById('pendingList');

        activatedList.innerHTML = '';
        pendingList.innerHTML = '';

        const recentActivated = data.downlines.activated.slice(-5); // Show last 5
        const recentPending = data.downlines.pending.slice(-5);

        recentActivated.forEach(user => {
          const li = document.createElement('li');
          li.textContent = `${user.username} - Joined: ${new Date(user.signupDate).toLocaleDateString()}`;
          activatedList.appendChild(li);
        });

        recentPending.forEach(user => {
          const li = document.createElement('li');
          li.textContent = `${user.username} - Joined: ${new Date(user.signupDate).toLocaleDateString()}`;
          pendingList.appendChild(li);
        });

        if (recentActivated.length === 0) {
          activatedList.innerHTML = '<li>No activated downlines yet.</li>';
        }
        if (recentPending.length === 0) {
          pendingList.innerHTML = '<li>No pending downlines.</li>';
        }

        // Load withdrawal history (recent)
        fetch(`/api/withdrawals/${userId}`)
          .then(res => res.json())
          .then(withdrawalData => {
            const withdrawalList = document.getElementById('withdrawalList');
            withdrawalList.innerHTML = '';
            const recentWithdrawals = withdrawalData.withdrawals.slice(-5); // Show last 5
            recentWithdrawals.forEach(withdrawal => {
              const li = document.createElement('li');
              li.textContent = `GHS ${withdrawal.amount} - ${withdrawal.status} - ${new Date(withdrawal.date).toLocaleDateString()}`;
              withdrawalList.appendChild(li);
            });
            if (recentWithdrawals.length === 0) {
              withdrawalList.innerHTML = '<li>No withdrawal history.</li>';
            }
          });
      });
  }
}

// Account page
if (window.location.pathname.endsWith('account.html')) {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    window.location.href = 'login.html';
  } else {
    setupActivityListeners();
    resetInactivityTimer();

    fetch(`/api/dashboard/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.isActivated) {
          document.querySelector('main').innerHTML = `
            <section class="account-info">
              <h2>Account Not Activated</h2>
              <p>Your account is not activated. To access the full site features, you need to pay GHS ${data.activationFee} to activate your account.</p>
              <p>Contact the admin via WhatsApp for payment options.</p>
              <button id="activateBtn" class="btn">Activate Now</button>
            </section>
          `;
          document.getElementById('activateBtn').addEventListener('click', () => {
            openWhatsAppForActivation(data.username, data.activationFee);
          });
          return;
        }

        // Update profile avatar with first letter of username
        const avatar = document.getElementById('profileAvatar');
        const name = document.getElementById('profileName');
        if (avatar && name) {
          avatar.textContent = (data.username || 'U').charAt(0).toUpperCase();
          name.textContent = data.username || 'User';
        }

        document.getElementById('status').textContent = data.isActivated ? 'Activated' : 'Pending Activation';
        document.getElementById('signupDate').textContent = new Date(data.signupDate).toLocaleDateString();

        // Full withdrawal history
        fetch(`/api/withdrawals/${userId}`)
          .then(res => res.json())
          .then(withdrawalData => {
            const fullWithdrawalList = document.getElementById('fullWithdrawalList');
            fullWithdrawalList.innerHTML = '';
            withdrawalData.withdrawals.forEach(withdrawal => {
              const li = document.createElement('li');
              li.textContent = `GHS ${withdrawal.amount} - ${withdrawal.status} - ${new Date(withdrawal.date).toLocaleDateString()}`;
              fullWithdrawalList.appendChild(li);
            });
            if (withdrawalData.withdrawals.length === 0) {
              fullWithdrawalList.innerHTML = '<li>No withdrawal history.</li>';
            }
          });

        // Full downline history
        const fullActivatedList = document.getElementById('fullActivatedList');
        const fullPendingList = document.getElementById('fullPendingList');

        fullActivatedList.innerHTML = '';
        fullPendingList.innerHTML = '';

        data.downlines.activated.forEach(user => {
          const li = document.createElement('li');
          li.textContent = `${user.username} - Joined: ${new Date(user.signupDate).toLocaleDateString()}`;
          fullActivatedList.appendChild(li);
        });

        data.downlines.pending.forEach(user => {
          const li = document.createElement('li');
          li.textContent = `${user.username} - Joined: ${new Date(user.signupDate).toLocaleDateString()}`;
          fullPendingList.appendChild(li);
        });

        if (data.downlines.activated.length === 0) {
          fullActivatedList.innerHTML = '<li>No activated downlines yet.</li>';
        }
        if (data.downlines.pending.length === 0) {
          fullPendingList.innerHTML = '<li>No pending downlines.</li>';
        }
      });
  }
}

// Withdrawal request
if (document.getElementById('withdrawBtn')) {
  document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('withdrawalAmount').value);
    const userId = localStorage.getItem('userId');
    if (!amount || amount < 30) {
      alert('Minimum withdrawal is 30 Ghana Cedis');
      return;
    }
    const response = await fetch(`/api/withdraw/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    const result = await response.json();
    if (response.ok) {
      alert('Withdrawal request submitted successfully');
      location.reload(); // Refresh to update earnings
    } else {
      alert(result.error);
    }
  });
}

// View full withdrawal history
if (document.getElementById('viewFullWithdrawalHistory')) {
  document.getElementById('viewFullWithdrawalHistory').addEventListener('click', () => {
    window.location.href = 'account.html';
  });
}

// View full downline history
if (document.getElementById('viewFullDownlineHistory')) {
  document.getElementById('viewFullDownlineHistory').addEventListener('click', () => {
    window.location.href = 'account.html';
  });
}

// Copy referral link
if (document.getElementById('copyLink')) {
  document.getElementById('copyLink').addEventListener('click', () => {
    const link = fullReferralLink || document.getElementById('copyLink').dataset.fullLink;
    navigator.clipboard.writeText(link);
    alert('Link copied!');
  });
}

// Profile dropdown
if (document.getElementById('profileBtn')) {
  document.getElementById('profileBtn').addEventListener('click', () => {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  });
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const profileContainer = document.querySelector('.profile-container');
  const dropdown = document.getElementById('profileDropdown');
  if (profileContainer && dropdown && !profileContainer.contains(event.target)) {
    dropdown.style.display = 'none';
  }
});

// Logout link
if (document.getElementById('logoutLink')) {
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  });
}

// Logout button in dashboard header and account page
if (document.getElementById('logoutBtn')) {
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  });
}

// Change password button
if (document.getElementById('changePasswordBtn')) {
  document.getElementById('changePasswordBtn').addEventListener('click', async () => {
    const currentPassword = prompt('Enter your current password:');
    if (!currentPassword) return;

    const newPassword = prompt('Enter your new password (8-16 characters):');
    if (!newPassword || newPassword.length < 8 || newPassword.length > 16) {
      alert('Password must be 8-16 characters long');
      return;
    }

    const confirmPassword = prompt('Confirm your new password:');
    if (confirmPassword !== newPassword) {
      alert('Passwords do not match');
      return;
    }

    const userId = localStorage.getItem('userId');
    const response = await fetch(`/api/change-password/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const result = await response.json();
    if (response.ok) {
      alert('Password changed successfully');
    } else {
      alert(result.error);
    }
  });
}

// Toggle withdrawal history
if (document.getElementById('toggleWithdrawalHistory')) {
  document.getElementById('toggleWithdrawalHistory').addEventListener('click', () => {
    const list = document.getElementById('fullWithdrawalList');
    const button = document.getElementById('toggleWithdrawalHistory');
    if (list.style.display === 'none') {
      list.style.display = 'block';
      button.textContent = 'Hide Withdrawal History';
    } else {
      list.style.display = 'none';
      button.textContent = 'Show Withdrawal History';
    }
  });
}

// Toggle downline history
if (document.getElementById('toggleDownlineHistory')) {
  document.getElementById('toggleDownlineHistory').addEventListener('click', () => {
    const content = document.getElementById('fullDownlineContent');
    const button = document.getElementById('toggleDownlineHistory');
    if (content.style.display === 'none') {
      content.style.display = 'block';
      button.textContent = 'Hide Downline History';
    } else {
      content.style.display = 'none';
      button.textContent = 'Show Downline History';
    }
  });
}

// Profile link (placeholder)
if (document.getElementById('profileLink')) {
  document.getElementById('profileLink').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Profile page coming soon!');
  });
}

// Handle referral code from URL
const urlParams = new URLSearchParams(window.location.search);
const ref = urlParams.get('ref');
if (ref && document.getElementById('referralCode')) {
  document.getElementById('referralCode').value = ref;
}

// Theme toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const body = document.body;

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    const img = themeToggle.querySelector('img');
    if (savedTheme === 'dark') {
      body.classList.add('dark-mode');
      img.src = 'icons/dark_mode.png';
    } else {
      img.src = 'icons/light_mode.png';
    }

    // Toggle theme
    themeToggle.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      const isDark = body.classList.contains('dark-mode');
      img.src = isDark ? 'icons/dark_mode.png' : 'icons/light_mode.png';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }
});

// Menu toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.querySelector('.menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', toggleMenu);
  }
});

function toggleMenu() {
  document.getElementById("navMenu").classList.toggle("show");
}

// Close menu when clicking outside
window.onclick = function(event) {
  if (!event.target.matches('.menu-btn')) {
    const dropdowns = document.getElementsByClassName("dropdown-content");
    for (let i = 0; i < dropdowns.length; i++) {
      dropdowns[i].classList.remove('show');
    }
  }
}

// Navigation for user sections
const navLinks = document.querySelectorAll('.nav-link[data-section]');
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      // Internal section
      e.preventDefault();
      const sectionId = link.getAttribute('data-section');
      showSection(sectionId);
    }
    // External links will navigate normally without preventDefault
  });
});

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
}

// Window resize handler removed

// Notifications page
if (window.location.pathname.endsWith('notifications.html')) {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    window.location.href = 'login.html';
  } else {
    setupActivityListeners();
    resetInactivityTimer();

    fetch(`/api/dashboard/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.isActivated) {
          document.querySelector('main').innerHTML = `
            <section class="account-info">
              <h2>Account Not Activated</h2>
              <p>Your account is not activated. To access the full site features, you need to pay GHS ${data.activationFee} to activate your account.</p>
              <p>Contact the admin via WhatsApp for payment options.</p>
              <button id="activateBtn" class="btn">Activate Now</button>
            </section>
          `;
          document.getElementById('activateBtn').addEventListener('click', () => {
            openWhatsAppForActivation(data.username, data.activationFee);
          });
          return;
        }

        loadNotifications();
      });
  }
}

// Auto-refresh notifications every 30 seconds
setInterval(() => {
  if (window.location.pathname.includes('notifications.html')) {
    loadNotifications();
  }
  // Also check for new notifications on dashboard
  if (window.location.pathname.includes('dashboard.html')) {
    checkNewNotifications();
  }
}, 30 * 1000);

// Initialize notification checking on dashboard load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize notification checking on dashboard load
  if (window.location.pathname.includes('dashboard.html')) {
    checkNewNotifications();
  }
});

function loadNotifications(showRecent = false) {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    window.location.href = 'login.html';
    return;
  }

  fetch(`/api/notifications/${userId}`)
    .then(res => res.json())
    .then(data => {
      const notificationsList = document.getElementById('notifications');
      notificationsList.innerHTML = '';

      // Filter notifications for the current user (broadcast or specific to user)
      let userNotifications = data.notifications.filter(n => n.type === 'broadcast' || n.userId === userId);

      // Sort by date descending (most recent first)
      userNotifications.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (showRecent) {
        userNotifications = userNotifications.slice(0, 5); // Show only recent 5
      }

      if (userNotifications.length === 0) {
        notificationsList.innerHTML = '<div class="notification-item">No notifications yet.</div>';
        return;
      }

      userNotifications.forEach(notification => {
        const div = document.createElement('div');
        div.className = 'notification-item';
        const isPrivate = notification.type === 'individual';
        div.innerHTML = `
          <div class="notification-header">
            <span class="notification-sender">Admin sent a ${isPrivate ? 'private' : 'broadcast'} message</span>
          </div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${new Date(notification.date).toLocaleTimeString()}</div>
          <div class="notification-full-time" style="display: none;">${new Date(notification.date).toLocaleString()}</div>
        `;
        notificationsList.appendChild(div);

        // Add event listener for time toggle
        const timeElement = div.querySelector('.notification-time');
        timeElement.addEventListener('click', () => toggleTime(timeElement));
      });
    })
    .catch(error => console.error('Error loading notifications:', error));
}

// Check for new notifications and update badge
function checkNewNotifications() {
  const userId = localStorage.getItem('userId');
  if (!userId) return;

  fetch(`/api/notifications/${userId}`)
    .then(res => res.json())
    .then(data => {
      const userNotifications = data.notifications.filter(n => n.type === 'broadcast' || n.userId === userId);
      const unreadCount = userNotifications.filter(n => !n.read).length;

      const badge = document.getElementById('notification-badge');
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    })
    .catch(error => console.error('Error checking notifications:', error));
}

function toggleTime(timeElement) {
  const fullTimeElement = timeElement.nextElementSibling;
  if (fullTimeElement && fullTimeElement.classList.contains('notification-full-time')) {
    if (fullTimeElement.style.display === 'none' || fullTimeElement.style.display === '') {
      fullTimeElement.style.display = 'block';
    } else {
      fullTimeElement.style.display = 'none';
    }
  }
}

// Toggle recent notifications
if (document.getElementById('toggleRecent')) {
  document.getElementById('toggleRecent').addEventListener('click', () => {
    const btn = document.getElementById('toggleRecent');
    const showRecent = btn.textContent === 'Toggle Recent Notifications';
    loadNotifications(showRecent);
    btn.textContent = showRecent ? 'Show All Notifications' : 'Toggle Recent Notifications';
  });
}

// Highlight active nav item removed

// Ads page
if (window.location.pathname.endsWith('ads.html')) {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    window.location.href = 'login.html';
  } else {
    setupActivityListeners();
    resetInactivityTimer();

    fetch(`/api/dashboard/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.isActivated) {
          document.querySelector('main').innerHTML = `
            <section class="account-info">
              <h2>Account Not Activated</h2>
              <p>Your account is not activated. To access the full site features, you need to pay GHS ${data.activationFee} to activate your account.</p>
              <p>Contact the admin via WhatsApp for payment options.</p>
              <button id="activateBtn" class="btn">Activate Now</button>
            </section>
          `;
          document.getElementById('activateBtn').addEventListener('click', () => {
            fetch('/api/admin/whatsapp')
              .then(res => res.json())
              .then(whatsappData => {
                const whatsappNumber = whatsappData.number.replace(/\D/g, ''); // Remove non-digits
                const message = encodeURIComponent(`Hello, I want to activate my account. My username is ${data.username}. Please provide payment options for GHS ${data.activationFee}.`);
                const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
                window.open(whatsappUrl, '_blank');
              })
              .catch(error => {
                console.error('Error fetching WhatsApp number:', error);
                alert('Unable to contact admin. Please try again later.');
              });
          });
          return;
        }

        loadAds();
        loadTodaysLinkPost();
      });
  }
}

function loadAds() {
  fetch('/api/ads')
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('ads-container');
      container.innerHTML = '';

      // Filter to only show active ads
      const activeAds = data.ads.filter(ad => ad.isActive);

      activeAds.forEach(ad => {
        // Determine reward amount based on platform
        let rewardAmount;
        const platform = ad.platform.toLowerCase();
        if (platform === 'youtube') {
          rewardAmount = 0.2;
        } else if (platform === 'tiktok') {
          rewardAmount = 0.15;
        } else if (platform === 'instagram') {
          rewardAmount = 0.2;
        } else {
          rewardAmount = 0.15;
        }

        const adDiv = document.createElement('div');
        adDiv.className = 'ad-item';
        adDiv.innerHTML = `
          <h3>${ad.title}</h3>
          <p>${ad.description}</p>
          <div class="ad-video">
            ${getVideoEmbed(ad.videoUrl, ad.platform)}
          </div>
          <button class="watch-ad-btn" data-ad-id="${ad.id}">Watch & Earn GHS ${rewardAmount}</button>
        `;
        container.appendChild(adDiv);

        // Add event listener
        const watchBtn = adDiv.querySelector('.watch-ad-btn');
        watchBtn.addEventListener('click', () => watchAd(ad.id, rewardAmount));
      });
    })
    .catch(error => {
      console.error('Error loading ads:', error);
      document.getElementById('ads-container').innerHTML = '<p>Error loading ads. Please try again later.</p>';
    });
}

function getVideoEmbed(videoUrl, platform) {
  if (platform === 'youtube') {
    const videoId = extractYouTubeId(videoUrl);
    return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
  } else if (platform === 'tiktok') {
    return `<iframe src="${videoUrl}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else if (platform === 'instagram') {
    return `<iframe src="${videoUrl}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else {
    return `<video controls width="560" height="315"><source src="${videoUrl}" type="video/mp4"></video>`;
  }
}

function extractYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length == 11) ? match[2] : null;
}

function watchAd(adId, rewardAmount) {
  // Get current user
  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('Please log in to watch ads');
    window.location.href = 'login.html';
    return;
  }

  const btn = document.querySelector(`[data-ad-id="${adId}"]`);
  btn.disabled = true;
  let countdown = 30;
  btn.textContent = `Watching... ${countdown}s`;

  const timer = setInterval(() => {
    countdown--;
    btn.textContent = `Watching... ${countdown}s`;
    if (countdown <= 0) {
      clearInterval(timer);

      // Update user earnings server-side after 10 seconds
      fetch(`/api/user/earn-ad/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId })
      })
      .then(res => res.json())
      .then(result => {
        if (result.message) {
          alert(`Ad watched! You earned GHS ${rewardAmount}!`);
          // Refresh dashboard if on dashboard page
          if (window.location.pathname.includes('dashboard.html')) {
            location.reload(); // Refresh to update earnings
          }
        } else {
          alert(result.error);
        }
      })
      .catch(error => {
        console.error('Error earning from ad:', error);
        alert('Error processing earnings. Please try again.');
      });

      // Disable button for additional 30 seconds cooldown
      btn.textContent = 'Watched!';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = `Watch & Earn GHS ${rewardAmount}`;
      }, 30000); // 30 seconds cooldown
    }
  }, 1000);
}

// Load today's link post
function loadTodaysLinkPost() {
  const userId = localStorage.getItem('userId');
  fetch('/api/linkposts/today')
    .then(res => res.json())
    .then(data => {
      const linkPostContainer = document.getElementById('linkPostContainer');
      if (data.linkPost) {
        // Determine reward amount based on platform
        let rewardAmount = 0.05; // Default
        const platform = data.linkPost.platform.toLowerCase();
        if (platform === 'youtube') {
          rewardAmount = 0.06;
        } else if (platform === 'tiktok') {
          rewardAmount = 0.03;
        } else if (platform === 'instagram') {
          rewardAmount = 0.02;
        } else if (platform === 'facebook') {
          rewardAmount = 0.04;
        } else if (platform === 'twitter') {
          rewardAmount = 0.01;
        }

        let buttonHtml = `<button id="viewLinkBtn" class="view-link-btn" disabled>Already Viewed Today</button>`;
        let buttonDisabled = true;

        // Check if user has already viewed the link today
        if (userId) {
          fetch(`/api/dashboard/${userId}`)
            .then(res => res.json())
            .then(dashboardData => {
              const today = new Date().toISOString().split('T')[0];
              const lastViewDate = dashboardData.lastLinkViewDate ? dashboardData.lastLinkViewDate.split('T')[0] : null;
              if (lastViewDate !== today) {
                buttonHtml = `<button id="viewLinkBtn" class="view-link-btn">View Link & Earn GHS ${rewardAmount}</button>`;
                buttonDisabled = false;
              }
              updateLinkPostHtml(linkPostContainer, data.linkPost, rewardAmount, buttonHtml, buttonDisabled);
            })
            .catch(error => {
              console.error('Error checking link view status:', error);
              updateLinkPostHtml(linkPostContainer, data.linkPost, rewardAmount, buttonHtml, buttonDisabled);
            });
        } else {
          buttonHtml = `<button id="viewLinkBtn" class="view-link-btn">View Link & Earn GHS ${rewardAmount}</button>`;
          buttonDisabled = false;
          updateLinkPostHtml(linkPostContainer, data.linkPost, rewardAmount, buttonHtml, buttonDisabled);
        }
      } else {
        linkPostContainer.innerHTML = '<section class="dashboard-card"><div class="card-icon">🔗</div><h2>Today\'s Ad Link</h2><p>No link post available for today.</p></section>';
      }
    })
    .catch(error => {
      console.error('Error loading today\'s link post:', error);
      document.getElementById('linkPostContainer').innerHTML = '<section class="dashboard-card"><div class="card-icon">🔗</div><h2>Today\'s Ad Link</h2><p>Error loading link post.</p></section>';
    });
}

function updateLinkPostHtml(container, linkPost, rewardAmount, buttonHtml, buttonDisabled) {
  // First, fetch link preview
  fetch(`/api/link-preview?url=${encodeURIComponent(linkPost.link)}`)
    .then(res => res.json())
    .then(preview => {
      const previewHtml = preview.title ? `
        <div class="link-preview">
          ${preview.image ? `<img src="${preview.image}" alt="Preview" class="preview-image" onerror="this.style.display='none'">` : ''}
          <div class="preview-content">
            <h4 class="preview-title">${preview.title}</h4>
            ${preview.description ? `<p class="preview-description">${preview.description}</p>` : ''}
            ${preview.siteName ? `<small class="preview-site">${preview.siteName}</small>` : ''}
          </div>
        </div>
      ` : '';

      container.innerHTML = `
        <section class="dashboard-card">
          <div class="card-icon">🔗</div>
          <h2>Today's Ad Link</h2>
          ${previewHtml}
          <p><strong>Link:</strong> <a href="${linkPost.link}" target="_blank" rel="noopener noreferrer">${linkPost.link}</a></p>
          <p><em>Posted for ${linkPost.day}</em></p>
          ${buttonHtml}
        </section>
      `;

      // Add event listener for the view link button if not disabled
      if (!buttonDisabled) {
        document.getElementById('viewLinkBtn').addEventListener('click', () => viewLink(linkPost.link));
      }
    })
    .catch(error => {
      console.error('Error fetching link preview:', error);
      // Fallback to original display without preview
      container.innerHTML = `
        <section class="dashboard-card">
          <div class="card-icon">🔗</div>
          <h2>Today's Ad Link</h2>
          <p><strong>Link:</strong> <a href="${linkPost.link}" target="_blank" rel="noopener noreferrer">${linkPost.link}</a></p>
          <p><em>Posted for ${linkPost.day}</em></p>
          ${buttonHtml}
        </section>
      `;

      // Add event listener for the view link button if not disabled
      if (!buttonDisabled) {
        document.getElementById('viewLinkBtn').addEventListener('click', () => viewLink(linkPost.link));
      }
    });
}

// View link function with timer
function viewLink(linkUrl) {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('Please log in to view links');
    window.location.href = 'login.html';
    return;
  }

  // Open link in new tab/window
  window.open(linkUrl, '_blank');

  // Start 30-second timer for reward
  let countdown = 30;
  const timerDisplay = document.createElement('div');
  timerDisplay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 16px;
    font-weight: bold;
    z-index: 10000;
  `;
  timerDisplay.textContent = `Viewing link... ${countdown} seconds remaining to earn reward`;
  document.body.appendChild(timerDisplay);

  const timer = setInterval(() => {
    countdown--;
    timerDisplay.textContent = `Viewing link... ${countdown} seconds remaining to earn reward`;

    if (countdown <= 0) {
      clearInterval(timer);
      timerDisplay.textContent = 'Reward earned!';
      timerDisplay.style.backgroundColor = 'rgba(40, 167, 69, 0.8)';

      // Remove timer display after 3 seconds
      setTimeout(() => {
        if (timerDisplay.parentNode) {
          document.body.removeChild(timerDisplay);
        }
      }, 3000);

      // Reward the user
      fetch(`/api/user/earn-link/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(res => res.json())
      .then(result => {
        if (result.message) {
          alert(`Link viewed! You earned GHS ${result.earned}!`);
          // Disable the button until next day
          const viewBtn = document.getElementById('viewLinkBtn');
          if (viewBtn) {
            viewBtn.disabled = true;
            viewBtn.textContent = 'Already Viewed Today';
          }
          // Refresh dashboard if on dashboard page
          if (window.location.pathname.includes('dashboard.html')) {
            location.reload(); // Refresh to update earnings
          }
        } else {
          alert(result.error);
        }
      })
      .catch(error => {
        console.error('Error earning from link:', error);
        alert('Error processing earnings. Please try again.');
      });
    }
  }, 1000);
}
