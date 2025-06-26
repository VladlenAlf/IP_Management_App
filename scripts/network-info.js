const os = require('os');

console.log('🌐 Информация о сетевых интерфейсах:\n');

const networkInterfaces = os.networkInterfaces();
const port = process.env.PORT || 3000;

Object.keys(networkInterfaces).forEach(interfaceName => {
  console.log(`📡 ${interfaceName}:`);
  
  networkInterfaces[interfaceName].forEach(interface => {
    if (interface.family === 'IPv4') {
      const type = interface.internal ? '(Локальный)' : '(Сетевой)';
      const url = `http://${interface.address}:${port}`;
      
      console.log(`   IPv4: ${interface.address} ${type}`);
      console.log(`   URL:  ${url}`);
      
      if (!interface.internal) {
        console.log(`   🔗 Доступен в локальной сети`);
      }
    }
  });
  console.log('');
});

console.log('💡 Для запуска сервера в сети используйте:');
console.log('   npm run network');
console.log('   или');
console.log('   npm run network:dev');
