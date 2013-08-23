process.env.NODEJS_FILE_ACCESSDIR = '/';
//process.env.NODEJS_OPEN_BASEDIR = '/';


var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    exec = require('child_process').exec,
    fsLock = require('../lib/index.js'),
    fs = require('fs');

//Prepping for tests
fsLock({
    'open_basedir': ['/'],
    'file_accessdir': ['/']
}, true);

fs = require('fs');

var tests = {
    'generic open with defaults': {
        topic: function() {
            return fs.readdirSync('/tmp');
        },
        'should return an array': function(topic) {
            assert.isArray(topic);
        }
    },
    'local-lock with Sync method - single path': {
        topic: function() {
            fsLock({
                'open_basedirdir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            var ret = null;
            try {
                ret = fs.readdirSync('/tmp'); //Should error
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw an error': function(topic) {
            assert.equal('Access denied (file: /tmp)', topic.message);
        }
    },
    'local-lock with Sync method - double path': {
        topic: function() {
            fsLock({
                'open_basedirdir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            var ret = null;
            
            try {
                ret = fs.renameSync('/tmp', '/tmp2');
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw an error': function(topic) {
            assert.equal('Access denied (file: /tmp, /tmp2)', topic.message);
        }
    },
    'local-lock with async method - single path': {
        topic: function() {
            fsLock({
                'open_basedirdir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            var self = this;
            fs.readdir('/tmp', function(err, data) {
                self.callback(null, {
                    err: err,
                    data: data
                });
            });
        },
        'should throw an error': function(topic) {
            assert.isUndefined(topic.data);
            assert.equal('Access denied (file: /tmp)', topic.err.message);
        }
    },
    'local-lock with async method - double path': {
        topic: function() {
            fsLock({
                'open_basedirdir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            var self = this;
            fs.rename('/tmp', '/tmp2', function(err, data) {
                self.callback(null, {
                    err: err,
                    data: data
                });
            });
        },
        'should throw an error': function(topic) {
            assert.isUndefined(topic.data);
            assert.equal('Access denied (file: /tmp, /tmp2)', topic.err.message);
        }
    },
    'local-lock with async method and one bad path': {
        topic: function() {
            fsLock({
                'open_basedirdir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            var self = this;
            fs.rename(__dirname, '/tmp', function(err, data) {
                self.callback(null, {
                    err: err,
                    data: data
                });
            });
        },
        'should throw an error': function(topic) {
            assert.isUndefined(topic.data);
            assert.equal('Access denied (file: /tmp)', topic.err.message);
        }
    },
    'local-lock with async method and one bad path - reversed': {
        topic: function() {
            fsLock({
                'open_basedirdir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            var self = this;
            fs.rename('/tmp', __dirname, function(err, data) {
                self.callback(null, {
                    err: err,
                    data: data
                });
            });
        },
        'should throw an error': function(topic) {
            assert.isUndefined(topic.data);
            assert.equal('Access denied (file: /tmp)', topic.err.message);
        }
    },
    'async with two valid paths': {
        topic: function() {
            fsLock({
                'open_basedir': ['/tmp'],
                'file_accessdir': [path.join(__dirname, '../'), '/tmp']
            });
            var self = this;
            try {
            fs.unlinkSync('/tmp/package.json');
            } catch (e) {}
            fs.symlink(path.join(__dirname, '../package.json'), '/tmp/package.json', function(err, data) {
                self.callback(null, {
                    err: err,
                    data: data
                });
            });
        },
        'should NOT throw an error': function(topic) {
            assert.isNull(topic.err);
        },
        'should NOT return data': function(topic) {
            assert.isUndefined(topic.data);
        }
    },
    'check http urls': {
        topic: function() {
            var ret = null;
            try {
                ret = fs.readdirSync('http://foobar.com'); //Should error
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw an error': function(topic) {
            assert.equal('Access denied (file: http://foobar.com)', topic.message);
        }
    },
    'check https urls': {
        topic: function() {
            var ret = null;
            try {
                ret = fs.readdirSync('https://foobar.com'); //Should error
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw an error': function(topic) {
            assert.equal('Access denied (file: https://foobar.com)', topic.message);
        }
    },
    'check local path': {
        topic: function() {
            var ret = null;
            try {
                ret = fs.readdirSync(__dirname); //Should NOT error
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should return an array': function(topic) {
            assert.isArray(topic);
        }
    },
    'check local require': {
        topic: function() {
            var ret = null;
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': [__dirname]
            });
            try {
                ret = require('../package.json');
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw an error': function(topic) {
            assert.equal('Access denied (module: ../package.json)', topic.message);
        }
    },
    'check local package is requireable': {
        topic: function() {
            var p = path.join(__dirname, '../');
            p = p.substr(0, p.length - 1);
            fsLock({
                'open_basedir': [p],
                'file_accessdir': [p]
            });
            return fsLock.isRequireAllowed('jshint');
        },
        'should be ok': function(topic) {
            assert.isTrue(topic);
        }
    },
    'check local package is requireable out of basedir': {
        topic: function() {
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': [__dirname]
            });
            return fsLock.isRequireAllowed('jshint');
        },
        'should be false': function(topic) {
            assert.isFalse(topic);
        }
    },
    'get allowed require when set': {
        topic: function() {
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': [__dirname]
            });
            return fsLock.getAllowedRequire();
        },
        'should be __dirname + slash': function(topic) {
            assert.isArray(topic);
            assert.equal(__dirname + path.sep, topic[0]);
        }
    },
    'get allowed require when not set': {
        topic: function() {
            fsLock({
                'open_basedir': undefined,
                'file_accessdir': [__dirname]
            });
            return fsLock.getAllowedRequire();
        },
        'should be and empty array': function(topic) {
            assert.isArray(topic);
            assert.equal(undefined, topic[0]);
        }
    },
    'check local package require in basedir': {
        topic: function() {
            var ret = null;
            fsLock({
                'open_basedir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            try {
                ret = require('jshint');
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should return the package': function(topic) {
            assert.ok(topic);
            assert.isFunction(topic.JSHINT);
        }
    },
    'check local package require': {
        topic: function() {
            var ret = null;
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': [__dirname]
            });
            try {
                ret = require('jshint');
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw an error': function(topic) {
            assert.equal('Access denied (module: jshint)', topic.message);
        }
    },
    'normalizePath - local path': {
        topic: function() {
            return fsLock.normalizePath('lib/index/foo');
        },
        'should normalize to CWD': function(topic) {
            assert.equal(path.join(__dirname, '../', 'lib/index/foo/'), topic);
        }
    },
    'resolveList': {
        topic: function() {
            return fsLock.resolveList(['/tmp', '/log'], ['/foo', '/bar', undefined, '']);
        },
        'should resolve the list': function(topic) {
            assert.isArray(topic);
            assert.equal('/tmp', topic[0]);
            assert.equal('/log', topic[1]);
            assert.equal('/foo/', topic[2]);
            assert.equal('/bar/', topic[3]);
        }
    },
    'dlopen - bad path': {
        topic: function() {
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': [__dirname]
            });
            return process.dlopen('../../foo.node');
        },
        'should throw access denied error': function(topic) {
            assert.equal('Access denied (native module: ../../foo.node)', topic.message);
        }
    },
    'dlopen - good path': {
        topic: function() {
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': [__dirname]
            });
            return process.dlopen(path.join(__dirname, 'foo.node'), 'foo.node');
        },
        'should allow': function(topic) {
            assert.equal('dlopen(foo.node, 1): image not found', topic.message);
        }
    },
    'process.binding': {
        topic: function() {
            return process.binding('fs');
        },
        'should return augmented FS object': function(topic) {
            assert.ok(topic);
            assert.isFunction(topic.open);
            assert.ok(topic['@fs-lock']);
        }
    },
    'require native module': {
        topic: function() {
            fsLock({
                'open_basedir': [path.join(__dirname, '../')],
                'file_accessdir': [path.join(__dirname, '../')]
            });
            return require('getrusage');
        },
        'should load native module': function(topic) {
            assert.ok(topic);
            assert.isFunction(topic.usage);
        }
    },
    'isAccessAllowed: pass': {
        topic: function() {
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': [__dirname]
            });
            return fsLock.isAccessAllowed(path.join(__dirname, 'foo.js'));
        },
        'should be true': function(topic) {
            assert.isTrue(topic);
        }
    },
    'isAccessAllowed: fail': {
        topic: function() {
            fsLock({
                'open_basedir': [__dirname],
                'file_accessdir': null
            });
            return fsLock.isAccessAllowed(path.join(__dirname, 'foo.js'));
        },
        'should be false': function(topic) {
            assert.isFalse(topic);
        }
    },
    'resolveConfig': {
        topic: function() {
            return fsLock._resolveConfig({
                'open_basedir': ['/'],
                'file_accessdir': ['/tmp']
            }, {
                'file_accessdir': ['/var']
            });
        },
        'should resolve the passed config': function(topic) {
            assert.ok(topic);
            assert.isArray(topic['file_accessdir']);
            assert.isArray(topic['open_basedir']);
            assert.equal(2, topic['file_accessdir'].length);
            assert.equal(1, topic['open_basedir'].length);
        }
    },
    'verifyConfig - no allow override': {
        topic: function() {
            var ret = null;
            try {
                ret = fsLock._verifyConfig(true, false, true, true);
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw': function(topic) {
            assert.equal('Constructor already called, can not override allowChange', topic.message);
        }
    },
    'verifyConfig - no allow override, no mainCalled': {
        topic: function() {
            var ret = null;
            try {
                ret = fsLock._verifyConfig(true, false, true, false);
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should be true': function(topic) {
            assert.isTrue(topic);
        }
    },
    'verifyConfig - config set, no allowChange, no override': {
        topic: function() {
            var ret = null;
            try {
                ret = fsLock._verifyConfig(true, false, false, false);
            } catch (e) {
                ret = e;
            }
            return ret;
        },
        'should throw': function(topic) {
            assert.equal('Config already set, can not set again', topic.message);
        }
    },
    'reset perms - test should be last': {
        topic: function() {
            fsLock({
                'open_basedir': ['/'],
                'file_accessdir': ['/']
            });
            return true;
        },
        'should return true': function(topic) {
            assert.isTrue(topic);
        }
    }
};

vows.describe('fs-lock').addBatch(tests).export(module);
