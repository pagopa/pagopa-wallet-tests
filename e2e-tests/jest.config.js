module.exports = {
  preset: "jest-puppeteer",
  reporters: [
    'default',
    [ 'jest-junit', {
      outputDirectory: './test_reports',
      outputName: `wallet-ui-TEST.xml`,
    } ]
  ]
};