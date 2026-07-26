// app.config.ts does `import 'dotenv/config'`, which would otherwise reload
// the real backend/.env file on every jest.resetModules() + require() below,
// clobbering the env vars this spec deletes/overrides on purpose.
jest.mock('dotenv/config', () => ({}));

describe('loadConfig', () => {
  const REQUIRED_ENV = {
    PAYMENT_GATEWAY_BASE_LINK: 'https://api-sandbox.example.dev/v1',
    PAYMENT_GATEWAY_PUBLIC_KEY: 'pub_test',
    PAYMENT_GATEWAY_PRIVATE_KEY: 'prv_test',
    PAYMENT_GATEWAY_INTEGRITY_SECRET: 'integrity_test',
  };
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ...REQUIRED_ENV };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds the config from environment variables, applying defaults', () => {
    delete process.env.PORT;
    delete process.env.AWS_REGION;
    delete process.env.PRODUCTS_TABLE;

    const { loadConfig } = require('./app.config');
    const config = loadConfig();

    expect(config.port).toBe(3000);
    expect(config.aws.region).toBe('us-east-1');
    expect(config.aws.dynamodb.productsTable).toBe('Products');
    expect(config.paymentGateway.baseUrl).toBe(REQUIRED_ENV.PAYMENT_GATEWAY_BASE_LINK);
  });

  it('honors explicit environment variables over defaults', () => {
    process.env.PORT = '4000';
    process.env.AWS_REGION = 'us-west-2';
    process.env.PRODUCTS_TABLE = 'CustomProducts';

    const { loadConfig } = require('./app.config');
    const config = loadConfig();

    expect(config.port).toBe(4000);
    expect(config.aws.region).toBe('us-west-2');
    expect(config.aws.dynamodb.productsTable).toBe('CustomProducts');
  });

  it('throws when a required payment gateway variable is missing', () => {
    delete process.env.PAYMENT_GATEWAY_PRIVATE_KEY;

    const { loadConfig } = require('./app.config');

    expect(() => loadConfig()).toThrow(/PAYMENT_GATEWAY_PRIVATE_KEY/);
  });
});
