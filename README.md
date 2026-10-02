# Playwright E2E Test Suite

Automated end-to-end tests using Playwright and Flutter canvas automation.

## Setup

### Prerequisites
- Node.js 18+ (LTS)
- npm

### Installation

```bash
npm install
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test
```bash
npx playwright test -g "pattern"
```

### Run in headed mode
```bash
npx playwright test --headed
```

### Update visual baselines
```bash
npx playwright test --update-snapshots
```

### View HTML report
```bash
npx playwright show-report
```

## Test Suite

Tests are organized in `tests/login-test.spec.js` and cover:
- Authentication flows
- Form validation
- Security mechanisms
- UI interactions
- Visual regression

## Project Structure

```
playwright-tests/
├── tests/
│   ├── login-test.spec.js           # Test suite
│   ├── helpers.js                   # Helper functions
│   └── login-test.spec.js-snapshots/ # Visual baselines
├── playwright.config.js
├── package.json
└── README.md
```
