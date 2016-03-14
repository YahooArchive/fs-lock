/*global describe, it*/
process.env.NODEJS_FILE_ACCESSDIR = '/';
//process.env.NODEJS_OPEN_BASEDIR = '/';


var assert = require('assert'),
    path = require('path'),
    exec = require('child_process').exec,
    fsLock = require('../index.js'),
    fs = require('fs');

//Prepping for tests
fsLock({
    'open_basedir': ['/'],
    'file_accessdir': ['/']
}, true);

fs = require('fs');

describe('fslock unit tests', function() {

    it('should generic open with defaults', function() {
        assert.ok(Array.isArray(fs.readdirSync('/tmp')));
    });

    it('local-lock with Sync method - single path', function() {
        fsLock({
            'open_basedirdir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        assert.throws(function() {
            fs.readdirSync('/tmp');
        }, /Access denied \(file: \/tmp\)/);
    });

    it('local-lock with Sync method - double path', function() {
        fsLock({
            'open_basedirdir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        assert.throws(function() {
            fs.renameSync('/tmp', '/tmp2');
        }, /Access denied \(file: \/tmp, \/tmp2\)/);
    });

    it('local-lock with async method - single path', function(done) {
        fsLock({
            'open_basedirdir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        fs.readdir('/tmp', function(err, data) {
            assert.equal(data, null);
            assert.equal('Access denied (file: /tmp)', err.message);
            done();
        });
    });

    it('local-lock with async method - double path', function(done) {
        fsLock({
            'open_basedirdir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        fs.rename('/tmp', '/tmp2', function(err, data) {
            assert.equal(data, undefined);
            assert.equal('Access denied (file: /tmp, /tmp2)', err.message);
            done();
        });
    });
    
    it('local-lock with async method and one bad path', function(done) {
        fsLock({
            'open_basedirdir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        fs.rename(__dirname, '/tmp', function(err, data) {
            assert.equal(data, undefined);
            assert.equal('Access denied (file: /tmp)', err.message);
            done();
        });
    });
    
    it('local-lock with async method and one bad path - reversed', function(done) {
        fsLock({
            'open_basedirdir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        fs.rename('/tmp', __dirname, function(err, data) {
            assert.equal(data, undefined);
            assert.equal('Access denied (file: /tmp)', err.message);
            done();
        });
    });

    it('async with two valid paths', function(done) {
        fsLock({
            'open_basedir': ['/tmp'],
            'file_accessdir': [path.join(__dirname, '../'), '/tmp']
        });
        try {
            fs.unlinkSync('/tmp/package.json'); //For testing only
        } catch (e) {}
        fs.symlink(path.join(__dirname, '../package.json'), '/tmp/package.json', function(err, data) {
            assert.equal(err, null);
            assert.equal(data, undefined);
            done();
        });
    });
    
    it('should check http urls', function() {
        assert.throws(function() {
            fs.readdirSync('http://foobar.com'); //Should error
        }, /Access denied \(file: http:\/\/foobar.com\)/);
    });

    it('should check https urls', function() {
        assert.throws(function() {
            fs.readdirSync('https://foobar.com'); //Should error
        }, /Access denied \(file: https:\/\/foobar.com\)/);
    });
    
    it('should check local path', function() {
        var ret = fs.readdirSync(__dirname);
        assert.ok(Array.isArray(ret));
    });
    
    it('should check local require', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': [__dirname]
        });
        assert.throws(function() {
            require('../package.json');
        }, /Access denied \(module: ..\/package.json\)/);
    });
    
    it('should check local package is requireable', function() {
        var p = path.join(__dirname, '../');
        p = p.substr(0, p.length - 1);
        fsLock({
            'open_basedir': [p],
            'file_accessdir': [p]
        });
        assert.ok(fsLock.isRequireAllowed('jshint'));
    });

    it('should check local package is not requireable out of basedir', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': [__dirname]
        });
        assert.equal(fsLock.isRequireAllowed('jshint'), false);
    });
    
    it('should get allowed require when set', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': [__dirname]
        });
        var allowed = fsLock.getAllowedRequire();
        assert.ok(Array.isArray(allowed));
        assert.equal(__dirname + path.sep, allowed[0]);
    });
    
    it('should get allowed require when not set', function() {
        fsLock({
            'open_basedir': undefined,
            'file_accessdir': [__dirname]
        });
        var allowed = fsLock.getAllowedRequire();
        assert.ok(Array.isArray(allowed));
        assert.equal(undefined, allowed[0]);
    });
    
    it('should check local package require in basedir', function() {
        fsLock({
            'open_basedir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        var hint = require('jshint');
        assert.ok(hint);
        assert.equal(typeof hint.JSHINT, 'function');
    });
    
    it('should check local package require', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': [__dirname]
        });
        assert.throws(function() {
            require('jshint');
        }, /Access denied \(module: jshint\)/);
    });
    
    it('should normalizePath - local path', function() {
        assert.equal(path.join(__dirname, '../', 'lib/index/foo/'), fsLock.normalizePath('lib/index/foo'));
    });
    
    it('should resolveList', function() {
        var items = fsLock.resolveList(['/tmp', '/log'], ['/foo', '/bar', undefined, '']);
        assert.ok(Array.isArray(items));
        assert.equal('/tmp', items[0]);
        assert.equal('/log', items[1]);
        assert.equal('/foo/', items[2]);
        assert.equal('/bar/', items[3]);
    });
    
    it('should dlopen - bad path', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': [__dirname]
        });
        assert.throws(function() {
            process.dlopen('../../foo.node');
        }, /Access denied \(native module: ..\/..\/foo.node\)/);
    });
    
    it('should dlopen - good path', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': [__dirname]
        });
        var res = null;
        try {
            process.dlopen(path.join(__dirname, 'foo.node'), 'foo.node');
        } catch (e) {
            res = e;
        }
        assert.equal(/Access denied/.test(res.message), false);
    });
    
    it('should augment process.binding', function() {
        var bfs = process.binding('fs');
        assert.ok(bfs);
        assert.equal(typeof bfs.open, 'function');
        assert.ok(bfs['@fs-lock']);
    });
    
    it('should deal with process.binding w/ null character', function() {
        var bfs = process.binding('fs\0');
        assert.ok(bfs);
        assert.equal(typeof bfs.open, 'function');
        assert.ok(bfs['@fs-lock']);
    });
    
    it('should require native module', function() {
        fsLock({
            'open_basedir': [path.join(__dirname, '../')],
            'file_accessdir': [path.join(__dirname, '../')]
        });
        var c = require('contextify');
        assert.ok(c);
        assert.equal(typeof c.createContext, 'function');
    });
    
    it('isAccessAllowed: pass', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': [__dirname]
        });
        assert.ok(fsLock.isAccessAllowed(path.join(__dirname, 'foo.js')));
    });
    
    it('isAccessAllowed: fail', function() {
        fsLock({
            'open_basedir': [__dirname],
            'file_accessdir': null
        });
        assert.equal(false, fsLock.isAccessAllowed(path.join(__dirname, 'foo.js')));
    });
    
    it('resolveConfig', function() {
        var test = fsLock._resolveConfig({
            'open_basedir': ['/'],
            'file_accessdir': ['/tmp']
        }, {
            'file_accessdir': ['/var']
        });

        assert.ok(test);
        assert.ok(Array.isArray(test['file_accessdir']));
        assert.ok(Array.isArray(test['open_basedir']));
        assert.equal(2, test['file_accessdir'].length);
        assert.equal(1, test['open_basedir'].length);
    });
    
    it('verifyConfig - no allow override', function() {
        assert.throws(function() {
            fsLock._verifyConfig(true, false, true, true);
        }, /Constructor already called, can not override allowChange/);
    });
    
    it('verifyConfig - no allow override, no mainCalled', function() {
        assert.ok(fsLock._verifyConfig(true, false, true, false));
    });
    
    it('verifyConfig - config set, no allowChange, no override', function() {
        assert.throws(function() {
            fsLock._verifyConfig(true, false, false, false);
        }, /Config already set, can not set again/);
    });
    
    it('should reset perms - test should be last', function() {
        fsLock({
            'open_basedir': ['/'],
            'file_accessdir': ['/']
        });
        assert.ok(true);
    });

});
