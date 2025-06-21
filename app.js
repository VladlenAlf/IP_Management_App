// Глобальные переменные
let currentTab = 'ip-management';
let subnets = [];
let ipAddresses = [];
let currentUser = null;

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
        console.log('Загружено IP адресов:', ipAddresses.length); // Для отладки
        renderIpTable();
    } catch (error) {
        console.error('Ошибка загрузки IP адресов:', error);
        showMessage('Ошибка загрузки IP адресов', 'error');
    }
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
                <button class="btn btn-small btn-danger" onclick="deleteSubnet(${subnet.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Обновление фильтров подсетей
function updateSubnetFilters() {
    const subnetFilter = document.getElementById('subnetFilter');
    const ipSubnet = document.getElementById('ipSubnet');
    
    // Очистка существующих опций
    subnetFilter.innerHTML = '<option value="">Все подсети</option>';
    ipSubnet.innerHTML = '<option value="">Без подсети</option>';
    
    subnets.forEach(subnet => {
        const option = document.createElement('option');
        option.value = subnet.id;
        option.textContent = `${subnet.network}/${subnet.mask}`;
        
        subnetFilter.appendChild(option.cloneNode(true));
        ipSubnet.appendChild(option);
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
function showAddIpModal() {
    document.getElementById('ipModalTitle').textContent = 'Добавить IP адрес';
    document.getElementById('ipForm').reset();
    document.getElementById('ipId').value = '';
    document.getElementById('ipModal').style.display = 'block';
}

function showAddSubnetModal() {
    document.getElementById('subnetForm').reset();
    document.getElementById('subnetModal').style.display = 'block';
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

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма добавления/редактирования IP
    document.getElementById('ipForm').addEventListener('submit', async function(e) {
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
    
    // Форма добавления подсети
    document.getElementById('subnetForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const subnetData = {
            network: document.getElementById('subnetNetwork').value,
            mask: parseInt(document.getElementById('subnetMask').value),
            description: document.getElementById('subnetDescription').value
        };
        
        try {
            await API.createSubnet(subnetData);
            showMessage('Подсеть успешно создана', 'success');
            closeModal('subnetModal');
            loadSubnets();
            loadStats();
        } catch (error) {
            showMessage('Ошибка при создании подсети', 'error');
        }
    });
    
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