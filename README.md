# Favigen

<!-- cspell: disable bracketsstartstop -->

[![version](https://img.shields.io/github/v/tag/josh-hemphill/favigen?sort=semver&style=flat-square)](https://github.com/josh-hemphill/favigen/releases)
[![NPM](https://img.shields.io/static/v1?label=&message=NPM&color=informational&style=flat-square)](https://npmjs.org/package/favigen)
[![Codecov](https://img.shields.io/codecov/c/github/josh-hemphill/favigen.svg?style=flat-square)](https://codecov.io/gh/josh-hemphill/favigen)
[![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/favigen?label=Deps&style=flat-square)](https://libraries.io/npm/favigen)
[![Rate on Openbase](https://badges.openbase.com/js/rating/favigen.svg)](https://openbase.com/js/favigen?utm_source=embedded&utm_medium=badge&utm_campaign=rate-badge)
[![Test](https://github.com/josh-hemphill/favigen/actions/workflows/test.yml/badge.svg)](https://github.com/josh-hemphill/favigen/actions/workflows/test.yml)
[![Build Release](https://github.com/josh-hemphill/favigen/actions/workflows/release.yml/badge.svg)](https://github.com/josh-hemphill/favigen/actions/workflows/release.yml)

Provides type information for all CSP directives and related headers' directives; as well as a basic utility funtion that helps convert the typed properties to key/values of each header content's policy string.

Kept up to date with [Mozilla's CSP documentation of available directives](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy).

## Installation

Install with npm:

```shell
$ npm install --save-dev favigen
# Or shorthand
npm i -D favigen
```

## Basic Usage <!-- [<svg alt="codesandbox" xmlns="http://www.w3.org/2000/svg" width="16" height="18"><path d="M7.219 15.877V9.394l-5.73-3.208v3.696l2.624 1.48v2.78l3.106 1.735zm1.488.038l3.163-1.773v-2.845l2.642-1.49V6.16l-5.805 3.26v6.496zm5.041-11l-3.05-1.72-2.68 1.512L5.32 3.193 2.241 4.937l5.744 3.215 5.763-3.237zM0 13.513V4.53L8 0l8 4.511V13.5l-8.001 4.484L0 13.513z" fill="currentColor"/></svg>](https://codesandbox.io/s/favigen-demo-uh195?file=/webpack.config.js) -->

Either pass your CSP directives in at instatiation, or after.

```javascript
const { CspDirectives } = require('favigen')
// or ESM
import { CspDirectives } from 'favigen';

const cspD = new CspDirectives({
  'child-src': 'none',
})

cspD.CSP['connect-src'] = 'example.com'

cspD.CSP['navigate-to'] = ['example.com','example2.com']

csp.headers === {
  'Content-Security-Policy-Report-Only': '',
  'Content-Security-Policy':
    "child-src 'none'; connect-src 'example.com'; navigate-to 'example.com' 'example2.com'",
  'Report-To': '',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}
```

The default configuration produces a referrer policy of `strict-origin-when-cross-origin` because that is the default, and is well suited to be explicitly stated.

## Advanced Usage

```typescript
const { CspDirectives } = require('favigen')
// or ESM
import { CspDirectives } from 'favigen';

const reportTo: ReportTo[] = [
  {
    max_age: 12000,
    group: 'example-group-name',
    endpoints: [{url:'https://example.com'}],
  },
]

const whichToReport = {
    'connect-src':'example.com'
}

const referrerPolicy = 'strict-origin'

const cspD = new CspDirectives(
  {
    'child-src': 'none',
    'connect-src':'example.com',
    'report-to': 'example-group-name'
  },
  reportTo,
  whichToReport,
  referrerPolicy
)

csp.headers === {
  'Content-Security-Policy-Report-Only': "connect-src 'example.com';",
  'Content-Security-Policy':
    "child-src 'none'; connect-src 'example.com'; report-to 'example-group-name';",
  'Report-To': '[{"max_age":12000,"group":"example-group-name","endpoints":[{"url":"https://example.com"}]}]',
  'Referrer-Policy': 'strict-origin',
}
```

For reading up on the descriptions and implications of all directives see [Mozilla's CSP documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)

### Iterate over all available directives

This also provides a map of constants of every available directive name and the category(s) of souces/directives it can be assigned.

```ts
import { directiveNamesList } from 'favigen';

const myDirectives = directiveNamesList
  .reduce((acc,v) => {
    // ! Warning: not all directives allow the full set of directive parameters
    // Though as of 5/6/2021 they all support the 'none' directive, though would be kind of pointless to do this.
    acc[v] = 'none'
  },{})
```

```ts
import { DirectiveMap } from 'favigen';

let myDirectives = DirectiveMap.get('report-to')
myDirectives === [
  {
    displayName: 'Any String',
    consumes: {
      'String': 'string',
    },
    compose: (args: {String:string}) => args.String,
  },
]

myDirectives = DirectiveMap.get('require-sri-for')
myDirectives === [
  'script', 'style', 'script style'
]

myDirectives = DirectiveMap.get('upgrade-insecure-requests')
myDirectives === [
  true, false,
]
```

## Changelog

Take a look at the [CHANGELOG.md](https://github.com/josh-hemphill/favigen/tree/latest/CHANGELOG.md).

## Contribution

You're free to contribute to this project by submitting [issues](https://github.com/josh-hemphill/favigen/issues) and/or [pull requests](https://github.com/josh-hemphill/favigen/pulls).

Please keep in mind that every change and feature should be covered by
tests.

## License

This project is licensed under [MIT](https://github.com/josh-hemphill/favigen/blob/latest/LICENSE).

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- ALL-CONTRIBUTORS-LIST:END -->
