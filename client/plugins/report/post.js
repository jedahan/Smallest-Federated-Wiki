(function() {
  var Farm, Port, Site, Sufix, child, compose, enclose, fetchPage, findPaths, findPubs, findSchedule, flow, fold, fs, header, links, print, ready, report, sendmail,
    __slice = [].slice;

  child = require('child_process');

  fs = require('fs');

  report = require('./report.js');

  print = function() {
    var arg;
    arg = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return console.log.apply(console, arg);
  };

  Site = process.env.Site || null;

  Port = process.env.Port || '';

  if (!Site) {
    Farm = process.env.Farm || '../../../data/farm';
  }

  Sufix = process.env.Sufix || 'report';

  findPaths = function(done) {
    if (Farm) {
      return child.exec("ls " + Farm + "/*/pages/*-" + Sufix, function(err, stdout, stderr) {
        var path, site, slug, x, _i, _len, _ref, _ref1, _results;
        _ref = stdout.split(/\n/);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          path = _ref[_i];
          if (path === '') {
            continue;
          }
          _ref1 = path.split('/').reverse(), slug = _ref1[0], x = _ref1[1], site = _ref1[2];
          _results.push(done(path, site, slug));
        }
        return _results;
      });
    } else {
      return child.exec("ls ../../../data/pages/*-" + Sufix, function(err, stdout, stderr) {
        var path, slug, _i, _len, _ref, _results;
        _ref = stdout.split(/\n/);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          path = _ref[_i];
          if (path === '') {
            continue;
          }
          slug = path.split('/').reverse()[0];
          _results.push(done(path, Site, slug));
        }
        return _results;
      });
    }
  };

  fetchPage = function(path, done) {
    var text;
    return text = fs.readFile(path, 'utf8', function(err, text) {
      if (err) {
        return console.log(['fetchPage', path, err]);
      }
      return done(JSON.parse(text));
    });
  };

  findSchedule = function(page) {
    var item, _i, _len, _ref;
    _ref = page.story;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      item = _ref[_i];
      if (item.type === 'report') {
        return report.parse(item.text);
      }
    }
    return null;
  };

  findPubs = function(done) {
    return findPaths(function(path, site, slug) {
      return fetchPage(path, function(page) {
        var issue, schedule, _i, _len, _ref, _results;
        if (schedule = findSchedule(page)) {
          _results = [];
          for (_i = 0, _len = schedule.length; _i < _len; _i++) {
            issue = schedule[_i];
            if ((issue.interval != null) && ((_ref = issue.recipients) != null ? _ref.length : void 0)) {
              _results.push(done({
                site: site,
                slug: slug,
                page: page,
                schedule: schedule,
                issue: issue
              }));
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        }
      });
    });
  };

  links = function(text) {
    return text.replace(/\[(http.*?) +(.*?)\]/gi, "[$2]");
  };

  flow = function(text) {
    return text.replace(/\s+/g, ' ') + "\n";
  };

  fold = function(text) {
    return text.match(/.{1,50}(\s|$)|\S+?(\s|$)/g).join("\n");
  };

  compose = function(page, since) {
    var action, active, item, result, _i, _j, _len, _len1, _ref, _ref1;
    active = {};
    _ref = page.journal;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      action = _ref[_i];
      if (action.date && action.date > since) {
        if (action.type === 'add') {
          active[action.id] = 'NEW';
        }
        if (action.type === 'edit' && !active[action.id]) {
          active[action.id] = 'UPDATE';
        }
      }
    }
    result = [];
    _ref1 = page.story;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      item = _ref1[_j];
      if (item.type === 'paragraph' && active[item.id]) {
        result.push(active[item.id]);
        result.push(fold(flow(links(item.text))));
      }
    }
    return result.join("\n");
  };

  ready = function(_arg) {
    var issue, lapse, now, period, thisIssue, window;
    issue = _arg.issue, now = _arg.now, period = _arg.period;
    window = period * 60 * 1000;
    thisIssue = report.advance(now, issue, 0);
    lapse = now.getTime() - thisIssue.getTime();
    return lapse < window;
  };

  header = function(fields) {
    var k, v;
    return ((function() {
      var _results;
      _results = [];
      for (k in fields) {
        v = fields[k];
        _results.push("" + k + ": " + v);
      }
      return _results;
    })()).join("\n");
  };

  enclose = function(_arg) {
    var issue, page, site, slug, summary;
    site = _arg.site, slug = _arg.slug, page = _arg.page, issue = _arg.issue, summary = _arg.summary;
    return [
      header({
        To: issue.recipients.join(", "),
        'Reply-to': issue.recipients.join(", "),
        Subject: "" + page.title + " (" + issue.interval + ")"
      }), "" + page.title + "\nPublished " + issue.interval + " from Federated Wiki", summary, "See details at\nhttp://" + site + Port + "/" + slug + ".html"
    ].join("\n\n");
  };

  sendmail = function(pub) {
    var output, send;
    output = [];
    send = child.spawn('/usr/sbin/sendmail', ['-fward@wiki.org', '-t']);
    send.stdin.write(pub.message);
    send.stdin.end();
    send.stderr.setEncoding('utf8');
    send.stderr.on('data', function(data) {
      return output.push(data);
    });
    return send.on('exit', function(code) {
      print("sent " + pub.page.title + " (" + pub.issue.interval + "), code: " + code);
      return print(output.join(''));
    });
  };

  findPubs(function(pub) {
    pub.now = new Date(2012, 12 - 1, 21, 0, 0, 3);
    pub.now = new Date();
    pub.period = 60;
    if (ready(pub)) {
      pub.summary = compose(pub.page, report.advance(pub.now, pub.issue, -1));
      if (pub.summary !== '') {
        pub.message = enclose(pub);
        return sendmail(pub);
      }
    }
  });

}).call(this);
