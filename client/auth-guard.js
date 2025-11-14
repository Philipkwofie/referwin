/**
 * Auth Guard for Admin Pages
 * This script should be included in the <head> of any admin HTML page that requires authentication.
 * It checks for a valid admin session and redirects to the login page if the session is not active.
 * It must be a blocking script (not async/defer) to prevent the page content from rendering before the check is complete.
 */
(async function() {
  const token = localStorage.getItem('adminToken');

  if (!token) {
    window.location.replace('admin-login.html');
    return;
  }

  try {
    const response = await fetch('/api/admin/session-check', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      // Use replace() to prevent the user from using the "back" button to return to the protected page.
      window.location.replace('admin-login.html');
    }
    // If the response is ok, the user is authenticated, and the script does nothing, allowing the page to load normally.
  } catch (error) {
    console.error('Authentication check failed, redirecting to login.', error);
    window.location.replace('admin-login.html');
  }
})();