/**
 * Common functionality for all admin pages.
 * This script handles theme toggling, logout, and the navigation menu.
 */
document.addEventListener('DOMContentLoaded', () => {
  // --- Theme Toggle ---
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const body = document.body;
    const img = themeToggle.querySelector('img');

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      body.classList.add('dark-mode');
      if (img) img.src = 'icons/dark_mode.png';
    } else {
      if (img) img.src = 'icons/light_mode.png';
    }

    // Toggle theme on click
    themeToggle.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      const isDark = body.classList.contains('dark-mode');
      if (img) img.src = isDark ? 'icons/dark_mode.png' : 'icons/light_mode.png';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  // --- Logout Button ---
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      localStorage.removeItem('adminToken');
      window.location.href = 'admin-login.html';
    });
  }

  // --- Navigation Menu ---
  const menuBtn = document.querySelector('.menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const navMenu = document.getElementById('navMenu');
      if (navMenu) {
        navMenu.classList.toggle('show');
      }
    });
  }

  // --- Close dropdown when clicking outside ---
  window.addEventListener('click', function(event) {
    const dropdown = document.querySelector('.dropdown');
    const navMenu = document.getElementById('navMenu');

    if (dropdown && navMenu && !dropdown.contains(event.target)) {
      navMenu.classList.remove('show');
    }
  });
});