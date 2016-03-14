/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jshint node: true */
var currentCWD = process.cwd();
var block_access = false;
var FILE_ACCESSDIR = process.env.NODEJS_FILE_ACCESSDIR;
var OPEN_BASEDIR = process.env.NODEJS_OPEN_BASEDIR;
var path = require('path');

var config = null;

var configSet = false;

var mainCalled = false;

var allowChange = false;

var getConfig = function() {
    return config || {
        'file_accessdir': ['/'],
        'open_basedir': ['/']
    };
};

function normalizePath(full) {
  var dir_name = full;

  if (dir_name[0] !== '/') {
    dir_name = path.normalize(currentCWD + '/' + dir_name);
  }
  dir_name += (dir_name[dir_name.length - 1] === '/') ? '' : '/';
  return dir_name;
}


var allowPath = function(pathname, name) {
    if (pathname.indexOf('http:') === 0 || pathname.indexOf('https:') === 0) {
        return false;
    }

    var conf = getConfig(),
        paths = conf[name],
        i, nextChar, curPath;

    if (pathname[0] !== '/') {
        pathname = path.normalize(currentCWD + '/' + pathname);
    } else {
        pathname = path.normalize(pathname);
    }
    pathname = normalizePath(pathname);

    for (i = 0; i < paths.length; i++) {
        curPath = paths[i];
        if (pathname.indexOf(curPath) !== 0) {
            continue;
        }

        nextChar = pathname[curPath.length];
        /*istanbul ignore next*/
        if (curPath[curPath.length - 1] !== '/' && nextChar && nextChar !== '/') {
            continue;
        }

        return true;
    }

    return false;
};


var isAccessAllowed = function(file) {
    return allowPath(file, 'file_accessdir');
};

function augmentFS(binding) {
    var orig = {};

    Object.keys(binding).forEach(function(i) {
        orig[i] = binding[i];
    });

    function checkAndPass(name, num) {
      return function(path) {
        if (!block_access || isAccessAllowed(path)) {
          return orig[name].apply(binding, arguments);
        } else {
          var err = new Error('Access denied (file: ' + path + ')'),
              arg = arguments[num - 1];
          /*istanbul ignore else*/
          if (arg === undefined) {
            throw err;
          } else if (typeof arg === 'object') {
              if (arg.oncomplete) {
                  arg.oncomplete(err);
              } else {
                  throw err;
              }
          } else {
            arg(err);
          }
        }
      };
    }

    function checkAndPass2(name, num) {
      return function(path1, path2) {
        if (!block_access || (isAccessAllowed(path1) && isAccessAllowed(path2))) {
          return orig[name].apply(binding, arguments);
        } else {
            var str = [], err, arg;
            if (!isAccessAllowed(path1)) {
                str.push(path1);
            }
            if (!isAccessAllowed(path2)) {
                str.push(path2);
            }

            err = new Error('Access denied (file: ' + str.join(', ') + ')');
            arg = arguments[num - 1];
            /*istanbul ignore else*/
            if (arg === undefined) {
                throw err;
            } else if (typeof arg === 'object') {
                if (arg.oncomplete) {
                    arg.oncomplete(err);
                } else {
                    throw err;
                }
            } else {
                arg(err);
            }
        }
      };
    }

    binding.open = checkAndPass('open', 4);
    binding.rename = checkAndPass2('rename', 3);
    binding.rmdir = checkAndPass('rmdir', 2);
    binding.mkdir = checkAndPass('mkdir', 3);
    binding.readdir = checkAndPass('readdir', 2);
    binding.symlink = checkAndPass2('symlink', 4);
    binding.link = checkAndPass2('link', 3);
    binding.unlink = checkAndPass('unlink', 2);
    binding.chmod = checkAndPass('chmod', 3);
    binding.chown = checkAndPass('chown', 4);
    binding.readlink = checkAndPass('readlink', 2);

    Object.defineProperty(binding, '@fs-lock', { value: true });
    //Freeze this object so no one else can override this method
    Object.freeze(binding);

    return binding;
}

function setupProtectedFS() {
    var oldBinding = process.binding,
        oldDLopen = process.dlopen,
        augmentedFS = augmentFS(oldBinding('fs'));

    process.binding = function(mod) {
        mod = mod.replace(/\0/g, '');
        return ((mod === 'fs') ? augmentedFS : oldBinding(mod));
    };
    process.dlopen = function(mod, path) {
      var real_path = mod.filename || mod;
      if (!block_access || isAccessAllowed(real_path)) {
        return oldDLopen.apply(process, arguments);
      }
      throw new Error('Access denied (native module: ' + real_path + ')');
    };
}




var resolveList = function(arr, param) {
    var tempArr = [],
        resArr = [];

    if (typeof param === 'string') {
        tempArr = param.split(':');
    }
    if (param instanceof Array) {
        tempArr = param;
    }
    
    tempArr.forEach(function(v, k) {
        if (typeof v === 'string') {
            v = v.trim();
            if (v.length !== 0) {
                resArr[k] = normalizePath(v);
            }
        }
    });
    return arr.concat(resArr);
};


function setFromEnv(name, param) {
    config = config || {};
    if (param) {
        config[name] = resolveList(config[name] || [], param.trim());
    }
}

setAccess = function(module) {
    // wraps module._findPath, adding file access permission check
    var trueFindPath = module._findPath;
    module._findPath = function(request, paths) {
        var filename = trueFindPath(request, paths);
        if (!filename) { return filename; }
        if (allowPath(filename, 'open_basedir')) {
            return filename;
        }
        throw new Error('Access denied (module: ' + request + ')');
    };
    
    //Freeze this object so no one else can override this method
    Object.freeze(module);

    // load usual config first
    getConfig();

    // Set from env variables
    setFromEnv('file_accessdir', FILE_ACCESSDIR);
    setFromEnv('open_basedir', OPEN_BASEDIR);
};

setupProtectedFS();
block_access = true;

var NativeModule = require('module');
setAccess(NativeModule);

var resolveConfig = function(s, config, overwrite) {
    config = (overwrite ? {} : config);
    ['open_basedir', 'file_accessdir'].forEach(function(name) {
        config[name] = resolveList(config[name] || [], s[name]);
    });
    return config;
};

var verifyConfig = function(configSet, allowChange, overrideChange, mainCalled) {
    if (configSet && !allowChange) {
        if (overrideChange) {
            if (mainCalled) {
                throw new Error('Constructor already called, can not override allowChange');
            }
        } else {
            throw new Error('Config already set, can not set again');
        }
    }
    if (overrideChange && !mainCalled) {
        allowChange = true;
        console.error('!! OVERRIDING FS LOCK - THIS SHOULD ONLY BE FOR TESTING');
    }
    return allowChange;
};


module.exports = function(s, overrideChange) {
    allowChange = verifyConfig(configSet, allowChange, overrideChange, mainCalled);
    configSet = true;
    config = resolveConfig(s, config, allowChange);
    mainCalled = true;
};

//Wrapped so they can't be over written from the outside
module.exports.isRequireAllowed = function(module) {
  return allowPath(module, 'open_basedir') &&
      allowPath(module, 'file_accessdir');
};

module.exports.getAllowedRequire = function() {
  var conf = getConfig();
  return conf.open_basedir.slice(0);
};

//Exposed only for testing..
module.exports.normalizePath = function(full) {
    return normalizePath(full);
};
module.exports.resolveList = function(arr, param) {
    return resolveList(arr, param);
};
module.exports.isAccessAllowed = function(file) {
    return isAccessAllowed(file);
};
module.exports._resolveConfig = function(s, config) {
    return resolveConfig(s, config);
};
module.exports._verifyConfig = function(configSet, allowChange, overrideChange, mainCalled) {
    return verifyConfig(configSet, allowChange, overrideChange, mainCalled);
};
