document.addEventListener('DOMContentLoaded', function() {
  // The auth-guard.js script handles redirection.
  // If this code runs, the user is authenticated.
  // We can directly load the page content.
  loadLinkPosts();

  // Create link post button
  document.getElementById('createAdPostBtn').addEventListener('click', createLinkPost);

  // Handle link post actions (edit, delete, manual post)
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('edit-link-post')) {
      editLinkPost(e.target.dataset.id);
    } else if (e.target.classList.contains('delete-link-post')) {
      deleteLinkPost(e.target.dataset.id);
    } else if (e.target.classList.contains('manual-post')) {
      manualPost(e.target.dataset.id);
    }
  });
});

async function loadLinkPosts() {
  try {
    const token = localStorage.getItem('adminToken');
    const response = await fetch('/api/admin/linkposts', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();

    const container = document.getElementById('adPostsContainer');
    container.innerHTML = '';

    if (data.linkPosts.length === 0) {
      container.innerHTML = '<p>No link posts found.</p>';
      return;
    }

    data.linkPosts.forEach(linkPost => {
      const postElement = createLinkPostElement(linkPost);
      container.appendChild(postElement);
    });
  } catch (error) {
    console.error('Error loading link posts:', error);
    showMessage('Error loading link posts', 'error');
  }
}

function createLinkPostElement(linkPost) {
  const div = document.createElement('div');
  div.className = 'link-post-item';
  div.style.cssText = `
    border: 1px solid #e1e5e9;
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 15px;
    background: #f8f9fa;
  `;

  const dayName = linkPost.day.charAt(0).toUpperCase() + linkPost.day.slice(1);
  const status = linkPost.posted ? 'Posted' : (linkPost.autoPost ? 'Auto-Post Enabled' : 'Manual Post Pending');
  const statusColor = linkPost.posted ? '#28a745' : (linkPost.autoPost ? '#007bff' : '#ffc107');

  const platformName = linkPost.platform.charAt(0).toUpperCase() + linkPost.platform.slice(1);

  div.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 style="margin: 0; color: #333;">${dayName} Link Post</h3>
      <span style="color: ${statusColor}; font-weight: bold;">${status}</span>
    </div>
    <p style="margin: 5px 0; word-break: break-all;"><strong>Platform:</strong> ${platformName}</p>
    <p style="margin: 5px 0; word-break: break-all;"><strong>Link:</strong> <a href="${linkPost.link}" target="_blank">${linkPost.link}</a></p>
    <p style="margin: 5px 0;"><strong>Auto-Post:</strong> ${linkPost.autoPost ? 'Yes' : 'No'}</p>
    <p style="margin: 5px 0;"><strong>Created:</strong> ${new Date(linkPost.createdAt).toLocaleString()}</p>
    ${linkPost.postedAt ? `<p style="margin: 5px 0;"><strong>Posted At:</strong> ${new Date(linkPost.postedAt).toLocaleString()}</p>` : ''}
    <div style="margin-top: 10px;">
      <button class="modern-btn secondary-btn edit-link-post" data-id="${linkPost.id}" style="margin-right: 10px;">Edit</button>
      <button class="modern-btn danger-btn delete-link-post" data-id="${linkPost.id}" style="margin-right: 10px;">Delete</button>
      ${!linkPost.posted ? `<button class="modern-btn primary-btn manual-post" data-id="${linkPost.id}">Post Now</button>` : ''}
    </div>
  `;

  return div;
}

async function createLinkPost() {
  const day = document.getElementById('adDay').value;
  const platform = document.getElementById('adPlatform').value;
  const link = document.getElementById('adUrl').value.trim();
  const autoPost = document.getElementById('autoPost').checked;

  if (!link) {
    showMessage('Please enter a link URL', 'error');
    return;
  }

  try {
    const token = localStorage.getItem('adminToken');
    const response = await fetch('/api/admin/linkposts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ day, platform, link, autoPost }),
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(data.message, 'success');
      document.getElementById('adUrl').value = '';
      loadLinkPosts();
    } else {
      showMessage(data.error, 'error');
    }
  } catch (error) {
    console.error('Error creating link post:', error);
    showMessage('Error creating link post', 'error');
  }
}

async function editLinkPost(id) {
  // For simplicity, we'll use prompt. In a real app, you'd show a modal
  const newLink = prompt('Enter new link URL:');
  if (!newLink) return;

  const autoPostStr = prompt('Enable auto-post? (yes/no):');
  const autoPost = autoPostStr && autoPostStr.toLowerCase() === 'yes';

  try {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`/api/admin/linkposts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ link: newLink, autoPost }),
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(data.message, 'success');
      loadLinkPosts();
    } else {
      showMessage(data.error, 'error');
    }
  } catch (error) {
    console.error('Error updating link post:', error);
    showMessage('Error updating link post', 'error');
  }
}

async function deleteLinkPost(id) {
  if (!confirm('Are you sure you want to delete this link post?')) return;

  try {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`/api/admin/linkposts/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(data.message, 'success');
      loadLinkPosts();
    } else {
      showMessage(data.error, 'error');
    }
  } catch (error) {
    console.error('Error deleting link post:', error);
    showMessage('Error deleting link post', 'error');
  }
}

async function manualPost(id) {
  if (!confirm('Are you sure you want to post this link now?')) return;

  try {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(`/api/admin/linkposts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ posted: true }),
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('Link posted successfully', 'success');
      loadLinkPosts();
    } else {
      showMessage(data.error, 'error');
    }
  } catch (error) {
    console.error('Error posting link:', error);
    showMessage('Error posting link', 'error');
  }
}

function showMessage(message, type) {
  // Simple message display - you can enhance this
  alert(message);
}
