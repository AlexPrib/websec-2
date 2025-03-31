$(document).ready(() => {
    const App = {
      config: {
        apiEndpoint: '/api',
        mapApiKey: 'd70e58f2-79c2-4b10-8752-80181b717d58'
      },
      elements: {
        searchInput: $('#stationSearch'),
        searchResults: $('#searchResults'),
        scheduleView: $('#scheduleView'),
        favoritesList: $('#favoritesList'),
        searchButton: $('#searchButton')
      },
      state: {
        favorites: JSON.parse(localStorage.getItem('favorites')) || [],
        currentLocation: null,
        allStations: [],
        map: null
      },

      init() {
        this.loadYandexMap();
        this.setupEventListeners();
        this.loadStations();
        this.renderFavorites();
      },
  
      loadYandexMap() {
        const script = document.createElement('script');
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${this.config.mapApiKey}&lang=ru_RU`;
        script.onload = () => this.initYandexMap();
        document.head.appendChild(script);
      },
  
      initYandexMap() {
        ymaps.ready(() => {
          this.initGeoLocation();
          let isDragging = false;
          let clickTimer;
  
          this.state.map = new ymaps.Map('yandexMap', {
            center: [53.195878, 50.100202],
            zoom: 10
          });
  
          this.state.map.events.add('actionbegin', () => { isDragging = true; });
          this.state.map.events.add('actionend', () => { isDragging = false; });
  
          this.state.map.events.add('click', (e) => {
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
              if (!isDragging) this.handleMapClick(e.get('coords'));
            }, 50);
          });
        });
      },
  
      initGeoLocation() {
        if (!navigator.geolocation) {
          console.warn('Geolocation not supported');
          return;
        }
  
        navigator.geolocation.getCurrentPosition(
          position => {
            this.state.currentLocation = [
              position.coords.latitude,
              position.coords.longitude
            ];
            if (this.state.map) this.state.map.setCenter(this.state.currentLocation, 14);
          },
          error => console.error('Geolocation error:', error)
        );
      },

      async loadStations() {
        try {
          const response = await fetch(`${this.config.apiEndpoint}/allStations`);
          const data = await response.json();
          this.state.allStations = data.stations;
        } catch (error) {
          console.error('Station loading error:', error);
        }
      },
  
      async loadNearestStations(lat, lng, distance = 50) {
        try {
          const response = await fetch(
            `${this.config.apiEndpoint}/nearestStations?lat=${lat}&lng=${lng}&distance=${distance}`
          );
          const data = await response.json();
          this.showNearestStations(data);
        } catch (error) {
          console.error('Nearest stations error:', error);
        }
      },
  
      async loadSchedule(title, code) {
        try {
          const response = await fetch(`${this.config.apiEndpoint}/schedule?station=${code}`);
          const data = await response.json();
          this.showSchedule(title, data);
        } catch (error) {
          console.error('Schedule loading error:', error);
        }
      },
  
      showNearestStations(data) {
        const { searchResults } = this.elements;
        searchResults.empty().show();
    
        if (!data?.stations?.length) {
            searchResults.append('<div class="search-result-item-nofound">Станций электричек поблизости не найдено</div>');
            return;
        }
    
        this.state.map.geoObjects.removeAll();
    
        data.stations.forEach(station => {
            searchResults.append(
                `<div class="search-result-item" data-code="${station.code}">
                    ${station.title} (${Math.round(station.distance)} км)
                </div>`
            );
    
            const placemark = new ymaps.Placemark(
                [station.lat, station.lng],
                { balloonContent: station.title },
                { preset: 'islands#blueTrainCircleIcon' }
            );
            this.state.map.geoObjects.add(placemark);
        });
    
        if (data.stations.length > 0) {
            const nearest = data.stations.reduce((prev, curr) => 
                prev.distance < curr.distance ? prev : curr
            );
            this.state.map.setCenter([nearest.lat, nearest.lng], 13);
            this.state.map.geoObjects.get(0).balloon.open();
        }
    },
  
      renderFavorites() {
        const { favoritesList } = this.elements;
        favoritesList.empty();
  
        if (this.state.favorites.length === 0) {
          favoritesList.append('<div>No favorite stations</div>');
          return;
        }
  
        this.state.favorites.forEach(station => {
          favoritesList.append(
            `<div class="favorite-item">
              <span class="fav-station" data-code="${station.code}">
                ${station.title}
              </span>
              <span class="remove-fav" data-code="${station.code}">✖️</span>
            </div>`
          );
        });
      },
  
      showSearchResults(stations) {
        const { searchResults } = this.elements;
        searchResults.empty().show();
  
        if (stations.length === 0) {
          searchResults.append('<div class="search-result-item-nofound">No stations found</div>');
          return;
        }
  
        stations.forEach(station => {
          searchResults.append(
            `<div class="search-result-item" data-code="${station.code}">
              ${station.title}
            </div>`
          );
        });
      },
  
      showSchedule(title, data) {
        const { scheduleView } = this.elements;
        scheduleView.empty();
  
        if (!data?.schedule?.length) {
          scheduleView.append('<div>No schedule data available</div>');
          return;
        }
  
        scheduleView.append(`<h3>Расписание станции: ${title}</h3>`);
        data.schedule.forEach(train => {
          scheduleView.append(
            `<div class="schedule-item">
              <span>${train.thread.title}</span>
              <span>${train.departure || '—'}</span>
            </div>`
          );
        });
      },
  
      handleMapClick(coords) {
        this.loadNearestStations(coords[0], coords[1]);
        if (this.state.map) {
            this.state.map.geoObjects.removeAll();
            
            this.elements.searchResults.html('<div class="search-result-item-nofound">Загрузка станций...</div>').show();
            
            this.loadNearestStations(coords[0], coords[1]).then(() => {
            });
        }
    },
  
      handleDocumentClick(e) {
        const isSearchRelated = $(e.target).closest('.search-box, #searchResults').length > 0;
        if (!isSearchRelated) this.elements.searchResults.hide();
      },
  
      handleSearch() {
        const query = this.elements.searchInput.val().trim();
        if (query.length < 3) {
          alert('Enter at least 3 characters');
          return;
        }
  
        const results = this.searchLocalStations(query);
        this.showSearchResults(results);
      },
  
      handleSearchResultClick(e) {
        e.stopPropagation();
        const element = $(e.currentTarget);
        const station = {
          title: element.text().trim(),
          code: element.data('code')
        };
  
        this.loadSchedule(station.title, station.code);
        this.elements.searchResults.hide();
  
        if (!this.state.favorites.some(fav => fav.code === station.code)) {
          this.state.favorites.push(station);
          localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
          this.renderFavorites();
        }
      },
  
      handleFavoriteClick(e) {
        const station = {
          title: $(e.currentTarget).text().trim(),
          code: $(e.currentTarget).data('code')
        };
        this.loadSchedule(station.title, station.code);
      },
  
      handleRemoveFavorite(e) {
        e.stopPropagation();
        const code = $(e.currentTarget).data('code');
        this.state.favorites = this.state.favorites.filter(fav => fav.code !== code);
        localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
        this.renderFavorites();
      },
  
      searchLocalStations(query) {
        const normalizedQuery = query.toLowerCase().trim();
        return this.state.allStations.filter(station => 
          station.title.toLowerCase().includes(normalizedQuery) &&
          station.transport_type === 'train'
        );
      },
  
      setupEventListeners() {
        $(document).on('click', e => this.handleDocumentClick(e));
        
        this.elements.searchButton.on('click', () => this.handleSearch());
        this.elements.searchInput.on('keypress', e => {
          if (e.which === 13) this.handleSearch();
        });
        
        this.elements.searchResults.on('click', '.search-result-item', e => 
          this.handleSearchResultClick(e)
        );
        
        this.elements.favoritesList.on('click', '.fav-station', e => 
          this.handleFavoriteClick(e)
        );
        
        this.elements.favoritesList.on('click', '.remove-fav', e => 
          this.handleRemoveFavorite(e)
        );
      }
    };
  
    App.init();
  });