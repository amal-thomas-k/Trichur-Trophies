// Isolated fixture only: never opens data/work1 or the shop's existing orders.
process.env.TEST_TRANSPORT='http';
process.env.SHOP_QA='1';
process.env.QA_OUTPUT='artifacts/shop-qa';
await import('./browser-check.js');
