fs-lock - open_basedir and file_accessdir support
=================================================

This module implements `open_basedir` and `file_accessdir` inside of Node.js.

   * `open_basedir`: Validates that all `require`'s are inside these directories.
   * `file_accessdir`: `fs` module methods are verified against these directories.

If a path is not validated, it will throw an error (either throw or err out the callback).

Usage
-----

The goal for this module is to help when you are loading 3rd party modules and you need
to restrict their access. A few examples of this come to mind:

   * CLI apps that work only in a certain dir and load 3rd party add-ons.
   * Running a Node.js server process and you rely on 3rd party code to read things from the fs
   * You are paranoid and want to make sure someone doesn't touch what they shouldn't

When you use this module, you `require` it and configure it in your controlled script.
Then any call/require after that will be forced to use these predefined scoped directories.

Notes
-----

Since this is written purely in Javascript, there are likely places that a user could
override other methods to gain access. I have tried to prevent this with `Object.freeze`
on the two `Object`'s that are modified so that they can't be modified again.

Overrides
---------

The constructor to `fs-lock` can not be called more than once, this means that once the
settings are in place, they can not be overrided (except for testing, view code to see that).

The only overrides available for this are a set of Environment variables that are read
at init time. Environment vars where chosen because if you have access to them you
probably have access to the script too.

   * `NODEJS_FILE_ACCESSDIR`
   * `NODEJS_OPEN_BASEDIR`

Both of these support the standard `:` separator and will be auto processed when
the module is loaded.

Example
-------

```javascript
//Do your startup code here, then lock it down with:
require('fs-lock')({
    'file_accessdir': [ __dirname, '/tmp' ],
    'open_basedir': [ '/usr/local/share/node_modules', __dirname ]
});


var fs = require('fs');

fs.readFile('/etc/passwd', function(err, data) {
    //this will throw an Access Denied error
});
```

Build Status
------------

[![Build Status](https://secure.travis-ci.org/yahoo/fs-lock.png?branch=master)](http://travis-ci.org/yahoo/fs-lock)

Node Badge
----------

[![NPM](https://nodei.co/npm/fs-lock.png)](https://nodei.co/npm/fs-lock/)
