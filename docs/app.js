(() => {
  const byId = id => document.getElementById(id);
  const { paths, questions, recommend } = globalThis.ACADEMY_CAREER;
  const { checkedOn, exams, cutoffs } = globalThis.ADMISSIONS ?? { exams: [], cutoffs: [] };
  const search = byId('exam-search');
  const track = byId('exam-track');
  const status = byId('exam-status');
  const cutoffTrack = byId('cutoff-track');
  const quiz = byId('career-quiz');
  const answers = [];
  const pageSize = 9;
  const statusOrder = ['Open', 'Upcoming', 'Watch', 'Closed'];
  let visibleExams = pageSize;
  let questionIndex = 0;

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function button(label, className, onClick) {
    const node = element('button', label, `button ${className}`);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  function link(label, url, className) {
    let href;
    try { href = new URL(url); } catch { return element('span', 'Link pending'); }
    if (href.protocol !== 'https:') return element('span', 'Link pending');
    const anchor = element('a', label, className);
    anchor.href = href.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  }

  function examFilterChanged() {
    visibleExams = pageSize;
    renderExams();
  }

  function selectPath(name) {
    search.value = '';
    track.value = name;
    status.value = '';
    cutoffTrack.value = name;
    examFilterChanged();
    renderCutoffs();
    window.location.hash = 'exams';
    byId('exams').scrollIntoView();
    byId('exams-title').focus({ preventScroll: true });
  }

  function renderPaths() {
    for (const path of paths) {
      const card = element('button', undefined, 'career-card');
      card.type = 'button';
      const symbol = element('span', path.symbol, 'path-symbol');
      const arrow = element('span', '↗', 'path-arrow');
      symbol.setAttribute('aria-hidden', 'true');
      arrow.setAttribute('aria-hidden', 'true');
      card.append(symbol, arrow, element('strong', path.name), element('small', path.description));
      card.addEventListener('click', () => selectPath(path.name));
      byId('career-grid').append(card);
    }
    const labels = new Set([...paths.map(path => path.name), ...exams.map(exam => exam.track), ...cutoffs.map(row => row.track)]);
    for (const name of labels) {
      track.add(new Option(name));
      cutoffTrack.add(new Option(name));
    }
  }

  function makeExamCard(exam) {
    const card = element('article', undefined, 'exam-card');
    const meta = element('div', undefined, 'exam-meta');
    meta.append(element('span', exam.track), element('span', exam.status, `pill ${exam.status.toLowerCase()}`));
    const facts = element('dl');
    for (const [label, value] of [['Deadline', exam.deadline], ['Exam', exam.exam], ['Fee', exam.fee]]) {
      facts.append(element('dt', label), element('dd', value));
    }
    const details = element('details');
    details.append(element('summary', 'Documents and admission route'), element('p', exam.docs), element('p', exam.details));
    const actions = element('div', undefined, 'exam-actions');
    actions.append(link(exam.status === 'Open' ? 'Official application ↗' : 'Official portal ↗', exam.url, 'button dark'));
    if (exam.source && exam.source !== exam.url) actions.append(link('Notice or bulletin ↗', exam.source, 'text-link'));
    card.append(meta, element('h3', exam.name), facts, details, actions);
    return card;
  }

  function renderExams() {
    const keyword = search.value.trim().toLowerCase();
    const matches = exams.filter(exam => {
      const text = [exam.name, exam.track, exam.details].join(' ').toLowerCase();
      return text.includes(keyword) && (!track.value || track.value === exam.track) && (!status.value || status.value === exam.status);
    }).sort((left, right) => statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status));
    const grid = byId('exam-grid');
    const shown = matches.slice(0, visibleExams);
    byId('exam-count').textContent = matches.length ? `Showing ${shown.length} of ${matches.length} routes` : '0 routes';
    grid.replaceChildren(...shown.map(makeExamCard));
    for (const heading of grid.querySelectorAll('h3')) heading.tabIndex = -1;
    if (!matches.length) grid.append(element('p', exams.length ? 'No routes match these filters.' : 'The admissions list is temporarily unavailable.', 'empty'));
    if (matches.length > shown.length) {
      const more = button('Show more exams', 'light', () => {
        const firstNew = visibleExams;
        visibleExams += pageSize;
        renderExams();
        grid.children[firstNew]?.querySelector('h3')?.focus();
      });
      grid.append(more);
    }
  }

  function renderCutoffs() {
    const body = byId('cutoff-rows');
    const shown = cutoffs.filter(row => !cutoffTrack.value || cutoffTrack.value === row.track);
    body.replaceChildren(...shown.map(row => {
      const tr = element('tr');
      for (const cell of [row.college, row.metric, row.value, row.scope]) tr.append(element('td', cell));
      const source = element('td');
      source.append(link('Official data ↗', row.source));
      tr.append(source);
      return tr;
    }));
    if (!shown.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 5;
      cell.textContent = 'No benchmark is listed for this path. Check the relevant admissions portal for counselling results.';
    }
  }

  function focusQuizHeading(heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }

  function renderQuestion() {
    if (questionIndex === questions.length) {
      renderResults();
      return;
    }
    const question = questions[questionIndex];
    const heading = element('h3', 'Career exploration quiz');
    const progress = element('p', `Question ${questionIndex + 1} of ${questions.length}`, 'quiz-progress');
    const form = element('form');
    const choices = element('fieldset');
    choices.append(element('legend', question.prompt));
    for (const [index, option] of question.options.entries()) {
      const label = element('label', undefined, 'option');
      const radio = element('input');
      radio.type = 'radio';
      radio.name = 'answer';
      radio.value = index;
      radio.required = true;
      radio.checked = answers[questionIndex] === index;
      label.append(radio, document.createTextNode(option.label));
      choices.append(label);
    }
    choices.addEventListener('change', event => { answers[questionIndex] = Number(event.target.value); });
    const next = element('button', questionIndex === questions.length - 1 ? 'See suggested paths' : 'Continue', 'button dark');
    next.type = 'submit';
    const controls = element('div', undefined, 'quiz-actions');
    if (questionIndex) controls.append(button('Back', 'light', () => { questionIndex -= 1; renderQuestion(); }));
    controls.append(next);
    form.append(choices, controls);
    form.addEventListener('submit', event => { event.preventDefault(); questionIndex += 1; renderQuestion(); });
    quiz.replaceChildren(heading, progress, form);
    if (!questionIndex) heading.after(element('p', 'Choose what interests you and try short sample tasks. Your answers stay in this tab. This quiz is for exploration and does not measure IQ.'));
    focusQuizHeading(heading);
  }

  function renderResults() {
    const heading = element('h3', 'Paths to explore');
    const suggestions = recommend(answers);
    const results = element('div', undefined, 'quiz-results');
    const descriptions = ['Based on your interest and the sample task.', 'Based on the interest you selected.', 'Based on your answer to the sample task.'];
    for (const path of suggestions) {
      const card = element('article', undefined, 'result-card');
      const reason = path.interest ? (path.task ? descriptions[0] : descriptions[1]) : descriptions[2];
      card.append(element('h4', path.name), element('p', reason), button('See exams ↗', 'dark', () => selectPath(path.name)));
      results.append(card);
    }
    const controls = element('div', undefined, 'quiz-actions');
    controls.append(button('Review last answer', 'light', () => { questionIndex -= 1; renderQuestion(); }), button('Start again', 'light', () => { answers.length = 0; questionIndex = 0; renderQuestion(); }));
    quiz.replaceChildren(heading, element('p', suggestions.length ? 'Start with these options, then check course eligibility and talk through your shortlist.' : 'Browse any career path above, or try the quiz again when you are ready.'), results, controls);
    focusQuizHeading(heading);
  }

  function setBookingLink() {
    const configured = globalThis.ACADEMY_CONFIG?.bookingUrl ?? '';
    const anchor = byId('book-link');
    const url = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(configured) ? configured : '';
    anchor.hidden = !url;
    if (url) anchor.href = url;
    byId('book-status').textContent = url ? '' : 'Online booking is being set up. Contact COS about a counselling slot.';
  }

  renderPaths();
  if (checkedOn) {
    const checked = new Date(`${checkedOn}T12:00:00+05:30`);
    const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(checked);
    byId('checked-date').textContent = `Official notices checked ${dateLabel}`;
  }
  document.querySelectorAll('[data-quiz]').forEach(anchor => anchor.addEventListener('click', () => {
    quiz.hidden = false;
    if (!quiz.hasChildNodes()) renderQuestion();
  }));
  document.querySelector('[data-open-exams]').addEventListener('click', () => {
    search.value = '';
    track.value = '';
    status.value = 'Open';
    examFilterChanged();
  });
  byId('reset-filters').addEventListener('click', () => {
    search.value = '';
    track.value = '';
    status.value = '';
    examFilterChanged();
  });
  search.addEventListener('input', examFilterChanged);
  track.addEventListener('change', examFilterChanged);
  status.addEventListener('change', examFilterChanged);
  cutoffTrack.addEventListener('change', renderCutoffs);
  document.querySelector('.session a').addEventListener('click', () => { byId('documents').open = true; });
  if (window.location.hash === '#career-quiz') {
    quiz.hidden = false;
    renderQuestion();
  }
  if (window.location.hash === '#documents') byId('documents').open = true;
  renderExams();
  renderCutoffs();
  setBookingLink();
})();
