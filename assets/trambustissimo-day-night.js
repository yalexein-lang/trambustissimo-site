(() => {
  'use strict';
  const DAY_START = 7;
  const NIGHT_START = 19;
  let timer = 0;

  function themeForLocalTime(date = new Date()) {
    const hour = date.getHours() + date.getMinutes() / 60;
    return hour >= DAY_START && hour < NIGHT_START ? 'day' : 'night';
  }

  function apply() {
    const theme = themeForLocalTime();
    const root = document.documentElement;
    if (root.dataset.trambTheme !== theme) root.dataset.trambTheme = theme;
    root.style.colorScheme = theme === 'day' ? 'light' : 'dark';
    return theme;
  }

  function scheduleNextCheck() {
    clearTimeout(timer);
    const now = new Date();
    const next = new Date(now);
    const isDay = themeForLocalTime(now) === 'day';
    next.setHours(isDay ? NIGHT_START : DAY_START, 0, 2, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    timer = window.setTimeout(() => { apply(); scheduleNextCheck(); }, Math.max(1000, next - now));
  }

  apply();
  scheduleNextCheck();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { apply(); scheduleNextCheck(); } });
  window.addEventListener('focus', () => { apply(); scheduleNextCheck(); }, { passive: true });
})();
