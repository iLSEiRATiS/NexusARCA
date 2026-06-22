console.log('require node-afip...');
const Afip = require('node-afip');
console.log('instantiating...');
const afip = new Afip({ CUIT: 20409318550, res_folder: './afip_res' });
console.log('done instantiated');
