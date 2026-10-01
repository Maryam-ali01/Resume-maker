/* ==========================================================================
   INKFOLIO — resume builder logic
   ========================================================================== */

(function () {
  const STORAGE_KEY = 'inkfolio-resume-v1';
  let saveTimer = null;

  const state = {
    fullName: '', jobTitle: '', email: '', phone: '', location: '', website: '',
    summary: '', photo: '', template: 'classic', accent: '#C08A2E',
    fontDisplay: "'Fraunces', serif", fontBody: "'Work Sans', sans-serif",
    experience: [], education: [], skills: []
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------------- init from storage / query ---------------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (e) { /* ignore corrupt/blocked storage */ }

    const params = new URLSearchParams(location.search);
    const qTemplate = params.get('template');
    if (qTemplate && ['classic', 'modern', 'minimal', 'portrait'].includes(qTemplate)) {
      state.template = qTemplate;
    }
    if (!state.experience.length) {
      state.experience.push({ id: uid(), role: '', company: '', dates: '', location: '', desc: '' });
    }
    if (!state.education.length) {
      state.education.push({ id: uid(), degree: '', school: '', dates: '', notes: '' });
    }
  }

  function persist() {
    const tag = $('#autosaveTag');
    if (tag) { tag.textContent = 'Saving…'; tag.style.opacity = '.6'; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      let ok = true;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch (e) { ok = false; }
      if (tag) {
        tag.textContent = ok ? 'Saved' : 'Not saved'; tag.style.opacity = '1';
        tag.classList.remove('pulse'); void tag.offsetWidth; tag.classList.add('pulse');
      }
    }, 350);
    updateProgress();
  }

  /* ---------------- toast notifications ---------------- */
  function toast(message) {
    const host = $('#toastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    }, 2600);
  }

  /* ---------------- progress + section dots ---------------- */
  function updateProgress() {
    const personalDone = !!(state.fullName && state.jobTitle);
    const expDone = state.experience.some(x => x.role || x.company);
    const eduDone = state.education.some(x => x.degree || x.school);
    const skillsDone = state.skills.length > 0;

    const dots = { personal: personalDone, experience: expDone, education: eduDone, skills: skillsDone };
    Object.entries(dots).forEach(([key, done]) => {
      const dot = $(`.tab-dot[data-dot="${key}"]`);
      if (dot) dot.classList.toggle('filled', done);
    });

    const weights = [personalDone, expDone, eduDone, skillsDone, !!state.photo];
    const pct = Math.round((weights.filter(Boolean).length / weights.length) * 100);
    const fill = $('#progressFill');
    if (fill) fill.style.width = pct + '%';

    const hint = $('#helperHint');
    if (hint) {
      if (pct >= 100) hint.textContent = "Looking good — your resume is fully filled in. Hit Export / Print when you're ready.";
      else if (!personalDone) hint.textContent = 'Tip: fill in your name and role first — everything else on the preview builds around it.';
      else if (!expDone) hint.textContent = 'Tip: add at least one role under Experience to strengthen your resume.';
      else if (!state.photo) hint.textContent = 'Tip: adding a photo works best with the Portrait or Modern Sidebar layout.';
      else hint.textContent = "Almost there — check Skills and Education, then you're done.";
    }
  }

  /* ---------------- tabs ---------------- */
  function initTabs() {
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        $$('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
      });
    });
  }

  /* ---------------- simple fields ---------------- */
  function initSimpleFields() {
    const map = {
      fullName: '#fullName', jobTitle: '#jobTitle', email: '#email', phone: '#phone',
      location: '#location', website: '#website', summary: '#summary'
    };
    Object.entries(map).forEach(([key, sel]) => {
      const el = $(sel);
      el.value = state[key];
      el.addEventListener('input', () => { state[key] = el.value; renderPreview(); persist(); });
    });
  }

  /* ---------------- photo upload ---------------- */
  // Downscale before storing: raw phone photos are several MB and would
  // blow the localStorage quota (autosave would silently fail).
  function resizeImage(file, maxSide, cb) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // PNG transparency -> white
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => toast('Could not read that image — try a JPG or PNG');
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function initPhoto() {
    const drop = $('#photoDrop');
    const input = $('#photoInput');
    const img = $('#photoPreviewImg');
    const text = $('#photoDropText');
    const removeBtn = $('#photoRemove');
    const slot = $('#rPhotoSlot');

    function showPhoto(dataUrl) {
      img.src = dataUrl; img.style.display = 'block';
      text.style.display = 'none';
      removeBtn.style.display = 'inline';
    }
    function setPhoto(dataUrl) {
      state.photo = dataUrl;
      showPhoto(dataUrl);
      renderPreview(); persist();
      toast('Photo added to your resume');
    }
    function clearPhoto() {
      state.photo = '';
      img.style.display = 'none'; img.removeAttribute('src');
      text.style.display = 'block';
      removeBtn.style.display = 'none';
      input.value = '';                       // lets the same file be picked again
      renderPreview(); persist();
    }
    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      resizeImage(file, 700, setPhoto);
    }

    drop.addEventListener('click', e => { if (e.target !== input) input.click(); });
    drop.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => { handleFile(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
    removeBtn.addEventListener('click', clearPhoto);

    // clicking the "Add photo" box inside the Portrait preview
    slot.addEventListener('click', () => {
      $('.tab-btn[data-tab="personal"]').click();
      input.click();
    });

    if (state.photo) showPhoto(state.photo);
  }

  /* ---------------- experience / education repeaters ---------------- */
  function bindRepeatItem(entry, node, fields, arrRef) {
    fields.forEach(f => {
      const input = $('.' + f.cls, node);
      input.value = entry[f.key] || '';
      input.addEventListener('input', () => { entry[f.key] = input.value; renderPreview(); persist(); });
    });
    $('.remove-btn', node).addEventListener('click', () => {
      const idx = arrRef.indexOf(entry);
      if (idx > -1) arrRef.splice(idx, 1);
      node.remove();
      renderPreview(); persist();
    });
  }

  function renderExperienceForm() {
    const list = $('#experienceList');
    list.innerHTML = '';
    const tpl = $('#experienceRowTpl');
    state.experience.forEach(entry => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = entry.id;
      bindRepeatItem(entry, node, [
        { cls: 'exp-role', key: 'role' }, { cls: 'exp-company', key: 'company' },
        { cls: 'exp-dates', key: 'dates' }, { cls: 'exp-location', key: 'location' },
        { cls: 'exp-desc', key: 'desc' }
      ], state.experience);
      list.appendChild(node);
    });
  }

  function renderEducationForm() {
    const list = $('#educationList');
    list.innerHTML = '';
    const tpl = $('#educationRowTpl');
    state.education.forEach(entry => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = entry.id;
      bindRepeatItem(entry, node, [
        { cls: 'edu-degree', key: 'degree' }, { cls: 'edu-school', key: 'school' },
        { cls: 'edu-dates', key: 'dates' }, { cls: 'edu-notes', key: 'notes' }
      ], state.education);
      list.appendChild(node);
    });
  }

  function initRepeaters() {
    renderExperienceForm();
    renderEducationForm();
    $('#addExperience').addEventListener('click', () => {
      state.experience.push({ id: uid(), role: '', company: '', dates: '', location: '', desc: '' });
      renderExperienceForm(); renderPreview(); persist();
    });
    $('#addEducation').addEventListener('click', () => {
      state.education.push({ id: uid(), degree: '', school: '', dates: '', notes: '' });
      renderEducationForm(); renderPreview(); persist();
    });
  }

  /* ---------------- skills ---------------- */
  function renderSkillTags() {
    const wrap = $('#skillTags');
    wrap.innerHTML = '';
    state.skills.forEach((skill, i) => {
      const tag = document.createElement('span');
      tag.className = 'skill-tag';
      tag.innerHTML = `${escapeHtml(skill)} <button type="button" aria-label="Remove">&times;</button>`;
      $('button', tag).addEventListener('click', () => {
        state.skills.splice(i, 1); renderSkillTags(); renderPreview(); persist();
      });
      wrap.appendChild(tag);
    });
  }
  function initSkills() {
    renderSkillTags();
    const input = $('#skillInput');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        state.skills.push(input.value.trim());
        input.value = '';
        renderSkillTags(); renderPreview(); persist();
        if (state.skills.length === 1) toast('Nice — keep adding skills that match the role');
      }
    });
  }

  /* ---------------- customize: template / colour / font ---------------- */
  function initCustomize() {
    $$('.tpl-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tpl-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.template = btn.dataset.template;
        const preview = $('#resumePreview');
        preview.classList.add('switching');
        setTimeout(() => {
          applyTemplate();
          preview.classList.remove('switching');
        }, 180);
        persist();
        toast(`Switched to ${btn.textContent} layout`);
        if (state.template === 'portrait' && !state.photo) {
          setTimeout(() => toast('Click the photo box on the resume to add your picture'), 900);
        }
      });
    });

    $$('.swatch[data-color]').forEach(sw => {
      sw.addEventListener('click', () => {
        $$('.swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        state.accent = sw.dataset.color;
        applyAccent();
        persist();
      });
    });
    const customColor = $('#customColor');
    customColor.addEventListener('input', () => {
      $$('.swatch').forEach(s => s.classList.remove('active'));
      state.accent = customColor.value;
      applyAccent();
      persist();
    });

    const fontSelect = $('#fontSelect');
    fontSelect.addEventListener('change', () => {
      const opt = fontSelect.selectedOptions[0];
      state.fontDisplay = opt.value;
      state.fontBody = opt.dataset.body;
      applyFonts();
      persist();
    });
  }

  function applyTemplate() {
    const preview = $('#resumePreview');
    preview.classList.remove('tpl-classic', 'tpl-modern', 'tpl-minimal', 'tpl-portrait');
    preview.classList.add('tpl-' + state.template);
    preview.dataset.template = state.template;
    $$('.tpl-opt').forEach(b => b.classList.toggle('active', b.dataset.template === state.template));
    renderPreview();   // skills block / photo slot depend on the template
  }
  function applyAccent() {
    $('#resumePreview').style.setProperty('--accent', state.accent);
  }
  function applyFonts() {
    const preview = $('#resumePreview');
    preview.style.setProperty('--font-d', state.fontDisplay);
    preview.style.setProperty('--font-b', state.fontBody);
  }

  /* ---------------- render preview content ---------------- */
  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderPreview() {
    const name = state.fullName || 'Your Name';
    const role = state.jobTitle || 'Job Title';
    const contactParts = [state.email, state.phone, state.location, state.website].filter(Boolean);
    const contact = contactParts.length ? contactParts.join(' · ') : 'email · phone · location';

    $('#rName1').textContent = name; $('#rName2').textContent = name;
    $('#rRole1').textContent = role; $('#rRole2').textContent = role;
    $('#rContact1').textContent = contact;
    $('#rContact2').innerHTML = contactParts.length ? contactParts.map(escapeHtml).join('<br>') : 'email<br>phone<br>location';

    ['rPhoto1', 'rPhoto2'].forEach(id => {
      const img = $('#' + id);
      if (state.photo) { img.src = state.photo; img.style.display = 'block'; }
      else { img.style.display = 'none'; }
    });

    const slot = $('#rPhotoSlot');
    if (slot) slot.style.display = state.photo ? 'none' : '';

    const summarySection = $('#rSummarySection');
    if (state.summary.trim()) {
      summarySection.style.display = 'block';
      $('#rSummary').textContent = state.summary;
    } else summarySection.style.display = 'none';

    const expWrap = $('#rExperience');
    const hasExp = state.experience.some(x => x.role || x.company || x.desc);
    $('#rExperienceSection').style.display = hasExp ? 'block' : 'none';
    expWrap.innerHTML = state.experience.map(x => {
      if (!(x.role || x.company || x.desc)) return '';
      return `<div class="exp-item">
        <div class="row1"><span>${escapeHtml(x.role || 'Role')}${x.company ? ' · ' + escapeHtml(x.company) : ''}</span><span>${escapeHtml(x.dates)}</span></div>
        <div class="row2"><span>${escapeHtml(x.location)}</span></div>
        <p>${escapeHtml(x.desc)}</p>
      </div>`;
    }).join('');

    const eduWrap = $('#rEducation');
    const hasEdu = state.education.some(x => x.degree || x.school);
    $('#rEducationSection').style.display = hasEdu ? 'block' : 'none';
    eduWrap.innerHTML = state.education.map(x => {
      if (!(x.degree || x.school)) return '';
      return `<div class="edu-item">
        <div class="row1"><span>${escapeHtml(x.degree || 'Degree')}${x.school ? ' · ' + escapeHtml(x.school) : ''}</span><span>${escapeHtml(x.dates)}</span></div>
        <div class="row2"><span>${escapeHtml(x.notes)}</span></div>
      </div>`;
    }).join('');

    const skillsHtml = state.skills.map(s => `<span>${escapeHtml(s)}</span>`).join('');
    $('#rSkillsMain').innerHTML = skillsHtml;
    $('#rSkillsSidebar').innerHTML = skillsHtml;
    const skillsInSidebar = state.template === 'modern' || state.template === 'portrait';
    $('#rSkillsSection').style.display = state.skills.length && !skillsInSidebar ? 'block' : 'none';
  }

  /* ---------------- sample data ---------------- */
  function fillSampleData() {
    Object.assign(state, {
      fullName: 'Aiman Raza', jobTitle: 'Product Designer',
      email: 'aiman.raza@email.com', phone: '+92 300 1234567',
      location: 'Karachi, Pakistan', website: 'linkedin.com/in/aimanraza',
      summary: 'Product designer with 5+ years shaping fintech and e-commerce apps end to end — from research to polished, shippable UI.',
      experience: [
        { id: uid(), role: 'Senior Product Designer', company: 'Studio Loop', dates: '2022 — Present', location: 'Karachi, PK', desc: 'Led design for a mobile banking app used by 200k+ customers; cut onboarding drop-off by 34%.' },
        { id: uid(), role: 'Product Designer', company: 'Northbridge Labs', dates: '2019 — 2022', location: 'Lahore, PK', desc: 'Owned the design system and shipped 12 major feature releases across web and iOS.' }
      ],
      education: [
        { id: uid(), degree: 'BS Computer Science', school: 'NED University of Engineering & Technology', dates: '2015 — 2019', notes: 'CGPA 3.7 / 4.0' }
      ],
      skills: ['Figma', 'Design Systems', 'User Research', 'Prototyping', 'HTML/CSS', 'Team Leadership']
    });
    renderExperienceForm(); renderEducationForm(); renderSkillTags();
    $$('.field input, .field textarea').forEach(() => {}); // no-op guard
    $('#fullName').value = state.fullName; $('#jobTitle').value = state.jobTitle;
    $('#email').value = state.email; $('#phone').value = state.phone;
    $('#location').value = state.location; $('#website').value = state.website;
    $('#summary').value = state.summary;
    renderPreview(); persist();
    toast('Sample resume loaded — edit any field to make it yours');
  }

  /* ---------------- reset / export ---------------- */
  function initMisc() {
    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('Clear all resume content? This cannot be undone.')) return;
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
    $('#sampleBtn').addEventListener('click', fillSampleData);
    $('#exportBtn').addEventListener('click', () => {
      toast('Opening print dialog — choose "Save as PDF"');
      setTimeout(() => window.print(), 300);
    });
  }

  function syncCustomizeUI() {
    $$('.tpl-opt').forEach(b => b.classList.toggle('active', b.dataset.template === state.template));
    const matchSwatch = $(`.swatch[data-color="${state.accent}"]`);
    if (matchSwatch) matchSwatch.classList.add('active');
    else $('#customColor').value = state.accent;
    $('#customColor').value = state.accent;

    const fontSelect = $('#fontSelect');
    const match = $$('#fontSelect option').find(o => o.value === state.fontDisplay);
    if (match) fontSelect.value = match.value;
  }

  /* ---------------- boot ---------------- */
  function boot() {
    loadState();
    initTabs();
    initSimpleFields();
    initPhoto();
    initRepeaters();
    initSkills();
    initCustomize();
    initMisc();
    syncCustomizeUI();
    applyTemplate();
    applyAccent();
    applyFonts();
    renderPreview();
    updateProgress();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
