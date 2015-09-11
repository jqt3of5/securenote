(function () {
'use strict';

    module.exports.bufferToHex = function(arr) {
	var i;
	var len;
	var hex = '';
	var c;
	
	for (i = 0, len = arr.length; i < len; i += 1) {
	    c = arr[i].toString(16);
	    if (c.length < 2) {
		c = '0' + c;
	    }
	    hex += c;
	}

	return hex;
    }

    module.exports.hexToBuffer = function(hex) {
	// TODO use Uint8Array or ArrayBuffer or DataView
	var i;
	var byteLen = hex.length / 2;
	var arr;
	var j = 0;

	if (byteLen !== parseInt(byteLen, 10)) {
	    throw new Error("Invalid hex length '" + hex.length + "'");
	}

	arr = new Uint8Array(byteLen);

	for (i = 0; i < byteLen; i += 1) {
	    arr[i] = parseInt(hex[j] + hex[j + 1], 16);
	    j += 2;
	}

	return arr;
    }

module.exports.utf8ToBinaryString = function(str) {
  var escstr = encodeURIComponent(str);
  // replaces any uri escape sequence, such as %0A,
  // with binary escape, such as 0x0A
  var binstr = escstr.replace(/%([0-9A-F]{2})/g, function(match, p1) {
    return String.fromCharCode('0x' + p1);
  });

  return binstr;
}

module.exports.utf8ToBuffer = function (str) {
  var binstr = module.exports.utf8ToBinaryString(str);
  var buf = binaryStringToBuffer(binstr);
  return buf;
}

function utf8ToBase64(str) {
  var binstr = utf8ToBinaryString(str);
  return btoa(binstr);
}

    function binaryStringToUtf8(binstr) {
	var escstr = binstr.replace(/(.)/g, function (m, p) {
	    var code = p.charCodeAt(0).toString(16).toUpperCase();
	    if (code.length < 2) {
		code = '0' + code;
	    }
	    return '%' + code;
	});
	return decodeURIComponent(escstr);
    }

module.exports.bufferToUtf8 = function(buf) {
  var binstr = bufferToBinaryString(buf);
  return binaryStringToUtf8(binstr);
}

function base64ToUtf8(b64) {
  var binstr = atob(b64);

  return binaryStringToUtf8(binstr);
}

function bufferToBinaryString(buf) {
  var binstr = Array.prototype.map.call(buf, function (ch) {
    return String.fromCharCode(ch);
  }).join('');

  return binstr;
}

function bufferToBase64(arr) {
  var binstr = bufferToBinaryString(arr);
  return btoa(binstr);
}

function binaryStringToBuffer(binstr) {
  var buf;

  if ('undefined' !== typeof Uint8Array) {
    buf = new Uint8Array(binstr.length);
  } else {
    buf = [];
  }

  Array.prototype.forEach.call(binstr, function (ch, i) {
    buf[i] = ch.charCodeAt(0);
  });

  return buf;
}

function base64ToBuffer(base64) {
  var binstr = atob(base64);
  var buf = binaryStringToBuffer(binstr);
  return buf;
}

}());
