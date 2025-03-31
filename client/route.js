class RouteFinder {
    constructor() {
      this.apiEndpoint = '/api';
      this.allStations = [];
      this.initElements();
      this.bindEvents();
      this.initStations();
    }
  
    initElements() {
      this.elements = {
        fromInput: $('#fromStation'),
        toInput: $('#toStation'),
        fromSuggestions: $('#fromSuggestions'),
        toSuggestions: $('#toSuggestions'),
        findButton: $('#findRoute'),
        scheduleView: $('#scheduleView')
      };
    }
  
    bindEvents() {
      this.elements.fromInput.on('input', () => this.handleInput(this.elements.fromInput, this.elements.fromSuggestions));
      this.elements.toInput.on('input', () => this.handleInput(this.elements.toInput, this.elements.toSuggestions));
      $(document).on('click', '.suggestion-item', (e) => this.handleSuggestionClick(e));
      this.elements.findButton.on('click', () => this.findRoute());
      $(document).on('click', (e) => this.closeSuggestions(e));
    }
  
    async initStations() {
      try {
        const response = await fetch(`${this.apiEndpoint}/allStations`);
        const data = await response.json();
        this.allStations = data.stations;
      } catch (error) {
        console.error('Ошибка загрузки станций:', error);
        this.showError('Не удалось загрузить список станций');
      }
    }
  
    handleInput($input, $suggestions) {
      const query = $input.val().trim();
      if (query.length < 2) {
        $suggestions.hide();
        return;
      }
      
      const suggestions = this.searchStations(query);
      this.showSuggestions($suggestions, suggestions);
    }
  
    searchStations(query) {
      const normalizedQuery = query.toLowerCase().trim();
      return this.allStations.filter(station => 
        station.title.toLowerCase().includes(normalizedQuery) &&
        station.transport_type === 'train'
      );
    }
  
    showSuggestions($container, stations) {
      $container.empty();
  
      if (stations.length === 0) {
        $container.hide();
        return;
      }
  
      stations.forEach(station => {
        $container.append(`
          <div class="suggestion-item" data-code="${station.code}">
            ${station.title} <small>(${station.transport_type === 'suburban' ? 'электричка' : 'поезд'})</small>
          </div>
        `);
      });
  
      $container.show();
    }
  
    handleSuggestionClick(e) {
      const $item = $(e.currentTarget);
      const $input = $item.closest('.station-box').find('.input-search');
      
      $input.val($item.text().split(' (')[0]);
      $input.data('station-code', $item.data('code'));
      $item.parent().hide();
    }
  
    closeSuggestions(e) {
      if (!$(e.target).closest('.station-box').length) {
        $('.suggestions').hide();
      }
    }
  
    async findRoute() {
      const fromCode = this.elements.fromInput.data('station-code');
      const toCode = this.elements.toInput.data('station-code');
  
      if (!fromCode || !toCode) {
        this.showError('Пожалуйста, выберите станции из списка предложений');
        return;
      }
  
      try {
        this.showLoading();
        
        const response = await fetch(`${this.apiEndpoint}/searchRoutes?from=${fromCode}&to=${toCode}`);
        const data = await response.json();
        
        if (data.routes?.length > 0) {
          this.showRoutes(data.routes);
        } else {
          this.showNoRoutes();
        }
      } catch (error) {
        console.error('Ошибка при поиске маршрута:', error);
        this.showError('Произошла ошибка при загрузке маршрутов');
      }
    }
  
    showLoading() {
      this.elements.scheduleView.html('<div class="loader" style="margin: 2rem auto;"></div>');
    }
  
    showError(message) {
      this.elements.scheduleView.html(`
        <div style="text-align: center; padding: 2rem; color: var(--error-color);">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${message}</p>
        </div>
      `);
    }
  
    showNoRoutes() {
      this.elements.scheduleView.html(`
        <div style="text-align: center; padding: 2rem; color: var(--dark-gray);">
          <i class="fas fa-exclamation-circle" style="color: var(--error-color); font-size: 2rem; margin-bottom: 1rem;"></i>
          <h3>Маршрутов не найдено</h3>
          <p>Попробуйте изменить параметры поиска</p>
        </div>
      `);
    }
  
    showRoutes(routes) {
      this.elements.scheduleView.empty();
  
      this.elements.scheduleView.append(`
        <div class="route-header">
          <h3><i class="fas fa-train"></i> Найденные маршруты</h3>
          <div class="route-path">
            <span class="station-from">${this.elements.fromInput.val()}</span>
            <i class="fas fa-arrow-right"></i>
            <span class="station-to">${this.elements.toInput.val()}</span>
          </div>
        </div>
        <div class="routes-list"></div>
      `);
  
      const $routesList = this.elements.scheduleView.find('.routes-list');
      
      routes.forEach((route, index) => {
        const duration = route.duration_seconds 
          ? this.formatDuration(route.duration_seconds) 
          : route.duration || '';
        
        $routesList.append(`
          <div class="route-item" data-route-index="${index}">
            <div class="route-main-info">
              <div class="route-name">
                <i class="fas fa-subway"></i>
                <strong>${route.thread.title}</strong>
                ${route.thread.number ? `<span class="route-number">№ ${route.thread.number}</span>` : ''}
              </div>
              <div class="route-times">
                <div class="time-departure">
                  <i class="fas fa-clock"></i>
                  <span>${route.departure || '—'}</span>
                </div>
                ${route.arrival ? `
                <div class="time-arrival">
                  <i class="fas fa-flag-checkered"></i>
                  <span>${route.arrival}</span>
                </div>
                ` : ''}
              </div>
            </div>
          </div>
        `);
      });
    }
  
    formatDuration(seconds) {
      if (!seconds) return '';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} ч ${minutes} мин`;
    }
  }
  
  $(document).ready(() => {
    new RouteFinder();
  });