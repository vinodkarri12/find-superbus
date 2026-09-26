const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

const enrichment = `const { stops, routes, alerts } = window.FindSuperBusData;

// ENRICH DEMO DATA
Object.values(routes).forEach(route => {
  route.duration = route.durationMinutes; 
  route.fare = Math.round((10 + route.distanceKm * 0.5) / 5) * 5;
  const hrs = Math.floor(route.durationMinutes / 60);
  const mins = route.durationMinutes % 60;
  route.formattedDuration = hrs > 0 ? (mins > 0 ? \`\${hrs} hr \${mins} min\` : \`\${hrs} hr\`) : \`\${mins} min\`;
});`;
code = code.replace('const { stops, routes, alerts } = window.FindSuperBusData;', enrichment);

// 2. Update mountSharedChrome for Modal
const oldModal = `<dl class="detail-list"><div><dt>Via</dt><dd id="detail-via"></dd></div><div><dt>Stop</dt><dd id="detail-stop"></dd></div><div><dt>Departure</dt><dd id="detail-time"></dd></div><div><dt>Estimated arrival</dt><dd id="detail-arrival"></dd></div><div><dt>Travel time</dt><dd id="detail-duration"></dd></div><div><dt>Fare</dt><dd id="detail-fare"></dd></div><div><dt>Accessibility</dt><dd id="detail-accessibility"></dd></div><div><dt>Current status</dt><dd id="detail-status"></dd></div></dl>`;
const newModal = `<dl class="detail-list"><div><dt>Via</dt><dd id="detail-via"></dd></div><div><dt>Distance</dt><dd id="detail-distance"></dd></div><div><dt>Estimated Time</dt><dd id="detail-duration"></dd></div><div><dt>Stops</dt><dd id="detail-stops"></dd></div><div><dt>Departure</dt><dd id="detail-time"></dd></div><div><dt>Estimated Arrival</dt><dd id="detail-arrival"></dd></div><div><dt>Estimated Demo Fare</dt><dd id="detail-fare"></dd></div><div><dt>Current Stop</dt><dd id="detail-current-stop"></dd></div><div><dt>Next Stop</dt><dd id="detail-next-stop"></dd></div><div><dt>Accessibility</dt><dd id="detail-accessibility"></dd></div><div><dt>Status</dt><dd id="detail-status"></dd></div></dl>`;
code = code.replace(oldModal, newModal);

// 3. Update routeResult (Journey Planner Results)
const oldRouteResult = `card.innerHTML = \`<div><strong>BUS \${routeNumber}</strong><p>\${route.from} &rarr; \${route.to}</p><small>Via \${route.via} · Stop \${route.stop}\${travelDate ? \` · \${travelDate}\` : ''}</small></div><span>Departs \${route.time} · \${route.duration} min<br>₹\${route.fare} demo<br>\${route.total} total · \${route.occupied} occupied · \${available} available\${selected.length ? \` (\${selected.length} selected)\` : ''}<br>\${route.accessible ? 'Wheelchair accessible' : 'Limited accessibility'}</span><button class="text-button planner-view-route" data-route="\${routeNumber}" type="button">View Bus</button>\`;`;
const newRouteResult = `card.innerHTML = \`<div><strong>BUS \${routeNumber}</strong><p>\${route.from} &rarr; \${route.to}</p><small>Via \${route.via} · \${route.distanceKm} km · \${route.formattedDuration}</small></div><div style="margin: 0.5rem 0; font-size: 0.9rem; line-height: 1.4;">Departure: \${route.time}<br>Estimated arrival: \${estimatedArrival(route.time, route.duration)}<br>Stops: \${route.stops.length}<br>Estimated demo fare: ₹\${route.fare}<br>Seats: \${available} available<br>Status: \${currentDepartureStatus(routeNumber, '0 min')}</div><button class="button button-dark planner-view-route" data-route="\${routeNumber}" type="button">View Details</button><button class="text-button" type="button" style="margin-left: 0.5rem;" onclick="openBusDetails('\${routeNumber}')">Select Seat</button>\`;`;
code = code.replace(oldRouteResult, newRouteResult);

// 4. Update openBusDetails
const oldDetails = `const values = { '#detail-title': \`Bus \${busNumber}\`, '#detail-route': \`\${route.from} → \${route.to}\`, '#detail-via': route.via, '#detail-stop': route.stop, '#detail-time': route.time, '#detail-arrival': estimatedArrival(route.time, route.duration), '#detail-duration': \`\${route.duration} minutes\`, '#detail-fare': \`₹\${route.fare}\`, '#detail-accessibility': route.accessible ? 'Wheelchair accessible' : 'Limited accessibility', '#detail-status': status, '#detail-seats': seatSummary(busNumber) };`;
const newDetails = `const values = { '#detail-title': \`Bus \${busNumber}\`, '#detail-route': \`\${route.from} → \${route.to}\`, '#detail-via': route.via, '#detail-distance': \`\${route.distanceKm} km\`, '#detail-duration': route.formattedDuration, '#detail-stops': route.stops.length, '#detail-time': route.time, '#detail-arrival': estimatedArrival(route.time, route.duration), '#detail-fare': \`₹\${route.fare}\`, '#detail-current-stop': route.stops[0], '#detail-next-stop': route.stops[1] || route.to, '#detail-accessibility': route.accessible ? 'Wheelchair accessible' : 'Limited accessibility', '#detail-status': status, '#detail-seats': seatSummary(busNumber) };`;
code = code.replace(oldDetails, newDetails);

// 5. Update renderDepartureRows (Bus cards)
const oldRows = `return \`<article class="departure-row" data-route="\${number}" data-tags="\${route.tags.join(' ')}"><div class="route-badge badge-\${badge}">\${String(number).padStart(2, '0')}</div><div class="departure-info"><strong>\${route.from} <span aria-hidden="true">&#8594;</span> \${route.to}</strong><span>via \${route.via} · Stop \${route.stop}</span></div><div class="departure-time"><strong data-minutes="\${route.minutes}">\${route.minutes} min</strong><span>\${route.time}</span></div><div class="accessibility\${route.accessible ? '' : ' muted'}" aria-label="\${accessText}">&#9673;</div><button class="favorite-button" data-favorite="\${number}" aria-label="Favorite bus \${number}" type="button">&#9734;</button><button class="row-arrow" aria-label="View route \${number}" type="button">&#8594;</button></article>\`;`;
const newRows = `const availableSeats = route.total - route.occupied; return \`<article class="departure-row" data-route="\${number}" data-tags="\${route.tags.join(' ')}"><div class="route-badge badge-\${badge}">\${String(number).padStart(2, '0')}</div><div class="departure-info"><strong>\${route.from} <span aria-hidden="true">&#8594;</span> \${route.to}</strong><span style="display:flex;gap:0.5rem;flex-wrap:wrap;color:var(--text-muted);font-size:0.85rem"><span>📍 \${route.distanceKm} km</span><span>◷ \${route.formattedDuration}</span><span>● \${route.stops.length} stops</span><span>💺 \${availableSeats} seats</span></span></div><div class="departure-time"><strong data-minutes="\${route.minutes}">\${route.minutes} min</strong><span>\${route.time}</span></div><div class="accessibility\${route.accessible ? '' : ' muted'}" aria-label="\${accessText}">&#9673;</div><button class="favorite-button" data-favorite="\${number}" aria-label="Favorite bus \${number}" type="button">&#9734;</button><button class="row-arrow" aria-label="View route \${number}" type="button">&#8594;</button></article>\`;`;
code = code.replace(oldRows, newRows);

// 6. Fix Hero Animation Text - Speed & Distance & Live Label
const oldLabelUpdate = `const label = \`Bus 12 · \${status} · Kakinada to Rajahmundry\`;`;
const newLabelUpdate = `
    const distanceRemaining = Math.max(0, Math.round(55 * (1 - lastProgress)));
    const speed = status === 'Moving' ? (lastProgress < 0.1 || lastProgress > 0.9 ? 18 : 42) : (status.includes('Approaching') ? 15 : 0);
    const label = \`Bus 12 · \${status} · \${distanceRemaining} km remaining · \${speed} km/h\`;
`;
code = code.replace(oldLabelUpdate, newLabelUpdate);

fs.writeFileSync('script.js', code);
console.log('script.js updated');
