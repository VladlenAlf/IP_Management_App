// Zmienne globalne
let currentTab = 'subnet-management';
let subnets = [];
let companies = [];
let currentUser = null;
let currentLogsPage = 1;
let logsFilters = {};

// Zmienne globalne dla wykresów
let charts = {};

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
    }
};

// Funkcje globalne dla zarządzania firmami
async function deleteCompany(id) {
    const company = companies.find(c => c.id === id);
    if (!company) return;
    
    // Защита системной фирмы "Wolne"
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
        
        // Сначала загружаем компании, затем подсети и статистику
        await loadCompanies();
        await loadSubnets();
        await loadStats();
        setupEventListeners();
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
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
        console.error('Ошибка загрузки статистики:', error);
        showMessage('Błąd ładowania statystyk', 'error');
    }
}

// Ładowanie podsieci
async function loadSubnets() {
    try {
        subnets = await API.fetchSubnets();
        renderSubnetsTable();
        updateSubnetFilters();
        renderCompaniesTable(); // Обновляем таблицу компаний для актуализации количества подсетей
        loadStats(); // Обновляем верхнюю панель статистики
    } catch (error) {
        console.error('Ошибка загрузки подсетей:', error);
    }
}

// Ładowanie firm
async function loadCompanies() {
    try {
        companies = await API.fetchCompanies();
        updateCompanyOptions();
        renderCompaniesTable(); // Добавлено для отображения таблицы компаний
        
        // Обновляем аналитику после загрузки компаний
        if (document.querySelector('.tab-content.active')?.id === 'analytics') {
            await updateAnalytics();
        }
    } catch (error) {
        console.error('Ошибка загрузки компаний:', error);
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
        console.error('Ошибка загрузки логов:', error);
        showMessage('Błąd ładowania logów audytu', 'error');
    }
}

// Ładowanie analityki
async function loadAnalytics() {
    try {
        await updateAnalytics();
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
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
        console.error('Ошибка обновления аналитики:', error);
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
}

function showAddCompanyModal() {
    document.getElementById('companyModalTitle').textContent = 'Dodaj firmę';
    document.getElementById('companyForm').reset();
    document.getElementById('companyModal').style.display = 'block';
}

function showDivideSubnetModal() {
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
}

// Редактирование подсети
function editSubnet(id) {
    const subnet = subnets.find(s => s.id === id);
    if (!subnet) return;

    document.getElementById('subnetModalTitle').textContent = 'Edytuj podsieć';
    document.getElementById('subnetId').value = subnet.id;
    document.getElementById('subnetNetwork').value = subnet.network;
    document.getElementById('subnetMask').value = subnet.mask;
    document.getElementById('subnetCompany').value = subnet.company_id || '';
    document.getElementById('subnetVlan').value = subnet.vlan || '';
    document.getElementById('subnetDescription').value = subnet.description || '';
    
    updateCompanyOptions();
    document.getElementById('subnetModal').style.display = 'block';
}

// Обновление опций компаний
function updateCompanyOptions() {
    const selects = ['subnetCompany', 'companyFilter', 'analyticsCompanyFilter'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        
        if (selectId === 'companyFilter') {
            select.innerHTML = '<option value="">Wszystkie firmy</option><option value="free">Wolne</option>';
        } else if (selectId === 'analyticsCompanyFilter') {
            select.innerHTML = '<option value="">Wszystkie firmy</option>';
        } else {
            select.innerHTML = '<option value="">Wolna (nieprzypisana)</option>';
        }
        
        companies.forEach(company => {
            if (company.name !== 'Wolne') { // Не показываем "Wолне" как опцию
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                select.appendChild(option);
            }
        });
        
        select.value = currentValue;
    });
}

// Обновление опций для разделения подсети
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

// Обновление списка выбранных подсетей для объединения
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

// Обновление опций компаний для массового присвоения
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

// Управление табами
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
    }
    
    currentTab = tabName;
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма добавления/редактирования подсети
    const subnetForm = document.getElementById('subnetForm');
    if (subnetForm) {
        subnetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const subnetData = {
                network: document.getElementById('subnetNetwork').value,
                mask: parseInt(document.getElementById('subnetMask').value),
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
    
    // Форма добавления компании
    const companyForm = document.getElementById('companyForm');
    if (companyForm) {
        companyForm.addEventListener('submit', async function(e) {
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
                showMessage(error.message || 'Błąд podczas zapisywania firmy', 'error');
            }
        });
    }
    
    // Форма разделения подсети
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
                    showMessage(`Pomyślnie podzielono podsieć na ${result.created_count} mniejszych`, 'success');
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
                showMessage('Błąd podczas łącения подсети', 'error');
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
            showMessage(`Import zakończony z ${result.errors.length} błędami. Sprawdź konsolę.`, 'warning');
        }
        
        // Odświeżamy dane po imporcie podsieci i firm
        loadSubnets();
        loadCompanies(); // Dodano для обновления списка компаний
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
        console.error('Błąд импортa фирм:', error);
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
    const usableHosts = totalHosts - 2; // Исключаем сетевой и broadcast адреса
    
    return {
        totalHosts,
        usableHosts,
        networkAddress: network,
        broadcastAddress: calculateBroadcast(network, mask)
    };
}

function calculateBroadcast(network, mask) {
    // Упрощенная версия - для более точного расчета нужна более сложная логика
    const parts = network.split('.').map(Number);
    const hostBits = 32 - mask;
    const lastOctetBits = hostBits % 8;
    
    if (lastOctetBits > 0) {
        parts[3] = parts[3] | (Math.pow(2, lastOctetBits) - 1);
    }
    
    return parts.join('.');
}

// Функция удалена - больше не работаем с IP-адресами

// Отображение таблицы подсетей
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
                <button class="btn btn-small btn-danger" onclick="deleteSubnet(${subnet.id})">Usuń</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Отображение таблицы компаний
function renderCompaniesTable() {
    const tbody = document.querySelector('#companyTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    companies.forEach(company => {
        // Подсчитываем количество подсетей для каждой компании
        let subnetCount;
        if (company.name === 'Wolne') {
            // Для компании "Wolне" считаем подсети с company_id = NULL или company_id = 1
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

// Отображение таблицы логов
function renderLogsTable(logs) {
    const tbody = document.querySelector('#logsTable tbody');
    tbody.innerHTML = '';

    logs.forEach(log => {
        const row = document.createElement('tr');
        // Используем новую функцию для форматирования даты
        const date = formatDateForPoland(log.created_date);
        
        // Форматируем действие для отображения
        const actionMap = {
            'LOGIN_SUCCESS': 'Logowanie do systemu',
            'LOGIN_FAILED': 'Nieudane logowanie',
            'LOGOUT': 'Wylogowanie z systemu',
            'CREATE_SUBNET': 'Tworzenie podsieci',
            'CREATE_SUBNET_FAILED': 'Błąd tworzenia podsieci',
            'UPDATE_SUBNET': 'Modyfikacja подсети',
            'UPDATE_SUBNET_FAILED': 'Błąд мodyfikacji подсети',
            'DELETE_SUBNET': 'Usuwanie подсети',
            'DELETE_SUBNET_FAILED': 'Błąд usuwania подсети',
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

// Функция для форматирования даты по польскому времени
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

// Отображение пагинации для логов
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

// Показать детали лога
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
        
        // Форматируем действие
        const actionMap = {
            'LOGIN_SUCCESS': 'Logowanie do systemu',
            'LOGIN_FAILED': 'Nieudane logowanie',
            'LOGOUT': 'Wylogowanie z systemu',
            'CREATE_SUBNET': 'Tworzenie podsieci',
            'CREATE_SUBNET_FAILED': 'Błąd tworzenia podsieci',
            'UPDATE_SUBNET': 'Modyfikacja подсети',
            'UPDATE_SUBNET_FAILED': 'Błąд мodyfikacji подсети',
            'DELETE_SUBNET': 'Usuwanie подсети',
            'DELETE_SUBNET_FAILED': 'Błąд usuwania подсети',
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
        console.error('Ошибка загрузки деталей лога:', error);
        showMessage('Ошибка загрузки деталей лога', 'error');
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

// Функция удалена - больше не работаем с IP-адресами

// Удаление подсети
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
        showMessage('Błąд во время удаления подсети', 'error');
    }
}

// Функции для открытия модальных окон новых операций
function showAddCompanyModal() {
    document.getElementById('companyModalTitle').textContent = 'Dodaj firmę';
    document.getElementById('companyForm').reset();
    document.getElementById('companyId').value = '';
    document.getElementById('companyModal').style.display = 'block';
}

function showDivideSubnetModal() {
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

// Legacy aliases for compatibility
function openCompanyModal() { showAddCompanyModal(); }
function openDivideModal() { showDivideSubnetModal(); }
function openMergeModal() { showMergeSubnetsModal(); }
function openAssignModal() { showAssignFreeSubnetsModal(); }

// Функция фильтрации подсетей
function filterSubnets() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const companyFilter = document.getElementById('companyFilter')?.value || '';
    
    const filteredSubnets = subnets.filter(subnet => {
        const matchesSearch = !searchTerm || 
            subnet.network.toLowerCase().includes(searchTerm) ||
            (subnet.description && subnet.description.toLowerCase().includes(searchTerm));
        
        const matchesCompany = !companyFilter || 
            (companyFilter === 'free' && !subnet.company_id) ||
            (subnet.company_id && subnet.company_id.toString() === companyFilter);
        
        return matchesSearch && matchesCompany;
    });
    
    renderFilteredSubnetsTable(filteredSubnets);
}

// Функция отображения отфильтрованной таблицы подсетей
function renderFilteredSubnetsTable(filteredSubnets) {
    const tbody = document.querySelector('#subnetTable tbody');
    tbody.innerHTML = '';

    filteredSubnets.forEach(subnet => {
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
                <button class="btn btn-small btn-danger" onclick="deleteSubnet(${subnet.id})">Usuń</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Функция для переключения выбора всех подсетей  
function toggleAllSubnets() {
    const selectAllCheckbox = document.getElementById('selectAllSubnets');
    const checkboxes = document.querySelectorAll('#subnetTable input[type="checkbox"]:not(#selectAllSubnets)');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    updateSelectedSubnetsForMerge();
}

// Функция для редактирования компании
function editCompany(id) {
    const company = companies.find(c => c.id === id);
    if (!company) return;

    document.getElementById('companyModalTitle').textContent = 'Edytuj firmę';
    document.getElementById('companyId').value = company.id;
    document.getElementById('companyName').value = company.name;
    document.getElementById('companyDescription').value = company.description || '';
    
    document.getElementById('companyModal').style.display = 'block';
}

// Функция обновления логов
function refreshLogs() {
    loadAuditLogs(1, logsFilters);
}

// Функция фильтрации логов
function filterLogs() {
    const actionFilter = document.getElementById('actionFilter')?.value || '';
    const entityFilter = document.getElementById('entityFilter')?.value || '';
    const userFilter = document.getElementById('userFilter')?.value || '';
    const dateFromFilter = document.getElementById('dateFromFilter')?.value || '';
    const dateToFilter = document.getElementById('dateToFilter')?.value || '';
    
    const filters = {};
    
    if (actionFilter) {
        filters.action = actionFilter;
    }
    
    if (entityFilter) {
        filters.entity_type = entityFilter;
    }
    
    if (userFilter.trim()) {
        filters.username = userFilter.trim();
    }
    
    if (dateFromFilter) {
        filters.date_from = dateFromFilter;
    }
    
    if (dateToFilter) {
        filters.date_to = dateToFilter;
    }
    
    console.log('Применяем фильтры логов:', filters);
    loadAuditLogs(1, filters);
}

// Функция очистки фильтров логов
function clearLogsFilters() {
    document.getElementById('actionFilter').value = '';
    document.getElementById('entityFilter').value = '';
    document.getElementById('userFilter').value = '';
    document.getElementById('dateFromFilter').value = '';
    document.getElementById('dateToFilter').value = '';
    loadAuditLogs(1, {});
}

// Eksport do Excel
async function exportExcel() {
    try {
        const response = await API.exportExcel();
        
        if (!response.ok) {
            throw new Error('Błąd pobierania pliku');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showMessage('Plik został pobrany pomyślnie', 'success');
    } catch (error) {
        console.error('Błąд экспорта:', error);
        showMessage('Błąd podczas eksportu danych', 'error');
    }
}