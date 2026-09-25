const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Offline demo can continue without persistence. */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ }
  }
};

const stops = ['Kakinada', 'Samalkota', 'Pithapuram', 'Peddapuram', 'Anaparthi', 'Rajahmundry', 'Amalapuram', 'Tuni', 'Annavaram', 'Yanam', 'Mandapeta', 'Ramachandrapuram', 'Visakhapatnam'];
const routes = {
  12: { total: 30, occupied: 12, from: 'Kakinada', via: 'Anaparthi', to: 'Rajahmundry', stop: '08', time: '06:45', minutes: 3, duration: 18, fare: 20, accessible: true, tags: ['frequent', 'accessible'] },
  7: { total: 30, occupied: 21, from: 'Kakinada', via: 'Samalkota', to: 'Pithapuram', stop: '14', time: '06:50', minutes: 8, duration: 24, fare: 20, accessible: false, tags: ['frequent'] },
  21: { total: 40, occupied: 15, from: 'Kakinada', via: 'Ramachandrapuram', to: 'Amalapuram', stop: '03', time: '06:53', minutes: 11, duration: 16, fare: 25, accessible: true, tags: ['accessible'] },
  15: { total: 32, occupied: 14, from: 'Kakinada', via: 'Pithapuram', to: 'Tuni', stop: '06', time: '07:10', minutes: 12, duration: 28, fare: 22, accessible: true, tags: ['frequent', 'accessible'] },
  9: { total: 30, occupied: 16, from: 'Rajahmundry', via: 'Anaparthi', to: 'Kakinada', stop: '11', time: '07:25', minutes: 9, duration: 19, fare: 20, accessible: false, tags: ['frequent'] },
  18: { total: 36, occupied: 18, from: 'Kakinada', via: 'Tuni', to: 'Visakhapatnam', stop: '05', time: '07:40', minutes: 15, duration: 33, fare: 35, accessible: true, tags: ['accessible', 'frequent'] },
  25: { total: 32, occupied: 17, from: 'Kakinada', via: 'Amalapuram', to: 'Yanam', stop: '09', time: '08:00', minutes: 18, duration: 26, fare: 24, accessible: false, tags: ['frequent'] },
  31: { total: 28, occupied: 13, from: 'Peddapuram', via: 'Samalkota', to: 'Kakinada', stop: '12', time: '08:15', minutes: 20, duration: 22, fare: 18, accessible: true, tags: ['accessible'] }
};
const alerts = [
  { type: 'normal', label: 'Network operating normally', copy: 'All Kakinada-area routes are running to schedule.' },
  { type: 'delay', label: 'Route 07', copy: 'Minor delay near Samalkota.' },
  { type: 'change', label: 'Route 21', copy: 'Temporary stop change at Ramachandrapuram.' }
];
const defaultSettings = { theme: 'dark', highContrast: false, largeText: false, notifications: true, accessibleFirst: false };
let settings = { ...defaultSettings, ...storage.get('superbus-settings', {}) };
let selectedRoute = '12';
let countdownTimer;

function scrollToTarget(selector) {
  const target = $(selector);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.body.classList.toggle('high-contrast', settings.highContrast);
  document.body.classList.toggle('large-text', settings.largeText);
  const themeSelect = $('#theme-select');
  const highContrast = $('#high-contrast');
  const largeText = $('#large-text');
  const notifications = $('#enable-notifications');
  const accessibleFirst = $('#accessible-first');
  if (themeSelect) themeSelect.value = settings.theme;
  if (highContrast) highContrast.checked = settings.highContrast;
  if (largeText) largeText.checked = settings.largeText;
  if (notifications) notifications.checked = settings.notifications;
  if (accessibleFirst) accessibleFirst.checked = settings.accessibleFirst;
  const toggle = $('#theme-toggle');
  if (toggle) toggle.textContent = settings.theme === 'dark' ? 'Light' : 'Dark';
  const notificationPanel = $('#notifications-panel');
  if (!settings.notifications && notificationPanel) notificationPanel.hidden = true;
  if (!settings.notifications && $('#notification-count')) $('#notification-count').textContent = '0';
  sortDepartures();
}

function saveSettings() {
  storage.set('superbus-settings', settings);
  applySettings();
}

function populateStopSelects() {
  const ids = ['planner-from', 'planner-to', 'fare-from', 'fare-to'];
  ids.forEach((id) => {
    const select = $(`#${id}`);
    if (!select) return;
    stops.forEach((stop) => {
      const option = document.createElement('option');
      option.value = stop;
      option.textContent = stop;
      select.append(option);
    });
  });
}

function routeMatches(route, from, to) {
  const path = [route.from, route.via, route.to];
  return path.includes(from) && path.includes(to) && path.indexOf(from) < path.indexOf(to);
}

function routeResult(routeNumber) {
  const route = routes[routeNumber];
  const available = route.total - route.occupied;
  const card = document.createElement('article');
  card.className = 'planner-result';
  card.innerHTML = `<div><strong>BUS ${routeNumber}</strong><p>${route.from} &rarr; ${route.to}</p><small>Via ${route.via}</small></div><span>${route.duration} min<br>₹${route.fare}<br>${available} seats available</span><button class="text-button planner-view-route" data-route="${routeNumber}" type="button">View Bus</button>`;
  return card;
}

function findRoutes() {
  const from = $('#planner-from')?.value;
  const to = $('#planner-to')?.value;
  const output = $('#planner-results');
  if (!output) return;
  output.innerHTML = '';
  if (!from || !to || from === to) {
    output.innerHTML = '<p class="inline-message">Select two different stops to find a route.</p>';
    return;
  }
  const matching = Object.keys(routes).filter((number) => routeMatches(routes[number], from, to));
  if (!matching.length) {
    output.innerHTML = '<p class="inline-message">No direct route found. Try another destination.</p>';
    return;
  }
  matching.forEach((number) => output.append(routeResult(number)));
  $$('.planner-view-route', output).forEach((button) => button.addEventListener('click', () => openBusDetails(button.dataset.route)));
  storage.set('superbus-history', [{ from, to }, ...storage.get('superbus-history', []).filter((item) => item.from !== from || item.to !== to)].slice(0, 5));
  renderHistory();
}

function filterDepartures() {
  const query = ($('#route-search')?.value || '').trim().toLowerCase();
  const active = $('.filter-tab.active')?.dataset.filter || 'all';
  let visible = 0;
  $$('.departure-row').forEach((row) => {
    const matchesText = row.textContent.toLowerCase().includes(query) || row.dataset.route.includes(query);
    const matchesFilter = active === 'all' || row.dataset.tags.includes(active);
    const show = matchesText && matchesFilter;
    row.hidden = !show;
    if (show) visible += 1;
  });
  const noResults = $('#no-results');
  if (noResults) noResults.hidden = visible !== 0;
  if (query) storage.set('superbus-history', [{ query }, ...storage.get('superbus-history', []).filter((item) => item.query !== query)].slice(0, 5));
  renderHistory();
}

function sortDepartures() {
  const list = $('#departure-list');
  if (!list) return;
  const rows = $$('.departure-row', list);
  rows.sort((a, b) => {
    if (!settings.accessibleFirst) return 0;
    return Number(b.dataset.tags.includes('accessible')) - Number(a.dataset.tags.includes('accessible'));
  }).forEach((row) => list.append(row));
}

function renderHistory() {
  const target = $('#history-list');
  if (!target) return;
  const history = storage.get('superbus-history', []);
  target.innerHTML = history.length ? history.map((item) => `<button class="history-item" data-history='${JSON.stringify(item)}' type="button">${item.query || `${item.from} &rarr; ${item.to}`}</button>`).join('') : '<p class="empty-state">No recent searches yet.</p>';
  $$('.history-item', target).forEach((button) => button.addEventListener('click', () => {
    const item = JSON.parse(button.dataset.history);
    if (item.query && $('#route-search')) { $('#route-search').value = item.query; filterDepartures(); scrollToTarget('#departures'); }
    if (item.from) { $('#planner-from').value = item.from; $('#planner-to').value = item.to; findRoutes(); scrollToTarget('#journey-planner'); }
  }));
}

function renderSeatMap(total, occupied) {
  const seatMap = $('#seat-map');
  if (!seatMap) return;
  seatMap.innerHTML = '';
  for (let number = 1; number <= total; number += 1) {
    const seat = document.createElement('button');
    seat.className = `seat ${number <= occupied ? 'occupied' : 'available'}`;
    seat.type = 'button';
    seat.textContent = String(number).padStart(2, '0');
    seat.setAttribute('aria-label', `${number <= occupied ? 'Occupied' : 'Available'} seat ${number}`);
    if (number <= occupied) {
      seat.disabled = true;
    } else {
      seat.addEventListener('click', () => {
        seat.classList.toggle('selected');
        const selected = $$('.seat.selected', seatMap);
        const feedback = $('#seat-feedback');
        if (feedback) feedback.textContent = seat.classList.contains('selected') ? `Seat ${number} selected. ${selected.length} selected total.` : `${selected.length} selected. Seat ${number} available again.`;
      });
    }
    seatMap.append(seat);
  }
}

function updateSeatAvailability(busNumber) {
  const route = routes[busNumber];
  if (!route) return;
  selectedRoute = String(busNumber);
  const empty = route.total - route.occupied;
  const percentage = Math.round((route.occupied / route.total) * 100);
  const status = empty === 0 ? 'BUS FULL' : empty <= 5 ? 'ALMOST FULL' : 'SEATS AVAILABLE';
  const fill = $('#capacity-fill');
  if ($('#selected-bus')) $('#selected-bus').textContent = busNumber;
  if ($('#empty-seats')) $('#empty-seats').textContent = empty;
  if ($('#occupied-seats')) $('#occupied-seats').textContent = route.occupied;
  if ($('#total-seats')) $('#total-seats').textContent = route.total;
  if ($('#capacity-percent')) $('#capacity-percent').textContent = `${percentage}% occupied`;
  if ($('#seat-status')) $('#seat-status').textContent = status;
  if (fill) { fill.style.width = `${percentage}%`; fill.style.background = empty === 0 ? 'var(--red)' : empty <= 5 ? 'var(--orange)' : 'var(--green)'; }
  if ($('#map-bus')) $('#map-bus').textContent = busNumber;
  if ($('#next-bus')) $('#next-bus').textContent = busNumber;
  if ($('#current-stop')) $('#current-stop').textContent = route.via;
  if ($('#next-stop-name')) $('#next-stop-name').textContent = route.to;
  if ($('#next-eta')) $('#next-eta').textContent = `${route.minutes} min`;
  renderSeatMap(route.total, route.occupied);
}

function openBusDetails(busNumber) {
  const route = routes[busNumber];
  if (!route) return;
  updateSeatAvailability(busNumber);
  const values = { '#detail-title': `Bus ${busNumber}`, '#detail-route': `${route.from} -> ${route.to}`, '#detail-via': route.via, '#detail-stop': route.stop, '#detail-time': route.time, '#detail-duration': `${route.duration} minutes`, '#detail-fare': `₹${route.fare}`, '#detail-accessibility': route.accessible ? 'Wheelchair accessible' : 'Limited accessibility', '#detail-seats': `${route.total - route.occupied} available / ${route.total} total` };
  Object.entries(values).forEach(([selector, value]) => { if ($(selector)) $(selector).textContent = value; });
  const modal = $('#bus-detail-modal');
  if (modal) modal.hidden = false;
}

function renderFavorites() {
  const favorites = storage.get('superbus-favorites', []);
  $$('.favorite-button').forEach((button) => {
    const saved = favorites.includes(button.dataset.favorite);
    button.textContent = saved ? '★' : '☆';
    button.classList.toggle('is-favorite', saved);
  });
  const target = $('#favorites-list');
  if (!target) return;
  target.innerHTML = favorites.length ? favorites.map((number) => {
    const route = routes[number];
    const label = route ? `${route.from} → ${route.to}` : `Bus ${number}`;
    return `<button class="favorite-item" data-route="${number}" type="button">★ ${label}<span>Remove</span></button>`;
  }).join('') : '<p class="empty-state">Star a route to save it here.</p>';
  $$('.favorite-item', target).forEach((button) => button.addEventListener('click', () => toggleFavorite(button.dataset.route)));
}

function toggleFavorite(number) {
  const favorites = storage.get('superbus-favorites', []);
  storage.set('superbus-favorites', favorites.includes(String(number)) ? favorites.filter((item) => item !== String(number)) : [...favorites, String(number)]);
  renderFavorites();
}

function renderAlerts(filter = 'all') {
  const target = $('#alert-list');
  if (!target) return;
  target.innerHTML = alerts.filter((alert) => filter === 'all' || alert.type === filter).map((alert) => `<article class="alert-item alert-${alert.type}"><strong>${alert.label}</strong><span>${alert.copy}</span></article>`).join('');
}

function calculateFare() {
  const from = $('#fare-from')?.value;
  const to = $('#fare-to')?.value;
  const output = $('#fare-output');
  if (!output) return;
  if (!from || !to || from === to) { output.textContent = 'Choose two different stops to calculate a local demo fare.'; return; }
  const route = Object.values(routes).find((item) => routeMatches(item, from, to));
  output.textContent = route ? `Estimated fare: ₹${route.fare} | Estimated journey: ${route.duration} minutes` : 'Estimated fare: ₹30 | Estimated journey: 28 minutes';
}

function updateCo2() {
  const trips = Math.max(0, Number($('#co2-trips')?.value || 0));
  if ($('#co2-output')) $('#co2-output').textContent = `Estimated CO2 saved: ${(trips * .72).toFixed(1)} kg`;
}

function renderNotifications() {
  const target = $('#notification-list');
  if (!target) return;
  const notes = [{ time: '3 min ago', text: 'Bus 12 is arriving soon.' }, { time: '10 min ago', text: 'Route 07 has a minor delay.' }, { time: '25 min ago', text: 'Your favorite route is operating normally.' }];
  target.innerHTML = notes.map((note) => `<article><small>${note.time}</small><p>${note.text}</p></article>`).join('');
  const count = $('#notification-count');
  if (count) count.textContent = !settings.notifications || storage.get('superbus-notifications-read', false) ? '0' : String(notes.length);
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    $$('.departure-time strong[data-minutes]').forEach((element) => {
      const next = Number(element.dataset.minutes) - 1;
      element.dataset.minutes = String(next <= 0 ? 3 : next);
      element.textContent = next <= 0 ? 'Due' : `${next} min`;
    });
    const active = $(`.departure-row[data-route="${selectedRoute}"] .departure-time strong`);
    if (active && $('#next-eta')) $('#next-eta').textContent = active.textContent;
  }, 60000);
}

function animateCounters() {
  $$('[data-counter]').forEach((element) => {
    const value = Number(element.dataset.counter);
    let current = 0;
    const step = value / 24;
    const timer = setInterval(() => { current = Math.min(value, current + step); element.textContent = Number.isInteger(value) ? Math.round(current) : current.toFixed(1); if (current >= value) clearInterval(timer); }, 35);
  });
}

function togglePanel(id, show) { const panel = $(`#${id}`); if (panel) panel.hidden = show === undefined ? !panel.hidden : !show; }
function closeModal(id) { const modal = $(`#${id}`); if (modal) modal.hidden = true; }

function resetAll() {
  if (!window.confirm('Reset all demo transport data?')) return;
  localStorage.clear();
  window.location.reload();
}

function setupNavigation() {
  $$('[data-scroll-target]').forEach((button) => button.addEventListener('click', () => scrollToTarget(button.dataset.scrollTarget)));
  $$('.main-nav a').forEach((link) => link.addEventListener('click', () => $('.main-nav')?.classList.remove('mobile-open')));
  const sections = $$('#network, #departures, #about');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) $$('.main-nav a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`)); }), { rootMargin: '-25% 0px -65% 0px' });
    sections.forEach((section) => observer.observe(section));
  }
  $('.menu-toggle')?.addEventListener('click', (event) => { const open = event.currentTarget.getAttribute('aria-expanded') === 'true'; event.currentTarget.setAttribute('aria-expanded', String(!open)); $('.main-nav')?.classList.toggle('mobile-open', !open); });
}

function setupEvents() {
  $('#find-routes')?.addEventListener('click', findRoutes);
  $('#route-search')?.addEventListener('input', filterDepartures);
  $$('.filter-tab').forEach((button) => button.addEventListener('click', () => { $$('.filter-tab').forEach((item) => item.classList.remove('active')); button.classList.add('active'); filterDepartures(); }));
  $$('.row-arrow').forEach((button) => button.addEventListener('click', () => openBusDetails(button.closest('.departure-row')?.dataset.route)));
  $$('.favorite-button').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); toggleFavorite(button.dataset.favorite); }));
  $('#detail-view-seats')?.addEventListener('click', () => { closeModal('bus-detail-modal'); scrollToTarget('#seat-availability'); });
  $('#detail-favorite')?.addEventListener('click', () => { toggleFavorite(selectedRoute); $('#detail-favorite').textContent = storage.get('superbus-favorites', []).includes(selectedRoute) ? 'Favorited' : 'Add Favorite'; });
  $('#calculate-fare')?.addEventListener('click', calculateFare);
  $('#co2-trips')?.addEventListener('input', updateCo2);
  $('#show-pass')?.addEventListener('click', () => togglePanel('pass-modal', true));
  $$('.alert-filter').forEach((button) => button.addEventListener('click', () => { $$('.alert-filter').forEach((item) => item.classList.remove('active')); button.classList.add('active'); renderAlerts(button.dataset.alertFilter); }));
  $('#clear-history')?.addEventListener('click', () => { storage.remove('superbus-history'); renderHistory(); });
  $('#theme-toggle')?.addEventListener('click', () => { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; saveSettings(); });
  $('#theme-select')?.addEventListener('change', (event) => { settings.theme = event.target.value; saveSettings(); });
  [['#high-contrast', 'highContrast'], ['#large-text', 'largeText'], ['#enable-notifications', 'notifications'], ['#accessible-first', 'accessibleFirst']].forEach(([selector, key]) => $(selector)?.addEventListener('change', (event) => { settings[key] = event.target.checked; saveSettings(); renderNotifications(); }));
  $('#notifications-toggle')?.addEventListener('click', () => togglePanel('notifications-panel'));
  $('#settings-toggle')?.addEventListener('click', () => togglePanel('settings-panel'));
  $$('[data-open-panel]').forEach((button) => button.addEventListener('click', () => { togglePanel(button.dataset.openPanel, true); $('.main-nav')?.classList.remove('mobile-open'); }));
  $('#mark-read')?.addEventListener('click', () => { storage.set('superbus-notifications-read', true); renderNotifications(); });
  $('#reset-settings')?.addEventListener('click', () => { settings = { ...defaultSettings }; saveSettings(); });
  $('#reset-demo')?.addEventListener('click', resetAll);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
  $$('[data-close-panel]').forEach((button) => button.addEventListener('click', () => togglePanel(button.dataset.closePanel, false)));
  $$('.modal-backdrop').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; }));
}

function boot() {
  applySettings();
  populateStopSelects();
  setupNavigation();
  setupEvents();
  updateSeatAvailability('12');
  renderFavorites();
  renderHistory();
  renderAlerts();
  renderNotifications();
  updateCo2();
  startCountdown();
  const stats = $('#travel-statistics');
  if (stats && 'IntersectionObserver' in window) { const observer = new IntersectionObserver((entries, instance) => { if (entries.some((entry) => entry.isIntersecting)) { animateCounters(); instance.disconnect(); } }); observer.observe(stats); } else animateCounters();
  document.body.classList.add('loaded');
  window.setTimeout(() => $('#app-loader')?.classList.add('is-hidden'), 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
