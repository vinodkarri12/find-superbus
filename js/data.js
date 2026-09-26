window.FindSuperBusData = {
  stops: ['Kakinada', 'Samalkota', 'Pithapuram', 'Peddapuram', 'Anaparthi', 'Rajahmundry', 'Amalapuram', 'Tuni', 'Annavaram', 'Yanam', 'Mandapeta', 'Ramachandrapuram', 'Visakhapatnam'],
  routes: {
    12: { total: 30, occupied: 12, from: 'Kakinada', via: 'Anaparthi', to: 'Rajahmundry', stop: '08', time: '06:45', departure: '06:45', minutes: 3, durationMinutes: 90, distanceKm: 55, stops: ['Kakinada', 'Samalkota', 'Anaparthi', 'Rajahmundry'], accessible: true, status: 'IN TRANSIT', tags: ['frequent', 'accessible'] },
    7: { total: 30, occupied: 21, from: 'Kakinada', via: 'Samalkota', to: 'Pithapuram', stop: '14', time: '06:50', departure: '06:50', minutes: 8, durationMinutes: 40, distanceKm: 20, stops: ['Kakinada', 'Samalkota', 'Pithapuram'], accessible: false, status: 'LIMITED SEATS', tags: ['frequent'] },
    21: { total: 40, occupied: 15, from: 'Kakinada', via: 'Ramachandrapuram', to: 'Amalapuram', stop: '03', time: '06:53', departure: '06:53', minutes: 11, durationMinutes: 110, distanceKm: 65, stops: ['Kakinada', 'Ramachandrapuram', 'Amalapuram'], accessible: true, status: 'DEPARTED', tags: ['accessible'] },
    15: { total: 32, occupied: 14, from: 'Kakinada', via: 'Pithapuram', to: 'Tuni', stop: '06', time: '07:10', departure: '07:10', minutes: 12, durationMinutes: 100, distanceKm: 65, stops: ['Kakinada', 'Pithapuram', 'Annavaram', 'Tuni'], accessible: true, status: 'SEATS AVAILABLE', tags: ['frequent', 'accessible'] },
    9: { total: 30, occupied: 16, from: 'Rajahmundry', via: 'Anaparthi', to: 'Kakinada', stop: '11', time: '07:25', departure: '07:25', minutes: 9, durationMinutes: 90, distanceKm: 55, stops: ['Rajahmundry', 'Anaparthi', 'Samalkota', 'Kakinada'], accessible: false, status: 'SEATS AVAILABLE', tags: ['frequent'] },
    18: { total: 36, occupied: 18, from: 'Kakinada', via: 'Tuni', to: 'Visakhapatnam', stop: '05', time: '07:40', departure: '07:40', minutes: 15, durationMinutes: 210, distanceKm: 150, stops: ['Kakinada', 'Tuni', 'Annavaram', 'Visakhapatnam'], accessible: true, status: 'SEATS AVAILABLE', tags: ['accessible', 'frequent'] },
    25: { total: 32, occupied: 17, from: 'Kakinada', via: 'Amalapuram', to: 'Yanam', stop: '09', time: '08:00', departure: '08:00', minutes: 18, durationMinutes: 130, distanceKm: 80, stops: ['Kakinada', 'Amalapuram', 'Yanam'], accessible: false, status: 'SEATS AVAILABLE', tags: ['frequent'] },
    31: { total: 28, occupied: 13, from: 'Peddapuram', via: 'Samalkota', to: 'Kakinada', stop: '12', time: '08:15', departure: '08:15', minutes: 20, durationMinutes: 40, distanceKm: 20, stops: ['Peddapuram', 'Samalkota', 'Kakinada'], accessible: true, status: 'SEATS AVAILABLE', tags: ['accessible'] }
  },
  alerts: [
    { type: 'delay', label: 'DEMO · Bus 21', copy: 'Running approximately 5 minutes late.' },
    { type: 'change', label: 'DEMO · Bus 07', copy: 'Limited seating on this demonstration route.' },
    { type: 'normal', label: 'DEMO · Bus 12', copy: 'Arriving soon at the next stop.' }
  ],
  popularRouteIds: ['12', '7', '21', '15']
};
