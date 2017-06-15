var jsdom = require('jsdom');
var jquery = require('jquery');
var chalk = require('chalk');
var parseVairables = require('./parseVairables');

var JSDOM = jsdom.JSDOM;
var dom, $;
// var typeKey = '_class';
var heryKeys = 'hero-';
var heryBindKeys = 'bind:';
var __$$heroClassHolder = '__$hero_class';
var __$$heroCurrentView = '__$hero$CurrentView';
var _rootElementName = 'hero-view';
var _rootElementVariable = 'HeroView_';
var generatedFnName = 'generateView';
var _wrapperHeader = 'function ' + generatedFnName + '(context){';
// d-r-text-field --> DRTextField

function nameFormat(name) {
    return name.toLowerCase().split('-').map(function (subName) {
        return subName.charAt(0).toUpperCase() + subName.substring(1);
    }).join('');
}

function enSureFirstLowerCase(name) {
    var parts = name.toLowerCase().split('-');

    return parts.shift().toLowerCase() + parts.map(function (subName) {
        return subName.charAt(0).toUpperCase() + subName.substring(1);
    }).join('');
}

function traverse(element, callback, parentIdx) {
    if (!element) {
        return null;
    }

    var idx, len;

    callback && callback(element, parentIdx);

    var childrens = element.children();

    if (childrens) {
        for (idx = 0, len = childrens.length; idx < len; idx++) {
            traverse($(childrens[idx]), callback, (parentIdx
                ? parentIdx.concat(idx)
                : [idx]), element);
        }
    }
}

function getParentValue(hirachy, path) {
    if (!path) {
        return hirachy;
    }

    var i, len;
    var value = hirachy;
    var paths = path.split('_');

    paths.pop();

    if (!paths.length) {
        return hirachy;
    }

    for (i = 0, len = paths.length; i < len; i++) {
        value = value.childrens[parseInt(paths[i], 10)];
    }

    return value;
}

function getMeta() {
    var hirachy = {};

    traverse($(_rootElementName), function (element, path) {
        var attributes = element[0].attributes;
        var suffix = (path ? path.join('_') : '');
        var __fnName = nameFormat(element[0].tagName) + '_' + suffix;

        var nodeElement = {
            key: __fnName,
            expressions: {},
            attrs: {},
            childrens: []
        };

        if (!suffix) {
            hirachy = nodeElement;
        } else {
            getParentValue(hirachy, suffix).childrens.push(nodeElement);
        }

        var i, len;

        for (i = 0, len = attributes.length; i < len; i++) {
            if (attributes[i].name.indexOf(heryKeys) === 0) {

                nodeElement.expressions[attributes[i].name.replace(heryKeys, '')] = attributes[i].value;
                continue;
            }
            nodeElement.attrs[enSureFirstLowerCase(attributes[i].name)] = attributes[i].value;
        }
    });
    return hirachy;
}

function treeObject(hirachy, parentViewName) {
    var keys = hirachy.key.split('_');
    var tagName = keys.shift();
    var paths = keys;
    var isRoot = paths && paths.length && paths[0] === '';
    var isRootChild = paths.length === 1;
    var currentViewVariableName = isRoot ? __$$heroCurrentView : __$$heroCurrentView + paths.join('_');

    var __body = isRoot ? [_wrapperHeader] : [];

    __body.push('\n var ');
    __body.push(currentViewVariableName);
    __body.push(';');

    var fors, hasSquare;

    if ('for' in hirachy.expressions) {
        fors = hirachy.expressions.for.trim().split(/\bin\b/);
        hasSquare = /^\(.*\)$/.test(fors[0].trim());
        if (!hasSquare) {
            fors[0] = '(' + fors[0] + ')';
        }
        __body.push('\n');
        __body.push(fors[1]);
        __body.push('.forEach(function');
        __body.push(fors[0]);
        __body.push('{');
    }

    if ('if' in hirachy.expressions) {
        __body.push('\nif(');
        __body.push(hirachy.expressions.if);
        __body.push('){');
    }

    if (hirachy.childrens && hirachy.childrens.length) {
        if (isRoot) {
            hirachy.expressions[heryBindKeys + 'views'] = '[]';
        } else {
            hirachy.expressions[heryBindKeys + 'sub-views'] = '[]';
        }
    }

    var binds = Object.keys(hirachy.expressions).filter(function (heroDirective) {
        return heroDirective.indexOf(heryBindKeys) !== -1;
    });

    __body.push(currentViewVariableName);
    __body.push('={');

    if ('class' in hirachy.attrs) {
        console.warn('Attribute [class] is preserved, value [' + hirachy.attrs.class + '] will ignored.');
    }
    if (!isRoot) {
        hirachy.attrs[__$$heroClassHolder] = hirachy.key;
        hirachy.attrs.class = hirachy.key.split('_').shift();
    }

    var attrKeys = Object.keys(hirachy.attrs);

    attrKeys.forEach(function (attr, index) {
        __body.push(attr);
        __body.push(':');
        __body.push('"');
        __body.push(hirachy.attrs[attr]);
        __body.push('"');
        if (binds.length || (index < attrKeys.length - 1)) {
            __body.push(',\n');
        }
    });
    binds.forEach(function (bind, index) {
        __body.push(enSureFirstLowerCase(nameFormat(bind.replace(heryBindKeys, ''))));
        __body.push(':(');
        __body.push(hirachy.expressions[bind]);
        __body.push(')');
        if (index < (binds.length - 1)) {
            __body.push(',');
        }
    });
    __body.push('\n};');

    if (hirachy.childrens && hirachy.childrens.length) {
        hirachy.childrens.forEach(function (child) {
            var childFn = treeObject(child, currentViewVariableName);

            __body = __body.concat(childFn);

        });
    }
    if (!isRoot) {
        __body.push(parentViewName);
        if (isRootChild) {
            __body.push('.views.push(');
        } else {
            __body.push('.subViews.push(');
        }
        __body.push(currentViewVariableName);
        __body.push(');');

    }

    if ('if' in hirachy.expressions) {
        __body.push('}');
    }

    if ('for' in hirachy.expressions) {
        __body.push('});');
    }

    if (isRoot) {
        __body.push('\nreturn ');
        __body.push(__$$heroCurrentView);
        __body.push(';}');
    }

    return __body.join('');
}
function generateTemplate(metaData) {
    metaData.dynamic = false;
    if ('for' in metaData.expressions) {
        metaData.exist = '*';
    } else if ('if' in metaData.expressions) {
        metaData.exist = '?';
    } else {
        metaData.exist = '{1}';
    }
    Object.keys(metaData.expressions).forEach(function (expression) {
        var _variables;

        if (expression.indexOf(heryBindKeys) === 0) {
            _variables = parseVairables('function ' + __$$heroCurrentView + '_temp_fn(){return (' + metaData.expressions[expression] + ');}');

            if (_variables.implicitVariables && _variables.implicitVariables.length) {
                if (!metaData.dynamic) {
                    metaData.dynamic = [];
                }
                metaData.dynamic.push(enSureFirstLowerCase(expression.replace(heryBindKeys, '')));
            }
        }
    });
    delete metaData.attrs;
    delete metaData.expressions;

    if (metaData.childrens && metaData.childrens.length === 0) {
        delete metaData.childrens;
    } else {
        metaData.childrens.forEach(function (child) {
            generateTemplate(child);
        });
    }
    return metaData;
}
function convert(source, filePath) {
    dom = new JSDOM(source);
    $ = jquery(dom.window);
    var metaData = getMeta();

    var _codes = treeObject(metaData);

    var _variables = parseVairables(_codes);
    var variableDeclares = ['\n'];

    _variables.implicitVariables.forEach(function (_varaible) {
        if (_varaible.indexOf(__$$heroCurrentView) === 0) {
            console.log(chalk.yellow('\nFile: ' + filePath));
            console.log(chalk.yellow('The value of variable [' + _varaible + '] will be ignored, cause vairable name start with ' + __$$heroCurrentView + ' is preserved, Please change to another name.'));
        }
        variableDeclares.push('var ');
        variableDeclares.push(_varaible);
        variableDeclares.push('=');
        variableDeclares.push(_variables.paramName);
        variableDeclares.push('.');
        variableDeclares.push(_varaible);
        variableDeclares.push(';\n');
    });
    _codes = _codes.replace(_wrapperHeader, _wrapperHeader + variableDeclares.join(''));
    var _template = JSON.stringify(generateTemplate(metaData));

    _codes += '\n' + generatedFnName + '._template=' + _template + ';';
    _codes += '\n' + generatedFnName + '._viewName=\'' + _rootElementVariable + '\';';
    _codes += '\n' + generatedFnName + '._className=\'' + __$$heroClassHolder + '\';';
    _codes += '\nmodule.exports = ' + generatedFnName + ';';
    return _codes;
}

module.exports = function (source) {
    this.cacheable();
    var _codes = convert(source, this.resourcePath);

    console.log(_codes);
    this.callback(null, _codes);
};