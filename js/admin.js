(function(){
  const OWNER = 'ranjithkannankattil';
  const REPO  = 'ranjithkannankattil.github.io';
  const BRANCH = 'main';
  const POSTS_PATH = 'js/posts.js';
  const FEED_PATH  = 'feed.xml';
  const API = 'https://api.github.com';

  const form       = document.getElementById('post-form');
  const statusEl   = document.getElementById('admin-status');
  const btn        = document.getElementById('publish-btn');
  const newBtn     = document.getElementById('new-post-btn');
  const tokenEl    = document.getElementById('gh-token');
  const rememberEl = document.getElementById('remember-token');
  const dateEl     = document.getElementById('post-date');
  const searchEl   = document.getElementById('post-search');
  const selectEl   = document.getElementById('existing-post');
  const editingIndicator = document.getElementById('editing-indicator');

  const titleMlEl = document.getElementById('title-ml');
  const titleEnEl = document.getElementById('title-en');
  const tagsEl    = document.getElementById('post-tags');
  const bodyEl    = document.getElementById('post-body');
  const urlEl     = document.getElementById('post-url');

  let editingSlug = null; // null = writing a new post

  // Pre-fill today's date
  dateEl.value = new Date().toISOString().slice(0, 10);

  // Restore a remembered token, if any
  const savedToken = localStorage.getItem('gh_token');
  if (savedToken){ tokenEl.value = savedToken; rememberEl.checked = true; }

  function setStatus(msg, kind){
    statusEl.textContent = msg;
    statusEl.className = 'admin-status' + (kind ? ' ' + kind : '');
  }

  // --- UTF-8 safe base64 helpers (GitHub Contents API requires base64) ---
  function utf8ToB64(str){
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64ToUtf8(str){
    return decodeURIComponent(escape(atob(str)));
  }

  function slugify(str){
    return (str || '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function makeSlug(date, titleEn){
    const base = titleEn ? slugify(titleEn) : 'post';
    const rand = Math.random().toString(36).slice(2, 6);
    return `${date}-${base || 'post'}-${rand}`;
  }

  // --- Existing-post picker (uses the POSTS array already loaded via js/posts.js) ---
  const allPosts = (typeof POSTS !== 'undefined') ? POSTS : [];
  const sortedForPicker = [...allPosts].sort((a,b) => b.date.localeCompare(a.date));

  function renderPicker(filterText){
    const q = (filterText || '').trim().toLowerCase();
    const filtered = q
      ? sortedForPicker.filter(p =>
          (p.title_ml||'').toLowerCase().includes(q) ||
          (p.title_en||'').toLowerCase().includes(q) ||
          (p.tags||[]).join(' ').toLowerCase().includes(q))
      : sortedForPicker;
    selectEl.innerHTML = '<option value="">— New post —</option>' +
      filtered.slice(0, 200).map(p =>
        `<option value="${p.slug}">${p.date} — ${p.title_ml}${p.title_en ? ' — ' + p.title_en : ''}</option>`
      ).join('');
  }
  renderPicker('');
  searchEl.addEventListener('input', () => renderPicker(searchEl.value));

  function loadPostIntoForm(post){
    editingSlug = post.slug;
    titleMlEl.value = post.title_ml || '';
    titleEnEl.value = post.title_en || '';
    dateEl.value = post.date || '';
    tagsEl.value = (post.tags || []).join(', ');
    bodyEl.value = (post.body || []).join('\n\n');
    urlEl.value = post.source_url || '';
    editingIndicator.textContent = `Editing existing post (slug: ${post.slug}). Publishing will overwrite it in place.`;
    btn.textContent = 'Save changes to GitHub';
  }

  function resetForm(){
    editingSlug = null;
    form.reset();
    dateEl.value = new Date().toISOString().slice(0, 10);
    selectEl.value = '';
    editingIndicator.textContent = '';
    btn.textContent = 'Publish to GitHub';
  }

  selectEl.addEventListener('change', () => {
    if (!selectEl.value){ resetForm(); return; }
    const post = allPosts.find(p => p.slug === selectEl.value);
    if (post) loadPostIntoForm(post);
  });

  newBtn.addEventListener('click', resetForm);

  async function ghGet(path){
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, {
      headers: {
        'Authorization': `Bearer ${tokenEl.value.trim()}`,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (!res.ok){
      const body = await res.text();
      throw new Error(`GET ${path} failed (${res.status}): ${body.slice(0,200)}`);
    }
    return res.json();
  }

  async function ghPut(path, contentStr, sha, message){
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokenEl.value.trim()}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: utf8ToB64(contentStr),
        sha,
        branch: BRANCH
      })
    });
    if (!res.ok){
      const body = await res.text();
      throw new Error(`PUT ${path} failed (${res.status}): ${body.slice(0,300)}`);
    }
    return res.json();
  }

  function parsePostsArray(fileText){
    const start = fileText.indexOf('[');
    const end   = fileText.lastIndexOf(']');
    const prefix = fileText.slice(0, start);
    const posts = JSON.parse(fileText.slice(start, end + 1));
    return { prefix, posts };
  }

  function serializePostsArray(prefix, posts){
    return prefix + JSON.stringify(posts, null, 1) + ';\n';
  }

  function buildFeed(posts){
    const sorted = [...posts].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 50);
    const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const items = sorted.map(p => {
      const title = p.title_ml + (p.title_en ? ` — ${p.title_en}` : '');
      const link = `https://ranjithkb.com/writing-post.html?slug=${p.slug}`;
      const d = new Date(p.date + 'T00:00:00Z');
      const pubDate = d.toUTCString().replace('GMT','+0000');
      const cats = (p.tags||[]).map(t => `<category>${esc(t)}</category>`).join('');
      return `  <item>\n    <title>${esc(title)}</title>\n    <link>${link}</link>\n    <guid isPermaLink="false">${esc(p.slug)}</guid>\n    <pubDate>${pubDate}</pubDate>\n    ${cats}\n  </item>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>Ranjith — Writings</title>\n  <link>https://ranjithkb.com/writings.html</link>\n  <description>Malayalam prose and poetry.</description>\n  <language>ml</language>\n${items}\n</channel>\n</rss>\n`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = tokenEl.value.trim();
    if (!token){ setStatus('Paste your GitHub token first.', 'error'); return; }

    if (rememberEl.checked){ localStorage.setItem('gh_token', token); }
    else { localStorage.removeItem('gh_token'); }

    const titleMl = titleMlEl.value.trim();
    const titleEn = titleEnEl.value.trim();
    const date    = dateEl.value;
    const tags    = tagsEl.value.split(',').map(s=>s.trim()).filter(Boolean);
    const bodyRaw = bodyEl.value;
    const body    = bodyRaw.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
    const sourceUrl = urlEl.value.trim();

    if (!titleMl || !date || body.length === 0){
      setStatus('Title, date and body are required.', 'error');
      return;
    }

    const isEdit = !!editingSlug;

    btn.disabled = true;
    try {
      setStatus('Fetching current posts.js…');
      const postsFile = await ghGet(POSTS_PATH);
      const postsText = b64ToUtf8(postsFile.content.replace(/\n/g, ''));
      const { prefix, posts } = parsePostsArray(postsText);

      let finalSlug;
      if (isEdit){
        const idx = posts.findIndex(p => p.slug === editingSlug);
        if (idx === -1){
          throw new Error(`Post with slug "${editingSlug}" not found on GitHub — it may have been edited elsewhere since you loaded it. Refresh and try again.`);
        }
        finalSlug = editingSlug;
        posts[idx] = {
          ...posts[idx],
          title_ml: titleMl, title_en: titleEn, date, tags, body, source_url: sourceUrl
        };
      } else {
        finalSlug = makeSlug(date, titleEn);
        posts.push({
          slug: finalSlug, title_ml: titleMl, title_en: titleEn, date,
          source: 'original', blog: 'കാട്ടുവിതകൾ', tags, body, source_url: sourceUrl
        });
      }

      const newPostsText = serializePostsArray(prefix, posts);

      setStatus(isEdit ? 'Committing edit…' : 'Committing new post…');
      await ghPut(POSTS_PATH, newPostsText, postsFile.sha, `${isEdit ? 'Edit' : 'Add'} post: ${titleMl}`);

      setStatus('Updating feed.xml…');
      try {
        const feedFile = await ghGet(FEED_PATH);
        const newFeed = buildFeed(posts);
        await ghPut(FEED_PATH, newFeed, feedFile.sha, `Update feed for: ${titleMl}`);
      } catch (feedErr){
        console.warn('Feed update failed (post itself is fine):', feedErr);
      }

      setStatus(`${isEdit ? 'Saved' : 'Published'}. Live at ranjithkb.com/writing-post.html?slug=${finalSlug} once GitHub Pages rebuilds (~1 min).`, 'ok');
      resetForm();
    } catch (err){
      console.error(err);
      setStatus('Failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
})();

