// Zmienne globalne
let currentTab = 'subnet-management';
let subnets = [];
let companies = [];
let currentUser = null;
let currentLogsPage = 1;
let logsFilters = {};

// Zmienne globalne dla wykresów
let charts = {};

// Zmienne globalne dla historii podsieci
let subnetHistory = [];
let currentHistoryPage = 1;
let historyFilters = {};
let currentDetailedHistory = null;

// Funkcje API
const API = {
    async checkAuth() {
        const response = await fetch('/api/auth-status');
        return response.json();
    },

    async logout() {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        return response.json();
    },
    
    async fetchStats() {
        const response = await fetch('/api/stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    },

    async fetchSubnets() {
        const response = await fetch('/api/subnets');
        return response.json();
    },

    async fetchCompanies() {
        const response = await fetch('/api/companies');
        return response.json();
    },

    async createSubnet(subnetData) {
        const response = await fetch('/api/subnets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subnetData)
        });
        return response.json();
    },

    async createCompany(companyData) {
        const response = await fetch('/api/companies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(companyData)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Błąd tworzenia firmy');
        }
        return result;
    },

    async deleteCompany(id) {
        const response = await fetch(`/api/companies/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Błąd usuwania firmy');
        }
        return result;
    },

    async updateSubnet(id, subnetData) {
        const response = await fetch(`/api/subnets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subnetData)
        });
        return response.json();
    },

    async deleteSubnet(id) {
        const response = await fetch(`/api/subnets/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async divideSubnet(id, newMask) {
        const response = await fetch(`/api/subnets/${id}/divide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_mask: newMask })
        });
        return response.json();
    },

    async mergeSubnets(subnetIds) {
        const response = await fetch('/api/subnets/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subnet_ids: subnetIds })
        });
        return response.json();
    },

    async assignFreeSubnets(companyId) {
        const response = await fetch('/api/subnets/assign-free', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_id: companyId })
        });
        return response.json();
    },

    async importExcel(formData) {
        const response = await fetch('/api/import-excel', {
            method: 'POST',
            body: formData
        });
        return response.json();
    },

    async exportExcel() {
        const response = await fetch('/api/export-excel');
        return response;
    },

    async fetchAuditLogs(page = 1, filters = {}) {
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('limit', 50);
        
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/audit-logs?${params}`);
        return response.json();
    },

    async fetchLogDetails(logId) {
        const response = await fetch(`/api/audit-logs/${logId}`);
        return response.json();
    },

    // Analytics API calls
    async fetchAnalyticsStats(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/analytics/stats?${params}`);
        return response.json();
    },

    async fetchAnalyticsCompanies(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/analytics/companies?${params}`);
        return response.json();
    },

    async fetchAnalyticsMonthly(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/analytics/monthly?${params}`);
        return response.json();
    },

    async updateCompany(id, companyData) {
        const response = await fetch(`/api/companies/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(companyData)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Błąd aktualizacji firmy');
        }
        return result;
    },

    // Subnet History API calls
    async fetchSubnetHistory(page = 1, filters = {}) {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '20'
        });
        
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/subnet-history?${params}`);
        return response.json();
    },

    async fetchSubnetDetailedHistory(subnetId, filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/subnet-history/${subnetId}?${params}`);
        return response.json();
    }
};

// Funkcje globalne dla zarządzania firmami
async function deleteCompany(id) {
    const company = companies.find(c => c.id === id);
    if (!company) return;
    
    // Ochrona systemowej firmy "Wolne"
    if (company.name === 'Wolne' || id === 1) {
        showMessage('Nie można usunąć firmy systemowej "Wolne"', 'error');
        return;
    }
    
    if (!confirm(`Czy na pewno chcesz usunąć firmę "${company.name}"?`)) return;
    
    try {
        await API.deleteCompany(id);
        showMessage('Firma została pomyślnie usunięta', 'success');
        await loadCompanies();
        await loadSubnets();
        await loadStats();
    } catch (error) {
        console.error('Błąd podczas usuwania firmy:', error);
        showMessage(error.message || 'Błąd podczas usuwania firmy', 'error');
    }
}

// Inicjalizacja aplikacji
document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndInit();
});

// Sprawdzanie autoryzacji i inicjalizacja
async function checkAuthAndInit() {
    try {
        const authStatus = await API.checkAuth();
        
        if (!authStatus.authenticated) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = authStatus.user;
        updateUserInfo();
        
        // Najpierw ładujemy firmy, następnie podsieci i statystyki
        await loadCompanies();
        await loadSubnets();
        await loadStats();
        setupEventListeners();
    } catch (error) {
        console.error('Błąd sprawdzania autoryzacji:', error);
        window.location.href = '/login.html';
    }
}

// Aktualizacja informacji o użytkowniku
function updateUserInfo() {
    const userInfoElement = document.getElementById('userInfo');
    if (currentUser) {
        userInfoElement.textContent = `Cześć, ${currentUser.username}!`;
    }
}

// Wylogowanie z systemu
async function logout() {
    if (confirm('Czy na pewno chcesz się wylogować?')) {
        try {
            await API.logout();
            window.location.href = '/login.html';
        } catch (error) {
            showMessage('Błąd podczas wylogowywania', 'error');
        }
    }
}

// Ładowanie statystyk
async function loadStats() {
    try {
        console.log('Loading stats...');
        const stats = await API.fetchStats();
        console.log('Received stats:', stats);
        
        document.getElementById('totalSubnets').textContent = stats.total_subnets || 0;
        document.getElementById('assignedSubnets').textContent = stats.assigned_subnets || 0;
        document.getElementById('freeSubnets').textContent = stats.free_subnets || 0;
        document.getElementById('totalCompanies').textContent = stats.total_companies || 0;
        
        console.log('Stats updated in DOM');
    } catch (error) {
        console.error('Błąd ładowania statystyk:', error);
        showMessage('Błąd ładowania statystyk', 'error');
    }
}

// Ładowanie podsieci
async function loadSubnets() {
    try {
        subnets = await API.fetchSubnets();
        renderSubnetsTable();
        updateSubnetFilters();
        renderCompaniesTable(); // Aktualizujemy tabelę firm dla odświeżenia liczby podsieci
        loadStats(); // Aktualizujemy górny panel statystyk
    } catch (error) {
        console.error('Błąd ładowania podsieci:', error);
    }
}

// Ładowanie firm
async function loadCompanies() {
    try {
        companies = await API.fetchCompanies();
        updateCompanyOptions();
        renderCompaniesTable(); // Dodano dla wyświetlania tabeli firm
        
        // Aktualizujemy analitykę po załadowaniu firm
        if (document.querySelector('.tab-content.active')?.id === 'analytics') {
            await updateAnalytics();
        }
    } catch (error) {
        console.error('Błąd ładowania firm:', error);
    }
}

// Ładowanie logów audytu
async function loadAuditLogs(page = 1, filters = {}) {
    try {
        const data = await API.fetchAuditLogs(page, filters);
        renderLogsTable(data.logs);
        renderLogsPagination(data);
        currentLogsPage = page;
        logsFilters = filters;
    } catch (error) {
        console.error('Błąd ładowania logów:', error);
        showMessage('Błąd ładowania logów audytu', 'error');
    }
}

// Ładowanie analityki
async function loadAnalytics() {
    try {
        await updateAnalytics();
    } catch (error) {
        console.error('Błąd ładowania analityki:', error);
        showMessage('Błąd ładowania danych analityki', 'error');
    }
}

// Aktualizacja analityki z filtrami
async function updateAnalytics() {
    try {
        console.log('Updating analytics...');
        const filters = getAnalyticsFilters();
        console.log('Analytics filters:', filters);
        
        // Ładujemy wszystkie dane równolegle
        const [stats, companiesData, monthlyData] = await Promise.all([
            API.fetchAnalyticsStats(filters),
            API.fetchAnalyticsCompanies(filters),
            API.fetchAnalyticsMonthly(filters)
        ]);
        
        console.log('Analytics data received:', { stats, companiesData, monthlyData });
        
        // Aktualizujemy karty statystyk
        updateAnalyticsStats(stats);
        
        // Aktualizujemy wykresy
        updateSubnetsUsageChart(stats);
        updateCompaniesChart(companiesData);
        updateVlanChart(stats);
        updateMonthlyChart(monthlyData);
        
        console.log('Analytics updated successfully');
        
    } catch (error) {
        console.error('Błąd aktualizacji analityki:', error);
        showMessage('Błąd aktualizacji analityki', 'error');
    }
}

// Pobieranie filtrów analityki
function getAnalyticsFilters() {
    const companyFilter = document.getElementById('analyticsCompanyFilter');
    const dateFrom = document.getElementById('analyticsDateFrom');
    const dateTo = document.getElementById('analyticsDateTo');
    
    return {
        company_id: companyFilter ? companyFilter.value : '',
        date_from: dateFrom ? dateFrom.value : '',
        date_to: dateTo ? dateTo.value : ''
    };
}

// Reset filtrów analityki
function resetAnalyticsFilters() {
    const companyFilter = document.getElementById('analyticsCompanyFilter');
    const dateFrom = document.getElementById('analyticsDateFrom');
    const dateTo = document.getElementById('analyticsDateTo');
    
    if (companyFilter) companyFilter.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    
    updateAnalytics();
}

// Aktualizacja kart statystyk
function updateAnalyticsStats(stats) {
    const elements = {
        analyticsTotal: document.getElementById('analyticsTotal'),
        analyticsAssigned: document.getElementById('analyticsAssigned'),
        analyticsFree: document.getElementById('analyticsFree'),
        analyticsCompanies: document.getElementById('analyticsCompanies')
    };
    
    if (elements.analyticsTotal) elements.analyticsTotal.textContent = stats.total_subnets || 0;
    if (elements.analyticsAssigned) elements.analyticsAssigned.textContent = stats.assigned_subnets || 0;
    if (elements.analyticsFree) elements.analyticsFree.textContent = stats.free_subnets || 0;
    if (elements.analyticsCompanies) elements.analyticsCompanies.textContent = stats.total_companies || 0;
}

// Wykres użycia podsieci (kołowy)
function updateSubnetsUsageChart(stats) {
    const canvas = document.getElementById('subnetsUsageChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.subnetsUsage) {
        charts.subnetsUsage.destroy();
    }
    
    charts.subnetsUsage = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Przypisane', 'Wolne'],
            datasets: [{
                data: [stats.assigned_subnets || 0, stats.free_subnets || 0],
                backgroundColor: ['#3498db', '#95a5a6'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Wykres firm według liczby podsieci
function updateCompaniesChart(data) {
    const canvas = document.getElementById('companiesChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.companies) {
        charts.companies.destroy();
    }
    
    charts.companies = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.company),
            datasets: [{
                label: 'Podsieci',
                data: data.map(item => item.subnet_count),
                backgroundColor: '#3498db'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Wykres aktywności według miesięcy
function updateMonthlyChart(data) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    charts.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => {
                const date = new Date(item.month + '-01');
                return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short' });
            }),
            datasets: [{
                label: 'Przydzielone adresy IP',
                data: data.map(item => item.count),
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Wykres rozkładu VLAN
function updateVlanChart(stats) {
    const canvas = document.getElementById('vlanChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.vlan) {
        charts.vlan.destroy();
    }
    
    // Jeśli mamy dane o VLAN w stats
    const vlanData = stats.vlan_distribution || [];
    
    charts.vlan = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: vlanData.map(item => `VLAN ${item.vlan || 'Brak'}`),
            datasets: [{
                label: 'Liczba podsieci',
                data: vlanData.map(item => item.count || 0),
                backgroundColor: '#e74c3c',
                borderColor: '#c0392b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Модальные окна
// Модальные окна
function showAddSubnetModal() {
    document.getElementById('subnetModalTitle').textContent = 'Dodaj podsieć';
    document.getElementById('subnetForm').reset();
    document.getElementById('subnetId').value = '';
    updateCompanyOptions();
    document.getElementById('subnetModal').style.display = 'block';
    
    // Ustawiamy obsługę zdarzenia dla formularza
    setupSubnetFormHandler();
}

function showAddCompanyModal() {
    document.getElementById('companyModalTitle').textContent = 'Dodaj firmę';
    document.getElementById('companyForm').reset();
    document.getElementById('companyModal').style.display = 'block';
    
    // Ustawiamy obsługę zdarzenia dla formularza
    setupCompanyFormHandler();
}

function showDivideSubnetModal() {
    const select = document.getElementById('divideSubnetSelect');
    const newMaskField = document.getElementById('newMask');
    
    // Восстанавливаем возможность выбора
    select.disabled = false;
    newMaskField.min = 1;
    newMaskField.max = 30;
    
    // Удаляем подсказку о текущей маске
    const hintElement = document.querySelector('.current-mask-hint');
    if (hintElement) {
        hintElement.remove();
    }
    
    updateDivideSubnetOptions();
    document.getElementById('divideSubnetModal').style.display = 'block';
}

function showMergeSubnetsModal() {
    updateSelectedSubnetsForMerge();
    document.getElementById('mergeSubnetsModal').style.display = 'block';
}

function showAssignFreeSubnetsModal() {
    updateAssignCompanyOptions();
    document.getElementById('assignFreeSubnetsModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    
    // Если закрываем модальное окно разделения, восстанавливаем исходное состояние
    if (modalId === 'divideSubnetModal') {
        const select = document.getElementById('divideSubnetSelect');
        const newMaskField = document.getElementById('newMask');
        
        if (select) {
            select.disabled = false;
            select.innerHTML = '<option value="">Wybierz podsieć</option>';
        }
        if (newMaskField) {
            newMaskField.min = 1;
            newMaskField.max = 30;
            newMaskField.value = '';
        }
        
        // Удаляем подсказку о текущей маске
        const hintElement = document.querySelector('.current-mask-hint');
        if (hintElement) {
            hintElement.remove();
        }
    }
}

// Edycja podsieci
function editSubnet(id) {
    const subnet = subnets.find(s => s.id === id);
    if (!subnet) return;

    console.log('Editing subnet:', subnet); // Информация отладочная
    
    // СНАЧАЛА устанавливаем обработчик формы (это сбросит значения)
    setupSubnetFormHandler();
    
    // ПОТОМ заполняем форму данными
    document.getElementById('subnetModalTitle').textContent = 'Edytuj podsieć';
    document.getElementById('subnetId').value = subnet.id;
    document.getElementById('subnetNetwork').value = subnet.network;
    
    // Устанавливаем маску с отладкой
    const maskSelect = document.getElementById('subnetMask');
    console.log('Available mask options:', Array.from(maskSelect.options).map(opt => opt.value));
    console.log('Setting mask to:', subnet.mask);
    maskSelect.value = subnet.mask;
    console.log('Mask after setting:', maskSelect.value);
    
    document.getElementById('subnetVlan').value = subnet.vlan || '';
    document.getElementById('subnetDescription').value = subnet.description || '';
    
    // Обновляем опции компаний с правильным значением
    updateCompanyOptionsWithValue('subnetCompany', subnet.company_id);
    
    console.log('Set company to:', subnet.company_id); // Информация отладочная
    console.log('Company after setting:', document.getElementById('subnetCompany').value);
    
    document.getElementById('subnetModal').style.display = 'block';
}

// Редактирование компании
function editCompany(id) {
    const company = companies.find(c => c.id === id);
    if (!company) {
        showMessage('Nie znaleziono firmy', 'error');
        return;
    }

    document.getElementById('companyModalTitle').textContent = 'Edytuj firmę';
    document.getElementById('companyId').value = company.id;
    document.getElementById('companyName').value = company.name;
    document.getElementById('companyDescription').value = company.description || '';
    
    document.getElementById('companyModal').style.display = 'block';
    
    // Ustawiamy obsługę zdarzenia dla formularza
    setupCompanyFormHandler();
}

// Обновление опций компаний
function updateCompanyOptions() {
    const selects = ['subnetCompany', 'analyticsCompanyFilter'];
    
    console.log('Updating company options, available companies:', companies); // Отладочная информация
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        console.log(`Updating ${selectId}, current value:`, currentValue); // Отладочная информация
        
        if (selectId === 'analyticsCompanyFilter') {
            select.innerHTML = '<option value="">Wszystkie firmy</option>';
        } else {
            select.innerHTML = '<option value="">Wolna (nieprzypisana)</option>';
        }
        
        companies.forEach(company => {
            if (company.name !== 'Wolne') { // Не показываем "Wolne" как опцию
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                select.appendChild(option);
            }
        });
        
        // Восстанавливаем значение только если оно существует
        if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
            console.log(`Restored value ${currentValue} for ${selectId}`); // Отладочная информация
        } else {
            console.log(`Could not restore value ${currentValue} for ${selectId}`); // Отладочная информация
        }
    });
}

// Специальная функция для обновления опций компаний с сохранением конкретного значения
function updateCompanyOptionsWithValue(selectId, valueToSet) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    if (selectId === 'analyticsCompanyFilter') {
        select.innerHTML = '<option value="">Wszystkie firmy</option>';
    } else {
        select.innerHTML = '<option value="">Wolna (nieprzypisana)</option>';
    }
    
    companies.forEach(company => {
        if (company.name !== 'Wolne') {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            select.appendChild(option);
        }
    });
    
    // Устанавливаем нужное значение
    if (valueToSet && select.querySelector(`option[value="${valueToSet}"]`)) {
        select.value = valueToSet;
    } else if (valueToSet === '' || !valueToSet) {
        select.value = '';
    }
}

// Aktualizacja opcji do podziału podsieci
function updateDivideSubnetOptions() {
    const select = document.getElementById('divideSubnetSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Wybierz podsieć</option>';
    
    subnets.forEach(subnet => {
        const option = document.createElement('option');
        option.value = subnet.id;
        option.textContent = `${subnet.network}/${subnet.mask}`;
        if (subnet.company_name) {
            option.textContent += ` (${subnet.company_name})`;
        }
        select.appendChild(option);
    });
}

// Aktualizacja listy wybranych podsieci do łączenia
function updateSelectedSubnetsForMerge() {
    const container = document.getElementById('selectedSubnetsForMerge');
    if (!container) return;
    
    const checkedBoxes = document.querySelectorAll('#subnetTable input[type="checkbox"]:checked:not(#selectAllSubnets)');
    
    if (checkedBoxes.length === 0) {
        container.innerHTML = '<p>Nie wybrano żadnych podsieci</p>';
        return;
    }
    
    container.innerHTML = '';
    checkedBoxes.forEach(checkbox => {
        const subnetId = parseInt(checkbox.dataset.subnetId);
        const subnet = subnets.find(s => s.id === subnetId);
        if (subnet) {
            const div = document.createElement('div');
            div.textContent = `${subnet.network}/${subnet.mask}`;
            if (subnet.company_name) {
                div.textContent += ` (${subnet.company_name})`;
            }
            container.appendChild(div);
        }
    });
}

// Aktualizacja opcji firm dla masowego przypisania
function updateAssignCompanyOptions() {
    const select = document.getElementById('assignToCompany');
    if (!select) return;
    
    select.innerHTML = '<option value="">Wybierz firmę</option>';
    
    companies.forEach(company => {
        if (company.name !== 'Wolne' && company.name !== 'System') {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            select.appendChild(option);
        }
    });
}

// Zarządzanie zakładkami
function showTab(tabName) {
    // Скрыть все табы
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Убрать активный класс с кнопок
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать выбранный таб
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Загружаем данные при переключении на соответствующий таб
    if (tabName === 'audit-logs') {
        loadAuditLogs();
    } else if (tabName === 'analytics') {
        loadAnalytics();
    } else if (tabName === 'subnet-history') {
        loadSubnetHistory(1, {});
    }
    
    currentTab = tabName;
}

// Obsługa formularza podsieci
function setupSubnetFormHandler() {
    const subnetForm = document.getElementById('subnetForm');
    if (subnetForm) {
        // Удаляем старые обработчики
        const newForm = subnetForm.cloneNode(true);
        subnetForm.parentNode.replaceChild(newForm, subnetForm);
        
        // Добавляем новый обработчик
        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const networkInput = document.getElementById('subnetNetwork').value.trim();
            const mask = parseInt(document.getElementById('subnetMask').value);
            
            // Validate IP format first
            if (!isValidIP(networkInput)) {
                showMessage('Nieprawidłowy format adresu IP', 'error');
                return;
            }
            
            // Normalize IP to network address
            const normalizedNetwork = normalizeToNetworkAddress(networkInput, mask);
            if (!normalizedNetwork) {
                showMessage('Błąd podczas normalizacji adresu sieciowego', 'error');
                return;
            }
            
            // Show user notification if IP was normalized
            if (networkInput !== normalizedNetwork) {
                showMessage(`Adres IP został znormalizowany z ${networkInput} na ${normalizedNetwork}/${mask}`, 'success');
                // Update the input field to show the normalized address
                document.getElementById('subnetNetwork').value = normalizedNetwork;
            }
            
            const subnetData = {
                network: normalizedNetwork,
                mask: mask,
                company_id: document.getElementById('subnetCompany').value || null,
                vlan: document.getElementById('subnetVlan').value ? parseInt(document.getElementById('subnetVlan').value) : null,
                description: document.getElementById('subnetDescription').value
            };
            
            try {
                const subnetId = document.getElementById('subnetId').value;
                if (subnetId) {
                    await API.updateSubnet(subnetId, subnetData);
                    showMessage('Podsieć została pomyślnie zaktualizowana', 'success');
                } else {
                    await API.createSubnet(subnetData);
                    showMessage('Podsieć została pomyślnie utworzona', 'success');
                }
                
                closeModal('subnetModal');
                loadSubnets();
                loadStats();
            } catch (error) {
                showMessage('Błąd podczas zapisywania podsieci', 'error');
            }
        });
    }
}

// Обработчик формы компании
function setupCompanyFormHandler() {
    const companyForm = document.getElementById('companyForm');
    if (companyForm) {
        // Удаляем старые обработчики
        const newForm = companyForm.cloneNode(true);
        companyForm.parentNode.replaceChild(newForm, companyForm);
        
        // Добавляем новый обработчик
        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const companyData = {
                name: document.getElementById('companyName').value,
                description: document.getElementById('companyDescription').value
            };
            
            try {
                const companyId = document.getElementById('companyId').value;
                if (companyId) {
                    await API.updateCompany(companyId, companyData);
                    showMessage('Firma została pomyślnie zaktualizowana', 'success');
                } else {
                    await API.createCompany(companyData);
                    showMessage('Firma została pomyślnie utworzona', 'success');
                }
                
                closeModal('companyModal');
                loadCompanies();
                updateCompanyOptions();
                loadStats();
            } catch (error) {
                console.error('Błąd podczas zapisywania firmy:', error);
                showMessage(error.message || 'Błąd podczas zapisywania firmy', 'error');
            }
        });
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    setupSubnetFormHandler();
    setupCompanyFormHandler();
    
    // Formularz podziału podsieci
    const divideForm = document.getElementById('divideSubnetForm');
    if (divideForm) {
        divideForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const subnetId = document.getElementById('divideSubnetSelect').value;
            const newMask = parseInt(document.getElementById('newMask').value);
            
            if (!subnetId || !newMask) {
                showMessage('Należy wybrać podsieć и maskę', 'error');
                return;
            }
            
            try {
                const result = await API.divideSubnet(subnetId, newMask);
                if (result.error) {
                    showMessage(result.error, 'error');
                } else {
                    showMessage(`Pomyślnie podzielono podsieć na ${result.created_count} мniejszych`, 'success');
                    closeModal('divideSubnetModal');
                    loadSubnets();
                    loadStats();
                }
            } catch (error) {
                showMessage('Błąd podczas podziału podsieci', 'error');
            }
        });
    }
    
    // Форма объединения подсетей
    const mergeForm = document.getElementById('mergeSubnetsForm');
    if (mergeForm) {
        mergeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const checkedBoxes = document.querySelectorAll('#subnetTable input[type="checkbox"]:checked:not(#selectAllSubnets)');
            const subnetIds = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.subnetId));
            
            if (subnetIds.length < 2) {
                showMessage('Należy wybrać co najmniej 2 podsieci do połączenia', 'error');
                return;
            }
            
            try {
                const result = await API.mergeSubnets(subnetIds);
                if (result.error) {
                    showMessage(result.error, 'error');
                } else {
                    showMessage('Podsieci zostały pomyślnie połączone', 'success');
                    closeModal('mergeSubnetsModal');
                    loadSubnets();
                    loadStats();
                }
            } catch (error) {
                showMessage('Błąd podczas łącения подсетей', 'error');
            }
        });
    }
    
    // Форма массового присвоения
    const assignForm = document.getElementById('assignFreeSubnetsForm');
    if (assignForm) {
        assignForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const companyId = document.getElementById('assignToCompany').value;
            
            if (!companyId) {
                showMessage('Należy wybrać firmę', 'error');
                return;
            }
            
            try {
                const result = await API.assignFreeSubnets(companyId);
                if (result.error) {
                    showMessage(result.error, 'error');
                } else {
                    showMessage(`Pomyślnie przypisano ${result.assigned_count} wolnych podsieci`, 'success');
                    closeModal('assignFreeSubnetsModal');
                    loadSubnets();
                    loadStats();
                }
            } catch (error) {
                showMessage('Błąd podczas przypisywania podsieci', 'error');
            }
        });
    }
    
    // IP Calculator event listeners
    const calcIpInput = document.getElementById('calcIpAddress');
    const calcMaskSelect = document.getElementById('calcSubnetMask');
    const calcMaskCustom = document.getElementById('calcSubnetMaskCustom');
    
    if (calcIpInput) {
        calcIpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                calculateNetwork();
            }
        });
        
        // Remove error styling when user starts typing
        calcIpInput.addEventListener('input', function() {
            this.classList.remove('error');
            hideError('calculatorError');
        });
    }
    
    if (calcMaskSelect) {
        calcMaskSelect.addEventListener('change', function() {
            this.classList.remove('error');
            hideError('calculatorError');
            
            // Clear custom mask when select is used
            if (this.value && calcMaskCustom) {
                calcMaskCustom.value = '';
                calcMaskCustom.classList.remove('error');
            }
        });
        
        calcMaskSelect.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                calculateNetwork();
            }
        });
    }
    
    if (calcMaskCustom) {
        calcMaskCustom.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                calculateNetwork();
            }
        });
        
        calcMaskCustom.addEventListener('input', function() {
            this.classList.remove('error');
            hideError('calculatorError');
            
            // Clear select when custom mask is used
            if (this.value && calcMaskSelect) {
                calcMaskSelect.value = '';
                calcMaskSelect.classList.remove('error');
            }
        });
    }
    
    // Real-time network address normalization for subnet form
    const subnetNetworkInput = document.getElementById('subnetNetwork');
    const subnetMaskSelect = document.getElementById('subnetMask');
    
    if (subnetNetworkInput && subnetMaskSelect) {
        const validateAndShowNormalized = () => {
            const network = subnetNetworkInput.value.trim();
            const mask = parseInt(subnetMaskSelect.value);
            
            if (network && mask && isValidIP(network)) {
                const normalized = normalizeToNetworkAddress(network, mask);
                if (normalized && normalized !== network) {
                    // Show helper text with normalized address
                    let helperText = subnetNetworkInput.nextElementSibling;
                    if (!helperText || !helperText.classList.contains('normalization-hint')) {
                        helperText = document.createElement('small');
                        helperText.className = 'normalization-hint help-text';
                        subnetNetworkInput.parentNode.insertBefore(helperText, subnetNetworkInput.nextSibling);
                    }
                    helperText.textContent = `Adres sieciowy: ${normalized}/${mask}`;
                    helperText.style.color = '#3498db';
                } else {
                    // Remove hint if addresses match
                    const helperText = subnetNetworkInput.nextElementSibling;
                    if (helperText && helperText.classList.contains('normalization-hint')) {
                        helperText.remove();
                    }
                }
            } else {
                // Remove hint on invalid input
                const helperText = subnetNetworkInput.nextElementSibling;
                if (helperText && helperText.classList.contains('normalization-hint')) {
                    helperText.remove();
                }
            }
        };
        
        subnetNetworkInput.addEventListener('input', validateAndShowNormalized);
        subnetMaskSelect.addEventListener('change', validateAndShowNormalized);
    }
    
    // Закрытие модальных окон по клику вне их
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// Импорт Excel
function handleFileSelect() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (file && !file.name.match(/\.(xlsx|xls)$/)) {
        showMessage('Proszę wybrać plik Excel (.xlsx lub .xls)', 'error');
        fileInput.value = '';
    }
}

async function importExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Proszę wybrać plik do importu', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('excelFile', file);
    
    try {
        const result = await API.importExcel(formData);
        
        let message = result.message;
        if (result.stats && result.stats.created_companies > 0) {
            message += ` (utworzono ${result.stats.created_companies} nowych firm)`;
        }
        
        showMessage(message, 'success');
        
        if (result.errors && result.errors.length > 0) {
            console.warn('Błędy importu:', result.errors);
            showMessage(`Import zakończony z ${result.errors.length} błędami. Sprawdź консоль.`, 'warning');
        }
        
        // Odświeżamy dane po импорте подсетей и фирм
        loadSubnets();
        loadCompanies(); // Dodano dla aktualizacji listy firm
        fileInput.value = '';
    } catch (error) {
        showMessage('Błąd podczas importu pliku', 'error');
    }
}

// Import firm z Excel
async function importCompaniesExcel() {
    const fileInput = document.getElementById('companiesExcelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Proszę wybrać plik do importu firm', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('excelFile', file);
    
    try {
        const result = await API.importCompaniesExcel(formData);
        showMessage(result.message, 'success');
        
        if (result.errors && result.errors.length > 0) {
            console.warn('Błędy importu фирм:', result.errors);
            showMessage(`Import zakończony z ${result.errors.length} błędami. Sprawdź консоль.`, 'warning');
        }
        
        // Odświeżamy listę firm
        loadCompanies();
        fileInput.value = '';
    } catch (error) {
        console.error('Błąd importu фирм:', error);
        showMessage('Błąd podczas importu фирм', 'error');
    }
}

// Экспорт фирм в Excel
// Показ сообщений
function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    
    document.body.insertBefore(messageDiv, document.body.firstChild);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Утилитарные функции
function calculateSubnetInfo(network, mask) {
    const hostBits = 32 - mask;
    const totalHosts = Math.pow(2, hostBits);
    const usableHosts = totalHosts - 2; // Wyłączamy adresy sieciowy i broadcast
    
    return {
        totalHosts,
        usableHosts,
        networkAddress: network,
        broadcastAddress: calculateBroadcast(network, mask)
    };
}

function calculateBroadcast(network, mask) {
    // Uproszczona wersja - dla dokładniejszego obliczenia potrzebna jest bardziej złożona logika
    const parts = network.split('.').map(Number);
    const hostBits = 32 - mask;
    const lastOctetBits = hostBits % 8;
    
    if (lastOctetBits > 0) {
        parts[3] = parts[3] | (Math.pow(2, lastOctetBits) - 1);
    }
    
    return parts.join('.');
}

// Funkcje narzędziowe dla IP
function isValidIP(ip) {
    const regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip);
}

function normalizeToNetworkAddress(ip, mask) {
    if (!isValidIP(ip) || !mask || mask < 0 || mask > 32) {
        return null;
    }
    
    const parts = ip.split('.').map(Number);
    const maskBits = 0xFFFFFFFF << (32 - mask);
    
    const ipInt = (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    const networkInt = ipInt & maskBits;
    
    const networkParts = [
        (networkInt >>> 24) & 0xFF,
        (networkInt >>> 16) & 0xFF,
        (networkInt >>> 8) & 0xFF,
        networkInt & 0xFF
    ];
    
    return networkParts.join('.');
}

// Wyświetlanie tabeli podsieci
function renderSubnetsTable() {
    const tbody = document.querySelector('#subnetTable tbody');
    tbody.innerHTML = '';

    subnets.forEach(subnet => {
        const availableIps = Math.pow(2, 32 - subnet.mask) - 2;
        const companyName = subnet.company_name || 'Wolna';
        const vlan = subnet.vlan || '-';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" data-subnet-id="${subnet.id}"></td>
            <td>${subnet.network}</td>
            <td>/${subnet.mask}</td>
            <td>${availableIps}</td>
            <td>${companyName}</td>
            <td>${vlan}</td>
            <td>${subnet.description || '-'}</td>
            <td>${new Date(subnet.created_date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="editSubnet(${subnet.id})">Edytuj</button>
                <button class="btn btn-small btn-success" onclick="showDivideSubnetModalForId(${subnet.id})">Podziel</button>
                <button class="btn btn-small btn-danger" onclick="deleteSubnet(${subnet.id})">Usuń</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Wyświetlanie tabeli firm
function renderCompaniesTable() {
    const tbody = document.querySelector('#companyTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    companies.forEach(company => {
        // Liczymy ilość podsieci dla każdej firmy
        let subnetCount;
        if (company.name === 'Wolne') {
            // Dla firmy "Wolne" liczymy podsieci z company_id = NULL lub company_id = 1
            subnetCount = subnets.filter(subnet => 
                subnet.company_id === null || subnet.company_id === 1
            ).length;
        } else {
            subnetCount = subnets.filter(subnet => {
                return parseInt(subnet.company_id) === parseInt(company.id);
            }).length;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${company.name}</td>
            <td>${company.description || '-'}</td>
            <td>${subnetCount}</td>
            <td>${new Date(company.created_date).toLocaleDateString()}</td>
            <td>
                ${company.name !== 'Wolne' ? 
                    `<button class="btn btn-small btn-primary" onclick="editCompany(${company.id})">Edytuj</button>
                     <button class="btn btn-small btn-danger" onclick="deleteCompany(${company.id})">Usuń</button>` : 
                    '-'
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Wyświetlanie tabeli logów
function renderLogsTable(logs) {
    const tbody = document.querySelector('#logsTable tbody');
    tbody.innerHTML = '';

    logs.forEach(log => {
        const row = document.createElement('tr');
        // Używamy nowej funkcji do formatowania daty
        const date = formatDateForPoland(log.created_date);
        
        // Formatujemy akcję do wyświetlenia
        const actionMap = {
            'LOGIN_SUCCESS': 'Logowanie do systemu',
            'LOGIN_FAILED': 'Nieudane logowanie',
            'LOGOUT': 'Wylogowanie z systemu',
            'CREATE_SUBNET': 'Tworzenie podsieci',
            'CREATE_SUBNET_FAILED': 'Błąd tworzenia podsieci',
            'UPDATE_SUBNET': 'Modyfikacja podsieci',
            'UPDATE_SUBNET_FAILED': 'Błąd modyfikacji podsieci',
            'DELETE_SUBNET': 'Usuwanie podsieci',
            'DELETE_SUBNET_FAILED': 'Błąd usuwania podsieci',
            'DIVIDE_SUBNET': 'Podział podsieci',
            'MERGE_SUBNETS': 'Łączenie podsieci',
            'ASSIGN_SUBNETS': 'Przypisanie podsieci',
            'ASSIGN_FREE_SUBNETS': 'Przypisanie wolnych podsieci',
            'ASSIGN_FREE_SUBNETS_FAILED': 'Błąd przypisania wolnych podsieci',
            'CREATE_COMPANY': 'Tworzenie firmy',
            'CREATE_COMPANY_FAILED': 'Błąd tworzenia firmy',
            'UPDATE_COMPANY': 'Modyfikacja firmy',
            'UPDATE_COMPANY_FAILED': 'Błąd modyfikacji firmy',
            'DELETE_COMPANY': 'Usuwanie firmy',
            'DELETE_COMPANY_FAILED': 'Błąd usuwania firmy',
            'IMPORT_EXCEL': 'Import z Excel',
            'IMPORT_EXCEL_FAILED': 'Błąd importu z Excel',
            'EXPORT_EXCEL': 'Eksport do Excel',
            'EXPORT_EXCEL_FAILED': 'Błąd eksportu do Excel'
        };
        
        const entityMap = {
            'user': 'Użytkownik',
            'subnet': 'Podsieć',
            'company': 'Firma'
        };
        
        const actionText = actionMap[log.action] || log.action;
        const entityText = entityMap[log.entity_type] || log.entity_type;
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${log.username}</td>
            <td><span class="action-badge action-${log.action.toLowerCase()}">${actionText}</span></td>
            <td>${entityText}</td>
            <td>${log.entity_id || '-'}</td>
            <td><button class="btn btn-small btn-secondary" onclick="showLogDetails(${log.id})">Szczegóły</button></td>
            <td>${log.ip_address || '-'}</td>
        `;
        tbody.appendChild(row);
    });

    if (logs.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 40px;">
                Brak logów do wyświetlenia
            </td>
        `;
        tbody.appendChild(row);
    }
}

// Funkcja do formatowania daty według czasu polskiego
function formatDateForPoland(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Wyświetlanie paginacji dla logów
function renderLogsPagination(data) {
    const pagination = document.getElementById('logsPagination');
    pagination.innerHTML = '';
    
    if (data.totalPages <= 1) return;
    
    // Кнопка "Предыдущая"
    if (data.page > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-secondary btn-small';
        prevBtn.textContent = 'Poprzednia';
        prevBtn.onclick = () => loadAuditLogs(data.page - 1, logsFilters);
        pagination.appendChild(prevBtn);
    }
    
    // Номера страниц
    const startPage = Math.max(1, data.page - 2);
    const endPage = Math.min(data.totalPages, data.page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn btn-small ${i === data.page ? 'btn-primary' : 'btn-secondary'}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => loadAuditLogs(i, logsFilters);
        pagination.appendChild(pageBtn);
    }
    
    // Кнопка "Следующая"
    if (data.page < data.totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-secondary btn-small';
        nextBtn.textContent = 'Następna';
        nextBtn.onclick = () => loadAuditLogs(data.page + 1, logsFilters);
        pagination.appendChild(nextBtn);
    }
    
    // Информация о страницах
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `Strona ${data.page} z ${data.totalPages} (łącznie rekordów: ${data.total})`;
    pagination.appendChild(info);
}

// Pokaż szczegóły loga
async function showLogDetails(logId) {
    try {
        const log = await API.fetchLogDetails(logId);
        
        if (log.error) {
            showMessage(log.error, 'error');
            return;
        }
        
        // Заполняем основную информацию
        document.getElementById('logDetailDate').textContent = formatDateForPoland(log.created_date);
        document.getElementById('logDetailUser').textContent = log.username;
        
        // Formatujemy akcję
        const actionMap = {
            'LOGIN_SUCCESS': 'Logowanie do systemu',
            'LOGIN_FAILED': 'Nieudane logowanie',
            'LOGOUT': 'Wylogowanie z systemu',
            'CREATE_SUBNET': 'Tworzenie podsieci',
            'CREATE_SUBNET_FAILED': 'Błąd tworzenia podsieci',
            'UPDATE_SUBNET': 'Modyfikacja podsieci',
            'UPDATE_SUBNET_FAILED': 'Błąd мodyfikacji подсети',
            'DELETE_SUBNET': 'Usuwanie podsieci',
            'DELETE_SUBNET_FAILED': 'Błąd usuwania podsieci',
            'DIVIDE_SUBNET': 'Podział podsieci',
            'MERGE_SUBNETS': 'Łączenie podsieci',
            'ASSIGN_SUBNETS': 'Przypisanie podsieci',
            'ASSIGN_FREE_SUBNETS': 'Przypisanie wolnych podsieci',
            'ASSIGN_FREE_SUBNETS_FAILED': 'Błąd przypisania wolnych podsieci',
            'CREATE_COMPANY': 'Tworzenie firmy',
            'CREATE_COMPANY_FAILED': 'Błąd tworzenia firmy',
            'UPDATE_COMPANY': 'Modyfikacja firmy',
            'UPDATE_COMPANY_FAILED': 'Błąd modyfikacji firmy',
            'DELETE_COMPANY': 'Usuwanie firmy',
            'DELETE_COMPANY_FAILED': 'Błąd usuwania firmy',
            'IMPORT_EXCEL': 'Import z Excel',
            'IMPORT_EXCEL_FAILED': 'Błąd importu z Excel',
            'EXPORT_EXCEL': 'Eksport do Excel',
            'EXPORT_EXCEL_FAILED': 'Błąd eksportu do Excel'
        };
        
        const entityMap = {
            'user': 'Użytkownik',
            'subnet': 'Podsieć',
            'company': 'Firma'
        };
        
        document.getElementById('logDetailAction').textContent = actionMap[log.action] || log.action;
        document.getElementById('logDetailEntity').textContent = entityMap[log.entity_type] || log.entity_type;
        document.getElementById('logDetailEntityId').textContent = log.entity_id || '-';
        document.getElementById('logDetailIp').textContent = log.ip_address || '-';
        document.getElementById('logDetailUserAgent').textContent = log.user_agent || '-';
        
        // Обрабатываем старые значения
        const oldValuesSection = document.getElementById('oldValuesSection');
        const oldValuesElement = document.getElementById('logDetailOldValues');
        if (log.old_values) {
            try {
                const oldData = JSON.parse(log.old_values);
                oldValuesElement.textContent = JSON.stringify(oldData, null, 2);
                oldValuesSection.style.display = 'block';
            } catch (e) {
                oldValuesElement.textContent = log.old_values;
                oldValuesSection.style.display = 'block';
            }
        } else {
            oldValuesSection.style.display = 'none';
        }
        
        // Обрабатываем новые значения
        const newValuesSection = document.getElementById('newValuesSection');
        const newValuesElement = document.getElementById('logDetailNewValues');
        if (log.new_values) {
            try {
                const newData = JSON.parse(log.new_values);
                newValuesElement.textContent = JSON.stringify(newData, null, 2);
                newValuesSection.style.display = 'block';
            } catch (e) {
                newValuesElement.textContent = log.new_values;
                newValuesSection.style.display = 'block';
            }
        } else {
            newValuesSection.style.display = 'none';
        }
        
        // Показываем модальное окно
        document.getElementById('logDetailsModal').style.display = 'block';
        
    } catch (error) {
        console.error('Błąd ładowania szczegółów loga:', error);
        showMessage('Błąd ładowania szczegółów loga', 'error');
    }
}

// Обновление фильтров подсетей
function updateSubnetFilters() {
    const subnetFilter = document.getElementById('subnetFilter');
    const analyticsSubnetFilter = document.getElementById('analyticsSubnetFilter');
    
    // Очистка существующих опций
    if (subnetFilter) subnetFilter.innerHTML = '<option value="">Wszystkie podsieci</option>';
    if (analyticsSubnetFilter) analyticsSubnetFilter.innerHTML = '<option value="">Wszystkie podsieci</option>';
    
    subnets.forEach(subnet => {
        const option = document.createElement('option');
        option.value = subnet.id;
        option.textContent = `${subnet.network}/${subnet.mask}`;
        
        if (subnetFilter) subnetFilter.appendChild(option.cloneNode(true));
        if (analyticsSubnetFilter) analyticsSubnetFilter.appendChild(option.cloneNode(true));
    });
}

// Clear subnet filters
function clearSubnetFilters() {
    // Clear all filter inputs
    const filterElements = [
        'searchInput',
        'vlanFilter',
        'companyTextFilter'
    ];
    
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Re-run filter to show all subnets
    filterSubnets();
}

// Usuwanie podsieci
async function deleteSubnet(id) {
    if (!confirm('Czy na pewno chcesz usunąć tę podsieć?')) {
        return;
    }
    
    try {
        await API.deleteSubnet(id);
        showMessage('Podsieć została pomyślnie usunięta', 'success');
        loadSubnets();
        loadStats();
    } catch (error) {
        showMessage('Błąd podczas usuwania podsieci', 'error');
    }
}

// Funkcje do otwierania modalnych okien nowych operacji
function showAddCompanyModal() {
    document.getElementById('companyModalTitle').textContent = 'Dodaj firmę';
    document.getElementById('companyForm').reset();
    document.getElementById('companyId').value = '';
    document.getElementById('companyModal').style.display = 'block';
}

function showDivideSubnetModal() {
    const select = document.getElementById('divideSubnetSelect');
    const newMaskField = document.getElementById('newMask');
    
    // Восстанавливаем возможность выбора
    select.disabled = false;
    newMaskField.min = 1;
    newMaskField.max = 30;
    
    // Удаляем подсказку о текущей маске
    const hintElement = document.querySelector('.current-mask-hint');
    if (hintElement) {
        hintElement.remove();
    }
    
    updateDivideSubnetOptions();
    document.getElementById('divideSubnetModal').style.display = 'block';
}

function showMergeSubnetsModal() {
    updateSelectedSubnetsForMerge();
    document.getElementById('mergeSubnetsModal').style.display = 'block';
}

function showAssignFreeSubnetsModal() {
    updateAssignCompanyOptions();
    document.getElementById('assignFreeSubnetsModal').style.display = 'block';
}

// Funkcja do otwierania modalnego okna podziału dla konkretnej podsieci
function showDivideSubnetModalForId(subnetId) {
    // Znajdujemy podsieć po ID
    const subnet = subnets.find(s => s.id === subnetId);
    if (!subnet) {
        showMessage('Nie znaleziono podsieci do podziału', 'error');
        return;
    }

    // Wypełniamy modalne okno danymi o wybranej podsieci
    const modal = document.getElementById('divideSubnetModal');
    const form = document.getElementById('divideSubnetForm');
    const select = document.getElementById('divideSubnetSelect');
    const newMaskField = document.getElementById('newMask');
    
    // Czyścimy select i dodajemy tylko wybraną podsieć
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = subnet.id;
    option.textContent = `${subnet.network}/${subnet.mask}`;
    if (subnet.company_name) {
        option.textContent += ` (${subnet.company_name})`;
    }
    option.selected = true;
    select.appendChild(option);
    
    // Czynimy select niedostępnym do zmiany, ponieważ podsieć już wybrana
    select.disabled = true;
    
    // Устанавливаем минимальное значение маски (больше текущей)
    newMaskField.min = subnet.mask + 1;
    newMaskField.max = 30;
    newMaskField.value = '';
    
    // Добавляем подсказку о текущей маске
    let hintElement = document.querySelector('.current-mask-hint');
    if (!hintElement) {
        hintElement = document.createElement('small');
        hintElement.className = 'current-mask-hint';
        hintElement.style.display = 'block';
        hintElement.style.color = '#666';
        hintElement.style.marginTop = '5px';
        newMaskField.parentNode.appendChild(hintElement);
    }
    hintElement.textContent = `Текущая маска: /${subnet.mask}. Новая маска должна быть больше.`;
    
    // Показываем модальное окно
    modal.style.display = 'block';
}

// Modyfikujemy istniejącą funkcję dla przywrócenia oryginalnego zachowania
function showDivideSubnetModal() {
    const select = document.getElementById('divideSubnetSelect');
    const newMaskField = document.getElementById('newMask');
    
    // Восстанавливаем возможность выбора
    select.disabled = false;
    newMaskField.min = 1;
    newMaskField.max = 30;
    
    // Удаляем подсказку о текущей маске
    const hintElement = document.querySelector('.current-mask-hint');
    if (hintElement) {
        hintElement.remove();
    }
    
    updateDivideSubnetOptions();
    document.getElementById('divideSubnetModal').style.display = 'block';
}

// ==========================================
// SUBNET HISTORY FUNCTIONS
// ==========================================

// Ładowanie historii podsieci
async function loadSubnetHistory(page = 1, filters = {}) {
    try {
        currentHistoryPage = page;
        historyFilters = filters;
        
        const result = await API.fetchSubnetHistory(page, filters);
        subnetHistory = result.subnets || [];
        
        renderSubnetHistoryTable();
        renderHistoryPagination(result);
        
        // Aktualizujemy filtr firm po załadowaniu danych
        await loadCompanies(); // Убеждаемся что компании загружены
        updateHistoryCompanyFilter();
        
    } catch (error) {
        console.error('Błąd во время ładowania historii podsieci:', error);
        showMessage('Błąd во время ładowania historii podsieci', 'error');
    }
}

// Renderowanie таблицы истории подсетей
function renderSubnetHistoryTable() {
    const tbody = document.querySelector('#subnetHistoryTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!subnetHistory || subnetHistory.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="9" style="text-align: center; color: #666; padding: 20px;">Brak wyników do wyświetlenia</td>';
        tbody.appendChild(row);
        return;
    }

    subnetHistory.forEach(subnet => {
        const row = document.createElement('tr');
        const statusClass = subnet.status === 'active' ? 'active' : 'deleted';
        const companyName = subnet.company_name || 'Wolna';
        const vlan = subnet.vlan || '-';
        
        // Formatowanie дат
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString('pl-PL', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            });
        };
        
        const formatDateTime = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString('pl-PL', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        };
        
        const createdDate = formatDate(subnet.created_date);
        const deletedDate = formatDate(subnet.deleted_date);
        const lastActivity = formatDateTime(subnet.last_activity);
        
        row.innerHTML = `
            <td>${subnet.network}</td>
            <td>/${subnet.mask}</td>
            <td>${companyName}</td>
            <td>${vlan}</td>
            <td><span class="status-badge ${statusClass}">${subnet.status === 'active' ? 'Aktywna' : 'Usunięta'}</span></td>
            <td><span class="compact-date">${createdDate}</span></td>
            <td><span class="compact-date">${deletedDate}</span></td>
            <td><span class="compact-date">${lastActivity}</span></td>
            <td>
                <button class="btn btn-small btn-primary" onclick="showSubnetDetailedHistory(${subnet.id})">Historia</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Renderowanie paginacji dla historii
function renderHistoryPagination(result) {
    const pagination = document.getElementById('historyPagination');
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    // Если нет результатов, показываем информацию
    if (!result || !result.subnets || result.subnets.length === 0) {
        const noResults = document.createElement('span');
        noResults.textContent = 'Brak wyników do wyświetlenia';
        noResults.style.margin = '0 15px';
        noResults.style.color = '#666';
        pagination.appendChild(noResults);
        return;
    }
    
    // Если всего одна страница, не показываем навигацию
    if (!result.totalPages || result.totalPages <= 1) {
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Znaleziono ${result.total || result.subnets.length} wyników`;
        pageInfo.style.margin = '0 15px';
        pageInfo.style.color = '#666';
        pagination.appendChild(pageInfo);
        return;
    }
    
    // Previous button
    if (result.page > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Poprzednia';
        prevBtn.className = 'btn btn-secondary';
        prevBtn.onclick = () => loadSubnetHistory(result.page - 1, historyFilters);
        pagination.appendChild(prevBtn);
    }
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Strona ${result.page || 1} z ${result.totalPages || 1} (${result.total || 0} wyników)`;
    pageInfo.style.margin = '0 15px';
    pagination.appendChild(pageInfo);
    
    // Next button
    if (result.page < result.totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Następna';
        nextBtn.className = 'btn btn-secondary';
        nextBtn.onclick = () => loadSubnetHistory(result.page + 1, historyFilters);
        pagination.appendChild(nextBtn);
    }
}

// Обновление фильтра компаний в истории
function updateHistoryCompanyFilter() {
    const select = document.getElementById('historyCompanyFilter');
    if (!select) return;
    
    const currentValue = select.value; // Сохраняем текущее значение
    
    // Clear existing options except first
    select.innerHTML = '<option value="">Wszystkie firmy</option>';
    
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.name;
        select.appendChild(option);
    });
    
    // Восстанавливаем выбранное значение
    if (currentValue) {
        select.value = currentValue;
    }
}

// Filtrowanie historii podsieci
function filterSubnetHistory() {
    const subnetFilter = document.getElementById('historySubnetFilter')?.value || '';
    const statusFilter = document.getElementById('historyStatusFilter')?.value || '';
    const companyFilter = document.getElementById('historyCompanyFilter')?.value || '';
    
    const filters = {};
    
    // Добавляем фильтры только если они не пустые
    if (subnetFilter.trim()) {
        filters.subnet_filter = subnetFilter;
    }
    if (statusFilter) {
        filters.status_filter = statusFilter;
    }
    if (companyFilter) {
        filters.company_filter = companyFilter;
    }
    
    loadSubnetHistory(1, filters);
}

// Reset фильтров истории
function resetSubnetHistoryFilters() {
    document.getElementById('historySubnetFilter').value = '';
    document.getElementById('historyStatusFilter').value = '';
    document.getElementById('historyCompanyFilter').value = '';
    
    loadSubnetHistory(1, {});
}

// Pokazanie szczegółowej historii podsieci
async function showSubnetDetailedHistory(subnetId) {
    try {
        const result = await API.fetchSubnetDetailedHistory(subnetId);
        currentDetailedHistory = result;
        
        // Aktualizacja informacji o podsieci
        updateSubnetHistoryInfo(result.subnet);
        
        // Рендеринг истории
        renderDetailedHistoryTable(result.history);
        
        // Сброс фильтров
        resetDetailedHistoryFilters();
        
        // Показ модального окна
        document.getElementById('subnetDetailedHistoryModal').style.display = 'block';
        
    } catch (error) {
        console.error('Błąд во время ładowania szczegółовой истории:', error);
        showMessage('Błąd podczas ładowania szczegółowej historii podsieci', 'error');
    }
}

// Актуализация информации о подсети в модальном окне
function updateSubnetHistoryInfo(subnet) {
    const infoContainer = document.getElementById('subnetHistoryInfo');
    const titleElement = document.getElementById('subnetHistoryModalTitle');
    
    if (!subnet) {
        infoContainer.innerHTML = '<p>Nie znaleziono информации о подсети</p>';
        titleElement.textContent = 'Historia подсети';
        return;
    }
    
    titleElement.textContent = `Historia подсети ${subnet.network}/${subnet.mask}`;
    
    const statusClass = subnet.status === 'active' ? 'active' : 'deleted';
    const statusText = subnet.status === 'active' ? 'Aktywna' : 'Usunięta';
    
    infoContainer.innerHTML = `
        <div class="subnet-info-grid">
            <div class="subnet-info-item">
                <div class="subnet-info-label">Adres sieci</div>
                <div class="subnet-info-value">${subnet.network}/${subnet.mask}</div>
            </div>
            <div class="subnet-info-item">
                <div class="subnet-info-label">Status</div>
                <div class="subnet-info-value"><span class="status-badge ${statusClass}">${statusText}</span></div>
            </div>
            <div class="subnet-info-item">
                <div class="subnet-info-label">Firma</div>
                <div class="subnet-info-value">${subnet.company_name || 'Wolna'}</div>
            </div>
            <div class="subnet-info-item">
                <div class="subnet-info-label">VLAN</div>
                <div class="subnet-info-value">${subnet.vlan || '-'}</div>
            </div>
            <div class="subnet-info-item">
                <div class="subnet-info-label">Data utworzenia</div>
                <div class="subnet-info-value">${new Date(subnet.created_date).toLocaleString()}</div>
            </div>
            <div class="subnet-info-item">
                <div class="subnet-info-label">Opis</div>
                <div class="subnet-info-value">${subnet.description || '-'}</div>
            </div>
        </div>
    `;
}

// Renderowanie таблицы szczegółовой истории
function renderDetailedHistoryTable(history) {
    const tbody = document.querySelector('#detailedHistoryTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    history.forEach(log => {
        const row = document.createElement('tr');
        
        // Parse old and new values
        let oldValues = '';
        let newValues = '';
        let details = '';
        
        try {
            if (log.old_values) {
                const old = JSON.parse(log.old_values);
                oldValues = Object.entries(old).map(([k,v]) => `${translateFieldName(k)}: ${v}`).join('; ');
            }
            if (log.new_values) {
                const new_val = JSON.parse(log.new_values);
                newValues = Object.entries(new_val).map(([k,v]) => `${translateFieldName(k)}: ${v}`).join('; ');
            }
            details = formatActionDetails(log.action, log.old_values, log.new_values);
        } catch (e) {
            oldValues = log.old_values || '-';
            newValues = log.new_values || '-';
            details = translateAction(log.action);
        }
        
        row.innerHTML = `
            <td>${new Date(log.created_date).toLocaleString()}</td>
            <td>${log.username || 'System'}</td>
            <td><span class="action-badge action-${log.action.toLowerCase()}">${translateAction(log.action)}</span></td>
            <td class="history-details">${details}</td>
            <td class="history-changes">${oldValues}</td>
            <td class="history-changes">${newValues}</td>
        `;
        tbody.appendChild(row);
    });
}

// Formatowanie wartości dla historii
function formatHistoryValues(values) {
    if (!values) return '-';
    
    // Если это массив объектов (например, массив подсетей)
    if (Array.isArray(values)) {
        const formatted = values.map((item, index) => {
            if (typeof item === 'object' && item !== null) {
                // Specjalna obsługa dla obiektów podsieci
                if (item.network && item.mask) {
                    return `${index + 1}. ${item.network}/${item.mask}${item.company_name ? ` (${item.company_name})` : ''}`;
                }
                // Общая обработка объектов
                const objFormatted = [];
                for (const [key, value] of Object.entries(item)) {
                    if (value !== null && value !== undefined && value !== '') {
                        const translatedKey = translateFieldName(key);
                        objFormatted.push(`${translatedKey}: ${value}`);
                    }
                }
                return `${index + 1}. ${objFormatted.join(', ')}`;
            }
            return `${index + 1}. ${item}`;
        });
        return formatted.join('<br>') || '-';
    }
    
    // Если это объект
    if (typeof values === 'object') {
        const formatted = [];
        for (const [key, value] of Object.entries(values)) {
            if (value !== null && value !== undefined && value !== '') {
                const translatedKey = translateFieldName(key);
                // Если значение - массив или объект, преобразуем его
                let displayValue = value;
                if (Array.isArray(value)) {
                    displayValue = value.join(', ');
                } else if (typeof value === 'object') {
                    displayValue = JSON.stringify(value);
                }
                formatted.push(`${translatedKey}: ${displayValue}`);
            }
        }
        return formatted.join('<br>') || '-';
    }
    
    return values.toString() || '-';
}

// Formatowanie szczeg detalles akcji
function formatActionDetails(action, oldValues, newValues) {
    const actionText = translateAction(action);
    
    try {
        const old = oldValues ? JSON.parse(oldValues) : {};
        const new_val = newValues ? JSON.parse(newValues) : {};
        
        switch(action) {
            case 'CREATE_SUBNET':
                return `Utworzono podsieć ${new_val.network}/${new_val.mask}`;
            case 'UPDATE_SUBNET':
                const changes = [];
                if (old.network !== new_val.network || old.mask !== new_val.mask) {
                    changes.push(`Adres: ${old.network}/${old.mask} → ${new_val.network}/${new_val.mask}`);
                }
                if (old.company_id !== new_val.company_id) {
                    changes.push(`Firma zmieniona`);
                }
                if (old.vlan !== new_val.vlan) {
                    changes.push(`VLAN: ${old.vlan || '-'} → ${new_val.vlan || '-'}`);
                }
                if (old.description !== new_val.description) {
                    changes.push(`Opis zmieniony`);
                }
                return changes.join(', ') || actionText;
            case 'DELETE_SUBNET':
                return `Usunięto podsieć ${old.network}/${old.mask}`;
            case 'DIVIDE_SUBNET':
                return `Podzielono na ${new_val.created_subnets || '?'} podsieci z маскą /${new_val.new_mask}`;
            case 'MERGE_SUBNETS':
                if (Array.isArray(old)) {
                    const subnetList = old.map(subnet => `${subnet.network}/${subnet.mask}`).join(', ');
                    return `Połączono podsieci: ${subnetList}`;
                } else {
                    return `Połączono ${Object.keys(old).length || '?'} podsieci`;
                }
            default:
                return actionText;
        }
    } catch (e) {
        return actionText;
    }
}

// Тłumaczenie названий полей
function translateFieldName(fieldName) {
    const translations = {
        'network': 'Sieć',
        'mask': 'Maska',
        'company_id': 'ID Firmy',
        'vlan': 'VLAN',
        'description': 'Opis',
        'created_subnets': 'Utworzone podsieci',
        'new_mask': 'Nowa маска'
    };
    
    return translations[fieldName] || fieldName;
}

// Тłumaczenie акций
function translateAction(action) {
    const actionMap = {
        'LOGIN_SUCCESS': 'Logowanie do systemu',
        'LOGIN_FAILED': 'Nieudane logowanie',
        'LOGOUT': 'Wylogowanie z systemu',
        'CREATE_SUBNET': 'Tworzenie podsieci',
        'CREATE_SUBNET_FAILED': 'Błąd tworzenia подсети',
        'UPDATE_SUBNET': 'Modyfikacja podsieci',            'UPDATE_SUBNET_FAILED': 'Błąd modyfikacji podsieci',
            'DELETE_SUBNET': 'Usuwanie podsieci',
            'DELETE_SUBNET_FAILED': 'Błąd usuwania podsieci',
            'DIVIDE_SUBNET': 'Podział podsieci',
        'MERGE_SUBNETS': 'Łączenie podsieci',
        'ASSIGN_SUBNETS': 'Przypisanie подсети',
        'ASSIGN_FREE_SUBNETS': 'Przypisanie wolnych подсетей',
        'ASSIGN_FREE_SUBNETS_FAILED': 'Błąd przypisania wolnych подсетей',
        'CREATE_COMPANY': 'Tworzenie firmy',
        'CREATE_COMPANY_FAILED': 'Błąd tworzenia firmy',
        'UPDATE_COMPANY': 'Modyfikacja firmy',
        'UPDATE_COMPANY_FAILED': 'Błąd modyfikacji firmy',
        'DELETE_COMPANY': 'Usuwanie firmy',
        'DELETE_COMPANY_FAILED': 'Błąd usuwania firmy',
        'IMPORT_EXCEL': 'Import z Excel',
        'IMPORT_EXCEL_FAILED': 'Błąd importu z Excel',
        'EXPORT_EXCEL': 'Eksport do Excel',
        'EXPORT_EXCEL_FAILED': 'Błąd eksportu do Excel'
    };
    
    return actionMap[action] || action;
}

// Экспорт истории подсетей
async function exportSubnetHistory() {
    try {
        // Get all subnet history data without pagination
        const filters = {
            ...historyFilters,
            limit: 10000  // Large limit to get all data
        };
        
        const result = await API.fetchSubnetHistory(1, filters);
        
        if (!result.subnets || result.subnets.length === 0) {
            showMessage('Brak danych do eksportu', 'error');
            return;
        }
        
        // Prepare data for export
        const exportData = result.subnets.map(subnet => ({
            'Adres sieci': subnet.network,
            'Maska': `/${subnet.mask}`,
            'Firma': subnet.company_name || 'Wolna',
            'VLAN': subnet.vlan || '-',
            'Status': subnet.status === 'active' ? 'Aktywna' : 'Usunięta',
            'Data utworzenia': new Date(subnet.created_date).toLocaleDateString(),
            'Data usunięcia': subnet.deleted_date ? new Date(subnet.deleted_date).toLocaleDateString() : '-',
            'Ostatnia aktywność': subnet.last_activity ? new Date(subnet.last_activity).toLocaleDateString() : '-',
            'Opis': subnet.description || '-'
        }));
        
        // Convert to CSV
        const headers = Object.keys(exportData[0]);
        const csvContent = [
            headers.join(','),
            ...exportData.map(row => 
                headers.map(header => `"${row[header]}"`).join(',')
            )
        ].join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `historia_podsieci_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage('Historia podsieci została wyeksportowana', 'success');
        
    } catch (error) {
        console.error('Błąd podczas eksportu historii:', error);
        showMessage('Błąd podczas eksportu historii podsieci', 'error');
    }
}

// Экспорт szczegółовой истории подсети
async function exportSubnetDetailedHistory() {
    if (!currentDetailedHistory || !currentDetailedHistory.history) {
        showMessage('Brak danych do eksportu', 'error');
        return;
    }
    
    try {
        const subnet = currentDetailedHistory.subnet;
        const history = currentDetailedHistory.history;
        
        // Prepare data for export
        const exportData = history.map(log => {
            let oldValues = '';
            let newValues = '';
            let details = '';
            
            try {
                if (log.old_values) {
                    const old = JSON.parse(log.old_values);
                    oldValues = Object.entries(old).map(([k,v]) => `${translateFieldName(k)}: ${v}`).join('; ');
                }
                if (log.new_values) {
                    const new_val = JSON.parse(log.new_values);
                    newValues = Object.entries(new_val).map(([k,v]) => `${translateFieldName(k)}: ${v}`).join('; ');
                }
                details = formatActionDetails(log.action, log.old_values, log.new_values);
            } catch (e) {
                oldValues = log.old_values || '-';
                newValues = log.new_values || '-';
                details = translateAction(log.action);
            }
            
            return {
                'Data i czas': new Date(log.created_date).toLocaleString(),
                'Użytkownik': log.username || 'System',
                'Akcja': translateAction(log.action),
                'Szczegóły': details,
                'Стари значения': oldValues,
                'Новые значения': newValues
            };
        });
        
        // Convert to CSV
        const headers = Object.keys(exportData[0]);
        const csvContent = [
            `# Historia podsieci: ${subnet.network}/${subnet.mask}`,
            `# Status: ${subnet.status === 'active' ? 'Aktywna' : 'Usunięta'}`,
            `# Eksport z dnia: ${new Date().toLocaleString()}`,
            '',
            headers.join(','),
            ...exportData.map(row => 
                headers.map(header => `"${row[header]}"`).join(',')
            )
        ].join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `historia_podsieci_${subnet.network.replace(/\./g, '_')}_${subnet.mask}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage('Szczegółowa historia została wyeksportowana', 'success');
        
    } catch (error) {
        console.error('Błąd podczas экспорта szczegółовой истории:', error);
        showMessage('Błąd podczas экспорта szczegółowej истории', 'error');
    }
}

// Скрытие элемента ошибки
function hideError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

// Фильтрация подробной истории
function filterDetailedHistory() {
    if (!currentDetailedHistory) return;
    
    const actionFilter = document.getElementById('detailedHistoryActionFilter')?.value || '';
    const dateFrom = document.getElementById('detailedHistoryDateFrom')?.value || '';
    const dateTo = document.getElementById('detailedHistoryDateTo')?.value || '';
    
    let filteredHistory = currentDetailedHistory.history;
    
    if (actionFilter) {
        filteredHistory = filteredHistory.filter(log => log.action === actionFilter);
    }
    
    if (dateFrom) {
        filteredHistory = filteredHistory.filter(log => 
            new Date(log.created_date) >= new Date(dateFrom)
        );
    }
    
    if (dateTo) {
        filteredHistory = filteredHistory.filter(log => 
            new Date(log.created_date) <= new Date(dateTo + 'T23:59:59')
        );
    }
    
    renderDetailedHistoryTable(filteredHistory);
}

// Reset фильтров подробной истории
function resetDetailedHistoryFilters() {
    const actionFilter = document.getElementById('detailedHistoryActionFilter');
    const dateFrom = document.getElementById('detailedHistoryDateFrom');
    const dateTo = document.getElementById('detailedHistoryDateTo');
    
    if (actionFilter) actionFilter.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    
    if (currentDetailedHistory) {
        renderDetailedHistoryTable(currentDetailedHistory.history);
    }
}

// IP Calculator functions
function calculateNetwork() {
    const ipInput = document.getElementById('calcIpAddress');
    const maskSelect = document.getElementById('calcSubnetMask');
    const maskCustom = document.getElementById('calcSubnetMaskCustom');
    
    if (!ipInput) return;
    
    const ip = ipInput.value.trim();
    
    // Clear previous errors
    hideError('calculatorError');
    ipInput.classList.remove('error');
    if (maskSelect) maskSelect.classList.remove('error');
    if (maskCustom) maskCustom.classList.remove('error');
    
    // Validate IP
    if (!ip) {
        showCalculatorError('Wprowadź adres IP');
        ipInput.classList.add('error');
        return;
    }
    
    if (!isValidIP(ip)) {
        showCalculatorError('Nieprawidłowy format adresu IP');
        ipInput.classList.add('error');
        return;
    }
    
    // Get mask
    let mask;
    if (maskCustom && maskCustom.value.trim()) {
        // Custom mask in decimal notation (e.g., 255.255.255.0)
        const customMask = maskCustom.value.trim();
        mask = convertDecimalMaskToCIDR(customMask);
        if (mask === null) {
            showCalculatorError('Nieprawidłowy format maski sieci');
            maskCustom.classList.add('error');
            return;
        }
    } else if (maskSelect && maskSelect.value) {
        // CIDR notation from select
        mask = parseInt(maskSelect.value);
    } else {
        showCalculatorError('Wybierz maskę sieci');
        if (maskSelect) maskSelect.classList.add('error');
        return;
    }
    
    if (mask < 0 || mask > 32) {
        showCalculatorError('Maska musi być w zakresie 0-32');
        return;
    }
    
    try {
        const results = calculateNetworkParameters(ip, mask);
        displayCalculatorResults(results);
    } catch (error) {
        showCalculatorError('Błąd podczas obliczeń: ' + error.message);
    }
}

function clearCalculator() {
    // Clear inputs
    const ipInput = document.getElementById('calcIpAddress');
    const maskSelect = document.getElementById('calcSubnetMask');
    const maskCustom = document.getElementById('calcSubnetMaskCustom');
    
    if (ipInput) {
        ipInput.value = '';
        ipInput.classList.remove('error');
    }
    if (maskSelect) {
        maskSelect.value = '';
        maskSelect.classList.remove('error');
    }
    if (maskCustom) {
        maskCustom.value = '';
        maskCustom.classList.remove('error');
    }
    
    // Hide results and errors
    const results = document.getElementById('calculatorResults');
    if (results) results.style.display = 'none';
    
    hideError('calculatorError');
}

function showCalculatorError(message) {
    const errorElement = document.getElementById('calculatorError');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function convertDecimalMaskToCIDR(decimalMask) {
    // Convert decimal mask (e.g., 255.255.255.0) to CIDR notation (e.g., 24)
    if (!isValidIP(decimalMask)) return null;
    
    const parts = decimalMask.split('.').map(Number);
    let binaryString = '';
    
    for (let part of parts) {
        binaryString += part.toString(2).padStart(8, '0');
    }
    
    // Count consecutive 1s from the left
    let cidr = 0;
    for (let i = 0; i < 32; i++) {
        if (binaryString[i] === '1') {
            cidr++;
        } else {
            break;
        }
    }
    
    // Validate that there are no 1s after 0s (valid subnet mask)
    for (let i = cidr; i < 32; i++) {
        if (binaryString[i] === '1') {
            return null; // Invalid mask
        }
    }
    
    return cidr;
}

function calculateNetworkParameters(ip, mask) {
    const ipParts = ip.split('.').map(Number);
    
    // Calculate network address
    const maskBits = 0xFFFFFFFF << (32 - mask);
    const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const networkInt = ipInt & maskBits;
    const broadcastInt = networkInt | (0xFFFFFFFF >>> mask);
    
    // Convert back to dotted decimal
    const networkAddress = [
        (networkInt >>> 24) & 0xFF,
        (networkInt >>> 16) & 0xFF,
        (networkInt >>> 8) & 0xFF,
        networkInt & 0xFF
    ].join('.');
    
    const broadcastAddress = [
        (broadcastInt >>> 24) & 0xFF,
        (broadcastInt >>> 16) & 0xFF,
        (broadcastInt >>> 8) & 0xFF,
        broadcastInt & 0xFF
    ].join('.');
    
    // Calculate subnet mask in decimal notation
    const subnetMask = [
        (maskBits >>> 24) & 0xFF,
        (maskBits >>> 16) & 0xFF,
        (maskBits >>> 8) & 0xFF,
        maskBits & 0xFF
    ].join('.');
    
    // Calculate host addresses
    const hostMin = networkInt === ipInt ? null : [
        ((networkInt + 1) >>> 24) & 0xFF,
        ((networkInt + 1) >>> 16) & 0xFF,
        ((networkInt + 1) >>> 8) & 0xFF,
        (networkInt + 1) & 0xFF
    ].join('.');
    
    const hostMax = broadcastInt === networkInt + 1 ? null : [
        ((broadcastInt - 1) >>> 24) & 0xFF,
        ((broadcastInt - 1) >>> 16) & 0xFF,
        ((broadcastInt - 1) >>> 8) & 0xFF,
        (broadcastInt - 1) & 0xFF
    ].join('.');
    
    // Calculate number of hosts
    const totalHosts = Math.pow(2, 32 - mask);
    const usableHosts = mask === 32 ? 1 : (mask === 31 ? 2 : totalHosts - 2);
    
    // Determine network class and type
    const firstOctet = ipParts[0];
    let networkClass = '';
    let networkType = '';
    
    if (firstOctet >= 1 && firstOctet <= 126) {
        networkClass = 'A';
    } else if (firstOctet >= 128 && firstOctet <= 191) {
        networkClass = 'B';
    } else if (firstOctet >= 192 && firstOctet <= 223) {
        networkClass = 'C';
    } else if (firstOctet >= 224 && firstOctet <= 239) {
        networkClass = 'D (Multicast)';
    } else if (firstOctet >= 240 && firstOctet <= 255) {
        networkClass = 'E (Eksperymentalna)';
    }
    
    // Determine network type
    if (firstOctet === 10 || 
        (firstOctet === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) ||
        (firstOctet === 192 && ipParts[1] === 168)) {
        networkType = 'Prywatna';
    } else if (firstOctet === 127) {
        networkType = 'Loopback';
    } else if (firstOctet === 169 && ipParts[1] === 254) {
        networkType = 'Link-local';
    } else {
        networkType = 'Publiczna';
    }
    
    return {
        network: networkAddress,
        subnetMask: subnetMask,
        cidr: `/${mask}`,
        broadcast: broadcastAddress,
        hostMin: hostMin,
        hostMax: hostMax,
        totalHosts: totalHosts,
        usableHosts: usableHosts,
        networkClass: networkClass,
        networkType: networkType
    };
}

function displayCalculatorResults(results) {
    // Show results container
    const resultsContainer = document.getElementById('calculatorResults');
    if (resultsContainer) resultsContainer.style.display = 'block';
    
    // Update result fields
    const updateField = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value || '-';
    };
    
    updateField('resultNetwork', results.network);
    updateField('resultSubnetMask', results.subnetMask);
    updateField('resultCidr', results.cidr);
    updateField('resultBroadcast', results.broadcast);
    updateField('resultHostMin', results.hostMin);
    updateField('resultHostMax', results.hostMax);
    updateField('resultHosts', results.totalHosts.toLocaleString());
    updateField('resultUsableHosts', results.usableHosts.toLocaleString());
    updateField('resultNetworkClass', results.networkClass);
    updateField('resultNetworkType', results.networkType);
    
    // Additional information
    const additionalInfo = document.getElementById('resultAdditionalInfo');
    if (additionalInfo) {
        let info = '';
        
        if (results.usableHosts === 1) {
            info += '<p><strong>Host route:</strong> To jest pojedynczy host (/32)</p>';
        } else if (results.usableHosts === 2) {
            info += '<p><strong>Point-to-point:</strong> Sieć типа пункт-пункт (/31)</p>';
        }
        
        if (results.networkType === 'Prywatna') {
            info += '<p><strong>RFC 1918:</strong> Prywatny zakres adresów IP</p>';
        }
        
        if (results.totalHosts >= 1024) {
            info += `<p><strong>Duża sieć:</strong> ${Math.floor(results.totalHosts / 256)} pełnych podsieci /24</p>`;
        }
        
        additionalInfo.innerHTML = info || '<p>Brak dodatkowych informacji</p>';
    }
}

// Filtering functions for Subnets tab
function filterSubnets() {
    const searchInput = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const vlanFilter = document.getElementById('vlanFilter')?.value.toLowerCase() || '';
    const companyTextFilter = document.getElementById('companyTextFilter')?.value.toLowerCase() || '';
    
    const tbody = document.querySelector('#subnetTable tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        let visible = true;
        const cells = row.querySelectorAll('td');
        
        if (cells.length < 7) return; // Skip if not enough cells
        
        // Get data from cells
        const network = cells[1]?.textContent || '';
        const company = cells[4]?.textContent || '';
        const vlan = cells[5]?.textContent || '';
        const description = cells[6]?.textContent || '';
        
        // VLAN text filter
        if (vlanFilter && visible) {
            const vlanText = vlan.toLowerCase();
            if (!vlanText.includes(vlanFilter)) {
                visible = false;
            }
        }
        
        // Company text filter
        if (companyTextFilter && visible) {
            const companyText = company.toLowerCase();
            if (!companyText.includes(companyTextFilter)) {
                visible = false;
            }
        }
        
        // General search filter
        if (searchInput && visible) {
            const searchableText = (network + ' ' + company + ' ' + description).toLowerCase();
            if (!searchableText.includes(searchInput)) {
                visible = false;
            }
        }
        
        row.style.display = visible ? '' : 'none';
    });
}

// Filtering functions for Audit Logs tab
function filterLogs() {
    const actionFilter = document.getElementById('actionFilter')?.value || '';
    const entityFilter = document.getElementById('entityFilter')?.value || '';
    const userFilter = document.getElementById('userFilter')?.value || '';
    const dateFromFilter = document.getElementById('dateFromFilter')?.value || '';
    const dateToFilter = document.getElementById('dateToFilter')?.value || '';
    
    const filters = {
        action: actionFilter,
        entity_type: entityFilter,
        username: userFilter,
        date_from: dateFromFilter,
        date_to: dateToFilter
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });
    
    loadAuditLogs(1, filters);
}

function refreshLogs() {
    loadAuditLogs(currentLogsPage, logsFilters);
}

function clearLogsFilters() {
    // Clear all filter inputs
    const filterElements = [
        'actionFilter',
        'entityFilter', 
        'userFilter',
        'dateFromFilter',
        'dateToFilter'
    ];
    
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Reset filters and reload
    logsFilters = {};
    loadAuditLogs(1, {});
}