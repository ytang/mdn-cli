#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const program = require('commander');
const axios = require('axios');
const chalk = require('chalk');
const cssselect = require('css-select');
const he = require('he');
const htmlparser = require('htmlparser2');
const supportsHyperlinks = require('supports-hyperlinks');

program
  .option('--color', 'forcefully enable color')
  .option('--hyperlink=always', 'forcefully enable hyperlink')
  .option('--no-color', 'forcefully disable color')
  .option('--no-hyperlink', 'forcefully disable hyperlink')
  .version('0.2.0')
  .usage('<search terms>')
  .parse(process.argv);

if (!program.args.length) {
  program.help();
}

const searchTerms = program.args.join(' ');
const url = 'https://mdn.io/' + searchTerms;

function ddgRedirect(response) {
  const { protocol, host } = response.request;
  const dom = htmlparser.parseDOM(response.data);
  const refresh = cssselect.selectOne(
    'html > head > meta[http-equiv=refresh]',
    dom
  );
  const pathParams = refresh.attribs.content.split('url=')[1];
  const url = `${protocol}//${host}${pathParams}`;
  return axios.get(url);
}

function mdnRedirect(response) {
  const { protocol, host } = response.request;
  const dom = htmlparser.parseDOM(response.data);
  const refresh = cssselect.selectOne(
    'html > body > noscript > META[http-equiv=refresh]',
    dom
  );
  const url = refresh.attribs.content.split('URL=')[1];
  return axios.get(url);
}

function mdnParse(response) {
  const dom = htmlparser.parseDOM(response.data);
  let article;
  (function walk(dom) {
    if (!article) {
      _.forEach(dom, function (elem) {
        if (elem.name === 'article') {
          article = elem.children;
        } else {
          walk(elem.children);
        }
      });
    }
  })(dom);

  (function walk(dom, style, indent, pre) {
    _.forEach(dom, function (elem) {
      switch (elem.type) {
        case 'tag':
          switch (elem.name) {
            case 'a':
              const hyperlink =
                supportsHyperlinks.stdout &&
                !_.startsWith(elem.attribs.href, '#');
              if (hyperlink) {
                process.stdout.write('\x1b]8;;');
                if (!elem.attribs.href.includes('://')) {
                  process.stdout.write('https://developer.mozilla.org');
                }
                process.stdout.write(elem.attribs.href);
                process.stdout.write('\x1b\\');
              }
              walk(elem.children, style, indent, pre);
              if (hyperlink) {
                process.stdout.write('\x1b]8;;\x1b\\');
              }
              break;
            case 'br':
              console.log();
              break;
            case 'code':
              walk(elem.children, style.blue, indent, pre);
              break;
            case 'dd':
              walk(elem.children, style, indent + 2, pre);
              break;
            case 'div':
              if (elem.parent.name === 'li') {
                console.log();
                console.log();
              }
              if (
                elem.attribs.class === 'notecard deprecated' ||
                elem.attribs.class === 'notecard nonstandard' ||
                elem.attribs.class === 'notecard warning'
              ) {
                walk(elem.children, style.bgRed, indent, pre);
              } else if (elem.attribs.class === 'notecard note') {
                walk(elem.children, style.underline, indent, pre);
              } else if (elem.attribs.class !== 'metadata-content-container') {
                walk(elem.children, style, indent, pre);
              }
              break;
            case 'dt':
              process.stdout.write(_.repeat(' ', indent));
              walk(elem.children, style, indent, pre);
              console.log();
              break;
            case 'em':
              walk(elem.children, style.italic, indent, pre);
              break;
            case 'h1':
              _.forEach(elem.children, function (elem) {
                const data = he.decode(elem.data);
                console.log(style.bold(data));
                console.log(style.bold(_.repeat('=', data.length)));
                console.log();
              });
              break;
            case 'h2':
              if (elem.attribs.id !== 'try_it') {
                console.log();
                walk(elem.children, style.red.bold, indent, pre);
                console.log();
                console.log();
              }
              break;
            case 'h3':
              console.log();
              walk(elem.children, style.yellow.bold, indent, pre);
              console.log();
              console.log();
              break;
            case 'h4':
              console.log();
              walk(elem.children, style.green.bold, indent, pre);
              console.log();
              console.log();
              break;
            case 'li':
              process.stdout.write(_.repeat(' ', indent) + '- ');
              walk(elem.children, style, indent, pre);
              if (
                _.findIndex(elem.children, ['name', 'ol']) === -1 &&
                _.findIndex(elem.children, ['name', 'ul']) === -1
              ) {
                console.log();
                console.log();
              }
              break;
            case 'ol':
              if (elem.parent.name === 'li') {
                console.log();
                console.log();
              }
              walk(elem.children, style, indent + 2, pre);
              break;
            case 'p':
              if (elem.children.length) {
                process.stdout.write(_.repeat(' ', indent));
                walk(elem.children, style, indent, pre);
                console.log();
                console.log();
              }
              break;
            case 'pre':
              walk(elem.children, style, indent, true);
              console.log();
              break;
            case 'span':
              switch (elem.attribs.class) {
                case 'badge inline optional':
                  process.stdout.write(' ');
                  walk(elem.children, style.gray, indent, pre);
                  break;
                case 'token attr-name':
                  walk(elem.children, style.cyan, indent, pre);
                  break;
                case 'token attr-value':
                  walk(elem.children, style.green, indent, pre);
                  break;
                case 'token builtin class-name':
                  walk(elem.children, style.magenta, indent, pre);
                  break;
                case 'token comment':
                  walk(elem.children, style.gray.italic, indent, pre);
                  break;
                case 'token function':
                  walk(elem.children, style.red, indent, pre);
                  break;
                case 'token keyword':
                  walk(elem.children, style.magenta, indent, pre);
                  break;
                case 'token literal-property property':
                  walk(elem.children, style.cyan, indent, pre);
                  break;
                case 'token number':
                  walk(elem.children, style.yellow, indent, pre);
                  break;
                case 'token operator':
                  walk(elem.children, style.white, indent, pre);
                  break;
                case 'token parameter variable':
                  walk(elem.children, style.cyan, indent, pre);
                  break;
                case 'token punctuation':
                  walk(elem.children, style.white, indent, pre);
                  break;
                case 'token punctuation attr-equals':
                  walk(elem.children, style.white, indent, pre);
                  break;
                case 'token string':
                  walk(elem.children, style.green, indent, pre);
                  break;
                case 'token tag':
                  walk(elem.children, style.magenta, indent, pre);
                  break;
                case 'visually-hidden':
                  process.stdout.write(' ');
                  walk(elem.children, style.gray, indent, pre);
                  break;
                default:
                  walk(elem.children, style, indent, pre);
              }
              if (elem.attribs.title) {
                process.stdout.write(' ' + style.inverse(elem.attribs.title));
              }
              break;
            case 'strong':
              walk(elem.children, style.bold, indent, pre);
              break;
            case 'td':
              process.stdout.write('| ');
              walk(elem.children, style, indent, pre);
              process.stdout.write('\t');
              break;
            case 'th':
              process.stdout.write('| ');
              walk(elem.children, style.bold.underline, indent, pre);
              process.stdout.write('\t');
              break;
            case 'tr':
              walk(elem.children, style, indent, pre);
              console.log('|');
              console.log();
              break;
            case 'ul':
              if (elem.parent.name === 'li') {
                console.log();
                console.log();
              }
              walk(elem.children, style, indent + 2, pre);
              break;
            case 'var':
              walk(elem.children, style.underline, indent, pre);
              break;
            default:
              walk(elem.children, style, indent, pre);
          }
          break;
        case 'text':
          if (pre) {
            process.stdout.write(style(he.decode(elem.data)));
          } else {
            const data = elem.data.replace(/\s+/g, ' ');
            if (data.trim() || (elem.prev && elem.prev.name === 'strong')) {
              process.stdout.write(style(he.decode(data)));
            }
          }
          break;
        default:
          walk(elem.children, style, indent, pre);
      }
    });
  })(article, chalk.reset, 0, false);
}
axios.get(url).then(ddgRedirect).then(mdnRedirect).then(mdnParse);
