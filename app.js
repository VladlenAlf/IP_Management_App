// Глобальные переменные
let currentTab = 'ip-management';
let subnets = [];
let ipAddresses = [];
let currentUser = null;
let currentLogsPage = 1;
let logsFilters = {};

// Глобальные переменные для графиков
let charts = {};

// API функции
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
        return response.json();
    },

    async fetchSubnets() {
        const response = await fetch('/api/subnets');
        return response.json();
    },

    async fetchIpAddresses(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/ip-addresses?${params}`);
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

    async createIpAddress(ipData) {
        const response = await fetch('/api/ip-addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ipData)
        });
        return response.json();
    },

    async updateIpAddress(id, ipData) {
        const response = await fetch(`/api/ip-addresses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ipData)
        });
        return response.json();
    },

    async deleteIpAddress(id) {
        const response = await fetch(`/api/ip-addresses/${id}`, {
            method: 'DELETE'
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

    async deleteSubnet(id) {
        const response = await fetch(`/api/subnets/${id}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async updateSubnet(id, subnetData) {
        const response = await fetch(`/api/subnets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subnetData)
        });
        return response.json();
    },

    async createBulkIpAddresses(bulkData) {
        const response = await fetch('/api/ip-addresses/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bulkData)
        });
        return response.json();
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

    async fetchAnalyticsSubnets(filters = {}) {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                params.append(key, filters[key]);
            }
        });
        
        const response = await fetch(`/api/analytics/subnets?${params}`);
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

    async fetchAnalyticsUtilization() {
        const response = await fetch('/api/analytics/utilization');
        return response.json();
    },
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndInit();
});

// Проверка авторизации и инициализация
async function checkAuthAndInit() {
    try {
        const authStatus = await API.checkAuth();
        
        if (!authStatus.authenticated) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = authStatus.user;
        updateUserInfo();
        
        loadStats();
        loadSubnets();
        loadIpAddresses();
        setupEventListeners();
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        window.location.href = '/login.html';
    }
}

// Обновление информации о пользователе
function updateUserInfo() {
    const userInfoElement = document.getElementById('userInfo');
    if (currentUser) {
        userInfoElement.textContent = `Привет, ${currentUser.username}!`;
    }
}

// Выход из системы
async function logout() {
    if (confirm('Вы уверены, что хотите выйти из системы?')) {
        try {
            await API.logout();
            window.location.href = '/login.html';
        } catch (error) {
            showMessage('Ошибка при выходе из системы', 'error');
        }
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        const stats = await API.fetchStats();
        document.getElementById('totalIps').textContent = stats.total_ips || 0;
        document.getElementById('occupiedIps').textContent = stats.occupied_ips || 0;
        document.getElementById('freeIps').textContent = stats.free_ips || 0;
        document.getElementById('totalSubnets').textContent = stats.total_subnets || 0;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка подсетей
async function loadSubnets() {
    try {
        subnets = await API.fetchSubnets();
        renderSubnetsTable();
        updateSubnetFilters();
    } catch (error) {
        console.error('Ошибка загрузки подсетей:', error);
    }
}

// Загрузка IP адресов
async function loadIpAddresses(filters = {}) {
    try {
        ipAddresses = await API.fetchIpAddresses(filters);
        renderIpTable();
    } catch (error) {
        console.error('Ошибка загрузки IP адресов:', error);
        showMessage('Ошибка загрузки IP адресов', 'error');
    }
}

// Загрузка логов аудита
async function loadAuditLogs(page = 1, filters = {}) {
    try {
        const data = await API.fetchAuditLogs(page, filters);
        renderLogsTable(data.logs);
        renderLogsPagination(data);
        currentLogsPage = page;
        logsFilters = filters;
    } catch (error) {
        console.error('Ошибка загрузки логов:', error);
        showMessage('Ошибка загрузки логов аудита', 'error');
    }
}

// Загрузка аналитики
async function loadAnalytics() {
    try {
        await updateAnalytics();
    } catch (error) {
        console.error('Ошибка загрузки аналитики:', error);
        showMessage('Ошибка загрузки данных аналитики', 'error');
    }
}

// Обновление аналитики с фильтрами
async function updateAnalytics() {
    try {
        const filters = getAnalyticsFilters();
        
        // Загружаем все данные параллельно
        const [stats, subnetsData, companiesData, monthlyData, utilizationData] = await Promise.all([
            API.fetchAnalyticsStats(filters),
            API.fetchAnalyticsSubnets(filters),
            API.fetchAnalyticsCompanies(filters),
            API.fetchAnalyticsMonthly(filters),
            API.fetchAnalyticsUtilization()
        ]);
        
        // Обновляем карточки статистики
        updateAnalyticsStats(stats);
        
        // Обновляем графики
        updateIpUsageChart(stats);
        updateSubnetsChart(subnetsData);
        updateCompaniesChart(companiesData);
        updateMonthlyChart(monthlyData);
        updateUtilizationChart(utilizationData);
        
    } catch (error) {
        console.error('Ошибка обновления аналитики:', error);
        showMessage('Ошибка обновления аналитики', 'error');
    }
}

// Получение фильтров аналитики
function getAnalyticsFilters() {
    const subnetFilter = document.getElementById('analyticsSubnetFilter');
    const dateFrom = document.getElementById('analyticsDateFrom');
    const dateTo = document.getElementById('analyticsDateTo');
    
    return {
        subnet_id: subnetFilter ? subnetFilter.value : '',
        date_from: dateFrom ? dateFrom.value : '',
        date_to: dateTo ? dateTo.value : ''
    };
}

// Сброс фильтров аналитики
function resetAnalyticsFilters() {
    const subnetFilter = document.getElementById('analyticsSubnetFilter');
    const dateFrom = document.getElementById('analyticsDateFrom');
    const dateTo = document.getElementById('analyticsDateTo');
    
    if (subnetFilter) subnetFilter.value = '';
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    
    updateAnalytics();
}

// Обновление карточек статистики
function updateAnalyticsStats(stats) {
    const elements = {
        analyticsTotal: document.getElementById('analyticsTotal'),
        analyticsOccupied: document.getElementById('analyticsOccupied'),
        analyticsFree: document.getElementById('analyticsFree'),
        analyticsSubnets: document.getElementById('analyticsSubnets')
    };
    
    if (elements.analyticsTotal) elements.analyticsTotal.textContent = stats.total_ips || 0;
    if (elements.analyticsOccupied) elements.analyticsOccupied.textContent = stats.occupied_ips || 0;
    if (elements.analyticsFree) elements.analyticsFree.textContent = stats.free_ips || 0;
    if (elements.analyticsSubnets) elements.analyticsSubnets.textContent = stats.total_subnets || 0;
}

// График использования IP адресов (пирог)
function updateIpUsageChart(stats) {
    const canvas = document.getElementById('ipUsageChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.ipUsage) {
        charts.ipUsage.destroy();
    }
    
    charts.ipUsage = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Занято', 'Свободно'],
            datasets: [{
                data: [stats.occupied_ips || 0, stats.free_ips || 0],
                backgroundColor: ['#e74c3c', '#27ae60'],
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

// График IP адресов по подсетям
function updateSubnetsChart(data) {
    const canvas = document.getElementById('subnetsChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.subnets) {
        charts.subnets.destroy();
    }
    
    charts.subnets = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => `${item.network}/${item.mask}`),
            datasets: [
                {
                    label: 'Занято',
                    data: data.map(item => item.occupied_count),
                    backgroundColor: '#e74c3c'
                },
                {
                    label: 'Свободно',
                    data: data.map(item => item.free_count),
                    backgroundColor: '#27ae60'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
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

// График компаний
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
                label: 'IP адресов',
                data: data.map(item => item.ip_count),
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

// График активности по месяцам
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
                return date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' });
            }),
            datasets: [{
                label: 'Выдано IP адресов',
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

// График утилизации подсетей
function updateUtilizationChart(data) {
    const canvas = document.getElementById('utilizationChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (charts.utilization) {
        charts.utilization.destroy();
    }
    
    charts.utilization = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => `${item.network}/${item.mask}`),
            datasets: [{
                label: 'Утилизация (%)',
                data: data.map(item => item.utilization),
                backgroundColor: data.map(item => {
                    if (item.utilization >= 80) return '#e74c3c';
                    if (item.utilization >= 60) return '#f39c12';
                    return '#27ae60';
                }),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + '%';
                        }
                    }
                }
            }
        }
    });
}

// Обновление фильтров подсетей
function updateSubnetFilters() {
    const subnetFilter = document.getElementById('subnetFilter');
    const ipSubnet = document.getElementById('ipSubnet');
    const analyticsSubnetFilter = document.getElementById('analyticsSubnetFilter');
    
    // Очистка существующих опций
    if (subnetFilter) subnetFilter.innerHTML = '<option value="">Все подсети</option>';
    if (ipSubnet) ipSubnet.innerHTML = '<option value="">Без подсети</option>';
    if (analyticsSubnetFilter) analyticsSubnetFilter.innerHTML = '<option value="">Все подсети</option>';
    
    subnets.forEach(subnet => {
        const option = document.createElement('option');
        option.value = subnet.id;
        option.textContent = `${subnet.network}/${subnet.mask}`;
        
        if (subnetFilter) subnetFilter.appendChild(option.cloneNode(true));
        if (ipSubnet) ipSubnet.appendChild(option.cloneNode(true));
        if (analyticsSubnetFilter) analyticsSubnetFilter.appendChild(option.cloneNode(true));
    });
    
    // Также обновляем опции для массового добавления
    updateBulkSubnetOptions();
}

// Удаление IP
async function deleteIp(id) {
    if (!confirm('Вы уверены, что хотите удалить этот IP адрес?')) return;
    
    try {
        await API.deleteIpAddress(id);
        showMessage('IP адрес успешно удален', 'success');
        loadIpAddresses();
        loadStats();
    } catch (error) {
        showMessage('Ошибка при удалении IP адреса', 'error');
    }
}

// Удаление подсети
async function deleteSubnet(id) {
    if (!confirm('Вы уверены, что хотите удалить эту подсеть? Все связанные IP адреса будут отвязаны от неё.')) return;
    
    try {
        await API.deleteSubnet(id);
        showMessage('Подсеть успешно удалена', 'success');
        loadSubnets();
        loadIpAddresses(); // Обновляем список IP адресов
        loadStats();
    } catch (error) {
        showMessage('Ошибка при удалении подсети', 'error');
    }
}

// Фильтрация IP адресов
function filterIPs() {
    const filters = {
        subnet_id: document.getElementById('subnetFilter').value,
        occupied: document.getElementById('statusFilter').value,
        search: document.getElementById('searchInput').value
    };
    
    loadIpAddresses(filters);
}

// Фильтрация логов
function filterLogs() {
    const filters = {
        action: document.getElementById('actionFilter').value,
        entity_type: document.getElementById('entityFilter').value,
        username: document.getElementById('userFilter').value
    };
    
    loadAuditLogs(1, filters);
}

// Обновление логов
function refreshLogs() {
    loadAuditLogs(currentLogsPage, logsFilters);
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

// Модальные окна
function showAddIpModal() {
    document.getElementById('ipModalTitle').textContent = 'Добавить IP адрес';
    document.getElementById('ipForm').reset();
    document.getElementById('ipId').value = '';
    document.getElementById('ipModal').style.display = 'block';
}

function showAddSubnetModal() {
    document.getElementById('subnetModalTitle').textContent = 'Добавить подсеть';
    document.getElementById('subnetForm').reset();
    document.getElementById('subnetId').value = '';
    document.getElementById('subnetModal').style.display = 'block';
}

function showBulkIpModal() {
    document.getElementById('bulkIpForm').reset();
    updateBulkSubnetOptions();
    document.getElementById('bulkIpModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Редактирование IP
function editIp(id) {
    const ip = ipAddresses.find(ip => ip.id === id);
    if (!ip) return;

    document.getElementById('ipModalTitle').textContent = 'Редактировать IP адрес';
    document.getElementById('ipId').value = ip.id;
    document.getElementById('ipAddress').value = ip.ip_address;
    document.getElementById('ipSubnet').value = ip.subnet_id || '';
    document.getElementById('companyName').value = ip.company_name || '';
    document.getElementById('assignedDate').value = ip.assigned_date || '';
    document.getElementById('isOccupied').checked = ip.is_occupied;
    document.getElementById('ipDescription').value = ip.description || '';
    
    document.getElementById('ipModal').style.display = 'block';
}

// Редактирование подсети
function editSubnet(id) {
    const subnet = subnets.find(s => s.id === id);
    if (!subnet) return;

    document.getElementById('subnetModalTitle').textContent = 'Редактировать подсеть';
    document.getElementById('subnetId').value = subnet.id;
    document.getElementById('subnetNetwork').value = subnet.network;
    document.getElementById('subnetMask').value = subnet.mask;
    document.getElementById('subnetDescription').value = subnet.description || '';
    
    document.getElementById('subnetModal').style.display = 'block';
}

// Обновление опций подсетей для массового добавления
function updateBulkSubnetOptions() {
    const bulkSubnet = document.getElementById('bulkSubnet');
    if (!bulkSubnet) return;
    
    bulkSubnet.innerHTML = '<option value="">Выберите подсеть</option>';
    
    subnets.forEach(subnet => {
        const option = document.createElement('option');
        option.value = subnet.id;
        option.textContent = `${subnet.network}/${subnet.mask}`;
        bulkSubnet.appendChild(option);
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма добавления/редактирования IP
    const ipForm = document.getElementById('ipForm');
    if (ipForm) {
        ipForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const ipData = {
                ip_address: document.getElementById('ipAddress').value,
                subnet_id: document.getElementById('ipSubnet').value || null,
                company_name: document.getElementById('companyName').value,
                assigned_date: document.getElementById('assignedDate').value || null,
                is_occupied: document.getElementById('isOccupied').checked ? 1 : 0,
                description: document.getElementById('ipDescription').value
            };
            
            try {
                const ipId = document.getElementById('ipId').value;
                if (ipId) {
                    await API.updateIpAddress(ipId, ipData);
                    showMessage('IP адрес успешно обновлен', 'success');
                } else {
                    await API.createIpAddress(ipData);
                    showMessage('IP адрес успешно добавлен', 'success');
                }
                
                closeModal('ipModal');
                loadIpAddresses();
                loadStats();
            } catch (error) {
                showMessage('Ошибка при сохранении IP адреса', 'error');
            }
        });
    }
    
    // Форма добавления подсети
    const subnetForm = document.getElementById('subnetForm');
    if (subnetForm) {
        subnetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const subnetData = {
                network: document.getElementById('subnetNetwork').value,
                mask: parseInt(document.getElementById('subnetMask').value),
                description: document.getElementById('subnetDescription').value
            };
            
            try {
                const subnetId = document.getElementById('subnetId').value;
                if (subnetId) {
                    await API.updateSubnet(subnetId, subnetData);
                    showMessage('Подсеть успешно обновлена', 'success');
                } else {
                    await API.createSubnet(subnetData);
                    showMessage('Подсеть успешно создана', 'success');
                }
                
                closeModal('subnetModal');
                loadSubnets();
                loadStats();
            } catch (error) {
                showMessage('Ошибка при сохранении подсети', 'error');
            }
        });
    }
    
    // Форма массового добавления IP
    const bulkIpForm = document.getElementById('bulkIpForm');
    if (bulkIpForm) {
        bulkIpForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const bulkData = {
                subnet_id: document.getElementById('bulkSubnet').value,
                start_ip: document.getElementById('startIp').value,
                end_ip: document.getElementById('endIp').value,
                company_name: document.getElementById('bulkCompanyName').value,
                assigned_date: document.getElementById('bulkAssignedDate').value || null,
                is_occupied: document.getElementById('bulkIsOccupied').checked ? 1 : 0,
                description: document.getElementById('bulkDescription').value
            };
            
            try {
                const result = await API.createBulkIpAddresses(bulkData);
                if (result.error) {
                    showMessage(result.error, 'error');
                } else {
                    showMessage(`Успешно создано ${result.created_count} IP адресов`, 'success');
                    closeModal('bulkIpModal');
                    loadIpAddresses();
                    loadStats();
                }
            } catch (error) {
                showMessage('Ошибка при массовом создании IP адресов', 'error');
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
        showMessage('Пожалуйста, выберите файл Excel (.xlsx или .xls)', 'error');
        fileInput.value = '';
    }
}

async function importExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Пожалуйста, выберите файл для импорта', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('excelFile', file);
    
    try {
        const result = await API.importExcel(formData);
        showMessage(result.message, 'success');
        
        if (result.errors && result.errors.length > 0) {
            console.warn('Ошибки импорта:', result.errors);
        }
        
        loadIpAddresses();
        loadStats();
        fileInput.value = '';
    } catch (error) {
        showMessage('Ошибка при импорте файла', 'error');
    }
}

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

// Отображение таблицы IP адресов
function renderIpTable() {
    const tbody = document.querySelector('#ipTable tbody');
    tbody.innerHTML = '';

    // Сортируем IP адреса для правильного отображения
    const sortedIps = ipAddresses.sort((a, b) => {
        const ipA = a.ip_address.split('.').map(num => parseInt(num));
        const ipB = b.ip_address.split('.').map(num => parseInt(num));
        
        for (let i = 0; i < 4; i++) {
            if (ipA[i] !== ipB[i]) {
                return ipA[i] - ipB[i];
            }
        }
        return 0;
    });

    sortedIps.forEach(ip => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ip.ip_address}</td>
            <td>${ip.network ? `${ip.network}/${ip.mask}` : '-'}</td>
            <td>${ip.company_name || '-'}</td>
            <td>${ip.assigned_date || '-'}</td>
            <td>
                <span class="status-badge ${ip.is_occupied ? 'status-occupied' : 'status-free'}">
                    ${ip.is_occupied ? 'Занят' : 'Свободен'}
                </span>
            </td>
            <td>${ip.description || '-'}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="editIp(${ip.id})">Изменить</button>
                <button class="btn btn-small btn-danger" onclick="deleteIp(${ip.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Показываем сообщение если нет IP адресов
    if (sortedIps.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 40px;">
                Нет IP адресов для отображения
            </td>
        `;
        tbody.appendChild(row);
    }
}

// Отображение таблицы подсетей
function renderSubnetsTable() {
    const tbody = document.querySelector('#subnetTable tbody');
    tbody.innerHTML = '';

    subnets.forEach(subnet => {
        const availableIps = Math.pow(2, 32 - subnet.mask) - 2;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${subnet.network}</td>
            <td>/${subnet.mask}</td>
            <td>${availableIps}</td>
            <td>${subnet.description || '-'}</td>
            <td>${new Date(subnet.created_date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="editSubnet(${subnet.id})">Изменить</button>
                <button class="btn btn-small btn-danger" onclick="deleteSubnet(${subnet.id})">Удалить</button>
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
            'LOGIN_SUCCESS': 'Вход в систему',
            'LOGIN_FAILED': 'Неудачный вход',
            'LOGOUT': 'Выход из системы',
            'CREATE_SUBNET': 'Создание подсети',
            'UPDATE_SUBNET': 'Изменение подсети',
            'DELETE_SUBNET': 'Удаление подсети',
            'CREATE_IP': 'Создание IP',
            'UPDATE_IP': 'Изменение IP',
            'DELETE_IP': 'Удаление IP',
            'BULK_CREATE_IP': 'Массовое создание IP',
            'IMPORT_EXCEL': 'Импорт из Excel'
        };
        
        const entityMap = {
            'user': 'Пользователь',
            'subnet': 'Подсеть',
            'ip_address': 'IP адрес'
        };
        
        const actionText = actionMap[log.action] || log.action;
        const entityText = entityMap[log.entity_type] || log.entity_type;
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${log.username}</td>
            <td><span class="action-badge action-${log.action.toLowerCase()}">${actionText}</span></td>
            <td>${entityText}</td>
            <td>${log.entity_id || '-'}</td>
            <td><button class="btn btn-small btn-secondary" onclick="showLogDetails(${log.id})">Детали</button></td>
            <td>${log.ip_address || '-'}</td>
        `;
        tbody.appendChild(row);
    });

    if (logs.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 40px;">
                Нет логов для отображения
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
        prevBtn.textContent = 'Предыдущая';
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
        nextBtn.textContent = 'Следующая';
        nextBtn.onclick = () => loadAuditLogs(data.page + 1, logsFilters);
        pagination.appendChild(nextBtn);
    }
    
    // Информация о страницах
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `Страница ${data.page} из ${data.totalPages} (всего записей: ${data.total})`;
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
            'LOGIN_SUCCESS': 'Вход в систему',
            'LOGIN_FAILED': 'Неудачный вход',
            'LOGOUT': 'Выход из системы',
            'CREATE_SUBNET': 'Создание подсети',
            'UPDATE_SUBNET': 'Изменение подсети',
            'DELETE_SUBNET': 'Удаление подсети',
            'CREATE_IP': 'Создание IP',
            'UPDATE_IP': 'Изменение IP',
            'DELETE_IP': 'Удаление IP',
            'BULK_CREATE_IP': 'Массовое создание IP',
            'IMPORT_EXCEL': 'Импорт из Excel'
        };
        
        const entityMap = {
            'user': 'Пользователь',
            'subnet': 'Подсеть',
            'ip_address': 'IP адрес'
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