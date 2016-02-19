'use strict';

var
  util = require('util'),
  cheerio = require('cheerio')
;

const bypass = function (listener, checkGroup, checkId, checkLabel) {
  listener.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const check = function (listener, checkGroup, checkId, checkLabel, fileContents, sels) {
  var
    $ = null,
    errors = []
  ;

  listener.send('check-group:item-computing', checkGroup, checkId);
  $ = cheerio.load(fileContents);

  sels.forEach(function (sel) {
    if ($(sel).length <= 0) {
      errors.push(util.format('Expected to see this element: `%s`', sel));
    }
  });

  listener.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
};

module.exports.init = function (lstnr, group) {
  return (function (l, g) {
    let
      listener = l,
      checkGroup = g,
      checkLabel = 'Required elements',
      checkId = 'elements'
    ;

    listener.send('check-group:item-new', checkGroup, checkId, checkLabel);

    return {
      check: function (fileContents, sels) {
        check(listener, checkGroup, checkId, checkLabel, fileContents, sels);
      },
      bypass: function () {
        bypass(listener, checkGroup, checkId, checkLabel);
      }
    };
  }(lstnr, group));
};
