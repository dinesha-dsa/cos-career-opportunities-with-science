(() => {
  const paths = [
    { name: 'Engineering', symbol: '∑', description: 'Computing, electronics, machines and infrastructure' },
    { name: 'Architecture', symbol: '⌂', description: 'Buildings, public spaces and urban planning' },
    { name: 'Medical', symbol: '+', description: 'Medicine, dentistry, nursing and allied health' },
    { name: 'Maritime', symbol: '≈', description: 'Marine engineering, nautical science and shipping' },
    { name: 'Science', symbol: 'π', description: 'Research, lab work and core sciences' },
    { name: 'Design', symbol: '✧', description: 'Products, communication and user experience' },
    { name: 'Defence', symbol: '◇', description: 'Officer entry through the NDA and Naval Academy' },
  ];

  const interests = [
    ['Engineering', 'Build, program or troubleshoot a device'],
    ['Architecture', 'Sketch a building or improve a shared space'],
    ['Medical', 'Understand the body and help people recover'],
    ['Maritime', 'Learn how ships operate and navigate'],
    ['Science', 'Run an experiment to answer a question'],
    ['Design', 'Make a product or message easier to use'],
    ['Defence', 'Lead a team in a structured outdoor challenge'],
  ];

  const environments = [
    ['Engineering', 'A workshop, coding desk or engineering site'],
    ['Architecture', 'A design studio and visits to building sites'],
    ['Medical', 'A clinic, hospital or community health setting'],
    ['Maritime', 'A ship, port or marine workshop'],
    ['Science', 'A research lab, field site or data workspace'],
    ['Design', 'A studio where you can prototype and talk to users'],
    ['Defence', 'A training environment with teamwork and physical activity'],
  ];

  const preference = (prompt, options) => ({ prompt, options: [...options.map(([path, label]) => ({ path, label })), { label: 'I’m still exploring' }] });
  const task = (path, prompt, choices, correct) => ({ path, prompt, correct, options: [...choices.map(label => ({ label })), { label: 'Skip this question' }] });

  const questions = [
    preference('Which project would you most like to try?', interests),
    preference('Which work setting appeals to you most?', environments),
    task('Engineering', 'A motor moves a belt 12 metres in 6 seconds at a steady rate. How far does the belt move in 15 seconds?', ['18 metres', '30 metres', '36 metres'], 1),
    task('Architecture', 'On a floor plan at 1:100 scale, a wall is 4 cm long. How long is the actual wall?', ['40 cm', '40 m', '4 m'], 2),
    task('Medical', 'Which blood component mainly carries oxygen around the body?', ['Red blood cells', 'Platelets', 'White blood cells'], 0),
    task('Maritime', 'A ship travels 24 nautical miles in 2 hours. What is its average speed?', ['24 knots', '12 knots', '48 knots'], 1),
    task('Science', 'To test how light affects plant growth, which experiment best isolates the effect of light?', ['Change the water and light together', 'Compare different species in different light', 'Keep plant type, soil and water the same and change only the light'], 2),
    task('Design', 'Students cannot find the “Apply” button. What should you do first to understand why?', ['Observe where students look and where they get stuck', 'Add more text to the page', 'Change every button’s colour'], 0),
    task('Defence', 'Your team receives conflicting times for a briefing. What is the best first step?', ['Pick the earlier time without checking', 'Confirm the time with the coordinator and tell the whole team', 'Wait for someone else to decide'], 1),
  ];

  function recommend(answers) {
    const scores = new Map(paths.map(path => [path.name, { ...path, interest: 0, task: 0 }]));
    questions.forEach((question, index) => {
      const answer = question.options[answers[index]];
      if (answer?.path) scores.get(answer.path).interest += 1;
      if (question.path && answers[index] === question.correct) scores.get(question.path).task = 1;
    });

    const choices = [...scores.values()].filter(path => path.interest || path.task);
    choices.sort((left, right) => right.interest - left.interest || right.task - left.task);
    const lastIncluded = choices[Math.min(choices.length, 3) - 1];
    if (!lastIncluded) return [];
    return choices.filter(path => path.interest > lastIncluded.interest ||
      (path.interest === lastIncluded.interest && path.task >= lastIncluded.task));
  }

  globalThis.ACADEMY_CAREER = { paths, questions, recommend };
})();
