(function () {
  'use strict';

  const fs = require('fs');
  const path = require('path');
  const main = require('electron').remote;
  const markbotMain = main.require('./app/markbot-main');
  const exists = main.require('./app/file-exists');
  const validation = main.require('./app/checks/css/validation');
  const bestPractices = main.require('./app/checks/css/best-practices');
  const properties = main.require('./app/checks/css/properties');
  const content = main.require('./app/checks/content');

  const group = taskDetails.group;
  const file = taskDetails.options.file;
  const isCheater = taskDetails.options.cheater;

  let checksToComplete = 0;

  const checkIfDone = function () {
    checksToComplete--;

    if (checksToComplete <= 0) done();
  };

  const check = function () {
    const fullPath = path.resolve(taskDetails.cwd + '/' + file.path);
    let errors = [];
    let fileContents = '';
    let validationChecker;
    let bestPracticesChecker;
    let propertiesChecker;
    let contentChecker;

    // Backwards compatibility
    if (file.has_not) file.hasNot = file.has_not;
    if (file.search_not) file.searchNot = file.search_not;

    const bypassAllChecks = function (f) {
      checksToComplete = 0;

      if (f.valid) validationChecker.bypass();
      if (f.bestPractices) bestPracticesChecker.bypass();
      if (f.has || f.hasNot) propertiesChecker.bypass();
      if (f.search || f.searchNot) contentChecker.bypass();
    };

    checksToComplete++;
    markbotMain.send('check-group:item-new', group, 'exists', 'Exists');

    if (file.valid) {
      checksToComplete++;
      validationChecker = validation.init(group);

      if (file.bestPractices) {
        checksToComplete++;
        bestPracticesChecker = bestPractices.init(group);
      }

      if (file.has || file.hasNot) {
        checksToComplete++;
        propertiesChecker = properties.init(group);
      }
    }

    if (file.search || file.searchNot) {
      checksToComplete++;
      contentChecker = content.init(group);
    }

    if (!exists.check(fullPath)) {
      markbotMain.send('check-group:item-complete', group, 'exists', 'Exists', [`The file \`${file.path}\` is missing or misspelled`]);
      bypassAllChecks(file);
      checkIfDone();
      return;
    }

    if (file.locked) {
      checksToComplete++;
      markbotMain.send('check-group:item-new', group, 'unchanged', 'Unchanged');

      if (isCheater) {
        markbotMain.send('check-group:item-complete', group, 'unchanged', 'Unchanged', [`The \`${file.path}\` should not be changed`]);
      } else {
        markbotMain.send('check-group:item-complete', group, 'unchanged', 'Unchanged');
      }

      checkIfDone();
    }

    fs.readFile(fullPath, 'utf8', function (err, fileContents) {
      var lines;

      if (fileContents.trim() == '') {
        markbotMain.send('check-group:item-complete', group, 'exists', 'Exists', [`The file \`${file.path}\` is empty`]);
        bypassAllChecks(file);
        checkIfDone();
        return;
      }

      markbotMain.send('check-group:item-complete', group, 'exists', 'Exists');
      checkIfDone();
      lines = fileContents.toString().split(/[\n\u0085\u2028\u2029]|\r\n?/g);

      if (file.valid) {
        validationChecker.check(fullPath, fileContents, lines, function (err) {
          if (!err || err.length <= 0) {
            checkIfDone();

            if (file.bestPractices) bestPracticesChecker.check(fileContents, lines, checkIfDone);

            if (file.has || file.hasNot) {
              if (file.has && !file.hasNot) propertiesChecker.check(fileContents, file.has, [], checkIfDone);
              if (!file.has && file.hasNot) propertiesChecker.check(fileContents, [], file.hasNot, checkIfDone);
              if (file.has && file.hasNot) propertiesChecker.check(fileContents, file.has, file.hasNot, checkIfDone);
            }
          } else {
            if (file.bestPractices) {
              bestPracticesChecker.bypass();
              checksToComplete--;
            }

            if (file.has || file.hasNot) {
              propertiesChecker.bypass();
              checksToComplete--;
            }

            checkIfDone();
          }
        });
      }

      if (file.search || file.searchNot) {
        if (file.search && !file.searchNot) contentChecker.check(fileContents, file.search, [], checkIfDone);
        if (!file.search && file.searchNot) contentChecker.check(fileContents, [], file.searchNot, checkIfDone);
        if (file.search && file.searchNot) contentChecker.check(fileContents, file.search, file.searchNot, checkIfDone);
      }
    });
  };

  check();
}());