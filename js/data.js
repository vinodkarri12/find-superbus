window.FindSuperBusData = {
  stops: ['Kakinada', 'Samalkota', 'Pithapuram', 'Peddapuram', 'Anaparthi', 'Rajahmundry', 'Amalapuram', 'Tuni', 'Annavaram', 'Yanam', 'Mandapeta', 'Ramachandrapuram', 'Visakhapatnam'],
  routes: {
    12: { total: 30, occupied: 12, from: 'Kakinada', via: 'Anaparthi', to: 'Rajahmundry', stop: '08', time: '06:45', minutes: 3, duration: 18, fare: 20, accessible: true, status: 'Arriving soon', tags: ['frequent', 'accessible'] },
    7: { total: 30, occupied: 21, from: 'Kakinada', via: 'Samalkota', to: 'Pithapuram', stop: '14', time: '06:50', minutes: 8, duration: 24, fare: 20, accessible: false, status: 'Limited seating', tags: ['frequent'] },
    21: { total: 40, occupied: 15, from: 'Kakinada', via: 'Ramachandrapuram', to: 'Amalapuram', stop: '03', time: '06:53', minutes: 11, duration: 16, fare: 25, accessible: true, status: 'Delayed', tags: ['accessible'] },
    15: { total: 32, occupied: 14, from: 'Kakinada', via: 'Pithapuram', to: 'Tuni', stop: '06', time: '07:10', minutes: 12, duration: 28, fare: 22, accessible: true, status: 'On time', tags: ['frequent', 'accessible'] },
    9: { total: 30, occupied: 16, from: 'Rajahmundry', via: 'Anaparthi', to: 'Kakinada', stop: '11', time: '07:25', minutes: 9, duration: 19, fare: 20, accessible: false, status: 'On time', tags: ['frequent'] },
    18: { total: 36, occupied: 18, from: 'Kakinada', via: 'Tuni', to: 'Visakhapatnam', stop: '05', time: '07:40', minutes: 15, duration: 33, fare: 35, accessible: true, status: 'On time', tags: ['accessible', 'frequent'] },
    25: { total: 32, occupied: 17, from: 'Kakinada', via: 'Amalapuram', to: 'Yanam', stop: '09', time: '08:00', minutes: 18, duration: 26, fare: 24, accessible: false, status: 'On time', tags: ['frequent'] },
    31: { total: 28, occupied: 13, from: 'Peddapuram', via: 'Samalkota', to: 'Kakinada', stop: '12', time: '08:15', minutes: 20, duration: 22, fare: 18, accessible: true, status: 'On time', tags: ['accessible'] }
  },
  alerts: [
    { type: 'delay', label: 'DEMO · Bus 21', copy: 'Running approximately 5 minutes late.' },
    { type: 'change', label: 'DEMO · Bus 07', copy: 'Limited seating on this demonstration route.' },
    { type: 'normal', label: 'DEMO · Bus 12', copy: 'Arriving soon at the next stop.' }
  ],
  popularRouteIds: ['12', '7', '21', '15']
};
