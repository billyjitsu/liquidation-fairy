const fs = require('fs');
const config = require('../api3-adaptors/config.json');

function main() {
  if (fs.existsSync('deployed-contracts.json')) {
    const contractsRaw = fs.readFileSync('deployed-contracts.json', 'utf-8');
    const contracts = JSON.parse(contractsRaw);

    if (fs.existsSync('api3-aave-ui/deployment-configs.json')) {
      const generatedConfig = {
        config: config,
      };
      generatedConfig['deployed-contracts'] = contracts;

      console.log('generated ', generatedConfig);

      const existingConfigRaw = fs.readFileSync('api3-aave-ui/deployment-configs.json', 'utf-8');
      const existingConfig = JSON.parse(existingConfigRaw);

      existingConfig.generated = generatedConfig;

      fs.writeFileSync(
        'api3-aave-ui/deployment-configs.json',
        JSON.stringify(existingConfig, null, 2)
      );
    } else {
      throw Error('Please run yarn frontend:codegen first!');
    }
  } else {
    console.log('ekse');
    throw Error('Please deploy contracts first!');
  }
}

main();
