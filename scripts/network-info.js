const os = require('os');

console.log('🌐 Informacje o interfejsach sieciowych:\n');

const networkInterfaces = os.networkInterfaces();
const port = process.env.PORT || 3000;

Object.keys(networkInterfaces).forEach(interfaceName => {
  console.log(`📡 ${interfaceName}:`);
  
  networkInterfaces[interfaceName].forEach(interface => {
    if (interface.family === 'IPv4') {
      const type = interface.internal ? '(Lokalny)' : '(Sieciowy)';
      const url = `http://${interface.address}:${port}`;
      
      console.log(`   IPv4: ${interface.address} ${type}`);
      console.log(`   URL:  ${url}`);
      
      if (!interface.internal) {
        console.log(`   🔗 Dostępny w sieci lokalnej`);
      }
    }
  });
  console.log('');
});

console.log('💡 Aby uruchomić serwer w sieci użyj:');
console.log('   npm run network');
console.log('   lub');
console.log('   npm run network:dev');
