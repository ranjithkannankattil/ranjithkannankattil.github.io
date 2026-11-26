/* Radio page: questions and answers from radio-faq.json (the app's Help and FAQ reads the same file).
   Search, a link for every question (radio.html#faq-<id>), and English / Malayalam / Hindi. */
(function () {
  var list = document.getElementById('faqList'); if (!list) return;
  var search = document.getElementById('faqSearch');
  var data = null, lang = 'en';
  try { lang = localStorage.getItem('rv-faq-lang') || 'en'; } catch (e) {}
  var UI = {
    en: { title: 'Questions and answers', search: 'Search the questions', none: 'No question matches. Try another word, or write to hello@ranjithkb.com.', copy: 'Copy link', copied: 'Link copied',
      intro: "Radio Velvet is one person's hobby project, made in spare time, so a reply can take a few days. Every message to hello@ranjithkb.com is read." },
    ml: { title: 'ചോദ്യങ്ങളും ഉത്തരങ്ങളും', search: 'ചോദ്യങ്ങളിൽ തിരയുക', none: 'ഒരു ചോദ്യവും യോജിക്കുന്നില്ല. മറ്റൊരു വാക്ക് നോക്കൂ, അല്ലെങ്കിൽ hello@ranjithkb.com ലേക്ക് എഴുതൂ.', copy: 'ലിങ്ക് പകർത്തുക', copied: 'ലിങ്ക് പകർത്തി',
      intro: 'Radio Velvet ഒരാൾ ഒഴിവുസമയത്ത് ചെയ്യുന്ന ഹോബി പ്രോജക്ടാണ്; മറുപടിക്ക് കുറച്ച് ദിവസം എടുത്തേക്കാം. hello@ranjithkb.com ലേക്കുള്ള എല്ലാ സന്ദേശവും വായിക്കും.' },
    hi: { title: 'सवाल और जवाब', search: 'सवालों में खोजें', none: 'कोई सवाल नहीं मिला। दूसरा शब्द आज़माएँ, या hello@ranjithkb.com पर लिखें।', copy: 'लिंक कॉपी करें', copied: 'लिंक कॉपी हो गया',
      intro: 'Radio Velvet एक व्यक्ति का शौक़िया प्रोजेक्ट है, खाली समय में बना, इसलिए जवाब में कुछ दिन लग सकते हैं। hello@ranjithkb.com पर आया हर संदेश पढ़ा जाता है।' }
  };
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function inline(s) {
    return esc(s).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
      .replace(/hello@ranjithkb\.com/g, '<a href="mailto:hello@ranjithkb.com">hello@ranjithkb.com</a>');
  }
  function answer(a) {
    var out = '', inList = false;
    a.split('\n').forEach(function (line) {
      if (line.indexOf('1. ') === 0) { if (!inList) { out += '<ol>'; inList = true; } out += '<li>' + inline(line.slice(3)) + '</li>'; }
      else { if (inList) { out += '</ol>'; inList = false; } if (line) out += '<p>' + inline(line) + '</p>'; }
    });
    return out + (inList ? '</ol>' : '');
  }
  function tr(it) { return it[lang] || it.en; }
  function render() {
    if (!data) return;
    var u = UI[lang] || UI.en;
    document.getElementById('faqTitle').textContent = u.title;
    search.placeholder = u.search;
    var intro = document.querySelector('.faq-intro'); intro.innerHTML = inline(u.intro); intro.lang = lang;
    var words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var secs = (data.sections && data.sections[lang]) || {};
    var html = '', last = null, n = 0;
    data.items.forEach(function (it) {
      var t = tr(it), hay = (t.q + ' ' + t.a + ' ' + it.en.q + ' ' + it.en.a).toLowerCase();
      if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
      n++;
      if (it.section !== last) { html += '<h3 class="faq-sec">' + esc(secs[it.section] || it.section) + '</h3>'; last = it.section; }
      html += '<details class="faq-item" id="faq-' + it.id + '"' + (words.length && n <= 3 ? ' open' : '') + ' lang="' + lang + '">' +
        '<summary>' + esc(t.q) + '</summary><div class="faq-a">' + answer(t.a) +
        '<button type="button" class="faq-link" data-id="' + it.id + '">' + u.copy + '</button></div></details>';
    });
    list.innerHTML = n ? html : '<p class="faq-empty">' + esc(u.none) + '</p>';
    document.querySelectorAll('.faq-lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }
  function openHash() {
    var m = /^#faq-([a-z0-9-]+)$/.exec(location.hash); if (!m) return;
    var el = document.getElementById('faq-' + m[1]); if (!el) return;
    el.open = true; el.scrollIntoView({ block: 'start' });
  }
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.faq-link'); if (!b) return;
    var url = location.origin + location.pathname + '#faq-' + b.dataset.id, u = UI[lang] || UI.en;
    history.replaceState(null, '', '#faq-' + b.dataset.id);
    if (navigator.share && /Android|iPhone|iPad/.test(navigator.userAgent)) navigator.share({ url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { b.textContent = u.copied; setTimeout(function () { b.textContent = u.copy; }, 1800); });
  });
  document.querySelectorAll('.faq-lang button').forEach(function (b) {
    b.addEventListener('click', function () { lang = b.dataset.lang; try { localStorage.setItem('rv-faq-lang', lang); } catch (e) {} render(); });
  });
  search.addEventListener('input', render);
  window.addEventListener('hashchange', openHash);
  fetch('radio-faq.json?d=' + Math.floor(Date.now() / 3600000)).then(function (r) { return r.json(); })
    .then(function (j) { data = j; render(); openHash(); })
    .catch(function () { list.innerHTML = '<p class="faq-empty">Couldn\'t load the questions. Please reload the page.</p>'; });
})();
