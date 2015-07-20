#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var program = require('commander');
var request = require('request');
var htmlparser = require('htmlparser2');
var chalk = require('chalk');

program
    .version('0.1.0')
    .usage('<search terms>')
    .parse(process.argv);

if (!program.args.length) {
  program.help();
}

var searchTerms = program.args.join(' ');
var url = 'http://mdn.io/' + searchTerms;

request(url, function (error, response, body) {
  if (!error && response.statusCode === 200) {
    var handler = new htmlparser.DomHandler(function (error, dom) {
      if (!error) {
        var header, article;

        (function walk(dom) {
          if (!article) {
            _.forEach(dom, function (elem) {
              if (elem.name === 'h1') {
                header = elem.children;
              } else if (elem.name === 'article') {
                article = elem.children;
              } else {
                walk(elem.children);
              }
            });
          }
        })(dom);

        _.forEach(header, function (elem) {
          console.log(elem.data);
          console.log(_.repeat('=', elem.data.length));
          console.log();
        });

        (function walk(dom, style, indent, pre) {
          _.forEach(dom, function (elem) {
            switch (elem.type) {
              case 'tag':
                switch (elem.name) {
                  case 'br':
                    console.log();
                    break;
                  case 'code':
                    walk(elem.children, style.blue, indent, pre);
                    break;
                  case 'dd':
                    process.stdout.write('  ');
                    walk(elem.children, style, indent);
                    console.log();
                    console.log();
                    break;
                  case 'div':
                    if (elem.attribs.class !== 'htab') {
                      switch (elem.attribs.id) {
                        case 'compat-desktop':
                          console.log('Desktop');
                          console.log('-------');
                          break;
                        case 'compat-mobile':
                          console.log('Mobile');
                          console.log('------');
                          break;
                      }
                      walk(elem.children, style, indent);
                    }
                    break;
                  case 'dt':
                    walk(elem.children, style, indent);
                    console.log();
                    break;
                  case 'em':
                    walk(elem.children, style.italic, indent);
                    break;
                  case 'h2':
                    console.log();
                    walk(elem.children, style.red, indent);
                    console.log();
                    console.log();
                    break;
                  case 'h3':
                    console.log();
                    walk(elem.children, style.yellow, indent);
                    console.log();
                    console.log();
                    break;
                  case 'h4':
                    console.log();
                    walk(elem.children, style.green, indent);
                    console.log();
                    console.log();
                    break;
                  case 'li':
                    console.log();
                    process.stdout.write(_.repeat(' ', indent) + '- ');
                    walk(elem.children, style, indent);
                    console.log();
                    break;
                  case 'p':
                    if (elem.children.length) {
                      walk(elem.children, style, indent);
                      console.log();
                      console.log();
                    }
                    break;
                  case 'pre':
                    if (elem.attribs.class === 'syntaxbox') {
                      walk(elem.children, style, indent);
                      console.log();
                      console.log();
                    } else {
                      walk(elem.children, style, indent, true);
                      console.log();
                    }
                    break;
                  case 'span':
                    walk(elem.children, style, indent);
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
                    walk(elem.children, style, indent + 2);
                    console.log();
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
                  var lines = _.trim(elem.data, '\r\n').split(/\r?\n/);
                  for (var i = 0; i < lines.length; ++i) {
                    console.log(style('  ' + (i + 1) + '\t' + lines[i]));
                  }
                } else {
                  var data = _.trim(elem.data, '\r\n');
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
    });

    var parser = new htmlparser.Parser(handler);
    parser.write(body);
    parser.done();
  }
});
