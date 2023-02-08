#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const program = require('commander');
const axios = require('axios');
const htmlparser = require('htmlparser2');
const cssselect = require('css-select');
const chalk = require('chalk');
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
  let header, article;
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
              walk(elem.children, style, indent);
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
              walk(elem.children, style, indent + 2);
              break;
            case 'div':
              if (elem.attribs.class === 'notecard warning') {
                walk(elem.children, style.bgRed, indent);
              } else if (elem.attribs.class !== 'metadata-content-container') {
                walk(elem.children, style, indent);
              }
              break;
            case 'dt':
              process.stdout.write(_.repeat(' ', indent));
              walk(elem.children, style, indent);
              console.log();
              break;
            case 'em':
              walk(elem.children, style.italic, indent);
              break;
            case 'h1':
              _.forEach(elem.children, function (elem) {
                console.log(style.bold(elem.data));
                console.log(style.bold(_.repeat('=', elem.data.length)));
                console.log();
              });
              break;
            case 'h2':
              if (elem.attribs.id !== 'try_it') {
                console.log();
                walk(elem.children, style.red.bold, indent);
                console.log();
                console.log();
              }
              break;
            case 'h3':
              console.log();
              walk(elem.children, style.yellow.bold, indent);
              console.log();
              console.log();
              break;
            case 'h4':
              console.log();
              walk(elem.children, style.green.bold, indent);
              console.log();
              console.log();
              break;
            case 'li':
              process.stdout.write(_.repeat(' ', indent) + '- ');
              walk(elem.children, style, indent);
              if (_.findIndex(elem.children, ['name', 'ul']) === -1) {
                console.log();
                console.log();
              }
              break;
            case 'p':
              if (elem.children.length) {
                process.stdout.write(_.repeat(' ', indent));
                walk(elem.children, style, indent);
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
                case 'token keyword':
                  walk(elem.children, style.magenta, indent);
                  break;
                case 'token function':
                  walk(elem.children, style.red, indent);
                  break;
                case 'token number':
                  walk(elem.children, style.yellow, indent);
                  break;
                case 'token string':
                  walk(elem.children, style.green, indent);
                  break;
                case 'token literal-property property':
                  walk(elem.children, style.cyan, indent);
                  break;
                case 'token comment':
                  walk(elem.children, style.gray.italic, indent);
                  break;
                case 'badge inline optional':
                  process.stdout.write(style.gray(' (Optional)'));
                  break;
                default:
                  walk(elem.children, style, indent);
              }
              if (elem.attribs.title) {
                process.stdout.write(' ' + style.inverse(elem.attribs.title));
              }
              break;
            case 'strong':
              walk(elem.children, style.bold, indent);
              break;
            case 'td':
              process.stdout.write('| ');
              walk(elem.children, style, indent);
              process.stdout.write('\t');
              break;
            case 'th':
              process.stdout.write('| ');
              walk(elem.children, style.underline, indent);
              process.stdout.write('\t');
              break;
            case 'tr':
              walk(elem.children, style, indent);
              console.log('|');
              console.log();
              break;
            case 'ul':
              if (elem.parent.name === 'li') {
                console.log();
                console.log();
              }
              walk(elem.children, style, indent + 2);
              break;
            case 'var':
              walk(elem.children, style.underline, indent);
              break;
            default:
              walk(elem.children, style, indent);
          }
          break;
        case 'text':
          if (pre) {
            process.stdout.write(style(elem.data));
          } else {
            const data = elem.data.replaceAll(/\s+/g, ' ');
            if (data.trim()) {
              process.stdout.write(style(_.unescape(data)));
            }
          }
          break;
        default:
          walk(elem.children, style, indent);
      }
    });
  })(article, chalk.reset, 0);
}
axios.get(url).then(ddgRedirect).then(mdnRedirect).then(mdnParse);
