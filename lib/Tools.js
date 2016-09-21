"use strict";

var fs = require("fs");
var Promise = require("bluebird");
var _ = require("underscore");

module.exports = class Tools {

    constructor() {
        throw "Cannot construct singleton";
    }


    static ensureFolderExists(path, root) {
        var parts = path.split("/");
        var curr = root;

        while (parts.length) {
            curr += "/" + parts.shift();

            if (!fs.existsSync(curr)) {
                fs.mkdirSync(curr);
            }
        }
    }

    static getConfigValueByPath(config, path, defaultValue) {
        var pathParts = path.split(".");
        var currentConfig = JSON.parse(JSON.stringify(config));

        for (var i = 0; i < pathParts.length; i++) {
            var pathPart = pathParts[i];

            if (currentConfig[pathPart]) {
                currentConfig = currentConfig[pathPart];
            } else {
                return defaultValue || null;
            }
        }

        return currentConfig;
    }

    static getArrayDifferences(a, b) {
        var diff = [];

        for (var i = 0; i < b.length; i++) {
            var bval = b[i];
            var aval = a[i];

            if (bval instanceof Object) {
                for (var key in bval) {
                    if (aval instanceof Object) {
                        if (aval[key] != bval[key]) {
                            diff.push(bval);
                            break;
                        }
                    } else {
                        if (aval != bval[key]) {
                            diff.push(bval);
                            break;
                        }
                    }
                }
            } else {
                if (aval != bval) {
                    diff.push(bval);
                    break;
                }
            }
        }

        return diff;
    }

    static escapeForRegexp(str, delimiter) {
        if (!str) {
            return "";
        }

        str = str + "";
        return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
    }

    static capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    static loadCommentedConfigFile(path) {
        try {
            return this.parseCommentedJson(fs.readFileSync(path));
        } catch (e) {
            var Application = require('./Application.js');
            Application.log.error("Error loading JSON " + path);
        }
    }

    static parseCommentedJson(json) {
        return JSON.parse(this.minifyJson(json));
    }

    static minifyJson(json) {
        if (json instanceof Buffer) {
            json = json.toString();
        }

        try {
            if (JSON.parse(json)) {
                return json;
            }
        } catch (e) {

        }

        var tokenizer = /"|(\/\*)|(\*\/)|(\/\/)|\n|\r/g,
            in_string = false,
            in_multiline_comment = false,
            in_singleline_comment = false,
            tmp, tmp2, new_str = [], ns = 0, from = 0, lc, rc
            ;

        tokenizer.lastIndex = 0;

        while (tmp = tokenizer.exec(json)) {
            lc = RegExp.leftContext;
            rc = RegExp.rightContext;
            if (!in_multiline_comment && !in_singleline_comment) {
                tmp2 = lc.substring(from);
                if (!in_string) {
                    tmp2 = tmp2.replace(/(\n|\r|\s)*/g, "");
                }
                new_str[ns++] = tmp2;
            }
            from = tokenizer.lastIndex;

            if (tmp[0] == "\"" && !in_multiline_comment && !in_singleline_comment) {
                tmp2 = lc.match(/(\\)*$/);
                if (!in_string || !tmp2 || (tmp2[0].length % 2) == 0) {	// start of string with ", or unescaped " character found to end string
                    in_string = !in_string;
                }
                from--; // include " character in next catch
                rc = json.substring(from);
            }
            else if (tmp[0] == "/*" && !in_string && !in_multiline_comment && !in_singleline_comment) {
                in_multiline_comment = true;
            }
            else if (tmp[0] == "*/" && !in_string && in_multiline_comment && !in_singleline_comment) {
                in_multiline_comment = false;
            }
            else if (tmp[0] == "//" && !in_string && !in_multiline_comment && !in_singleline_comment) {
                in_singleline_comment = true;
            }
            else if ((tmp[0] == "\n" || tmp[0] == "\r") && !in_string && !in_multiline_comment && in_singleline_comment) {
                in_singleline_comment = false;
            }
            else if (!in_multiline_comment && !in_singleline_comment && !(/\n|\r|\s/.test(tmp[0]))) {
                new_str[ns++] = tmp[0];
            }
        }
        new_str[ns++] = rc;
        return new_str.join("");
    }

    static getPaginationForCount(count, limit, page, pagesInView, req) {
        page = parseInt(page) || 0;
        count = parseInt(count) || 0;
        limit = parseInt(limit);
        pagesInView = parseInt(pagesInView) || 2;

        var reqQuery = _.clone(req.query) || {};
        var maxPage = Math.ceil(count / limit) - 1;
        var pages = [];
        var startpage = page - pagesInView;
        var endpage = page + pagesInView;
        var rootUrl = req.currentContainer.get("URL");
        var prevUrl = null;
        var nextUrl = null;

        delete reqQuery.p; // doesn't matter for us
        var queryAddition = [];
        for (var key in reqQuery) {
            if (!reqQuery[key]) {
                continue;
            }
            queryAddition.push(key + "=" + reqQuery[key]);
        }
        queryAddition = queryAddition.join("&");

        if (startpage < 0) {
            endpage += (startpage * -1);
            startpage = 0;
        }

        if (endpage > maxPage) {
            startpage -= (endpage - maxPage);
            endpage = maxPage;
        }

        if (startpage < 0) {
            startpage = 0;
        }

        for (var i = startpage; i <= endpage; i++) {
            var pageUrl = rootUrl;

            if (i > 0) {
                pageUrl = rootUrl + "?p=" + i + (queryAddition ? "&" + queryAddition : "");
            } else {
                pageUrl = rootUrl + (queryAddition ? "?" + queryAddition : "");
            }

            pages.push({
                index: i,
                label: i + 1,
                url: pageUrl,
                active: i == page
            });
        }

        var prevPage = page - 1;
        var nextPage = page + 1;

        if (prevPage < 0) {
            prevPage = null;
        } else {
            if (prevPage > 0) {
                prevUrl = rootUrl + "?p=" + prevPage + (queryAddition ? "&" + queryAddition : "");
            } else {
                prevUrl = rootUrl + (queryAddition ? "?" + queryAddition : "");
            }
        }

        if (nextPage > endpage) {
            nextPage = null;
        } else {
            nextUrl = rootUrl + "?p=" + nextPage + (queryAddition ? "&" + queryAddition : "");
        }

        return {
            urlRoot: rootUrl + queryAddition,
            prevUrl: prevUrl,
            nextUrl: nextUrl,
            prev: prevPage,
            next: nextPage,
            pages: pages,
            active: page,
            limit: limit,
            total: count
        };
    }

    static getStringFromMongoQuery(query) {
        return JSON.stringify(query, function (k, v) {
            if (v instanceof RegExp) {
                v = JSON.stringify({
                    $regex: v.toString().slice(1, v.toString().length - 1)
                });
            } else if (typeof v === 'function') {
                return v + '';
            } else if (v === undefined) {
                v = "undefined";
            }
            return v;
        });

    }

    static measureTime() {
        var start = new Date().getTime();

        return () => {
            var end = new Date().getTime();
            return end - start;
        }
    }

    static escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    static pad(str, width) {
        var len = Math.max(0, width - str.length);
        return str + Array(len + 1).join(' ');
    }

    static isNumber(val) {
        return /^[\.0-9]+$/.test(String(val));
    }

    static formatDuration(duration) {
        var sec_num = parseInt(duration / 1000, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (seconds < 10) {
            seconds = "0" + seconds;
        }
        return hours + ':' + minutes + ':' + seconds;
    }

    static toPrecision(value, precision) {
        var precision = precision || 0,
            power = Math.pow(10, precision),
            absValue = Math.abs(Math.round(value * power)),
            result = (value < 0 ? '-' : '') + String(Math.floor(absValue / power));

        if (precision > 0) {
            var fraction = String(absValue % power),
                padding = new Array(Math.max(precision - fraction.length, 0) + 1).join('0');
            result += '.' + padding + fraction;
        }
        return result;
    }
}