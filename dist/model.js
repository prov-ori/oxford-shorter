(function (scope) {
  'use strict';
  const BOOK_ID = 'shorter-oxford-psychiatry-8-ru';
  const statuses = ['pending', 'draft', 'partial', 'translated', 'reviewed'];
  const ready = s => ['translated', 'reviewed'].includes(s.status);
  const readable = s => ready(s) || s.status === 'partial';
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function text(value, label, max = 100000) {
    assert(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `Некорректное поле: ${label}`);
  }
  function strings(value, label) {
    assert(Array.isArray(value) && value.length <= 10000, `Некорректный список: ${label}`);
    value.forEach(x => text(x, label));
  }
  function validateBlock(b, depth = 0) {
    assert(b && typeof b === 'object' && depth < 8, 'Некорректный блок текста');
    if (['paragraph', 'heading', 'quote'].includes(b.type)) text(b.text, 'текст');
    else if (b.type === 'list') strings(b.items, 'пункты списка');
    else if (b.type === 'table') {
      text(b.caption, 'подпись таблицы'); strings(b.headers, 'заголовки таблицы');
      assert(b.headers.length > 0 && Array.isArray(b.rows), 'Пустая таблица');
      b.rows.forEach(row => {
        assert(Array.isArray(row) && row.length === b.headers.length, 'Число ячеек таблицы не совпадает');
        row.forEach(cell => assert(typeof cell === 'string' && cell.length <= 100000, 'Некорректное поле: ячейки'));
      });
    } else if (b.type === 'box') {
      text(b.title, 'заголовок вставки'); assert(Array.isArray(b.blocks), 'Нет содержимого вставки');
      b.blocks.forEach(x => validateBlock(x, depth + 1));
    } else if (b.type === 'figure') {
      text(b.caption, 'подпись рисунка'); text(b.alt, 'описание рисунка');
      assert(typeof b.src === 'string' && /^assets\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/.test(b.src), 'Рисунок должен находиться в assets/');
    } else throw new Error('Неизвестный тип блока');
    if (b.type === 'heading' && b.level !== undefined) assert(Number.isInteger(b.level) && b.level >= 2 && b.level <= 6, 'Некорректный уровень заголовка');
  }
  function validateBook(book) {
    assert(book && book.schemaVersion === 1 && book.id === BOOK_ID, 'Это не пакет для данного учебника');
    assert(Number.isInteger(book.revision) && book.revision >= 0, 'Некорректная версия');
    text(book.title, 'название'); text(book.edition, 'издание');
    assert(typeof book.outlineComplete === 'boolean', 'Не указан статус оглавления');
    assert(Array.isArray(book.chapters) && Array.isArray(book.glossary), 'Нет глав или словаря');
    const ids = new Set();
    function id(value) { assert(typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,100}$/.test(value) && !['general', 'constructor', 'prototype'].includes(value) && !ids.has(value), 'Повторяющийся или некорректный идентификатор'); ids.add(value); }
    if (book.source) {
      text(book.source.filename, 'имя PDF');
      assert(/^[a-f0-9]{64}$/.test(book.source.sha256), 'Нет контрольной суммы исходного PDF');
      assert(Number.isInteger(book.source.pageCount) && book.source.pageCount > 0, 'Не указано число страниц PDF');
    }
    assert(!book.chapters.length || book.source, 'Для оглавления требуется источник');
    for (const chapter of book.chapters) {
      id(chapter.id); text(chapter.title, 'название главы'); text(chapter.originalTitle, 'исходное название главы');
      assert(Array.isArray(chapter.sections), 'Нет списка разделов');
      let previousLevel = 0;
      for (const s of chapter.sections) {
        id(s.id); text(s.title, 'название раздела'); text(s.originalTitle, 'исходное название раздела');
        assert(Number.isInteger(s.level) && s.level >= 1 && s.level <= 6 && s.level <= previousLevel + 1, 'Нарушена вложенность разделов'); previousLevel = s.level;
        assert(statuses.includes(s.status), 'Неизвестный статус перевода');
        assert(Number.isInteger(s.revision) && s.revision >= 1, 'Не указана версия раздела');
        const p = s.source;
        assert(p && Number.isInteger(p.pdfStart) && Number.isInteger(p.pdfEnd) && p.pdfStart >= 1 && p.pdfStart <= p.pdfEnd && p.pdfEnd <= book.source.pageCount, 'Некорректные страницы источника');
        if (p.printedPages !== undefined) text(p.printedPages, 'печатные страницы');
        assert(Array.isArray(s.blocks) && Array.isArray(s.summary), 'Нет текста или тезисов');
        s.blocks.forEach(b => validateBlock(b)); strings(s.summary, 'тезисы');
        if (s.editorNotes !== undefined) strings(s.editorNotes, 'примечания к переводу');
        if (s.status === 'pending') assert(!s.blocks.length && !s.summary.length, 'Ожидающий перевода раздел должен быть пустым');
        else assert(s.blocks.length > 0, 'Пустой перевод');
        if (readable(s)) { text(s.checkedAgainstSourceAt, 'дата сверки с PDF'); assert(s.summary.length > 0, 'Нет тезисов для конспекта'); }
        if (s.status === 'partial') {
          const c = s.coverage;
          assert(c && Number.isInteger(c.pdfStart) && Number.isInteger(c.pdfEnd) && c.pdfStart >= p.pdfStart && c.pdfStart <= c.pdfEnd && c.pdfEnd <= p.pdfEnd, 'Не указаны точные границы частичного перевода');
          text(c.printedPages, 'переведённые печатные страницы'); text(c.through, 'граница перевода'); text(c.next, 'продолжение перевода');
        }
        if (s.status === 'reviewed') text(s.reviewedBy, 'клинический редактор');
      }
    }
    if (book.outlineComplete) assert(book.chapters.length > 0, 'Полное оглавление не может быть пустым');
    book.glossary.forEach(g => { text(g.en, 'термин на английском'); text(g.ru, 'перевод термина'); if (g.note) text(g.note, 'примечание термина'); });
    return book;
  }
  function flatten(book) { return book.chapters.flatMap(c => c.sections.map(s => ({...s, chapter: c}))); }
  function isRead(s, state, book) { return ready(s) && state.completed[s.id]?.revision === s.revision && state.completed[s.id]?.source === book.source?.sha256; }
  function isPartRead(s, state, book) { return s.status === 'partial' && state.completed[s.id]?.revision === s.revision && state.completed[s.id]?.source === book.source?.sha256; }
  function stats(book, state) {
    const sections = flatten(book); const translated = sections.filter(ready).length;
    return {total: sections.length, translated, read: sections.filter(s => isRead(s, state, book)).length, partial: sections.filter(s => s.status === 'partial').length, partialRead: sections.filter(s => isPartRead(s, state, book)).length, draft: sections.filter(s => s.status === 'draft').length};
  }
  function emptyState() { return {schemaVersion: 1, bookId: BOOK_ID, notes: {}, completed: {}, lastSection: null, positions: {}, rate: 1, voice: '', fontSize: 20}; }
  function cleanState(raw) {
    assert(raw && raw.schemaVersion === 1 && raw.bookId === BOOK_ID, 'Резервная копия относится к другому учебнику');
    const s = emptyState();
    for (const key of ['notes', 'completed', 'positions']) assert(raw[key] && typeof raw[key] === 'object' && !Array.isArray(raw[key]), 'Повреждённая резервная копия');
    for (const [key, val] of Object.entries(raw.notes)) {
      assert(/^[a-z0-9][a-z0-9-]{0,100}$/.test(key) && typeof val === 'string' && val.length <= 1000000, 'Повреждённая заметка');
      s.notes[key] = val;
    }
    for (const [key, val] of Object.entries(raw.completed)) if (/^[a-z0-9][a-z0-9-]{0,100}$/.test(key) && val && Number.isInteger(val.revision) && /^[a-f0-9]{64}$/.test(val.source)) s.completed[key] = {revision: val.revision, source: val.source};
    for (const [key, val] of Object.entries(raw.positions)) if (/^[a-z0-9][a-z0-9-]{0,100}$/.test(key) && Number.isFinite(val) && val >= 0) s.positions[key] = val;
    s.lastSection = typeof raw.lastSection === 'string' ? raw.lastSection : null;
    s.rate = [0.75, 1, 1.25, 1.5].includes(raw.rate) ? raw.rate : 1;
    s.fontSize = [18, 20, 22, 24].includes(raw.fontSize) ? raw.fontSize : 20;
    s.voice = typeof raw.voice === 'string' ? raw.voice : '';
    return s;
  }
  function blockText(b) {
    if (b.type === 'list') return b.items.join('. ');
    if (b.type === 'table') return [b.caption, b.headers.join('. '), ...b.rows.map(r => r.map((v,i) => `${b.headers[i]}: ${v}`).join('. '))].join('. ');
    if (b.type === 'box') return b.title + '. ' + b.blocks.map(blockText).join('\n');
    if (b.type === 'figure') return b.caption + '. ' + b.alt;
    return b.text;
  }
  function chunks(text, max = 220) {
    const out = []; let part = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (part && part.length + word.length + 1 > max) { out.push(part); part = ''; }
      if (word.length > max) { if (part) { out.push(part); part = ''; } for (let i = 0; i < word.length; i += max) out.push(word.slice(i, i + max)); }
      else part += (part ? ' ' : '') + word;
    }
    if (part) out.push(part);
    return out;
  }
  scope.StudyModel = {BOOK_ID, validateBook, flatten, ready, readable, isRead, isPartRead, stats, emptyState, cleanState, blockText, chunks};
})(globalThis);
