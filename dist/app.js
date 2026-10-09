/* Buildless reader. Content is data; imported text is never interpreted as HTML. */
(async function () {
  'use strict';
  const M = StudyModel, $ = id => document.getElementById(id);
  const KEY = M.BOOK_ID + ':state:v1';
  const labels = {pending: 'Ожидает перевода', draft: 'Черновик', partial: 'Переведено частично', translated: 'Сверено с PDF', reviewed: 'Клиническая редактура'};
  let book = M.validateBook(window.STUDY_BOOK), state = M.emptyState(), sections = [], current = null, pdf = null, pdfUrl = null, db;
  let toastTimer, speechToken = 0, speechMode = 'idle', speechQueue = [], speechIndex = 0, activeUtterance = null, voices = [];
  function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000); }
  function libraryMessage(message) { $('libraryStatus').textContent = message; $('libraryStatus').hidden = false; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); $('saveStatus').textContent = 'Сохранено в этом браузере.'; return true; }
    catch { $('saveStatus').textContent = 'Не удалось сохранить. Скачайте резервную копию до закрытия страницы.'; toast('Хранилище недоступно или заполнено. Скачайте резервную копию.'); return false; }
  }
  try { const raw = localStorage.getItem(KEY); if (raw) state = M.cleanState(JSON.parse(raw)); }
  catch { toast('Не удалось прочитать локальные записи. Проверьте резервную копию.'); }
  async function database() {
    if (db) return db;
    db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('psychiatry-study-v1', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('library');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Закройте другую вкладку библиотеки и повторите.'));
    });
    return db;
  }
  async function dbGet(key) { const d = await database(); return new Promise((resolve, reject) => { const r = d.transaction('library').objectStore('library').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  async function dbPut(key, value) { const d = await database(); return new Promise((resolve, reject) => { const tx = d.transaction('library', 'readwrite'); tx.objectStore('library').put(value, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Запись прервана')); }); }
  try {
    const stored = await dbGet('book');
    if (stored) { M.validateBook(stored); if (stored.revision > book.revision && (!book.source || stored.source?.sha256 === book.source.sha256)) book = stored; }
    pdf = await dbGet('pdf');
    if (pdf && book.source && pdf.sha256 !== book.source.sha256) { pdf = null; toast('Локальный PDF не соответствует версии материала. Подключите исходный файл заново.'); }
  } catch { toast('Локальное хранение материалов недоступно. Записи можно сохранить резервной копией.'); }
  function download(filename, text, type = 'application/json;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], {type})); const link = el('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function exportBackup() { recordPosition(); download('psychiatry-notes-backup.json', JSON.stringify({...state, exportedAt: new Date().toISOString()}, null, 2)); }
  function recordPosition() { if (current) state.positions[current.id] = window.scrollY; }
  function route(id) { location.hash = id ? 'section=' + encodeURIComponent(id) : 'home'; }
  function updateStats() {
    const st = M.stats(book, state); const pct = st.total ? Math.round(st.read / st.total * 100) : 0;
    $('readCount').textContent = `${st.read} из ${st.total} разделов`;
    $('readPercent').textContent = st.total ? pct + '%' : '—'; $('readingProgress').value = pct;
    $('readHint').textContent = !st.total ? 'Прогресс появится после добавления оглавления.' : book.outlineComplete ? 'Прочитано разделов по всей книге. Разделы различаются по объёму.' : 'Прогресс по добавленной части оглавления.';
    if (st.partialRead) $('readHint').textContent += ` Также прочитаны доступные части: ${st.partialRead}. Они не засчитываются как целые разделы.`;
    $('translatedMetric').replaceChildren(document.createTextNode(st.translated + ' '), el('small', 'разделов'));
    $('readMetric').replaceChildren(document.createTextNode(st.read + ' '), el('small', 'разделов'));
    $('notesMetric').replaceChildren(document.createTextNode(Object.values(state.notes).filter(n => n.trim()).length + ' '), el('small', 'записей'));
    $('coverageHint').textContent = st.total ? `${st.translated} из ${st.total} полностью${st.partial ? ` · частично: ${st.partial}` : ''} · ${book.outlineComplete ? 'полное оглавление' : 'оглавление добавляется'}` : 'Перевод ещё не добавлен';
    $('continueButton').textContent = sections.some(M.readable) ? (state.lastSection ? 'Продолжить чтение →' : 'Начать с начала →') : sections.length ? 'Открыть оглавление →' : 'Подготовить материалы ↗';
  }
  function renderToc() {
    const q = $('search').value.trim().toLocaleLowerCase('ru'); const toc = $('toc'); toc.replaceChildren();
    if (!sections.length) {
      const p = el('p', 'Оглавление ожидает PDF', 'empty-toc'); p.append(el('span', 'Названия и порядок разделов будут перенесены из исходной книги.')); toc.append(p); return;
    }
    let found = 0;
    for (const chapter of book.chapters) {
      const rows = chapter.sections.filter(s => !q || [chapter.title, chapter.originalTitle, s.title, s.originalTitle, ...s.blocks.map(M.blockText)].join(' ').toLocaleLowerCase('ru').includes(q));
      if (!rows.length) continue; found += rows.length;
      const group = el('details'); group.open = Boolean(q) || current?.chapter.id === chapter.id || book.chapters.length === 1;
      group.append(el('summary', chapter.title));
      rows.forEach(s => {
        const done = M.isRead(s, state, book); const b = el('button', (done ? '✓ ' : '') + s.title, 'toc-item');
        b.style.setProperty('--depth', String(s.level - 1)); if (current?.id === s.id) b.setAttribute('aria-current', 'page');
        b.append(el('small', M.isPartRead(s, state, book) ? 'Доступная часть прочитана' : labels[s.status])); b.onclick = () => { route(s.id); closeToc(); }; group.append(b);
      }); toc.append(group);
    }
    if (!found) toc.append(el('p', 'Ничего не найдено. Попробуйте другое слово.', 'empty-toc'));
  }
  function renderLibrary() {
    $('pdfInfo').textContent = pdf ? `${pdf.filename} · ${(pdf.blob.size / 1048576).toFixed(1)} МБ · сохранён локально` : 'Пока не подключён.';
    $('viewPdf').disabled = !pdf;
    const st = M.stats(book, state);
    const numberedChapters = book.chapters.filter(c => c.number).length || book.chapters.length;
    $('packageInfo').textContent = sections.length ? `Версия ${book.revision}: ${numberedChapters} глав, ${st.total} разделов с учётом предварительных и справочных частей. Полностью переведено и сверено с PDF: ${st.translated}; частично: ${st.partial}; черновиков: ${st.draft}.` : 'Текст и оглавление ещё не добавлены.';
    if (book.source) {
      $('sourceTitle').textContent = book.outlineComplete ? `${numberedChapters} глав · от начала до конца` : 'Учебник пополняется поэтапно';
      $('sourceDescription').textContent = book.translationBoundary ? `Сейчас переведены: ${book.translationBoundary}` : `Источник: ${book.source.filename}. Переведено и сверено с PDF: ${st.translated} разделов. ${book.outlineComplete ? 'В навигации доступны главы и основные разделы.' : 'Оглавление пока неполное.'}`;
      $('sourceFootnote').textContent = `${book.source.pageCount} страниц в PDF. Добавленный перевод сверен с оригиналом; независимая клиническая редактура не проводилась. Частично переведённые разделы показывают точную границу готового текста; пустые разделы ожидают перевода.`;
      $('sourceButton').textContent = 'Открыть материалы →';
    } else if (pdf) {
      $('sourceTitle').textContent = 'Оригинал подключён';
      $('sourceDescription').textContent = 'PDF сохранён для сверки. Теперь нужен подготовленный по нему перевод с оглавлением. На сайте пока нет переведённых разделов.';
      $('sourceButton').textContent = 'Открыть материалы →';
    }
  }
  function renderOverview() {
    const container = $('chapterOverview'); container.replaceChildren();
    if (!book.chapters.length) return;
    container.append(el('h2', 'Главы учебника'));
    for (const c of book.chapters) {
      const row = el('div', undefined, 'chapter-row'); const copy = el('div'); const partial = c.sections.filter(s => s.status === 'partial').length;
      copy.append(el('h3', c.title), el('p', `${c.sections.filter(M.ready).length} из ${c.sections.length} разделов переведено полностью${partial ? ` · частично: ${partial}` : ''}`));
      const button = el('button', 'Открыть главу →', 'quiet outlined'); button.disabled = !c.sections.length; button.onclick = () => route(c.sections[0].id); row.append(copy, button); container.append(row);
    }
  }
  function renderBlock(b) {
    if (b.type === 'paragraph') return el('p', b.text);
    if (b.type === 'heading') return el('h' + (b.level || 2), b.text);
    if (b.type === 'quote') return el('blockquote', b.text);
    if (b.type === 'list') { const list = el(b.ordered ? 'ol' : 'ul'); b.items.forEach(i => list.append(el('li', i))); return list; }
    if (b.type === 'box') { const box = el('aside', undefined, 'box'); box.append(el('h3', b.title), ...b.blocks.map(renderBlock)); return box; }
    if (b.type === 'table') {
      const wrap = el('div', undefined, 'table-wrap'); const table = el('table'); const head = el('thead'), tr = el('tr'), body = el('tbody');
      b.headers.forEach(h => { const th = el('th', h); th.scope = 'col'; tr.append(th); }); head.append(tr);
      b.rows.forEach(row => { const r = el('tr'); row.forEach(c => r.append(el('td', c))); body.append(r); });
      table.append(el('caption', b.caption), head, body); wrap.append(table); return wrap;
    }
    const figure = el('figure'), image = el('img'); image.src = b.src; image.alt = b.alt; image.loading = 'lazy'; figure.append(image, el('figcaption', b.caption)); return figure;
  }
  function renderRoute() {
    recordPosition(); stopSpeech();
    let id = null; try { if (location.hash.startsWith('#section=')) id = decodeURIComponent(location.hash.slice(9)); } catch { /* Unknown route displays overview. */ }
    current = sections.find(s => s.id === id) || null;
    if (id && !current) toast('Этот раздел ещё не добавлен. Открыт обзор библиотеки.');
    $('home').hidden = Boolean(current); $('reader').hidden = !current;
    $('breadcrumb').textContent = current ? 'Учебник / ' + current.chapter.title : 'Библиотека / Обзор';
    if (current) {
      state.lastSection = current.id;
      $('chapterLabel').textContent = current.chapter.title;
      $('sectionTitle').textContent = current.title; $('sectionStatus').textContent = labels[current.status];
      const s = current.source;
      $('sourceReference').textContent = `PDF: стр. ${s.pdfStart}–${s.pdfEnd}` + (s.printedPages ? ` · В книге: ${s.printedPages}` : '') + ` · ${current.originalTitle}`;
      if (pdf) { const open = el('button', 'Оригинал ↗', 'text-button'); open.onclick = () => viewPdf(s.pdfStart); $('sourceReference').append(document.createTextNode(' · '), open); }
      $('draftWarning').hidden = current.status !== 'draft';
      $('partialNotice').hidden = current.status !== 'partial'; $('continuationNotice').hidden = current.status !== 'partial';
      if (current.status === 'partial') {
        const c = current.coverage;
        $('partialNotice').textContent = `Переведена часть раздела: PDF ${c.pdfStart}–${c.pdfEnd}, печатные стр. ${c.printedPages}. ${c.through}`;
        $('continuationNotice').textContent = `Здесь заканчивается доступный перевод. Далее в этом же разделе: ${c.next} Продолжение ещё не добавлено. Кнопка «Далее» открывает следующий основной раздел книги.`;
      }
      $('article').replaceChildren(); $('sectionOutline').replaceChildren(); $('editorNotes').replaceChildren();
      if (current.status === 'pending') $('article').append(el('p', 'Перевод этого раздела ещё не добавлен. Его место в структуре книги сохранено. Можно перейти дальше или записать вопросы в конспект.'));
      else current.blocks.forEach((b, i) => { const node = renderBlock(b); node.dataset.block = String(i); if (b.type === 'heading') node.id = 'block-' + i; $('article').append(node); });
      const headings = current.blocks.map((b,i) => ({...b,index:i})).filter(b => b.type === 'heading');
      if (headings.length > 1) {
        const menu = el('details'); menu.append(el('summary','В этом разделе · ' + headings.length + ' тем'));
        const links = el('div',undefined,'section-links');
        headings.forEach(b => { const button = el('button',b.text,'text-button'); button.style.marginLeft = ((b.level || 2)-2)*14 + 'px'; button.onclick = () => $('block-' + b.index).scrollIntoView({block:'start'}); links.append(button); });
        menu.append(links); $('sectionOutline').append(menu);
      }
      if (current.editorNotes?.length) {
        const details = el('details'); details.append(el('summary','Примечания к переводу · не текст книги'));
        current.editorNotes.forEach(note => details.append(el('p',note))); $('editorNotes').append(details);
      }
      $('previousButton').disabled = sections.indexOf(current) === 0;
      $('nextButton').disabled = sections.indexOf(current) === sections.length - 1;
      updateCompleteButton(); updateSpeechUI();
    }
    updateStats(); renderToc(); renderNotes(); save();
    const restoreId = current?.id; requestAnimationFrame(() => { if (current?.id === restoreId) window.scrollTo(0, restoreId ? state.positions[restoreId] || 0 : 0); });
  }
  function updateCompleteButton() {
    $('completeButton').disabled = !current || !M.readable(current);
    $('completeButton').textContent = current?.status === 'partial' ? (M.isPartRead(current, state, book) ? '✓ Часть прочитана · отменить' : 'Доступная часть прочитана') : current && M.isRead(current, state, book) ? '✓ Прочитано · отменить' : 'Отметить прочитанным';
    $('completeButton').title = current?.status === 'partial' ? 'Отметка относится только к текущей версии доступной части. При добавлении текста она потребует обновления.' : '';
  }
  function noteId() { return current?.id || 'general'; }
  function renderNotes() {
    $('notesContext').textContent = current ? current.chapter.title + ' / ' + current.title : 'Общие заметки к учебнику';
    $('summary').replaceChildren(); $('terms').replaceChildren();
    if (current?.status === 'partial') $('summary').append(el('p', `Тезисы только к переведённой части: печатные стр. ${current.coverage.printedPages}. ${current.coverage.through}`));
    if (current?.summary.length) { const list = el('ul'); current.summary.forEach(s => list.append(el('li', s))); $('summary').append(list); }
    else $('summary').append(el('p', current ? 'Тезисы появятся вместе с переводом этого раздела.' : 'Откройте раздел, чтобы увидеть его тезисы. Здесь можно сохранять общие заметки.'));
    if (current && book.glossary.length) {
      const text = current.blocks.map(M.blockText).join(' ').toLowerCase();
      const terms = book.glossary.filter(g => text.includes(g.ru.toLowerCase()) || text.includes(g.en.toLowerCase()));
      if (terms.length) { $('terms').append(el('h3', 'Терминология')); terms.forEach(g => $('terms').append(el('p', `${g.ru} — ${g.en}${g.note ? '. ' + g.note : ''}`))); }
    }
    $('personalNotes').value = state.notes[noteId()] || '';
  }
  function exportNotes() {
    let content = '# ' + (current?.title || 'Общие заметки к учебнику') + '\n\n';
    content += book.title + ', ' + book.edition + '\n\n';
    if (current) {
      content += `Источник полного раздела: PDF, стр. ${current.source.pdfStart}–${current.source.pdfEnd}. Статус: ${labels[current.status]}.\n\n`;
      if (current.status === 'partial') { const c = current.coverage; content += `Переведённая часть: PDF ${c.pdfStart}–${c.pdfEnd}, печатные стр. ${c.printedPages}. ${c.through}\nДалее: ${c.next}\n\n`; }
      content += '## Краткие тезисы\n\n' + current.summary.map(s => '- ' + s).join('\n') + '\n\n';
    }
    content += '## Мои заметки\n\n' + (state.notes[noteId()] || 'Пока нет заметок.');
    download('konspekt-' + noteId() + '.md', content, 'text/markdown;charset=utf-8');
  }
  function fillVoices() {
    voices = 'speechSynthesis' in window ? speechSynthesis.getVoices().filter(v => /^ru(?:[-_]|$)/i.test(v.lang)).sort((a,b) => Number(b.localService) - Number(a.localService)) : [];
    $('voiceSelect').replaceChildren();
    if (!voices.length) $('voiceSelect').append(new Option('Русский голос недоступен', ''));
    else voices.forEach(v => $('voiceSelect').append(new Option(v.name + (v.localService ? ' · на устройстве' : ' · сетевой'), v.voiceURI)));
    if (voices.some(v => v.voiceURI === state.voice)) $('voiceSelect').value = state.voice;
    $('voiceHint').textContent = voices.length ? 'Выберите удобный голос из доступных на устройстве.' : 'Добавьте русский голос в настройках речи системы или откройте сайт в браузере, где он доступен.';
    updateSpeechUI();
  }
  function updateSpeechUI() {
    $('speakButton').disabled = !current?.blocks.length || !voices.length;
    $('speakButton').textContent = speechMode === 'speaking' ? 'Ⅱ Пауза' : speechMode === 'paused' ? '▶ Продолжить' : '▶ Слушать';
    $('stopButton').disabled = speechMode === 'idle';
    if (speechMode !== 'idle') $('speechStatus').textContent = `${speechMode === 'paused' ? 'Пауза' : 'Чтение'} · фрагмент ${speechIndex + 1} из ${speechQueue.length}`;
    else $('speechStatus').textContent = !('speechSynthesis' in window) ? 'Этот браузер не поддерживает Web Speech API.' : !voices.length ? 'Русский голос пока не доступен. Проверьте настройки голоса.' : 'Озвучивается текст открытого раздела.';
  }
  function stopSpeech() {
    speechToken++; speechMode = 'idle'; activeUtterance = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    document.querySelectorAll('.speaking').forEach(n => n.classList.remove('speaking'));
    updateSpeechUI();
  }
  function sayNext(token) {
    if (token !== speechToken) return;
    if (speechIndex >= speechQueue.length) { stopSpeech(); $('speechStatus').textContent = current?.status === 'partial' ? 'Доступная часть озвучена. Продолжение раздела ещё переводится.' : 'Раздел озвучен. Отметьте его прочитанным, когда будете готовы.'; return; }
    const item = speechQueue[speechIndex]; document.querySelectorAll('.speaking').forEach(n => n.classList.remove('speaking'));
    $('article').querySelector(`[data-block="${item.block}"]`)?.classList.add('speaking');
    const utterance = new SpeechSynthesisUtterance(item.text); activeUtterance = utterance; utterance.lang = 'ru-RU'; utterance.rate = state.rate;
    utterance.voice = voices.find(v => v.voiceURI === $('voiceSelect').value) || voices[0];
    utterance.onend = () => { if (token !== speechToken) return; speechIndex++; sayNext(token); };
    utterance.onerror = e => { if (token !== speechToken) return; stopSpeech(); $('speechStatus').textContent = `Чтение остановлено (${e.error}). Попробуйте другой голос.`; };
    updateSpeechUI(); speechSynthesis.speak(utterance);
  }
  function speak() {
    if (!current?.blocks.length || !voices.length) return;
    if (speechMode === 'speaking') { speechSynthesis.pause(); speechMode = 'paused'; updateSpeechUI(); return; }
    if (speechMode === 'paused') { speechSynthesis.resume(); speechMode = 'speaking'; updateSpeechUI(); return; }
    stopSpeech(); speechQueue = current.blocks.flatMap((b,i) => M.chunks(M.blockText(b)).map(text => ({text, block:i})));
    speechIndex = 0; speechMode = 'speaking'; sayNext(speechToken);
  }
  function viewPdf(page = 1) { if (!pdf) return; if (pdfUrl) URL.revokeObjectURL(pdfUrl); pdfUrl = URL.createObjectURL(pdf.blob); window.open(pdfUrl + '#page=' + page, '_blank', 'noopener,noreferrer'); }
  function showLibrary() { renderLibrary(); $('libraryDialog').showModal(); }
  function closeToc() { $('sidebar').classList.remove('open'); $('tocButton').setAttribute('aria-expanded', 'false'); }
  for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => $(b.dataset.close).close();
  $('libraryButton').onclick = showLibrary; $('sourceButton').onclick = showLibrary;
  $('notesButton').onclick = () => { renderNotes(); $('notesDialog').showModal(); };
  $('homeButton').onclick = () => { route(null); closeToc(); };
  $('tocButton').setAttribute('aria-expanded', 'false'); $('tocButton').setAttribute('aria-controls', 'sidebar');
  $('tocButton').onclick = () => { $('sidebar').classList.add('open'); $('tocButton').setAttribute('aria-expanded', 'true'); $('closeToc').focus(); };
  $('closeToc').onclick = () => { closeToc(); $('tocButton').focus(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeToc(); });
  $('search').oninput = renderToc;
  $('continueButton').onclick = () => { const last = sections.find(s => s.id === state.lastSection); const next = last || sections.find(s => M.readable(s) && !M.isRead(s, state, book) && !M.isPartRead(s, state, book)) || sections[0]; if (next) route(next.id); else showLibrary(); };
  $('previousButton').onclick = () => route(sections[sections.indexOf(current) - 1]?.id);
  $('nextButton').onclick = () => route(sections[sections.indexOf(current) + 1]?.id);
  $('completeButton').onclick = () => {
    if (!current || !M.readable(current)) return;
    if (M.isRead(current, state, book) || M.isPartRead(current, state, book)) delete state.completed[current.id];
    else state.completed[current.id] = {revision: current.revision, source: book.source.sha256};
    save(); updateStats(); updateCompleteButton(); renderToc();
  };
  $('personalNotes').oninput = () => { state.notes[noteId()] = $('personalNotes').value; save(); updateStats(); };
  $('exportNotes').onclick = exportNotes;
  ['backupButton','backupInNotes','exportBackup'].forEach(id => { $(id).onclick = exportBackup; });
  $('restoreBackup').onclick = () => $('backupInput').click();
  $('choosePdf').onclick = () => $('pdfInput').click(); $('viewPdf').onclick = () => viewPdf(current?.source.pdfStart || 1);
  $('choosePackage').onclick = () => $('packageInput').click();
  $('pdfInput').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      if (file.size > 250 * 1048576) throw new Error('Файл больше 250 МБ. Используйте локальную копию PDF вне сайта.');
      const bytes = await file.arrayBuffer(); if (!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-')) throw new Error('Файл не похож на PDF.');
      if (!crypto.subtle) throw new Error('Для проверки PDF откройте сайт по HTTPS или через localhost.');
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('');
      if (book.source && book.source.sha256 !== hash) throw new Error('Этот PDF не совпадает с источником перевода. Выберите исходную версию книги.');
      const value = {filename: file.name, sha256: hash, blob: file}; await dbPut('pdf', value); pdf = value; renderLibrary(); renderRoute();
      libraryMessage('PDF подключён и сохранён в этом браузере. Для подготовки перевода прикрепите исходник в чат проекта.');
    } catch (e) { libraryMessage('PDF не подключён: ' + e.message); }
  };
  $('packageInput').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      if (file.size > 50 * 1048576) throw new Error('Пакет больше 50 МБ.');
      const imported = M.validateBook(JSON.parse(await file.text()));
      if (imported.revision <= book.revision) throw new Error('Нужен пакет более новой версии. Текущая версия: ' + book.revision + '.');
      if (book.source && imported.source?.sha256 !== book.source.sha256) throw new Error('Источник пакета отличается от текущего учебника.');
      if (pdf && imported.source?.sha256 !== pdf.sha256) throw new Error('Пакет подготовлен по другому PDF.');
      const existing = M.flatten(book), incoming = M.flatten(imported);
      if (existing.some(s => !incoming.some(n => n.id === s.id))) throw new Error('Пакет удаляет существующие разделы. Нужна полная обновлённая версия.');
      for (const old of existing) { const fresh = incoming.find(s => s.id === old.id); if (fresh.revision < old.revision || (JSON.stringify(old.blocks) !== JSON.stringify(fresh.blocks) && fresh.revision <= old.revision)) throw new Error('Изменённому тексту нужна новая версия раздела.'); }
      await dbPut('book', imported); book = imported; sections = M.flatten(book); renderLibrary(); renderOverview(); renderRoute(); libraryMessage('Новая версия добавлена. Личные заметки сохранены.');
    } catch (e) { libraryMessage('Материалы не добавлены: ' + e.message); }
  };
  $('backupInput').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      if (file.size > 20 * 1048576) throw new Error('Файл копии больше 20 МБ.');
      const restored = M.cleanState(JSON.parse(await file.text()));
      if ((Object.values(state.notes).some(n => n.trim()) || Object.keys(state.completed).length) && !window.confirm('Восстановление заменит текущие заметки и отметки прочитанного. Сохранили резервную копию и хотите продолжить?')) return;
      state = restored; applyPreferences(); save(); renderRoute(); libraryMessage('Заметки и прогресс восстановлены.');
    } catch (e) { libraryMessage('Копия не восстановлена: ' + e.message); }
  };
  function applyPreferences() { document.documentElement.style.setProperty('--text-size', state.fontSize + 'px'); $('fontSize').value = String(state.fontSize); $('rateSelect').value = String(state.rate); fillVoices(); }
  $('speakButton').onclick = speak; $('stopButton').onclick = stopSpeech;
  $('speechSettingsButton').onclick = () => { fillVoices(); $('speechDialog').showModal(); };
  $('voiceSelect').onchange = () => { stopSpeech(); state.voice = $('voiceSelect').value; save(); };
  $('rateSelect').onchange = () => { stopSpeech(); state.rate = Number($('rateSelect').value); save(); };
  $('fontSize').onchange = () => { state.fontSize = Number($('fontSize').value); document.documentElement.style.setProperty('--text-size', state.fontSize + 'px'); save(); };
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', fillVoices);
  window.addEventListener('hashchange', renderRoute);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { recordPosition(); save(); } });
  window.addEventListener('pagehide', () => { recordPosition(); save(); stopSpeech(); if (pdfUrl) URL.revokeObjectURL(pdfUrl); });
  sections = M.flatten(book); applyPreferences(); renderOverview(); renderLibrary(); renderRoute();
})();
