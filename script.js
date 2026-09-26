const $ = (selector, root = document) => root?.querySelector(selector) || null;
const $$ = (selector, root = document) => root ? [...root.querySelectorAll(selector)] : [];
const sessionStorageFallback = new Map();
const storage = {
  get(key, fallback) {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (stored !== null) return stored;
    } catch { /* Use session memory when browser storage is unavailable. */ }
    return sessionStorageFallback.has(key) ? sessionStorageFallback.get(key) : fallback;
  },
  set(key, value) {
    sessionStorageFallback.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Offline demo can continue without persistence. */ }
  },
  remove(key) {
    sessionStorageFallback.delete(key);
    try { localStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ }
  },
  clearAppData() {
    [...sessionStorageFallback.keys()].filter((key) => key.startsWith('superbus-')).forEach((key) => sessionStorageFallback.delete(key));
    try {
      Object.keys(localStorage).filter((key) => key.startsWith('superbus-')).forEach((key) => localStorage.removeItem(key));
    } catch { /* Continue after clearing this session's fallback state. */ }
  }
};

const { stops, routes, alerts } = window.FindSuperBusData;

Object.values(routes).forEach(route => {
  route.duration = route.durationMinutes; 
  route.fare = Math.round((10 + route.distanceKm * 0.5) / 5) * 5;
  const hrs = Math.floor(route.durationMinutes / 60);
  const mins = route.durationMinutes % 60;
  route.formattedDuration = hrs > 0 ? (mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`) : `${mins} min`;
});

const defaultSettings = { theme: 'dark', highContrast: false, largeText: false, reducedMotion: false, notifications: true, accessibleFirst: false };
let settings = { ...defaultSettings, ...storage.get('superbus-settings', {}) };
let selectedRoute = '12';
let countdownTimer;
let departureDeadlines = new Map();

function mountSharedChrome() {
  const page = document.body.dataset.page || 'home';
  const links = [
    ['home', 'index.html', 'Home'],
    ['find-bus', 'find-bus.html', 'Find Bus'],
    ['departures', 'departures.html', 'Departures'],
    ['journey-planner', 'journey-planner.html', 'Journey Planner'],
    ['favorites', 'favorites.html', 'Favorites'],
    ['about', 'about.html', 'About']
  ];
  const navigation = links.map(([key, href, label]) => `<a href="${href}"${page === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('');
  const header = $('#site-header');
  if (header) header.innerHTML = `<header class="site-header"><a class="brand" href="index.html" aria-label="Find SuperBus home"><span class="brand-mark"><span></span><span></span><span></span></span><span>Find SuperBus</span></a><nav class="main-nav" aria-label="Main navigation">${navigation}<a class="mobile-nav-action${page === 'settings' ? ' active' : ''}" href="settings.html"${page === 'settings' ? ' aria-current="page"' : ''}>Settings</a></nav><a class="header-action" href="journey-planner.html">Plan a Trip <span aria-hidden="true">&#8599;</span></a><div class="header-tools"><button class="icon-button" id="theme-toggle" type="button" aria-label="Switch theme">Light</button><button class="icon-button" id="notifications-toggle" type="button" aria-label="Open notifications">Bell <span class="notification-count" id="notification-count">3</span></button><a class="icon-button${page === 'settings' ? ' active' : ''}" id="settings-toggle" href="settings.html" aria-label="Open settings"${page === 'settings' ? ' aria-current="page"' : ''}>Settings</a></div><button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button></header>`;
  const footer = $('#site-footer');
  if (footer) footer.innerHTML = `<footer class="site-footer"><div class="section-wrap footer-inner"><a class="brand" href="index.html"><span class="brand-mark"><span></span><span></span><span></span></span><span>Find SuperBus</span></a><nav class="footer-links" aria-label="Footer navigation"><a href="index.html">Home</a><a href="find-bus.html">Find Bus</a><a href="departures.html">Departures</a><a href="journey-planner.html">Journey Planner</a><a href="favorites.html">Favorites</a><a href="about.html">About</a><a href="settings.html">Settings</a></nav><span>Find your bus. Find your route. Travel smarter.</span><span class="footer-status"><span></span> OFFLINE DEMO</span><span>Student Project · Simulated Transport Data</span><span>© 2026 Find SuperBus</span></div></footer>`;
  const overlays = $('#shared-overlays');
  if (overlays) overlays.innerHTML = `<div class="modal-backdrop" id="bus-detail-modal" hidden><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button class="modal-close" data-close-modal="bus-detail-modal" type="button" aria-label="Close bus details">&times;</button><p class="eyebrow"><span class="eyebrow-dot"></span> Simulated bus details</p><h2 id="detail-title">Bus 12</h2><p class="modal-route" id="detail-route"></p><dl class="detail-list"><div><dt>Via</dt><dd id="detail-via"></dd></div><div><dt>Distance</dt><dd id="detail-distance"></dd></div><div><dt>Estimated Time</dt><dd id="detail-duration"></dd></div><div><dt>Stops</dt><dd id="detail-stops"></dd></div><div><dt>Departure</dt><dd id="detail-time"></dd></div><div><dt>Estimated Arrival</dt><dd id="detail-arrival"></dd></div><div><dt>Estimated Demo Fare</dt><dd id="detail-fare"></dd></div><div><dt>Current Stop</dt><dd id="detail-current-stop"></dd></div><div><dt>Next Stop</dt><dd id="detail-next-stop"></dd></div><div><dt>Accessibility</dt><dd id="detail-accessibility"></dd></div><div><dt>Status</dt><dd id="detail-status"></dd></div></dl><div style="margin:1.5rem 0;padding:1rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);"><strong style="display:block;font-size:0.75rem;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:1rem;">ROUTE RANGE &amp; STOPS</strong><div id="detail-timeline" style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.9rem;font-weight:600;"></div></div><p class="detail-seats" id="detail-seats"></p><div class="modal-actions"><button class="button button-dark" id="detail-view-seats" type="button">Select Seat</button><button class="text-button" id="detail-favorite" type="button">Add Favorite</button><button class="text-button" data-close-modal="bus-detail-modal" type="button">Close</button></div></section></div><div class="modal-backdrop" id="pass-modal" hidden><section class="modal-card pass-modal-card" role="dialog" aria-modal="true" aria-labelledby="pass-title"><button class="modal-close" data-close-modal="pass-modal" type="button" aria-label="Close digital pass">&times;</button><p class="eyebrow"><span class="eyebrow-dot"></span> Digital pass</p><h2 id="pass-title">FIND SUPERBUS</h2><div class="pass-large"><strong>DIGITAL BUS PASS</strong><span>Demo Passenger</span><span>Monthly Pass · Local demonstration</span><span>Pass ID: FSB-DEMO-001</span></div><button class="button button-dark" data-close-modal="pass-modal" type="button">Close</button></section></div><aside class="side-panel" id="notifications-panel" hidden><div class="panel-heading"><div><p class="eyebrow"><span class="eyebrow-dot"></span> Inbox</p><h2>Notifications</h2></div><button class="modal-close" data-close-panel="notifications-panel" type="button" aria-label="Close notifications">&times;</button></div><div id="notification-list" class="notification-list"></div><button class="text-button" id="mark-read" type="button">Mark all as read</button></aside>`;
  if (!$('#app-loader')) document.body.insertAdjacentHTML('afterbegin', '<div class="app-loader" id="app-loader"><strong>FIND SUPERBUS</strong><span>Finding your network...</span></div>');
}

function renderDepartureRows(target = $('#departure-list'), routeNumbers = Object.keys(routes)) {
  if (!target) return;
  target.innerHTML = routeNumbers.map((number) => {
    const route = routes[number];
    const accessText = route.accessible ? 'Wheelchair accessible' : 'Limited accessibility';
    const badge = number === '21' || number === '18' ? 'blue' : number === '7' || number === '9' || number === '31' ? 'yellow' : 'coral';
    const availableSeats = route.total - route.occupied;
    return `<article class="departure-row" data-route="${number}" data-tags="${route.tags.join(' ')}"><div class="route-badge badge-${badge}">${String(number).padStart(2, '0')}</div><div class="departure-info"><strong>${route.from} <span aria-hidden="true">&#8594;</span> ${route.to}</strong><span style="display:flex;gap:0.5rem;flex-wrap:wrap;color:var(--text-muted);font-size:0.85rem"><span>📍 ${route.distanceKm} km</span><span>◷ ${route.formattedDuration}</span><span>● ${route.stops.length} stops</span><span>💺 ${availableSeats} seats</span></span></div><div class="departure-time"><strong data-minutes="${route.minutes}">${route.minutes} min</strong><span>${route.time}</span></div><div class="accessibility${route.accessible ? '' : ' muted'}" aria-label="${accessText}">&#9673;</div><button class="favorite-button" data-favorite="${number}" aria-label="Favorite bus ${number}" type="button">&#9734;</button><button class="row-arrow" aria-label="View route ${number}" type="button">&#8594;</button></article>`;
  }).join('');
}

function renderHomeHighlights() {
  const popular = $('#popular-route-list');
  if (popular) {
    popular.innerHTML = (window.FindSuperBusData.popularRouteIds || ['12', '7', '21', '15']).map((number) => {
      const route = routes[number];
      const badge = number === '21' ? 'blue' : number === '7' ? 'yellow' : 'coral';
      return `<article class="popular-route-item"><span class="route-badge badge-${badge}">${String(number).padStart(2, '0')}</span><div><strong>${route.from} → ${route.to}</strong><small>Via ${route.via} · ${route.duration} min · ₹${route.fare} demo</small></div><a class="text-button" href="find-bus.html?bus=${number}">View bus</a></article>`;
    }).join('');
  }
  const nearby = $('#home-nearby-list');
  if (nearby) nearby.innerHTML = ['Kakinada', 'Samalkota', 'Pithapuram', 'Peddapuram', 'Anaparthi', 'Rajahmundry', 'Amalapuram'].map((location) => `<a class="nearby-chip" href="find-bus.html?location=${encodeURIComponent(location)}">${location}</a>`).join('');
}

function renderDepartureBoard() {
  const board = $('#departure-board-body');
  if (!board) return;
  board.innerHTML = Object.keys(routes).map((number) => {
    const route = routes[number];
    const available = route.total - route.occupied - selectedSeatNumbers(number).length;
    const remaining = Math.max(0, departureDeadlines.get(number) ?? Date.now() + route.minutes * 60000 - Date.now());
    const countdown = remaining === 0 ? 'Departing' : `${Math.ceil(remaining / 60000)} min`;
    const status = currentDepartureStatus(number, countdown);
    const badge = number === '21' || number === '18' ? 'blue' : number === '7' || number === '9' || number === '31' ? 'yellow' : 'coral';
    return `<tr data-route="${number}"><td><strong class="route-badge badge-${badge}">${String(number).padStart(2, '0')}</strong></td><td><strong>${route.from} → ${route.to}</strong><small>via ${route.via}</small></td><td>${route.time}<small>${countdown}</small></td><td><span class="board-status" data-status="${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td><td>${available} seats</td><td><button class="text-button board-details" data-route="${number}" type="button">Details</button></td></tr>`;
  }).join('');
}

function updateDepartureBoard() {
  if (!$('#departure-board-body')) return;
  $$('#departure-board-body tr').forEach((row) => {
    const number = row.dataset.route;
    const route = routes[number];
    const remaining = Math.max(0, (departureDeadlines.get(number) || Date.now()) - Date.now());
    const countdown = remaining === 0 ? 'Departing' : `${Math.ceil(remaining / 60000)} min`;
    const status = currentDepartureStatus(number, countdown);
    const departureCell = $('td:nth-child(3) small', row);
    const statusCell = $('.board-status', row);
    const seatCell = $('td:nth-child(5)', row);
    const available = route.total - route.occupied - selectedSeatNumbers(number).length;
    if (departureCell) departureCell.textContent = countdown;
    if (statusCell) { statusCell.textContent = status; statusCell.dataset.status = status.toLowerCase().replace(/\s+/g, '-'); }
    if (seatCell) seatCell.textContent = `${available} seats`;
  });
}

function setupPageContent() {
  const page = document.body.dataset.page || 'home';
  if (page === 'home') {
    renderHomeHighlights();
    renderAlerts();
    updateNetworkStats();
    return;
  }
  if (page === 'find-bus' || page === 'departures') {
    renderDepartureRows();
    const params = new URLSearchParams(window.location.search);
    if ($('#route-search') && params.has('bus')) $('#route-search').value = `Bus ${params.get('bus')}`;
    if ($('#route-search') && params.has('location')) $('#route-search').value = params.get('location');
    if ($('#filter-from') && params.has('from')) $('#filter-from').value = params.get('from');
    if ($('#filter-to') && params.has('to')) $('#filter-to').value = params.get('to');
  }
  if (page === 'departures') renderDepartureBoard();
  if (page === 'settings') {
    const status = $('#storage-status');
    if (status) status.textContent = `Local demo storage is ${storageAvailable() ? 'available' : 'unavailable; this session will continue in memory'}. No data leaves this device.`;
  }
}

function storageAvailable() {
  try {
    const key = 'superbus-storage-check';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function scrollToTarget(selector) {
  const target = $(selector);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applySettings() {
  document.body.dataset.theme = settings.theme;
  document.body.classList.toggle('high-contrast', settings.highContrast);
  document.body.classList.toggle('large-text', settings.largeText);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  const themeSelect = $('#theme-select');
  const highContrast = $('#high-contrast');
  const largeText = $('#large-text');
  const reducedMotion = $('#reduced-motion');
  const notifications = $('#enable-notifications');
  const accessibleFirst = $('#accessible-first');
  if (themeSelect) themeSelect.value = settings.theme;
  if (highContrast) highContrast.checked = settings.highContrast;
  if (largeText) largeText.checked = settings.largeText;
  if (reducedMotion) reducedMotion.checked = settings.reducedMotion;
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
  document.dispatchEvent(new CustomEvent('superbus:motion-setting-change'));
}

function populateStopSelects() {
  const ids = ['planner-from', 'planner-to', 'fare-from', 'fare-to', 'quick-from', 'quick-to', 'filter-from', 'filter-to'];
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
  if ($('#quick-from')) $('#quick-from').value = 'Kakinada';
  if ($('#quick-to')) $('#quick-to').value = 'Rajahmundry';
}

function routeMatches(route, from, to) {
  const path = [route.from, route.via, route.to];
  return path.includes(from) && path.includes(to) && path.indexOf(from) < path.indexOf(to);
}

function selectedSeatNumbers(busNumber) {
  const route = routes[busNumber];
  const selections = storage.get('superbus-seat-selections', {});
  return route ? (selections[busNumber] || []).map(Number).filter((number) => Number.isInteger(number) && number > route.occupied && number <= route.total) : [];
}

function renderSelectedSeatSummary() {
  const selected = selectedSeatNumbers(selectedRoute);
  if ($('#selected-seat-names')) $('#selected-seat-names').textContent = selected.length ? selected.map((number) => String(number).padStart(2, '0')).join(', ') : 'None';
  if ($('#confirm-seats')) $('#confirm-seats').disabled = selected.length === 0;
}

function seatSummary(busNumber) {
  const route = routes[busNumber];
  const selected = selectedSeatNumbers(busNumber);
  const available = route.total - route.occupied - selected.length;
  const occupiedTotal = route.occupied + selected.length;
  const percentage = Math.round((occupiedTotal / route.total) * 100);
  return `${available} / ${route.total} available · ${percentage}% occupied${selected.length ? ` · ${selected.length} selected` : ''}`;
}

function currentDepartureStatus(busNumber, countdownText) {
  const route = routes[busNumber];
  if (!route) return 'SEATS AVAILABLE';
  const available = route.total - route.occupied - selectedSeatNumbers(busNumber).length;
  if (available <= 0) return 'FULL';
  if (available <= 5) return 'LIMITED SEATS';
  if (countdownText === 'Departing') return 'DEPARTED';
  const minutes = Number.parseInt(countdownText, 10);
  if (Number.isFinite(minutes) && minutes <= 3) return 'ARRIVING SOON';
  if (route.status.toUpperCase() === 'IN TRANSIT' || route.status.toUpperCase() === 'MOVING') return 'IN TRANSIT';
  return 'SEATS AVAILABLE';
}

function setDepartureStatus(row, status) {
  row.dataset.status = status.toLowerCase().replace(/\s+/g, '-');
  const label = $('.route-status', row);
  if (label) label.textContent = status;
}

function routeResult(routeNumber) {
  const route = routes[routeNumber];
  const selected = selectedSeatNumbers(routeNumber);
  const available = route.total - route.occupied - selected.length;
  const travelDate = $('#planner-date')?.value;
  const card = document.createElement('article');
  card.className = 'planner-result';
  card.innerHTML = `<div><strong>BUS ${routeNumber}</strong><p>${route.from} &rarr; ${route.to}</p><small>Via ${route.via} · ${route.distanceKm} km · ${route.formattedDuration}</small></div><div style="margin: 0.5rem 0; font-size: 0.9rem; line-height: 1.4;">Departure: ${route.time}<br>Estimated arrival: ${estimatedArrival(route.time, route.duration)}<br>Stops: ${route.stops.length}<br>Estimated demo fare: ₹${route.fare}<br>Seats: ${available} available<br>Status: ${currentDepartureStatus(routeNumber, '0 min')}</div><button class="text-button planner-view-route" data-route="${routeNumber}" type="button">View Details</button><button class="text-button" type="button" style="margin-left: 0.5rem;" onclick="openBusDetails('${routeNumber}')">Select Seat</button>`;
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
  const requestedTime = $('#planner-time')?.value || '';
  const matching = Object.keys(routes).filter((number) => routeMatches(routes[number], from, to) && (!requestedTime || routes[number].time >= requestedTime));
  if (!matching.length) {
    output.innerHTML = `<p class="inline-message">No matching demo departure${requestedTime ? ` after ${requestedTime}` : ''}. Try another destination or time.</p>`;
    return;
  }
  matching.forEach((number) => output.append(routeResult(number)));
  $$('.planner-view-route', output).forEach((button) => button.addEventListener('click', () => openBusDetails(button.dataset.route)));
  storage.set('superbus-history', [{ from, to, date: $('#planner-date')?.value || '', time: requestedTime }, ...storage.get('superbus-history', []).filter((item) => item.from !== from || item.to !== to)].slice(0, 5));
  recordTravelActivity('trips');
  renderHistory();
}

function filterDepartures() {
  const query = ($('#route-search')?.value || '').trim().toLowerCase();
  const busQuery = query.replace(/^bus\s*/, '').trim().replace(/^0+(?=\d)/, '');
  const active = $('.filter-tab.active')?.dataset.filter || 'all';
  const from = $('#filter-from')?.value || '';
  const to = $('#filter-to')?.value || '';
  const status = $('#filter-status')?.value || 'all';
  const accessibility = $('#filter-accessibility')?.value || 'all';
  const favorites = storage.get('superbus-favorites', []);
  const favoriteOnly = $('#filter-favorites')?.value === 'favorites';
  let visible = 0;
  $$('.departure-row').forEach((row) => {
    const route = routes[row.dataset.route];
    const matchesText = row.textContent.toLowerCase().includes(query) || row.dataset.route.includes(busQuery);
    const matchesFilter = active === 'all' || row.dataset.tags.includes(active);
    const matchesFrom = !from || route.from === from;
    const matchesTo = !to || route.to === to;
    const routeStatus = (row.dataset.status || route.status).toLowerCase().replace(/\s+/g, '-');
    const matchesStatus = status === 'all' || routeStatus === status;
    const matchesAccessibility = accessibility === 'all' || (accessibility === 'accessible' ? route.accessible : !route.accessible);
    const matchesFavorite = !favoriteOnly || favorites.includes(row.dataset.route);
    const show = matchesText && matchesFilter && matchesFrom && matchesTo && matchesStatus && matchesAccessibility && matchesFavorite;
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
    if (item.from) { $('#planner-from').value = item.from; $('#planner-to').value = item.to; if ($('#planner-date') && item.date) $('#planner-date').value = item.date; if ($('#planner-time') && item.time) $('#planner-time').value = item.time; findRoutes(); scrollToTarget('#journey-planner'); }
  }));
  updateTravelSummary();
}

function renderSeatMap(total, occupied) {
  const seatMap = $('#seat-map');
  if (!seatMap) return;
  const selected = new Set(selectedSeatNumbers(selectedRoute));
  seatMap.innerHTML = '';
  for (let number = 1; number <= total; number += 1) {
    const isOccupied = number <= occupied;
    const isSelected = selected.has(number);
    const seat = document.createElement('button');
    seat.className = `seat ${isOccupied ? 'occupied' : isSelected ? 'selected' : 'available'}`;
    seat.type = 'button';
    seat.textContent = String(number).padStart(2, '0');
    seat.dataset.seat = String(number);
    seat.setAttribute('aria-label', `${isOccupied ? 'Occupied' : isSelected ? 'Selected' : 'Available'} seat ${number}`);
    seat.disabled = isOccupied;
    seatMap.append(seat);
  }
}

function updateSeatAvailability(busNumber) {
  const route = routes[busNumber];
  if (!route) return;
  selectedRoute = String(busNumber);
  const selected = selectedSeatNumbers(busNumber);
  const occupiedAndSelected = route.occupied + selected.length;
  const empty = route.total - occupiedAndSelected;
  const percentage = Math.round((occupiedAndSelected / route.total) * 100);
  const status = empty === 0 ? 'BUS FULL' : empty <= 5 ? 'ALMOST FULL' : 'SEATS AVAILABLE';
  const fill = $('#capacity-fill');
  if ($('#selected-bus')) $('#selected-bus').textContent = busNumber;
  if ($('#empty-seats')) $('#empty-seats').textContent = empty;
  if ($('#occupied-seats')) $('#occupied-seats').textContent = route.occupied;
  if ($('#total-seats')) $('#total-seats').textContent = route.total;
  if ($('#capacity-percent')) $('#capacity-percent').textContent = `${percentage}% occupied`;
  if ($('#seat-status')) $('#seat-status').textContent = status;
  if ($('#seat-feedback')) $('#seat-feedback').textContent = selected.length ? `${selected.length} seat${selected.length === 1 ? '' : 's'} selected` : 'No seats selected';
  const departureRow = $(`.departure-row[data-route="${busNumber}"]`);
  if (departureRow) setDepartureStatus(departureRow, currentDepartureStatus(busNumber, $('.departure-time strong', departureRow)?.textContent || ''));
  renderSelectedSeatSummary();
  if ($('#seat-confirmation')) $('#seat-confirmation').hidden = true;
  if (fill) { fill.style.width = `${percentage}%`; fill.style.background = empty === 0 ? 'var(--red)' : empty <= 5 ? 'var(--orange)' : 'var(--green)'; }
  if ($('#map-bus')) $('#map-bus').textContent = busNumber;
  if ($('#next-bus')) $('#next-bus').textContent = busNumber;
  if ($('#current-stop')) $('#current-stop').textContent = route.via;
  if ($('#next-stop-name')) $('#next-stop-name').textContent = route.to;
  if ($('#next-eta')) $('#next-eta').textContent = `${route.minutes} min`;
  updateNetworkStats();
  renderSeatMap(route.total, route.occupied);
  if ($('#detail-seats') && !$('#bus-detail-modal')?.hidden && selectedRoute === String(busNumber)) $('#detail-seats').textContent = seatSummary(busNumber);
}

function estimatedArrival(time, duration) {
  const [hours, minutes] = time.split(':').map(Number);
  const arrival = (hours * 60 + minutes + duration) % (24 * 60);
  return `${String(Math.floor(arrival / 60)).padStart(2, '0')}:${String(arrival % 60).padStart(2, '0')}`;
}

function openBusDetails(busNumber) {
  const route = routes[busNumber];
  if (!route) return;
  if ($('#seat-map')) updateSeatAvailability(busNumber);
  const available = route.total - route.occupied - selectedSeatNumbers(busNumber).length;
  const rowStatus = $(`.departure-row[data-route="${busNumber}"] .route-status`)?.textContent || route.status;
  const status = available === 0 ? 'Full' : rowStatus;
  const values = { '#detail-title': `Bus ${busNumber}`, '#detail-route': `${route.from} → ${route.to}`, '#detail-via': route.via, '#detail-distance': `${route.distanceKm} km`, '#detail-duration': route.formattedDuration, '#detail-stops': route.stops.length, '#detail-time': route.time, '#detail-arrival': estimatedArrival(route.time, route.duration), '#detail-fare': `₹${route.fare}`, '#detail-current-stop': route.stops[0], '#detail-next-stop': route.stops[1] || route.to, '#detail-accessibility': route.accessible ? 'Wheelchair accessible' : 'Limited accessibility', '#detail-status': status, '#detail-seats': seatSummary(busNumber) };
  Object.entries(values).forEach(([selector, value]) => { if ($(selector)) $(selector).textContent = value; });
  if ($('#detail-timeline')) $('#detail-timeline').innerHTML = route.stops.map((stop, i) => `<div>${stop.toUpperCase()}</div>${i < route.stops.length - 1 ? '<div style="color:var(--text-muted);font-weight:normal;padding-left:0.25rem;">↓</div>' : ''}`).join('');
  if ($('#detail-favorite')) $('#detail-favorite').textContent = storage.get('superbus-favorites', []).includes(String(busNumber)) ? 'Favorited' : 'Add Favorite';
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
    return `<div class="favorite-item-card"><div><strong>♡ BUS ${number}</strong><span>${label}</span><small>Via ${route?.via || 'Demo route'}</small></div><div><button class="text-button favorite-view" data-route="${number}" type="button">View Bus</button><button class="text-button favorite-remove" data-route="${number}" type="button" aria-label="Remove bus ${number} from favorites">Remove</button></div></div>`;
  }).join('') : '<div class="empty-state"><p>No favorite buses yet.</p><a class="text-button" href="find-bus.html">Find a Bus</a></div>';
  $$('.favorite-remove', target).forEach((button) => button.addEventListener('click', () => toggleFavorite(button.dataset.route)));
  $$('.favorite-view', target).forEach((button) => button.addEventListener('click', () => {
    const number = button.dataset.route;
    if ($('#departure-list')) openBusDetails(number);
    else window.location.href = `find-bus.html?bus=${encodeURIComponent(number)}`;
  }));
}

function toggleFavorite(number) {
  const favorites = storage.get('superbus-favorites', []);
  storage.set('superbus-favorites', favorites.includes(String(number)) ? favorites.filter((item) => item !== String(number)) : [...favorites, String(number)]);
  renderFavorites();
  updateTravelSummary();
  if ($('#filter-favorites')?.value === 'favorites') filterDepartures();
}

function renderAlerts(filter = 'all') {
  const target = $('#alert-list');
  if (!target) return;
  target.innerHTML = alerts.filter((alert) => filter === 'all' || alert.type === filter).map((alert) => `<article class="alert-item alert-${alert.type}"><strong>${alert.label}</strong><span>${alert.copy} Simulated information.</span></article>`).join('');
}

function calculateFare() {
  const from = $('#fare-from')?.value;
  const to = $('#fare-to')?.value;
  const output = $('#fare-output');
  if (!output) return;
  if (!from || !to || from === to) { output.textContent = 'Choose two different stops to calculate a local demo fare.'; return; }
  const route = Object.values(routes).find((item) => routeMatches(item, from, to));
  if (!route) { output.textContent = 'No demo fare is available for that direct route.'; return; }
  const passenger = $('#passenger-type')?.value || 'adult';
  const multiplier = { adult: 1, student: .8, child: .5, senior: .75 }[passenger] || 1;
  const fare = Math.max(1, Math.round(route.fare * multiplier));
  const number = Object.keys(routes).find((routeNumber) => routes[routeNumber] === route);
  output.textContent = `Estimated demo fare: ₹${fare} (${passenger}) · Bus ${number} · ${route.duration} min`;
}

function updateNetworkStats() {
  const routeNumbers = Object.keys(routes);
  const availableSeats = routeNumbers.reduce((total, busNumber) => {
    const route = routes[busNumber];
    return total + route.total - route.occupied - selectedSeatNumbers(busNumber).length;
  }, 0);
  const stats = { 'active-buses': routeNumbers.length, 'available-seats': availableSeats, 'route-total': routeNumbers.length, 'nearby-stops': stops.length };
  Object.entries(stats).forEach(([id, value]) => {
    const element = $(`#${id}`);
    if (element) { element.dataset.counter = String(value); element.textContent = String(value); }
  });
  if ($('#route-count')) $('#route-count').textContent = String(routeNumbers.length);
  updateDepartureMeta();
  updateDepartureBoard();
  updateTravelSummary();
}

function updateDepartureMeta() {
  $$('.departure-row').forEach((row) => {
    const route = routes[row.dataset.route];
    const info = $('.departure-info', row);
    if (!route || !info) return;
    let meta = $('.departure-demo-meta', info);
    if (!meta) { meta = document.createElement('small'); meta.className = 'departure-demo-meta'; info.append(meta); }
    const available = route.total - route.occupied - selectedSeatNumbers(row.dataset.route).length;
    const status = (row.dataset.status || route.status.toLowerCase().replace(/\s+/g, '-')).split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const detail = `${status} · ${available} seats · ₹${route.fare} demo · ${route.accessible ? 'Accessible' : 'Limited access'}`;
    if (meta.textContent !== detail) meta.textContent = detail;
  });
}

function addDepartureSeatActions() {
  $$('.departure-row').forEach((row) => {
    const info = $('.departure-info', row);
    if (!info || $('.row-seat-action', info)) return;
    const button = document.createElement('button');
    button.className = 'row-seat-action';
    button.dataset.route = row.dataset.route;
    button.type = 'button';
    button.textContent = 'Select Seat';
    button.setAttribute('aria-label', `Select a seat on Bus ${row.dataset.route}`);
    info.append(button);
  });
}

function currentTravelSummary() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const saved = storage.get('superbus-travel-summary', {});
  if (saved.date !== today) return { date: today, trips: 0, seatsChecked: 0 };
  return { date: today, trips: Number(saved.trips) || 0, seatsChecked: Number(saved.seatsChecked) || 0 };
}

function updateTravelSummary() {
  const summary = currentTravelSummary();
  if ($('#today-trips')) $('#today-trips').textContent = String(summary.trips);
  if ($('#favorite-count')) $('#favorite-count').textContent = String(storage.get('superbus-favorites', []).length);
  if ($('#seats-checked')) $('#seats-checked').textContent = String(summary.seatsChecked);
  if ($('#recent-search-count')) $('#recent-search-count').textContent = String(storage.get('superbus-history', []).length);
}

function recordTravelActivity(activity) {
  const summary = currentTravelSummary();
  summary[activity] += 1;
  storage.set('superbus-travel-summary', summary);
  updateTravelSummary();
}

function updateCo2() {
  const trips = Math.max(0, Number($('#co2-trips')?.value || 0));
  if ($('#co2-output')) $('#co2-output').textContent = `Estimated CO2 saved: ${(trips * .72).toFixed(1)} kg`;
}

function renderNotifications() {
  const target = $('#notification-list');
  if (!target) return;
  const notes = [{ time: '3 min ago', text: 'DEMO · Bus 12 is arriving soon.' }, { time: '10 min ago', text: 'DEMO · Bus 07 has limited seating.' }, { time: '25 min ago', text: 'DEMO · Bus 21 is running approximately 5 minutes late.' }];
  target.innerHTML = notes.map((note) => `<article><small>${note.time}</small><p>${note.text}</p></article>`).join('');
  const count = $('#notification-count');
  if (count) count.textContent = !settings.notifications || storage.get('superbus-notifications-read', false) ? '0' : String(notes.length);
}

function startCountdown() {
  clearInterval(countdownTimer);
  departureDeadlines = new Map();
  $$('.departure-row').forEach((row) => {
    const minutes = Number($('.departure-time strong[data-minutes]', row)?.dataset.minutes || 0);
    departureDeadlines.set(row.dataset.route, Date.now() + minutes * 60000);
  });
  if ($('#departure-board-body') && !departureDeadlines.size) Object.keys(routes).forEach((number) => { departureDeadlines.set(number, Date.now() + routes[number].minutes * 60000); });
  const update = () => {
    $$('.departure-row').forEach((row) => {
      const element = $('.departure-time strong[data-minutes]', row);
      const remaining = Math.max(0, departureDeadlines.get(row.dataset.route) - Date.now());
      const minutes = Math.ceil(remaining / 60000);
      if (element) element.textContent = minutes === 0 ? 'Departing' : `${minutes} min`;
      setDepartureStatus(row, currentDepartureStatus(row.dataset.route, element?.textContent || ''));
    });
    updateDepartureMeta();
    if ($('#departure-board-body')) updateDepartureBoard();
    const active = $(`.departure-row[data-route="${selectedRoute}"] .departure-time strong`);
    if (active && $('#next-eta')) $('#next-eta').textContent = active.textContent;
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

function animateCounters() {
  $$('[data-counter]').forEach((element) => {
    const value = Number(element.dataset.counter);
    let current = 0;
    const step = value / 24;
    const timer = setInterval(() => { current = Math.min(value, current + step); element.textContent = Number.isInteger(value) ? Math.round(current) : current.toFixed(1); if (current >= value) clearInterval(timer); }, 35);
  });
}

function startHeroBusAnimation() {
  const visual = $('.hero-visual');
  const svg = $('.bus-route-overlay', visual);
  const positioner = $('.bus-motion-position', visual);
  const bus = $('.bus-illustration', visual);
  const legs = $$('.bus-route-leg', svg);
  const stops = $$('.route-node[data-main-stop]', visual).sort((first, second) => Number(first.dataset.mainStop) - Number(second.dataset.mainStop));
  const stopLabels = $$('.map-place[data-main-stop]', visual).sort((first, second) => Number(first.dataset.mainStop) - Number(second.dataset.mainStop));
  const secondaryVehicles = [
    { positioner: $('.secondary-bus-position.bus-07', visual), vehicle: $('.bus-07 .secondary-bus-vehicle', visual), path: $('.bus-secondary-route-green', svg), nodes: $$('.route-one .route-node', visual), duration: 23000, offset: .17 },
    { positioner: $('.secondary-bus-position.bus-21', visual), vehicle: $('.bus-21 .secondary-bus-vehicle', visual), path: $('.bus-secondary-route-blue', svg), nodes: $$('.route-three .route-node', visual), duration: 29000, offset: .58 }
  ];
  if (!visual || !svg || !positioner || !bus || legs.length !== 2 || stops.length !== 3 || stopLabels.length !== 3 || secondaryVehicles.some((vehicle) => !vehicle.positioner || !vehicle.vehicle || !vehicle.path)) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionDisabled = () => motionPreference.matches || settings.reducedMotion;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const stopPoints = [];
  const stopNames = ['Kakinada', 'Anaparthi', 'Rajahmundry'];
  let segments = [];
  let segmentIndex = 0;
  let phase = 'pause';
  let phaseStartedAt = 0;
  let lastProgress = 0;
  let frameId = 0;
  let previousTimestamp = null;
  let secondaryElapsed = 0;
  let activeApproach = -1;
  const liveStatus = $('.bus-live-status', positioner);
  const liveLabel = $('.bus-live-label', positioner);
  let liveLabelHalfWidth = 0;

  const sequence = [
    { leg: 0, from: 0, to: 1, reverse: false },
    { leg: 1, from: 1, to: 2, reverse: false },
    { leg: 1, from: 2, to: 1, reverse: true },
    { leg: 0, from: 1, to: 0, reverse: true }
  ];

  function updateBusLabel(status) {
    if (liveStatus && liveStatus.textContent !== status) {
      liveStatus.textContent = status;
      liveLabelHalfWidth = liveLabel.offsetWidth / 2;
    }
    const distanceRemaining = Math.max(0, Math.round(55 * (1 - lastProgress)));
    const speed = status === 'Moving' ? (lastProgress < 0.1 || lastProgress > 0.9 ? 18 : 42) : (status.includes('Approaching') ? 15 : 0);
    const label = `Bus 12 · ${status} · ${distanceRemaining} km remaining · ${speed} km/h`;
    if (positioner.getAttribute('aria-label') !== label) positioner.setAttribute('aria-label', label);
    if ($('#hero-live-status')) $('#hero-live-status').textContent = status.toUpperCase();
    if ($('#hero-live-speed')) $('#hero-live-speed').textContent = `${speed} km/h`;
    if ($('#hero-live-distance')) $('#hero-live-distance').textContent = `${distanceRemaining} km`;
  }

  function setApproachingStop(index) {
    if (activeApproach === index) {
      if (index < 0) updateBusLabel('Moving');
      return;
    }
    activeApproach = index;
    stops.forEach((stop, stopIndex) => stop.classList.toggle('is-approaching-stop', stopIndex === index));
    stopLabels.forEach((label, labelIndex) => label.classList.toggle('is-approaching-stop', labelIndex === index));
    updateBusLabel(index < 0 ? 'Moving' : `Approaching ${stopNames[index]}`);
  }

  function setCurrentStop(index) {
    setApproachingStop(-1);
    stops.forEach((stop, stopIndex) => stop.classList.toggle('is-active-stop', stopIndex === index));
    stopLabels.forEach((label, labelIndex) => label.classList.toggle('is-active-stop', labelIndex === index));
    updateBusLabel(`At stop · ${stopNames[index]}`);
  }

  function nodePoint(node, bounds, radius) {
    const rect = node.getBoundingClientRect();
    const screenPoint = svg.createSVGPoint();
    screenPoint.x = rect.left + rect.width / 2;
    screenPoint.y = rect.top + rect.height / 2;
    const point = screenPoint.matrixTransform(svg.getScreenCTM().inverse());
    const marginX = radius / bounds.width * 1000;
    const marginY = radius / bounds.height * 600;
    return { x: clamp(point.x, marginX, 1000 - marginX), y: clamp(point.y, marginY, 600 - marginY) };
  }

  function loopPath(points) {
    const curves = points.map((point, index) => {
      const previous = points[(index + points.length - 1) % points.length];
      const next = points[(index + 1) % points.length];
      const after = points[(index + 2) % points.length];
      const controlOne = { x: point.x + (next.x - previous.x) / 6, y: point.y + (next.y - previous.y) / 6 };
      const controlTwo = { x: next.x - (after.x - point.x) / 6, y: next.y - (after.y - point.y) / 6 };
      return `C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${next.x} ${next.y}`;
    });
    return `M ${points[0].x} ${points[0].y} ${curves.join(' ')} Z`;
  }

  function configureRoute() {
    const bounds = visual.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const svgBounds = svg.getBoundingClientRect();
    const wasConfigured = segments.length > 0;
    const previousSegmentIndex = segmentIndex;
    const previousPhase = phase;
    const previousProgress = lastProgress;

    const radius = Math.hypot(bus.offsetWidth / 2, bus.offsetHeight / 2) + 4;
    const marginX = Math.min(bounds.width / 2, radius);
    const marginY = Math.min(bounds.height / 2, radius);
    const x = [
      clamp(bounds.width * .10, marginX, bounds.width - marginX),
      clamp(bounds.width * .41, marginX, bounds.width - marginX),
      clamp(bounds.width * .92, marginX, bounds.width - marginX)
    ].map((value) => value / bounds.width * 1000);
    const y = [
      clamp(bounds.height * .34, marginY, bounds.height - marginY),
      clamp(bounds.height * .67, marginY, bounds.height - marginY),
      clamp(bounds.height * .78, marginY, bounds.height - marginY)
    ].map((value) => value / bounds.height * 600);
    stopPoints.splice(0, stopPoints.length, ...x.map((pointX, index) => ({ x: pointX, y: y[index] })));
    secondaryVehicles.forEach((vehicle) => {
      vehicle.path.setAttribute('d', loopPath(vehicle.nodes.map((node) => nodePoint(node, svgBounds, 32))));
      vehicle.length = vehicle.path.getTotalLength();
    });

    const [start, via, destination] = stopPoints;
    const firstDx = via.x - start.x;
    const firstDy = via.y - start.y;
    const secondDx = destination.x - via.x;
    const secondDy = destination.y - via.y;
    legs[0].setAttribute('d', `M ${start.x} ${start.y} C ${start.x + firstDx * .38} ${start.y + firstDy * .05}, ${via.x - firstDx * .3} ${via.y - firstDy * .25}, ${via.x} ${via.y}`);
    legs[1].setAttribute('d', `M ${via.x} ${via.y} C ${via.x + secondDx * .28} ${via.y + secondDy * .3}, ${destination.x - secondDx * .35} ${destination.y - secondDy * .2}, ${destination.x} ${destination.y}`);

    const scaleX = bounds.width / 1000;
    const scaleY = bounds.height / 600;
    segments = sequence.map((segment) => {
      const path = legs[segment.leg];
      const length = path.getTotalLength();
      let cssLength = 0;
      let previous = path.getPointAtLength(0);
      for (let step = 1; step <= 24; step += 1) {
        const point = path.getPointAtLength(length * step / 24);
        cssLength += Math.hypot((point.x - previous.x) * scaleX, (point.y - previous.y) * scaleY);
        previous = point;
      }
      return { ...segment, path, length, duration: Math.max(4000, cssLength / 30 * 1000) };
    });
    liveLabelHalfWidth = liveLabel?.offsetWidth / 2 || 0;

    segmentIndex = wasConfigured ? previousSegmentIndex : 0;
    phase = wasConfigured ? previousPhase : 'pause';
    lastProgress = wasConfigured ? previousProgress : 0;
    phaseStartedAt = performance.now() - (phase === 'move' ? lastProgress * segments[segmentIndex].duration : 0);
    if (phase === 'move') setApproachingStop(lastProgress > .82 ? segments[segmentIndex].to : -1);
    else setCurrentStop(segments[segmentIndex].from);
    positionBus(segments[segmentIndex], phase === 'move' ? lastProgress : 0);
    positionSecondaryVehicles(secondaryElapsed);
  }

  function positionVehicle(vehiclePosition, vehicle, path, length, progress, reverse = false, ease = true) {
    const easedProgress = ease ? progress * progress * (3 - 2 * progress) : progress;
    const distanceAlongPath = easedProgress * length;
    const distance = reverse ? length - distanceAlongPath : distanceAlongPath;
    const point = path.getPointAtLength(distance);
    const previous = path.getPointAtLength(Math.max(0, distance - 2));
    const next = path.getPointAtLength(Math.min(length, distance + 2));
    const direction = reverse ? -1 : 1;
    const bounds = svg.getBoundingClientRect();
    const deltaX = (next.x - previous.x) * bounds.width / 1000 * direction;
    const deltaY = (next.y - previous.y) * bounds.height / 600 * direction;
    let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    let flip = false;
    if (angle > 90) { angle -= 180; flip = true; }
    if (angle < -90) { angle += 180; flip = true; }
    angle = clamp(angle, -22, 22);
    const x = point.x * bounds.width / 1000;
    const y = point.y * bounds.height / 600;
    vehiclePosition.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    vehicle.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scaleX(${flip ? -1 : 1})`;
    return { x, y };
  }

  function positionBus(segment, progress) {
    const point = positionVehicle(positioner, bus, segment.path, segment.length, progress, segment.reverse);
    if (liveLabel) {
      const bounds = svg.getBoundingClientRect();
      const labelX = clamp(point.x, liveLabelHalfWidth + 8, bounds.width - liveLabelHalfWidth - 8);
      liveLabel.style.left = `${labelX - point.x}px`;
    }
  }

  function positionSecondaryVehicles(elapsed) {
    secondaryVehicles.forEach((vehicle) => {
      const progress = ((elapsed / vehicle.duration + vehicle.offset) % 1 + 1) % 1;
      positionVehicle(vehicle.positioner, vehicle.vehicle, vehicle.path, vehicle.length, progress, false, false);
    });
  }

  function animate(timestamp) {
    if (document.hidden || motionDisabled() || !segments.length) { frameId = 0; return; }
    if (previousTimestamp !== null) secondaryElapsed += timestamp - previousTimestamp;
    previousTimestamp = timestamp;
    positionSecondaryVehicles(secondaryElapsed);
    const segment = segments[segmentIndex];
    if (phase === 'pause') {
      if (timestamp - phaseStartedAt >= 700) {
        phase = 'move';
        phaseStartedAt = timestamp;
        lastProgress = 0;
        setCurrentStop(segment.from);
      }
    } else {
      const progress = clamp((timestamp - phaseStartedAt) / segment.duration, 0, 1);
      lastProgress = progress;
      positionBus(segment, progress);
      setApproachingStop(progress > .82 ? segment.to : -1);
      if (progress === 1) {
        setCurrentStop(segment.to);
        phase = 'pause';
        phaseStartedAt = timestamp;
        segmentIndex = (segmentIndex + 1) % segments.length;
        lastProgress = 0;
        setCurrentStop(segment.to);
      }
    }
    frameId = requestAnimationFrame(animate);
  }

  function start() {
    if (!frameId && !document.hidden && !motionDisabled()) frameId = requestAnimationFrame(animate);
  }

  function applyMotionPreference() {
    if (motionDisabled()) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      if (segments.length) {
        segmentIndex = 0;
        phase = 'pause';
        lastProgress = 0;
        secondaryElapsed = 0;
        previousTimestamp = null;
        phaseStartedAt = performance.now();
        setCurrentStop(0);
        positionBus(segments[0], 0);
        positionSecondaryVehicles(secondaryElapsed);
      }
    } else {
      start();
    }
  }

  configureRoute();
  if ('ResizeObserver' in window) new ResizeObserver(configureRoute).observe(visual);
  else window.addEventListener('resize', configureRoute);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (frameId) cancelAnimationFrame(frameId); frameId = 0; previousTimestamp = null; }
    else {
      phaseStartedAt = performance.now() - (phase === 'move' ? lastProgress * segments[segmentIndex].duration : 0);
      start();
    }
  });
  positioner.addEventListener('click', () => {
    const open = positioner.classList.toggle('is-info-open');
    positioner.setAttribute('aria-pressed', String(open));
  });
  motionPreference.addEventListener?.('change', applyMotionPreference);
  document.addEventListener('superbus:motion-setting-change', applyMotionPreference);
  start();
}

function togglePanel(id, show) { const panel = $(`#${id}`); if (panel) panel.hidden = show === undefined ? !panel.hidden : !show; }
function closeModal(id) { const modal = $(`#${id}`); if (modal) modal.hidden = true; }

function resetAll() {
  if (!window.confirm('Reset all demo transport data?')) return;
  storage.clearAppData();
  window.location.reload();
}

function setupNavigation() {
  $$('[data-scroll-target]').forEach((button) => button.addEventListener('click', () => scrollToTarget(button.dataset.scrollTarget)));
  $$('.main-nav a').forEach((link) => link.addEventListener('click', () => $('.main-nav')?.classList.remove('mobile-open')));
  $('.menu-toggle')?.addEventListener('click', (event) => { const open = event.currentTarget.getAttribute('aria-expanded') === 'true'; event.currentTarget.setAttribute('aria-expanded', String(!open)); $('.main-nav')?.classList.toggle('mobile-open', !open); });
}

function setupEvents() {
  $('#find-routes')?.addEventListener('click', findRoutes);
  $('#departure-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('.row-seat-action');
    if (!button) return;
    event.stopPropagation();
    updateSeatAvailability(button.dataset.route);
    scrollToTarget('#seat-availability');
    $('#seat-map .seat.available')?.focus({ preventScroll: true });
  });
  $('#departure-board-body')?.addEventListener('click', (event) => {
    const button = event.target.closest('.board-details');
    if (button) openBusDetails(button.dataset.route);
  });
  $('#find-my-bus')?.addEventListener('click', () => {
    const panel = $('#hero-quick-search');
    if (!panel) return;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('#quick-from')?.focus({ preventScroll: true });
  });
  $('#quick-find-buses')?.addEventListener('click', () => {
    const from = $('#quick-from')?.value || '';
    const to = $('#quick-to')?.value || '';
    const feedback = $('#quick-search-feedback');
    if (!from || !to || from === to) {
      if (feedback) { feedback.hidden = false; feedback.textContent = 'Choose two different locations.'; }
      return;
    }
    if (feedback) feedback.hidden = true;
    window.location.href = `find-bus.html?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  });
  $('#seat-map')?.addEventListener('click', (event) => {
    const seat = event.target.closest('.seat');
    if (!seat || seat.disabled) return;
    const number = Number(seat.dataset.seat);
    const selections = storage.get('superbus-seat-selections', {});
    const selected = selectedSeatNumbers(selectedRoute);
    selections[selectedRoute] = selected.includes(number) ? selected.filter((item) => item !== number) : [...selected, number];
    storage.set('superbus-seat-selections', selections);
    recordTravelActivity('seatsChecked');
    updateSeatAvailability(selectedRoute);
    if ($('#filter-status')?.value !== 'all') filterDepartures();
  });
  $('#confirm-seats')?.addEventListener('click', () => {
    const selected = selectedSeatNumbers(selectedRoute);
    const confirmation = $('#seat-confirmation');
    if (!confirmation || !selected.length) return;
    storage.set('superbus-last-seat-confirmation', { bus: selectedRoute, seats: selected, date: new Date().toISOString() });
    confirmation.textContent = `Demo selection saved for Bus ${selectedRoute}: seats ${selected.map((number) => String(number).padStart(2, '0')).join(', ')}. No ticket was issued.`;
    confirmation.hidden = false;
  });
  $('#route-search')?.addEventListener('input', filterDepartures);
  ['#filter-from', '#filter-to', '#filter-status', '#filter-accessibility', '#filter-favorites'].forEach((selector) => $(selector)?.addEventListener('change', filterDepartures));
  $$('.nearby-chip').forEach((button) => button.addEventListener('click', () => {
    if ($('#route-search')) $('#route-search').value = button.dataset.location;
    if ($('#filter-from')) $('#filter-from').value = '';
    if ($('#filter-to')) $('#filter-to').value = '';
    if ($('#filter-status')) $('#filter-status').value = 'all';
    if ($('#filter-accessibility')) $('#filter-accessibility').value = 'all';
    if ($('#filter-favorites')) $('#filter-favorites').value = 'all';
    $$('.filter-tab').forEach((item) => item.classList.toggle('active', item.dataset.filter === 'all'));
    $$('.nearby-chip').forEach((item) => item.classList.toggle('active', item === button));
    filterDepartures();
  }));
  $$('.filter-tab').forEach((button) => button.addEventListener('click', () => { $$('.filter-tab').forEach((item) => item.classList.remove('active')); button.classList.add('active'); filterDepartures(); }));
  $$('.departure-row').forEach((row) => {
    row.tabIndex = 0;
    row.setAttribute('aria-label', `View bus ${row.dataset.route} details`);
    row.addEventListener('click', (event) => { if (!event.target.closest('button')) openBusDetails(row.dataset.route); });
    row.addEventListener('keydown', (event) => { if (event.target === row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openBusDetails(row.dataset.route); } });
  });
  $$('.row-arrow').forEach((button) => button.addEventListener('click', () => openBusDetails(button.closest('.departure-row')?.dataset.route)));
  $$('.favorite-button').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); toggleFavorite(button.dataset.favorite); }));
  $('#detail-view-seats')?.addEventListener('click', () => {
    closeModal('bus-detail-modal');
    if ($('#seat-map')) { updateSeatAvailability(selectedRoute); scrollToTarget('#seat-availability'); }
    else window.location.href = `find-bus.html?bus=${encodeURIComponent(selectedRoute)}#seat-availability`;
  });
  $('#detail-favorite')?.addEventListener('click', () => { toggleFavorite(selectedRoute); $('#detail-favorite').textContent = storage.get('superbus-favorites', []).includes(selectedRoute) ? 'Favorited' : 'Add Favorite'; });
  $('#calculate-fare')?.addEventListener('click', calculateFare);
  $('#passenger-type')?.addEventListener('change', calculateFare);
  $('#co2-trips')?.addEventListener('input', updateCo2);
  $('#show-pass')?.addEventListener('click', () => togglePanel('pass-modal', true));
  $$('.alert-filter').forEach((button) => button.addEventListener('click', () => { $$('.alert-filter').forEach((item) => item.classList.remove('active')); button.classList.add('active'); renderAlerts(button.dataset.alertFilter); }));
  $('#clear-history')?.addEventListener('click', () => { storage.remove('superbus-history'); renderHistory(); });
  $('#theme-toggle')?.addEventListener('click', () => { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; saveSettings(); });
  $('#theme-select')?.addEventListener('change', (event) => { settings.theme = event.target.value; saveSettings(); });
  [['#high-contrast', 'highContrast'], ['#large-text', 'largeText'], ['#reduced-motion', 'reducedMotion'], ['#enable-notifications', 'notifications'], ['#accessible-first', 'accessibleFirst']].forEach(([selector, key]) => $(selector)?.addEventListener('change', (event) => { settings[key] = event.target.checked; saveSettings(); renderNotifications(); }));
  $('#notifications-toggle')?.addEventListener('click', () => togglePanel('notifications-panel'));
  $('#mark-read')?.addEventListener('click', () => { storage.set('superbus-notifications-read', true); renderNotifications(); });
  $('#reset-settings')?.addEventListener('click', () => { settings = { ...defaultSettings }; saveSettings(); });
  $('#reset-demo')?.addEventListener('click', resetAll);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
  $$('[data-close-panel]').forEach((button) => button.addEventListener('click', () => togglePanel(button.dataset.closePanel, false)));
  $$('.modal-backdrop').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') $$('.modal-backdrop').forEach((modal) => { modal.hidden = true; }); });
}

function boot() {
  mountSharedChrome();
  applySettings();
  populateStopSelects();
  setupPageContent();
  addDepartureSeatActions();
  if ($('#planner-date') && !$('#planner-date').value) {
    const today = new Date();
    $('#planner-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  const params = new URLSearchParams(window.location.search);
  if ($('#route-search') && (params.has('bus') || params.has('location') || params.has('from') || params.has('to'))) filterDepartures();
  setupNavigation();
  setupEvents();
  if ($('#seat-map')) updateSeatAvailability(params.get('bus') || '12');
  if ($('#favorites-list')) renderFavorites();
  if ($('#history-list')) renderHistory();
  if ($('#alert-list') && document.body.dataset.page !== 'home') renderAlerts();
  renderNotifications();
  if ($('#co2-trips')) updateCo2();
  if ($$('.departure-row').length || $('#departure-board-body')) startCountdown();
  if ($('.hero-visual')) startHeroBusAnimation();
  const stats = $('#travel-statistics');
  if (stats && 'IntersectionObserver' in window) { const observer = new IntersectionObserver((entries, instance) => { if (entries.some((entry) => entry.isIntersecting)) { animateCounters(); instance.disconnect(); } }); observer.observe(stats); } else animateCounters();
  document.body.classList.add('loaded');
  window.setTimeout(() => $('#app-loader')?.classList.add('is-hidden'), 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
