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
    }
};

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
        
        loadStats();
        loadSubnets();
        loadCompanies();
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
    try {
        await API.logout();
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Błąd wylogowania:', error);
        window.location.href = '/login.html';
    }
}

// Ładowanie statystyk
async function loadStats() {
    try {
        const stats = await API.fetchStats();
        document.getElementById('totalSubnets').textContent = stats.total_subnets || 0;
        document.getElementById('assignedSubnets').textContent = stats.assigned_subnets || 0;
        document.getElementById('freeSubnets').textContent = stats.free_subnets || 0;
        document.getElementById('totalCompanies').textContent = stats.total_companies || 0;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Ładowanie podsieci
async function loadSubnets() {
    try {
        subnets = await API.fetchSubnets();
        renderSubnetsTable();
        updateSubnetFilters();
    } catch (error) {
        console.error('Ошибка загрузки подсетей:', error);
    }
}

// Ładowanie firm
async function loadCompanies() {
    try {
        companies = await API.fetchCompanies();
        updateCompanyOptions();
    } catch (error) {
        console.error('Ошибка загрузки компаний:', error);
    }
}

// Показ сообщений
function showMessage(text, type) {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
    }, 5000);
}

// Отображение таблицы подсетей
function renderSubnetsTable() {
    const tbody = document.querySelector('#subnetTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    subnets.forEach(subnet => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" data-subnet-id="${subnet.id}"></td>
            <td>${subnet.network}</td>
            <td>/${subnet.mask}</td>
            <td>${subnet.vlan || ''}</td>
            <td>${subnet.company_name || 'Wolna'}</td>
            <td>${subnet.description || ''}</td>
            <td>${formatDateForPoland(subnet.created_date)}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="editSubnet(${subnet.id})">Edytuj</button>
                <button class="btn btn-small btn-danger" onclick="deleteSubnet(${subnet.id})">Usuń</button>
            </td>
        `;
        tbody.appendChild(row);
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
    
    currentTab = tabName;
}

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

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Обновление опций компаний
function updateCompanyOptions() {
    const selects = ['subnetCompany'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">Wolna (nieprzypisana)</option>';
        
        companies.forEach(company => {
            if (company.name !== 'Wolne') {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                select.appendChild(option);
            }
        });
        
        select.value = currentValue;
    });
}

// Обновление фильтров подсетей
function updateSubnetFilters() {
    // Обновляем фильтр по компаниям
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
        const currentValue = companyFilter.value;
        companyFilter.innerHTML = '<option value="">Wszystkie firmy</option>';
        
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.id;
            option.textContent = company.name;
            companyFilter.appendChild(option);
        });
        
        companyFilter.value = currentValue;
    }
}

// Форматирование даты
function formatDateForPoland(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Warsaw'
        });
    } catch (error) {
        return dateString;
    }
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

// Удаление подсети
async function deleteSubnet(id) {
    if (!confirm('Czy na pewno chcesz usunąć tę podsieć?')) return;
    
    try {
        await API.deleteSubnet(id);
        showMessage('Podsieć została usunięta', 'success');
        loadSubnets();
        loadStats();
    } catch (error) {
        showMessage('Błąd podczas usuwania podsieci', 'error');
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма добавления подсети
    const subnetForm = document.getElementById('subnetForm');
    if (subnetForm) {
        subnetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const subnetData = {
                network: document.getElementById('subnetNetwork').value,
                mask: parseInt(document.getElementById('subnetMask').value),
                company_id: document.getElementById('subnetCompany').value || null,
                vlan: document.getElementById('subnetVlan').value || null,
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
                await API.createCompany(companyData);
                showMessage('Firma została pomyślnie utworzona', 'success');
                closeModal('companyModal');
                loadCompanies();
                loadStats();
            } catch (error) {
                showMessage('Błąd podczas zapisywania firmy', 'error');
            }
        });
    }
}

// Экспорт Excel
async function exportExcel() {
    try {
        const response = await API.exportExcel();
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'podsieci.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showMessage('Plik Excel został pobrany', 'success');
    } catch (error) {
        showMessage('Błąd podczas eksportu do Excel', 'error');
    }
}

// Импорт Excel
async function importExcel() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Wybierz plik Excel', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('excelFile', file);
    
    try {
        const result = await API.importExcel(formData);
        showMessage(result.message, 'success');
        if (result.errors && result.errors.length > 0) {
            console.log('Błędy importu:', result.errors);
        }
        loadSubnets();
        loadStats();
    } catch (error) {
        showMessage('Błąd podczas importu Excel', 'error');
    }
}

// Funkcjes placeholder dla brakujących funkcji
function filterSubnets() {
    // TODO: Implementacja filtrowania podsieci
}

function handleFileSelect() {
    // Funkcja do obsługi wyboru pliku
}

function toggleAllSubnets() {
    const selectAll = document.getElementById('selectAllSubnets');
    const checkboxes = document.querySelectorAll('#subnetTable input[type="checkbox"]:not(#selectAllSubnets)');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

function showDivideSubnetModal() {
    // TODO: Implementacja modalnego okna podziału podsieci
}

function showMergeSubnetsModal() {
    // TODO: Implementacja modalnego okna łączenia podsieci
}

function showAssignFreeSubnetsModal() {
    // TODO: Implementacja modalnego okna przypisywania wolnych podsieci
}
