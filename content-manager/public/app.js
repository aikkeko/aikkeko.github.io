'use strict';

const state = {
  registry: null,
  revision: null,
  mode: 'articles',
  selectedKey: null,
  dirtyArticles: new Set(),
  dirtyMedia: new Set(),
  dirty: false
};

const $ = selector => document.querySelector(selector);
const elements = {
  list: $('#record-list'), search: $('#search'), save: $('#save'), reload: $('#reload'), saveState: $('#save-state'),
  empty: $('#empty-state'), articleForm: $('#article-form'), mediaForm: $('#media-form'), addMedia: $('#add-media'),
  articleCount: $('#article-count'), mediaCount: $('#media-count'), editorTitle: $('#editor-title'), toast: $('#toast')
};

const articleFields = ['title', 'author', 'description', 'categories', 'tags'];
const mediaFields = ['title', 'episode', 'date', 'platform', 'duration', 'tags', 'description', 'url', 'embed', 'cover'];

function splitTags(value) {
  return [...new Set(String(value || '').split(/[,，、]/).map(item => item.trim()).filter(Boolean))];
}

function normalizeDateForInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateFromInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toast(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.style.borderColor = error ? 'rgba(189,119,113,.55)' : '';
  elements.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

function setDirty(kind, key) {
  state.dirty = true;
  if (kind === 'articles') state.dirtyArticles.add(key);
  else state.dirtyMedia.add(key);
  elements.save.disabled = false;
  elements.saveState.textContent = '有尚未保存的修改';
  renderList();
}

function recordSearchText(key, item) {
  return [key, item.title, item.author, item.episode, ...(item.tags || []), ...(item.categories || [])].join(' ').toLowerCase();
}

function records() {
  if (!state.registry) return [];
  if (state.mode === 'articles') return Object.entries(state.registry.articles || {}).map(([key, item]) => ({ key, item }));
  return (state.registry.media?.items || []).map(item => ({ key: item.id, item }));
}

function renderList() {
  const query = elements.search.value.trim().toLowerCase();
  const featured = state.mode === 'articles' ? state.registry?.homepage?.featured_article : state.registry?.media?.featured;
  elements.list.innerHTML = '';
  for (const { key, item } of records().filter(entry => !query || recordSearchText(entry.key, entry.item).includes(query))) {
    const button = document.createElement('button');
    const isDirty = state.mode === 'articles' ? state.dirtyArticles.has(key) : state.dirtyMedia.has(key);
    button.type = 'button';
    button.className = `record${state.selectedKey === key ? ' active' : ''}`;
    button.innerHTML = `<strong>${escapeHtml(item.title || key)}</strong><span>${key === featured ? '<i class="pin">◆ 置顶</i>' : ''}<i>${escapeHtml((item.tags || item.categories || []).join(' · ') || '未设置标签')}</i>${isDirty ? '<i class="pin">● 未保存</i>' : ''}</span>`;
    button.addEventListener('click', () => selectRecord(key));
    elements.list.appendChild(button);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function selectRecord(key) {
  state.selectedKey = key;
  elements.empty.classList.add('hidden');
  if (state.mode === 'articles') showArticle(key);
  else showMedia(key);
  renderList();
}

function showArticle(key) {
  const article = state.registry.articles[key];
  elements.mediaForm.classList.add('hidden');
  elements.articleForm.classList.remove('hidden');
  $('#article-key').textContent = key;
  $('#article-featured').checked = state.registry.homepage.featured_article === key;
  for (const field of articleFields) {
    const value = Array.isArray(article[field]) ? article[field].join(', ') : article[field] || '';
    $(`#article-${field}`).value = value;
  }
  updateCounters();
}

function showMedia(key) {
  const item = state.registry.media.items.find(entry => entry.id === key);
  if (!item) return;
  elements.articleForm.classList.add('hidden');
  elements.mediaForm.classList.remove('hidden');
  $('#media-id').textContent = key;
  $('#media-featured').checked = state.registry.media.featured === key;
  for (const field of mediaFields) {
    let value = item[field] || '';
    if (field === 'tags') value = (item.tags || []).join(', ');
    if (field === 'date') value = normalizeDateForInput(value);
    $(`#media-${field}`).value = value;
  }
  updateCounters();
}

function updateArticle(field) {
  const article = state.registry.articles[state.selectedKey];
  if (!article) return;
  const input = $(`#article-${field}`);
  article[field] = field === 'tags' || field === 'categories' ? splitTags(input.value) : input.value;
  setDirty('articles', state.selectedKey);
  updateCounters();
}

function updateMedia(field) {
  const item = state.registry.media.items.find(entry => entry.id === state.selectedKey);
  if (!item) return;
  const input = $(`#media-${field}`);
  item[field] = field === 'tags' ? splitTags(input.value) : field === 'date' ? dateFromInput(input.value) : input.value;
  setDirty('media', state.selectedKey);
  updateCounters();
}

function updateCounters() {
  $('#article-description-count').textContent = $('#article-description').value.length;
  $('#media-description-count').textContent = $('#media-description').value.length;
}

async function loadData(force = false) {
  if (force && state.dirty && !confirm('放弃尚未保存的修改并重新载入吗？')) return;
  const response = await fetch('/api/data', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法读取内容配置');
  const data = await response.json();
  state.registry = data.registry;
  state.revision = data.revision;
  state.dirty = false;
  state.dirtyArticles.clear();
  state.dirtyMedia.clear();
  state.selectedKey = null;
  elements.save.disabled = true;
  elements.saveState.textContent = '尚未修改';
  elements.articleCount.textContent = Object.keys(state.registry.articles || {}).length;
  elements.mediaCount.textContent = state.registry.media?.items?.length || 0;
  elements.empty.classList.remove('hidden');
  elements.articleForm.classList.add('hidden');
  elements.mediaForm.classList.add('hidden');
  renderList();
}

async function saveData() {
  const controls = [...document.querySelectorAll('input, textarea, select, button')].map(element => [element, element.disabled]);
  controls.forEach(([element]) => { element.disabled = true; });
  elements.save.disabled = true;
  elements.saveState.textContent = '正在保存…';
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registry: state.registry, revision: state.revision })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '保存失败');
    state.registry = result.registry;
    state.revision = result.revision;
    state.dirty = false;
    state.dirtyArticles.clear();
    state.dirtyMedia.clear();
    elements.saveState.textContent = '已保存';
    toast(`已写入配置${result.synced?.length ? `，同步 ${result.synced.length} 篇文章` : ''}`);
    renderList();
  } catch (error) {
    elements.save.disabled = false;
    elements.saveState.textContent = '保存失败';
    toast(error.message, true);
  } finally {
    controls.forEach(([element, disabled]) => { element.disabled = disabled; });
    elements.save.disabled = !state.dirty;
  }
}

function addMedia() {
  const id = prompt('输入节目 ID（仅建议使用英文、数字与短横线）：');
  if (!id) return;
  const clean = id.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!clean || state.registry.media.items.some(item => item.id === clean)) return toast('节目 ID 无效或已存在', true);
  state.registry.media.items.unshift({ id: clean, type: 'video', title: '新声像节目', episode: '', platform: 'Bilibili', date: new Date().toISOString(), duration: '', url: '', embed: '', cover: '', description: '', tags: [] });
  setDirty('media', clean);
  selectRecord(clean);
  elements.mediaCount.textContent = state.registry.media.items.length;
}

function deleteMedia() {
  const item = state.registry.media.items.find(entry => entry.id === state.selectedKey);
  if (!item || !confirm(`确认删除“${item.title}”吗？`)) return;
  state.registry.media.items = state.registry.media.items.filter(entry => entry.id !== state.selectedKey);
  if (state.registry.media.featured === state.selectedKey) state.registry.media.featured = '';
  setDirty('media', state.selectedKey);
  state.selectedKey = null;
  elements.mediaForm.classList.add('hidden');
  elements.empty.classList.remove('hidden');
  elements.mediaCount.textContent = state.registry.media.items.length;
  renderList();
}

document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  state.selectedKey = null;
  document.querySelectorAll('.mode-button').forEach(item => item.classList.toggle('active', item === button));
  elements.addMedia.classList.toggle('hidden', state.mode !== 'media');
  elements.editorTitle.textContent = state.mode === 'articles' ? '文章档案' : '声像档案';
  elements.articleForm.classList.add('hidden');
  elements.mediaForm.classList.add('hidden');
  elements.empty.classList.remove('hidden');
  elements.search.value = '';
  renderList();
}));

for (const field of articleFields) $(`#article-${field}`).addEventListener('input', () => updateArticle(field));
for (const field of mediaFields) $(`#media-${field}`).addEventListener('input', () => updateMedia(field));
$('#article-featured').addEventListener('change', event => {
  state.registry.homepage.featured_article = event.target.checked ? state.selectedKey : '';
  setDirty('articles', state.selectedKey);
});
$('#media-featured').addEventListener('change', event => {
  state.registry.media.featured = event.target.checked ? state.selectedKey : '';
  setDirty('media', state.selectedKey);
});
elements.search.addEventListener('input', renderList);
elements.save.addEventListener('click', saveData);
elements.reload.addEventListener('click', () => loadData(true).catch(error => toast(error.message, true)));
elements.addMedia.addEventListener('click', addMedia);
$('#delete-media').addEventListener('click', deleteMedia);
window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });

loadData().catch(error => toast(error.message, true));
