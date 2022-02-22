const request = require('request');
const url = require('url');

const yeetTokens = require('./tokens.json');

"use strict";

var sjcl = {
    cipher: {},
    hash: {},
    keyexchange: {},
    mode: {},
    misc: {},
    codec: {},
    exception: {
        corrupt: function (message) {
            this.toString = function () {
                return "CORRUPT: " + this.message
            };
            this.message = message
        },
        invalid: function (message) {
            this.toString = function () {
                return "INVALID: " + this.message
            };
            this.message = message
        },
        bug: function (message) {
            this.toString = function () {
                return "BUG: " + this.message
            };
            this.message = message
        },
        notReady: function (message) {
            this.toString = function () {
                return "NOT READY: " + this.message
            };
            this.message = message
        }
    }
};
sjcl.cipher.aes = function (key) {
    if (!this._tables[0][0][0]) {
        this._precompute()
    }
    var i, j, tmp, encKey, decKey, sbox = this._tables[0][4],
        decTable = this._tables[1],
        keyLen = key.length,
        rcon = 1;
    if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
        throw new sjcl.exception.invalid("invalid aes key size")
    }
    this._key = [encKey = key.slice(0), decKey = []];
    for (i = keyLen; i < 4 * keyLen + 28; i++) {
        tmp = encKey[i - 1];
        if (i % keyLen === 0 || (keyLen === 8 && i % keyLen === 4)) {
            tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255];
            if (i % keyLen === 0) {
                tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
                rcon = rcon << 1 ^ (rcon >> 7) * 283
            }
        }
        encKey[i] = encKey[i - keyLen] ^ tmp
    }
    for (j = 0; i; j++ , i--) {
        tmp = encKey[j & 3 ? i : i - 4];
        if (i <= 4 || j < 4) {
            decKey[j] = tmp
        } else {
            decKey[j] = decTable[0][sbox[tmp >>> 24]] ^ decTable[1][sbox[tmp >> 16 & 255]] ^ decTable[2][sbox[tmp >> 8 & 255]] ^ decTable[3][sbox[tmp & 255]]
        }
    }
};
sjcl.cipher.aes.prototype = {
    encrypt: function (data) {
        return this._crypt(data, 0)
    },
    decrypt: function (data) {
        return this._crypt(data, 1)
    },
    _tables: [
        [
            [],
            [],
            [],
            [],
            []
        ],
        [
            [],
            [],
            [],
            [],
            []
        ]
    ],
    _precompute: function () {
        var encTable = this._tables[0],
            decTable = this._tables[1],
            sbox = encTable[4],
            sboxInv = decTable[4],
            i, x, xInv, d = [],
            th = [],
            x2, x4, x8, s, tEnc, tDec;
        for (i = 0; i < 256; i++) {
            th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i
        }
        for (x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
            s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
            s = s >> 8 ^ s & 255 ^ 99;
            sbox[x] = s;
            sboxInv[s] = x;
            x8 = d[x4 = d[x2 = d[x]]];
            tDec = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
            tEnc = d[s] * 0x101 ^ s * 0x1010100;
            for (i = 0; i < 4; i++) {
                encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
                decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8
            }
        }
        for (i = 0; i < 5; i++) {
            encTable[i] = encTable[i].slice(0);
            decTable[i] = decTable[i].slice(0)
        }
    },
    _crypt: function (input, dir) {
        if (input.length !== 4) {
            throw new sjcl.exception.invalid("invalid aes block size")
        }
        var key = this._key[dir],
            a = input[0] ^ key[0],
            b = input[dir ? 3 : 1] ^ key[1],
            c = input[2] ^ key[2],
            d = input[dir ? 1 : 3] ^ key[3],
            a2, b2, c2, nInnerRounds = key.length / 4 - 2,
            i, kIndex = 4,
            out = [0, 0, 0, 0],
            table = this._tables[dir],
            t0 = table[0],
            t1 = table[1],
            t2 = table[2],
            t3 = table[3],
            sbox = table[4];
        for (i = 0; i < nInnerRounds; i++) {
            a2 = t0[a >>> 24] ^ t1[b >> 16 & 255] ^ t2[c >> 8 & 255] ^ t3[d & 255] ^ key[kIndex];
            b2 = t0[b >>> 24] ^ t1[c >> 16 & 255] ^ t2[d >> 8 & 255] ^ t3[a & 255] ^ key[kIndex + 1];
            c2 = t0[c >>> 24] ^ t1[d >> 16 & 255] ^ t2[a >> 8 & 255] ^ t3[b & 255] ^ key[kIndex + 2];
            d = t0[d >>> 24] ^ t1[a >> 16 & 255] ^ t2[b >> 8 & 255] ^ t3[c & 255] ^ key[kIndex + 3];
            kIndex += 4;
            a = a2;
            b = b2;
            c = c2
        }
        for (i = 0; i < 4; i++) {
            out[dir ? 3 & -i : i] = sbox[a >>> 24] << 24 ^ sbox[b >> 16 & 255] << 16 ^ sbox[c >> 8 & 255] << 8 ^ sbox[d & 255] ^ key[kIndex++];
            a2 = a;
            a = b;
            b = c;
            c = d;
            d = a2
        }
        return out
    }
};
sjcl.bitArray = {
    bitSlice: function (a, bstart, bend) {
        a = sjcl.bitArray._shiftRight(a.slice(bstart / 32), 32 - (bstart & 31)).slice(1);
        return (bend === undefined) ? a : sjcl.bitArray.clamp(a, bend - bstart)
    },
    extract: function (a, bstart, blength) {
        var x, sh = Math.floor((-bstart - blength) & 31);
        if ((bstart + blength - 1 ^ bstart) & -32) {
            x = (a[bstart / 32 | 0] << (32 - sh)) ^ (a[bstart / 32 + 1 | 0] >>> sh)
        } else {
            x = a[bstart / 32 | 0] >>> sh
        }
        return x & ((1 << blength) - 1)
    },
    concat: function (a1, a2) {
        if (a1.length === 0 || a2.length === 0) {
            return a1.concat(a2)
        }
        var last = a1[a1.length - 1],
            shift = sjcl.bitArray.getPartial(last);
        if (shift === 32) {
            return a1.concat(a2)
        } else {
            return sjcl.bitArray._shiftRight(a2, shift, last | 0, a1.slice(0, a1.length - 1))
        }
    },
    bitLength: function (a) {
        var l = a.length,
            x;
        if (l === 0) {
            return 0
        }
        x = a[l - 1];
        return (l - 1) * 32 + sjcl.bitArray.getPartial(x)
    },
    clamp: function (a, len) {
        if (a.length * 32 < len) {
            return a
        }
        a = a.slice(0, Math.ceil(len / 32));
        var l = a.length;
        len = len & 31;
        if (l > 0 && len) {
            a[l - 1] = sjcl.bitArray.partial(len, a[l - 1] & 0x80000000 >> (len - 1), 1)
        }
        return a
    },
    partial: function (len, x, _end) {
        if (len === 32) {
            return x
        }
        return (_end ? x | 0 : x << (32 - len)) + len * 0x10000000000
    },
    getPartial: function (x) {
        return Math.round(x / 0x10000000000) || 32
    },
    equal: function (a, b) {
        if (sjcl.bitArray.bitLength(a) !== sjcl.bitArray.bitLength(b)) {
            return !1
        }
        var x = 0,
            i;
        for (i = 0; i < a.length; i++) {
            x |= a[i] ^ b[i]
        }
        return (x === 0)
    },
    _shiftRight: function (a, shift, carry, out) {
        var i, last2 = 0,
            shift2;
        if (out === undefined) {
            out = []
        }
        for (; shift >= 32; shift -= 32) {
            out.push(carry);
            carry = 0
        }
        if (shift === 0) {
            return out.concat(a)
        }
        for (i = 0; i < a.length; i++) {
            out.push(carry | a[i] >>> shift);
            carry = a[i] << (32 - shift)
        }
        last2 = a.length ? a[a.length - 1] : 0;
        shift2 = sjcl.bitArray.getPartial(last2);
        out.push(sjcl.bitArray.partial(shift + shift2 & 31, (shift + shift2 > 32) ? carry : out.pop(), 1));
        return out
    },
    _xor4: function (x, y) {
        return [x[0] ^ y[0], x[1] ^ y[1], x[2] ^ y[2], x[3] ^ y[3]]
    },
    byteswapM: function (a) {
        var i, v, m = 0xff00;
        for (i = 0; i < a.length; ++i) {
            v = a[i];
            a[i] = (v >>> 24) | ((v >>> 8) & m) | ((v & m) << 8) | (v << 24)
        }
        return a
    }
};
sjcl.codec.utf8String = {
    fromBits: function (arr) {
        var out = "",
            bl = sjcl.bitArray.bitLength(arr),
            i, tmp;
        for (i = 0; i < bl / 8; i++) {
            if ((i & 3) === 0) {
                tmp = arr[i / 4]
            }
            out += String.fromCharCode(tmp >>> 24);
            tmp <<= 8
        }
        return decodeURIComponent(escape(out))
    },
    toBits: function (str) {
        str = unescape(encodeURIComponent(str));
        var out = [],
            i, tmp = 0;
        for (i = 0; i < str.length; i++) {
            tmp = tmp << 8 | str.charCodeAt(i);
            if ((i & 3) === 3) {
                out.push(tmp);
                tmp = 0
            }
        }
        if (i & 3) {
            out.push(sjcl.bitArray.partial(8 * (i & 3), tmp))
        }
        return out
    }
};
sjcl.codec.hex = {
    fromBits: function (arr) {
        var out = "",
            i;
        for (i = 0; i < arr.length; i++) {
            out += ((arr[i] | 0) + 0xF00000000000).toString(16).substr(4)
        }
        return out.substr(0, sjcl.bitArray.bitLength(arr) / 4)
    },
    toBits: function (str) {
        var i, out = [],
            len;
        str = (/\s|0x/g, "");
        len = str.length;
        str = str + "00000000";
        for (i = 0; i < str.length; i += 8) {
            out.push(parseInt(str.substr(i, 8), 16) ^ 0)
        }
        return sjcl.bitArray.clamp(out, len * 4)
    }
};
sjcl.codec.base32 = {
    _chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    _hexChars: "0123456789ABCDEFGHIJKLMNOPQRSTUV",
    BITS: 32,
    BASE: 5,
    REMAINING: 27,
    fromBits: function (arr, _noEquals, _hex) {
        var BITS = sjcl.codec.base32.BITS,
            BASE = sjcl.codec.base32.BASE,
            REMAINING = sjcl.codec.base32.REMAINING;
        var out = "",
            i, bits = 0,
            c = sjcl.codec.base32._chars,
            ta = 0,
            bl = sjcl.bitArray.bitLength(arr);
        if (_hex) {
            c = sjcl.codec.base32._hexChars
        }
        for (i = 0; out.length * BASE < bl;) {
            out += c.charAt((ta ^ arr[i] >>> bits) >>> REMAINING);
            if (bits < BASE) {
                ta = arr[i] << (BASE - bits);
                bits += REMAINING;
                i++
            } else {
                ta <<= BASE;
                bits -= BASE
            }
        }
        while ((out.length & 7) && !_noEquals) {
            out += "="
        }
        return out
    },
    toBits: function (str, _hex) {
        str = (/\s|=/g, '').toUpperCase();
        var BITS = sjcl.codec.base32.BITS,
            BASE = sjcl.codec.base32.BASE,
            REMAINING = sjcl.codec.base32.REMAINING;
        var out = [],
            i, bits = 0,
            c = sjcl.codec.base32._chars,
            ta = 0,
            x, format = "base32";
        if (_hex) {
            c = sjcl.codec.base32._hexChars;
            format = "base32hex"
        }
        for (i = 0; i < str.length; i++) {
            x = c.indexOf(str.charAt(i));
            if (x < 0) {
                if (!_hex) {
                    try {
                        return sjcl.codec.base32hex.toBits(str)
                    } catch (e) { }
                }
                throw new sjcl.exception.invalid("this isn't " + format + "!")
            }
            if (bits > REMAINING) {
                bits -= REMAINING;
                out.push(ta ^ x >>> bits);
                ta = x << (BITS - bits)
            } else {
                bits += BASE;
                ta ^= x << (BITS - bits)
            }
        }
        if (bits & 56) {
            out.push(sjcl.bitArray.partial(bits & 56, ta, 1))
        }
        return out
    }
};
sjcl.codec.base32hex = {
    fromBits: function (arr, _noEquals) {
        return sjcl.codec.base32.fromBits(arr, _noEquals, 1)
    },
    toBits: function (str) {
        return sjcl.codec.base32.toBits(str, 1)
    }
};
sjcl.codec.base64 = {
    _chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
    fromBits: function (arr, _noEquals, _url) {
        var out = "",
            i, bits = 0,
            c = sjcl.codec.base64._chars,
            ta = 0,
            bl = sjcl.bitArray.bitLength(arr);
        if (_url) {
            c = c.substr(0, 62) + '-_'
        }
        for (i = 0; out.length * 6 < bl;) {
            out += c.charAt((ta ^ arr[i] >>> bits) >>> 26);
            if (bits < 6) {
                ta = arr[i] << (6 - bits);
                bits += 26;
                i++
            } else {
                ta <<= 6;
                bits -= 6
            }
        }
        while ((out.length & 3) && !_noEquals) {
            out += "="
        }
        return out
    },
    toBits: function (str, _url) {
        str = (/\s|=/g, '');
        var out = [],
            i, bits = 0,
            c = sjcl.codec.base64._chars,
            ta = 0,
            x;
        if (_url) {
            c = c.substr(0, 62) + '-_'
        }
        for (i = 0; i < str.length; i++) {
            x = c.indexOf(str.charAt(i));
            if (x < 0) {
                throw new sjcl.exception.invalid("this isn't base64!")
            }
            if (bits > 26) {
                bits -= 26;
                out.push(ta ^ x >>> bits);
                ta = x << (32 - bits)
            } else {
                bits += 6;
                ta ^= x << (32 - bits)
            }
        }
        if (bits & 56) {
            out.push(sjcl.bitArray.partial(bits & 56, ta, 1))
        }
        return out
    }
};
sjcl.codec.base64url = {
    fromBits: function (arr) {
        return sjcl.codec.base64.fromBits(arr, 1, 1)
    },
    toBits: function (str) {
        return sjcl.codec.base64.toBits(str, 1)
    }
};
sjcl.codec.bytes = {
    fromBits: function (arr) {
        var out = [],
            bl = sjcl.bitArray.bitLength(arr),
            i, tmp;
        for (i = 0; i < bl / 8; i++) {
            if ((i & 3) === 0) {
                tmp = arr[i / 4]
            }
            out.push(tmp >>> 24);
            tmp <<= 8
        }
        return out
    },
    toBits: function (bytes) {
        var out = [],
            i, tmp = 0;
        for (i = 0; i < bytes.length; i++) {
            tmp = tmp << 8 | bytes[i];
            if ((i & 3) === 3) {
                out.push(tmp);
                tmp = 0
            }
        }
        if (i & 3) {
            out.push(sjcl.bitArray.partial(8 * (i & 3), tmp))
        }
        return out
    }
};
sjcl.codec.z85 = {
    _chars: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#",
    _byteMap: [0x00, 0x44, 0x00, 0x54, 0x53, 0x52, 0x48, 0x00, 0x4B, 0x4C, 0x46, 0x41, 0x00, 0x3F, 0x3E, 0x45, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x40, 0x00, 0x49, 0x42, 0x4A, 0x47, 0x51, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x4D, 0x00, 0x4E, 0x43, 0x00, 0x00, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F, 0x20, 0x21, 0x22, 0x23, 0x4F, 0x00, 0x50, 0x00, 0x00],
    fromBits: function (arr) {
        if (!arr) {
            return null
        }
        if (0 !== sjcl.bitArray.bitLength(arr) % 32) {
            throw new sjcl.exception.invalid("Invalid bitArray length!")
        }
        var out = "",
            c = sjcl.codec.z85._chars;
        for (var i = 0; i < arr.length; ++i) {
            var word = arr[i];
            var value = 0;
            for (var j = 0; j < 4; ++j) {
                var byteChunk = (word >>> 8 * (4 - j - 1)) & 0xFF;
                value = value * 256 + byteChunk
            }
            var divisor = 85 * 85 * 85 * 85;
            while (divisor) {
                out += c.charAt(Math.floor(value / divisor) % 85);
                divisor = Math.floor(divisor / 85)
            }
        }
        var encodedSize = arr.length * 5;
        if (out.length !== encodedSize) {
            throw new sjcl.exception.invalid("Bad Z85 conversion!")
        }
        return out
    },
    toBits: function (str) {
        if (!str) {
            return []
        }
        if (0 !== str.length % 5) {
            throw new sjcl.exception.invalid("Invalid Z85 string!")
        }
        var out = [],
            value = 0,
            byteMap = sjcl.codec.z85._byteMap;
        var word = 0,
            wordSize = 0;
        for (var i = 0; i < str.length;) {
            value = value * 85 + byteMap[str[i++].charCodeAt(0) - 32];
            if (0 === i % 5) {
                var divisor = 256 * 256 * 256;
                while (divisor) {
                    word = (word * Math.pow(2, 8)) + (Math.floor(value / divisor) % 256);
                    ++wordSize;
                    if (4 === wordSize) {
                        out.push(word);
                        word = 0, wordSize = 0
                    }
                    divisor = Math.floor(divisor / 256)
                }
                value = 0
            }
        }
        return out
    }
}
sjcl.hash.sha256 = function (hash) {
    if (!this._key[0]) {
        this._precompute()
    }
    if (hash) {
        this._h = hash._h.slice(0);
        this._buffer = hash._buffer.slice(0);
        this._length = hash._length
    } else {
        this.reset()
    }
};
sjcl.hash.sha256.hash = function (data) {
    return (new sjcl.hash.sha256()).update(data).finalize()
};
sjcl.hash.sha256.prototype = {
    blockSize: 512,
    reset: function () {
        this._h = this._init.slice(0);
        this._buffer = [];
        this._length = 0;
        return this
    },
    update: function (data) {
        if (typeof data === "string") {
            data = sjcl.codec.utf8String.toBits(data)
        }
        var i, b = this._buffer = sjcl.bitArray.concat(this._buffer, data),
            ol = this._length,
            nl = this._length = ol + sjcl.bitArray.bitLength(data);
        if (nl > 9007199254740991) {
            throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits")
        }
        if (typeof Uint32Array !== 'undefined') {
            var c = new Uint32Array(b);
            var j = 0;
            for (i = 512 + ol - ((512 + ol) & 511); i <= nl; i += 512) {
                this._block(c.subarray(16 * j, 16 * (j + 1)));
                j += 1
            }
            b.splice(0, 16 * j)
        } else {
            for (i = 512 + ol - ((512 + ol) & 511); i <= nl; i += 512) {
                this._block(b.splice(0, 16))
            }
        }
        return this
    },
    finalize: function () {
        var i, b = this._buffer,
            h = this._h;
        b = sjcl.bitArray.concat(b, [sjcl.bitArray.partial(1, 1)]);
        for (i = b.length + 2; i & 15; i++) {
            b.push(0)
        }
        b.push(Math.floor(this._length / 0x100000000));
        b.push(this._length | 0);
        while (b.length) {
            this._block(b.splice(0, 16))
        }
        this.reset();
        return h
    },
    _init: [],
    _key: [],
    _precompute: function () {
        var i = 0,
            prime = 2,
            factor, isPrime;

        function frac(x) {
            return (x - Math.floor(x)) * 0x100000000 | 0
        }
        for (; i < 64; prime++) {
            isPrime = !0;
            for (factor = 2; factor * factor <= prime; factor++) {
                if (prime % factor === 0) {
                    isPrime = !1;
                    break
                }
            }
            if (isPrime) {
                if (i < 8) {
                    this._init[i] = frac(Math.pow(prime, 1 / 2))
                }
                this._key[i] = frac(Math.pow(prime, 1 / 3));
                i++
            }
        }
    },
    _block: function (w) {
        var i, tmp, a, b, h = this._h,
            k = this._key,
            h0 = h[0],
            h1 = h[1],
            h2 = h[2],
            h3 = h[3],
            h4 = h[4],
            h5 = h[5],
            h6 = h[6],
            h7 = h[7];
        for (i = 0; i < 64; i++) {
            if (i < 16) {
                tmp = w[i]
            } else {
                a = w[(i + 1) & 15];
                b = w[(i + 14) & 15];
                tmp = w[i & 15] = ((a >>> 7 ^ a >>> 18 ^ a >>> 3 ^ a << 25 ^ a << 14) + (b >>> 17 ^ b >>> 19 ^ b >>> 10 ^ b << 15 ^ b << 13) + w[i & 15] + w[(i + 9) & 15]) | 0
            }
            tmp = (tmp + h7 + (h4 >>> 6 ^ h4 >>> 11 ^ h4 >>> 25 ^ h4 << 26 ^ h4 << 21 ^ h4 << 7) + (h6 ^ h4 & (h5 ^ h6)) + k[i]);
            h7 = h6;
            h6 = h5;
            h5 = h4;
            h4 = h3 + tmp | 0;
            h3 = h2;
            h2 = h1;
            h1 = h0;
            h0 = (tmp + ((h1 & h2) ^ (h3 & (h1 ^ h2))) + (h1 >>> 2 ^ h1 >>> 13 ^ h1 >>> 22 ^ h1 << 30 ^ h1 << 19 ^ h1 << 10)) | 0
        }
        h[0] = h[0] + h0 | 0;
        h[1] = h[1] + h1 | 0;
        h[2] = h[2] + h2 | 0;
        h[3] = h[3] + h3 | 0;
        h[4] = h[4] + h4 | 0;
        h[5] = h[5] + h5 | 0;
        h[6] = h[6] + h6 | 0;
        h[7] = h[7] + h7 | 0
    }
};
sjcl.hash.sha512 = function (hash) {
    if (!this._key[0]) {
        this._precompute()
    }
    if (hash) {
        this._h = hash._h.slice(0);
        this._buffer = hash._buffer.slice(0);
        this._length = hash._length
    } else {
        this.reset()
    }
};
sjcl.hash.sha512.hash = function (data) {
    return (new sjcl.hash.sha512()).update(data).finalize()
};
sjcl.hash.sha512.prototype = {
    blockSize: 1024,
    reset: function () {
        this._h = this._init.slice(0);
        this._buffer = [];
        this._length = 0;
        return this
    },
    update: function (data) {
        if (typeof data === "string") {
            data = sjcl.codec.utf8String.toBits(data)
        }
        var i, b = this._buffer = sjcl.bitArray.concat(this._buffer, data),
            ol = this._length,
            nl = this._length = ol + sjcl.bitArray.bitLength(data);
        if (nl > 9007199254740991) {
            throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits")
        }
        if (typeof Uint32Array !== 'undefined') {
            var c = new Uint32Array(b);
            var j = 0;
            for (i = 1024 + ol - ((1024 + ol) & 1023); i <= nl; i += 1024) {
                this._block(c.subarray(32 * j, 32 * (j + 1)));
                j += 1
            }
            b.splice(0, 32 * j)
        } else {
            for (i = 1024 + ol - ((1024 + ol) & 1023); i <= nl; i += 1024) {
                this._block(b.splice(0, 32))
            }
        }
        return this
    },
    finalize: function () {
        var i, b = this._buffer,
            h = this._h;
        b = sjcl.bitArray.concat(b, [sjcl.bitArray.partial(1, 1)]);
        for (i = b.length + 4; i & 31; i++) {
            b.push(0)
        }
        b.push(0);
        b.push(0);
        b.push(Math.floor(this._length / 0x100000000));
        b.push(this._length | 0);
        while (b.length) {
            this._block(b.splice(0, 32))
        }
        this.reset();
        return h
    },
    _init: [],
    _initr: [0xbcc908, 0xcaa73b, 0x94f82b, 0x1d36f1, 0xe682d1, 0x3e6c1f, 0x41bd6b, 0x7e2179],
    _key: [],
    _keyr: [0x28ae22, 0xef65cd, 0x4d3b2f, 0x89dbbc, 0x48b538, 0x05d019, 0x194f9b, 0x6d8118, 0x030242, 0x706fbe, 0xe4b28c, 0xffb4e2, 0x7b896f, 0x1696b1, 0xc71235, 0x692694, 0xf14ad2, 0x4f25e3, 0x8cd5b5, 0xac9c65, 0x2b0275, 0xa6e483, 0x41fbd4, 0x1153b5, 0x66dfab, 0xb43210, 0xfb213f, 0xef0ee4, 0xa88fc2, 0x0aa725, 0x03826f, 0x0e6e70, 0xd22ffc, 0x26c926, 0xc42aed, 0x95b3df, 0xaf63de, 0x77b2a8, 0xedaee6, 0x82353b, 0xf10364, 0x423001, 0xf89791, 0x54be30, 0xef5218, 0x65a910, 0x71202a, 0xbbd1b8, 0xd2d0c8, 0x41ab53, 0x8eeb99, 0x9b48a8, 0xc95a63, 0x418acb, 0x63e373, 0xb2b8a3, 0xefb2fc, 0x172f60, 0xf0ab72, 0x6439ec, 0x631e28, 0x82bde9, 0xc67915, 0x72532b, 0x26619c, 0xc0c207, 0xe0eb1e, 0x6ed178, 0x176fba, 0xc898a6, 0xf90dae, 0x1c471b, 0x047d84, 0xc72493, 0xc9bebc, 0x100d4c, 0x3e42b6, 0x657e2a, 0xd6faec, 0x475817],
    _precompute: function () {
        var i = 0,
            prime = 2,
            factor, isPrime;

        function frac(x) {
            return (x - Math.floor(x)) * 0x100000000 | 0
        }

        function frac2(x) {
            return (x - Math.floor(x)) * 0x10000000000 & 0xff
        }
        for (; i < 80; prime++) {
            isPrime = !0;
            for (factor = 2; factor * factor <= prime; factor++) {
                if (prime % factor === 0) {
                    isPrime = !1;
                    break
                }
            }
            if (isPrime) {
                if (i < 8) {
                    this._init[i * 2] = frac(Math.pow(prime, 1 / 2));
                    this._init[i * 2 + 1] = (frac2(Math.pow(prime, 1 / 2)) << 24) | this._initr[i]
                }
                this._key[i * 2] = frac(Math.pow(prime, 1 / 3));
                this._key[i * 2 + 1] = (frac2(Math.pow(prime, 1 / 3)) << 24) | this._keyr[i];
                i++
            }
        }
    },
    _block: function (words) {
        var i, wrh, wrl, h = this._h,
            k = this._key,
            h0h = h[0],
            h0l = h[1],
            h1h = h[2],
            h1l = h[3],
            h2h = h[4],
            h2l = h[5],
            h3h = h[6],
            h3l = h[7],
            h4h = h[8],
            h4l = h[9],
            h5h = h[10],
            h5l = h[11],
            h6h = h[12],
            h6l = h[13],
            h7h = h[14],
            h7l = h[15];
        var w;
        if (typeof Uint32Array !== 'undefined') {
            w = Array(160);
            for (var j = 0; j < 32; j++) {
                w[j] = words[j]
            }
        } else {
            w = words
        }
        var ah = h0h,
            al = h0l,
            bh = h1h,
            bl = h1l,
            ch = h2h,
            cl = h2l,
            dh = h3h,
            dl = h3l,
            eh = h4h,
            el = h4l,
            fh = h5h,
            fl = h5l,
            gh = h6h,
            gl = h6l,
            hh = h7h,
            hl = h7l;
        for (i = 0; i < 80; i++) {
            if (i < 16) {
                wrh = w[i * 2];
                wrl = w[i * 2 + 1]
            } else {
                var gamma0xh = w[(i - 15) * 2];
                var gamma0xl = w[(i - 15) * 2 + 1];
                var gamma0h = ((gamma0xl << 31) | (gamma0xh >>> 1)) ^ ((gamma0xl << 24) | (gamma0xh >>> 8)) ^ (gamma0xh >>> 7);
                var gamma0l = ((gamma0xh << 31) | (gamma0xl >>> 1)) ^ ((gamma0xh << 24) | (gamma0xl >>> 8)) ^ ((gamma0xh << 25) | (gamma0xl >>> 7));
                var gamma1xh = w[(i - 2) * 2];
                var gamma1xl = w[(i - 2) * 2 + 1];
                var gamma1h = ((gamma1xl << 13) | (gamma1xh >>> 19)) ^ ((gamma1xh << 3) | (gamma1xl >>> 29)) ^ (gamma1xh >>> 6);
                var gamma1l = ((gamma1xh << 13) | (gamma1xl >>> 19)) ^ ((gamma1xl << 3) | (gamma1xh >>> 29)) ^ ((gamma1xh << 26) | (gamma1xl >>> 6));
                var wr7h = w[(i - 7) * 2];
                var wr7l = w[(i - 7) * 2 + 1];
                var wr16h = w[(i - 16) * 2];
                var wr16l = w[(i - 16) * 2 + 1];
                wrl = gamma0l + wr7l;
                wrh = gamma0h + wr7h + ((wrl >>> 0) < (gamma0l >>> 0) ? 1 : 0);
                wrl += gamma1l;
                wrh += gamma1h + ((wrl >>> 0) < (gamma1l >>> 0) ? 1 : 0);
                wrl += wr16l;
                wrh += wr16h + ((wrl >>> 0) < (wr16l >>> 0) ? 1 : 0)
            }
            w[i * 2] = wrh |= 0;
            w[i * 2 + 1] = wrl |= 0;
            var chh = (eh & fh) ^ (~eh & gh);
            var chl = (el & fl) ^ (~el & gl);
            var majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
            var majl = (al & bl) ^ (al & cl) ^ (bl & cl);
            var sigma0h = ((al << 4) | (ah >>> 28)) ^ ((ah << 30) | (al >>> 2)) ^ ((ah << 25) | (al >>> 7));
            var sigma0l = ((ah << 4) | (al >>> 28)) ^ ((al << 30) | (ah >>> 2)) ^ ((al << 25) | (ah >>> 7));
            var sigma1h = ((el << 18) | (eh >>> 14)) ^ ((el << 14) | (eh >>> 18)) ^ ((eh << 23) | (el >>> 9));
            var sigma1l = ((eh << 18) | (el >>> 14)) ^ ((eh << 14) | (el >>> 18)) ^ ((el << 23) | (eh >>> 9));
            var krh = k[i * 2];
            var krl = k[i * 2 + 1];
            var t1l = hl + sigma1l;
            var t1h = hh + sigma1h + ((t1l >>> 0) < (hl >>> 0) ? 1 : 0);
            t1l += chl;
            t1h += chh + ((t1l >>> 0) < (chl >>> 0) ? 1 : 0);
            t1l += krl;
            t1h += krh + ((t1l >>> 0) < (krl >>> 0) ? 1 : 0);
            t1l = t1l + wrl | 0;
            t1h += wrh + ((t1l >>> 0) < (wrl >>> 0) ? 1 : 0);
            var t2l = sigma0l + majl;
            var t2h = sigma0h + majh + ((t2l >>> 0) < (sigma0l >>> 0) ? 1 : 0);
            hh = gh;
            hl = gl;
            gh = fh;
            gl = fl;
            fh = eh;
            fl = el;
            el = (dl + t1l) | 0;
            eh = (dh + t1h + ((el >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
            dh = ch;
            dl = cl;
            ch = bh;
            cl = bl;
            bh = ah;
            bl = al;
            al = (t1l + t2l) | 0;
            ah = (t1h + t2h + ((al >>> 0) < (t1l >>> 0) ? 1 : 0)) | 0
        }
        h0l = h[1] = (h0l + al) | 0;
        h[0] = (h0h + ah + ((h0l >>> 0) < (al >>> 0) ? 1 : 0)) | 0;
        h1l = h[3] = (h1l + bl) | 0;
        h[2] = (h1h + bh + ((h1l >>> 0) < (bl >>> 0) ? 1 : 0)) | 0;
        h2l = h[5] = (h2l + cl) | 0;
        h[4] = (h2h + ch + ((h2l >>> 0) < (cl >>> 0) ? 1 : 0)) | 0;
        h3l = h[7] = (h3l + dl) | 0;
        h[6] = (h3h + dh + ((h3l >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
        h4l = h[9] = (h4l + el) | 0;
        h[8] = (h4h + eh + ((h4l >>> 0) < (el >>> 0) ? 1 : 0)) | 0;
        h5l = h[11] = (h5l + fl) | 0;
        h[10] = (h5h + fh + ((h5l >>> 0) < (fl >>> 0) ? 1 : 0)) | 0;
        h6l = h[13] = (h6l + gl) | 0;
        h[12] = (h6h + gh + ((h6l >>> 0) < (gl >>> 0) ? 1 : 0)) | 0;
        h7l = h[15] = (h7l + hl) | 0;
        h[14] = (h7h + hh + ((h7l >>> 0) < (hl >>> 0) ? 1 : 0)) | 0
    }
};
sjcl.hash.sha1 = function (hash) {
    if (hash) {
        this._h = hash._h.slice(0);
        this._buffer = hash._buffer.slice(0);
        this._length = hash._length
    } else {
        this.reset()
    }
};
sjcl.hash.sha1.hash = function (data) {
    return (new sjcl.hash.sha1()).update(data).finalize()
};
sjcl.hash.sha1.prototype = {
    blockSize: 512,
    reset: function () {
        this._h = this._init.slice(0);
        this._buffer = [];
        this._length = 0;
        return this
    },
    update: function (data) {
        if (typeof data === "string") {
            data = sjcl.codec.utf8String.toBits(data)
        }
        var i, b = this._buffer = sjcl.bitArray.concat(this._buffer, data),
            ol = this._length,
            nl = this._length = ol + sjcl.bitArray.bitLength(data);
        if (nl > 9007199254740991) {
            throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits")
        }
        if (typeof Uint32Array !== 'undefined') {
            var c = new Uint32Array(b);
            var j = 0;
            for (i = this.blockSize + ol - ((this.blockSize + ol) & (this.blockSize - 1)); i <= nl; i += this.blockSize) {
                this._block(c.subarray(16 * j, 16 * (j + 1)));
                j += 1
            }
            b.splice(0, 16 * j)
        } else {
            for (i = this.blockSize + ol - ((this.blockSize + ol) & (this.blockSize - 1)); i <= nl; i += this.blockSize) {
                this._block(b.splice(0, 16))
            }
        }
        return this
    },
    finalize: function () {
        var i, b = this._buffer,
            h = this._h;
        b = sjcl.bitArray.concat(b, [sjcl.bitArray.partial(1, 1)]);
        for (i = b.length + 2; i & 15; i++) {
            b.push(0)
        }
        b.push(Math.floor(this._length / 0x100000000));
        b.push(this._length | 0);
        while (b.length) {
            this._block(b.splice(0, 16))
        }
        this.reset();
        return h
    },
    _init: [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0],
    _key: [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6],
    _f: function (t, b, c, d) {
        if (t <= 19) {
            return (b & c) | (~b & d)
        } else if (t <= 39) {
            return b ^ c ^ d
        } else if (t <= 59) {
            return (b & c) | (b & d) | (c & d)
        } else if (t <= 79) {
            return b ^ c ^ d
        }
    },
    _S: function (n, x) {
        return (x << n) | (x >>> 32 - n)
    },
    _block: function (words) {
        var t, tmp, a, b, c, d, e, h = this._h;
        var w;
        if (typeof Uint32Array !== 'undefined') {
            w = Array(80);
            for (var j = 0; j < 16; j++) {
                w[j] = words[j]
            }
        } else {
            w = words
        }
        a = h[0];
        b = h[1];
        c = h[2];
        d = h[3];
        e = h[4];
        for (t = 0; t <= 79; t++) {
            if (t >= 16) {
                w[t] = this._S(1, w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16])
            }
            tmp = (this._S(5, a) + this._f(t, b, c, d) + e + w[t] + this._key[Math.floor(t / 20)]) | 0;
            e = d;
            d = c;
            c = this._S(30, b);
            b = a;
            a = tmp
        }
        h[0] = (h[0] + a) | 0;
        h[1] = (h[1] + b) | 0;
        h[2] = (h[2] + c) | 0;
        h[3] = (h[3] + d) | 0;
        h[4] = (h[4] + e) | 0
    }
};
sjcl.mode.ccm = {
    name: "ccm",
    _progressListeners: [],
    listenProgress: function (cb) {
        sjcl.mode.ccm._progressListeners.push(cb)
    },
    unListenProgress: function (cb) {
        var index = sjcl.mode.ccm._progressListeners.indexOf(cb);
        if (index > -1) {
            sjcl.mode.ccm._progressListeners.splice(index, 1)
        }
    },
    _callProgressListener: function (val) {
        var p = sjcl.mode.ccm._progressListeners.slice(),
            i;
        for (i = 0; i < p.length; i += 1) {
            p[i](val)
        }
    },
    encrypt: function (prf, plaintext, iv, adata, tlen) {
        var L, out = plaintext.slice(0),
            tag, w = sjcl.bitArray,
            ivl = w.bitLength(iv) / 8,
            ol = w.bitLength(out) / 8;
        tlen = tlen || 64;
        adata = adata || [];
        if (ivl < 7) {
            throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes")
        }
        for (L = 2; L < 4 && ol >>> 8 * L; L++) { }
        if (L < 15 - ivl) {
            L = 15 - ivl
        }
        iv = w.clamp(iv, 8 * (15 - L));
        tag = sjcl.mode.ccm._computeTag(prf, plaintext, iv, adata, tlen, L);
        out = sjcl.mode.ccm._ctrMode(prf, out, iv, tag, tlen, L);
        return w.concat(out.data, out.tag)
    },
    decrypt: function (prf, ciphertext, iv, adata, tlen) {
        tlen = tlen || 64;
        adata = adata || [];
        var L, w = sjcl.bitArray,
            ivl = w.bitLength(iv) / 8,
            ol = w.bitLength(ciphertext),
            out = w.clamp(ciphertext, ol - tlen),
            tag = w.bitSlice(ciphertext, ol - tlen),
            tag2;
        ol = (ol - tlen) / 8;
        if (ivl < 7) {
            throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes")
        }
        for (L = 2; L < 4 && ol >>> 8 * L; L++) { }
        if (L < 15 - ivl) {
            L = 15 - ivl
        }
        iv = w.clamp(iv, 8 * (15 - L));
        out = sjcl.mode.ccm._ctrMode(prf, out, iv, tag, tlen, L);
        tag2 = sjcl.mode.ccm._computeTag(prf, out.data, iv, adata, tlen, L);
        if (!w.equal(out.tag, tag2)) {
            throw new sjcl.exception.corrupt("ccm: tag doesn't match")
        }
        return out.data
    },
    _macAdditionalData: function (prf, adata, iv, tlen, ol, L) {
        var mac, tmp, i, macData = [],
            w = sjcl.bitArray,
            xor = w._xor4;
        mac = [w.partial(8, (adata.length ? 1 << 6 : 0) | (tlen - 2) << 2 | L - 1)];
        mac = w.concat(mac, iv);
        mac[3] |= ol;
        mac = prf.encrypt(mac);
        if (adata.length) {
            tmp = w.bitLength(adata) / 8;
            if (tmp <= 0xFEFF) {
                macData = [w.partial(16, tmp)]
            } else if (tmp <= 0xFFFFFFFF) {
                macData = w.concat([w.partial(16, 0xFFFE)], [tmp])
            }
            macData = w.concat(macData, adata);
            for (i = 0; i < macData.length; i += 4) {
                mac = prf.encrypt(xor(mac, macData.slice(i, i + 4).concat([0, 0, 0])))
            }
        }
        return mac
    },
    _computeTag: function (prf, plaintext, iv, adata, tlen, L) {
        var mac, i, w = sjcl.bitArray,
            xor = w._xor4;
        tlen /= 8;
        if (tlen % 2 || tlen < 4 || tlen > 16) {
            throw new sjcl.exception.invalid("ccm: invalid tag length")
        }
        if (adata.length > 0xFFFFFFFF || plaintext.length > 0xFFFFFFFF) {
            throw new sjcl.exception.bug("ccm: can't deal with 4GiB or more data")
        }
        mac = sjcl.mode.ccm._macAdditionalData(prf, adata, iv, tlen, w.bitLength(plaintext) / 8, L);
        for (i = 0; i < plaintext.length; i += 4) {
            mac = prf.encrypt(xor(mac, plaintext.slice(i, i + 4).concat([0, 0, 0])))
        }
        return w.clamp(mac, tlen * 8)
    },
    _ctrMode: function (prf, data, iv, tag, tlen, L) {
        var enc, i, w = sjcl.bitArray,
            xor = w._xor4,
            ctr, l = data.length,
            bl = w.bitLength(data),
            n = l / 50,
            p = n;
        ctr = w.concat([w.partial(8, L - 1)], iv).concat([0, 0, 0]).slice(0, 4);
        tag = w.bitSlice(xor(tag, prf.encrypt(ctr)), 0, tlen);
        if (!l) {
            return {
                tag: tag,
                data: []
            }
        }
        for (i = 0; i < l; i += 4) {
            if (i > n) {
                sjcl.mode.ccm._callProgressListener(i / l);
                n += p
            }
            ctr[3]++;
            enc = prf.encrypt(ctr);
            data[i] ^= enc[0];
            data[i + 1] ^= enc[1];
            data[i + 2] ^= enc[2];
            data[i + 3] ^= enc[3]
        }
        return {
            tag: tag,
            data: w.clamp(data, bl)
        }
    }
};
if (sjcl.beware === undefined) {
    sjcl.beware = {}
}
sjcl.beware["CTR mode is dangerous because it doesn't protect message integrity."] = function () {
    sjcl.mode.ctr = {
        name: "ctr",
        encrypt: function (prf, plaintext, iv, adata) {
            return sjcl.mode.ctr._calculate(prf, plaintext, iv, adata)
        },
        decrypt: function (prf, ciphertext, iv, adata) {
            return sjcl.mode.ctr._calculate(prf, ciphertext, iv, adata)
        },
        _calculate: function (prf, data, iv, adata) {
            var l, bl, res, c, d, e, i;
            if (adata && adata.length) {
                throw new sjcl.exception.invalid("ctr can't authenticate data")
            }
            if (sjcl.bitArray.bitLength(iv) !== 128) {
                throw new sjcl.exception.invalid("ctr iv must be 128 bits")
            }
            if (!(l = data.length)) {
                return []
            }
            c = iv.slice(0);
            d = data.slice(0);
            bl = sjcl.bitArray.bitLength(d);
            for (i = 0; i < l; i += 4) {
                e = prf.encrypt(c);
                d[i] ^= e[0];
                d[i + 1] ^= e[1];
                d[i + 2] ^= e[2];
                d[i + 3] ^= e[3];
                c[3]++
            }
            return sjcl.bitArray.clamp(d, bl)
        }
    }
};
if (sjcl.beware === undefined) {
    sjcl.beware = {}
}
sjcl.beware["CBC mode is dangerous because it doesn't protect message integrity."] = function () {
    sjcl.mode.cbc = {
        name: "cbc",
        encrypt: function (prp, plaintext, iv, adata) {
            if (adata && adata.length) {
                throw new sjcl.exception.invalid("cbc can't authenticate data")
            }
            if (sjcl.bitArray.bitLength(iv) !== 128) {
                throw new sjcl.exception.invalid("cbc iv must be 128 bits")
            }
            var i, w = sjcl.bitArray,
                xor = w._xor4,
                bl = w.bitLength(plaintext),
                bp = 0,
                output = [];
            if (bl & 7) {
                throw new sjcl.exception.invalid("pkcs#5 padding only works for multiples of a byte")
            }
            for (i = 0; bp + 128 <= bl; i += 4, bp += 128) {
                iv = prp.encrypt(xor(iv, plaintext.slice(i, i + 4)));
                output.splice(i, 0, iv[0], iv[1], iv[2], iv[3])
            }
            bl = (16 - ((bl >> 3) & 15)) * 0x1010101;
            iv = prp.encrypt(xor(iv, w.concat(plaintext, [bl, bl, bl, bl]).slice(i, i + 4)));
            output.splice(i, 0, iv[0], iv[1], iv[2], iv[3]);
            return output
        },
        decrypt: function (prp, ciphertext, iv, adata) {
            if (adata && adata.length) {
                throw new sjcl.exception.invalid("cbc can't authenticate data")
            }
            if (sjcl.bitArray.bitLength(iv) !== 128) {
                throw new sjcl.exception.invalid("cbc iv must be 128 bits")
            }
            if ((sjcl.bitArray.bitLength(ciphertext) & 127) || !ciphertext.length) {
                throw new sjcl.exception.corrupt("cbc ciphertext must be a positive multiple of the block size")
            }
            var i, w = sjcl.bitArray,
                xor = w._xor4,
                bi, bo, output = [];
            adata = adata || [];
            for (i = 0; i < ciphertext.length; i += 4) {
                bi = ciphertext.slice(i, i + 4);
                bo = xor(iv, prp.decrypt(bi));
                output.splice(i, 0, bo[0], bo[1], bo[2], bo[3]);
                iv = bi
            }
            bi = output[i - 1] & 255;
            if (bi === 0 || bi > 16) {
                throw new sjcl.exception.corrupt("pkcs#5 padding corrupt")
            }
            bo = bi * 0x1010101;
            if (!w.equal(w.bitSlice([bo, bo, bo, bo], 0, bi * 8), w.bitSlice(output, output.length * 32 - bi * 8, output.length * 32))) {
                throw new sjcl.exception.corrupt("pkcs#5 padding corrupt")
            }
            return w.bitSlice(output, 0, output.length * 32 - bi * 8)
        }
    }
};
sjcl.mode.ocb2 = {
    name: "ocb2",
    encrypt: function (prp, plaintext, iv, adata, tlen, premac) {
        if (sjcl.bitArray.bitLength(iv) !== 128) {
            throw new sjcl.exception.invalid("ocb iv must be 128 bits")
        }
        var i, times2 = sjcl.mode.ocb2._times2,
            w = sjcl.bitArray,
            xor = w._xor4,
            checksum = [0, 0, 0, 0],
            delta = times2(prp.encrypt(iv)),
            bi, bl, output = [],
            pad;
        adata = adata || [];
        tlen = tlen || 64;
        for (i = 0; i + 4 < plaintext.length; i += 4) {
            bi = plaintext.slice(i, i + 4);
            checksum = xor(checksum, bi);
            output = output.concat(xor(delta, prp.encrypt(xor(delta, bi))));
            delta = times2(delta)
        }
        bi = plaintext.slice(i);
        bl = w.bitLength(bi);
        pad = prp.encrypt(xor(delta, [0, 0, 0, bl]));
        bi = w.clamp(xor(bi.concat([0, 0, 0]), pad), bl);
        checksum = xor(checksum, xor(bi.concat([0, 0, 0]), pad));
        checksum = prp.encrypt(xor(checksum, xor(delta, times2(delta))));
        if (adata.length) {
            checksum = xor(checksum, premac ? adata : sjcl.mode.ocb2.pmac(prp, adata))
        }
        return output.concat(w.concat(bi, w.clamp(checksum, tlen)))
    },
    decrypt: function (prp, ciphertext, iv, adata, tlen, premac) {
        if (sjcl.bitArray.bitLength(iv) !== 128) {
            throw new sjcl.exception.invalid("ocb iv must be 128 bits")
        }
        tlen = tlen || 64;
        var i, times2 = sjcl.mode.ocb2._times2,
            w = sjcl.bitArray,
            xor = w._xor4,
            checksum = [0, 0, 0, 0],
            delta = times2(prp.encrypt(iv)),
            bi, bl, len = sjcl.bitArray.bitLength(ciphertext) - tlen,
            output = [],
            pad;
        adata = adata || [];
        for (i = 0; i + 4 < len / 32; i += 4) {
            bi = xor(delta, prp.decrypt(xor(delta, ciphertext.slice(i, i + 4))));
            checksum = xor(checksum, bi);
            output = output.concat(bi);
            delta = times2(delta)
        }
        bl = len - i * 32;
        pad = prp.encrypt(xor(delta, [0, 0, 0, bl]));
        bi = xor(pad, w.clamp(ciphertext.slice(i), bl).concat([0, 0, 0]));
        checksum = xor(checksum, bi);
        checksum = prp.encrypt(xor(checksum, xor(delta, times2(delta))));
        if (adata.length) {
            checksum = xor(checksum, premac ? adata : sjcl.mode.ocb2.pmac(prp, adata))
        }
        if (!w.equal(w.clamp(checksum, tlen), w.bitSlice(ciphertext, len))) {
            throw new sjcl.exception.corrupt("ocb: tag doesn't match")
        }
        return output.concat(w.clamp(bi, bl))
    },
    pmac: function (prp, adata) {
        var i, times2 = sjcl.mode.ocb2._times2,
            w = sjcl.bitArray,
            xor = w._xor4,
            checksum = [0, 0, 0, 0],
            delta = prp.encrypt([0, 0, 0, 0]),
            bi;
        delta = xor(delta, times2(times2(delta)));
        for (i = 0; i + 4 < adata.length; i += 4) {
            delta = times2(delta);
            checksum = xor(checksum, prp.encrypt(xor(delta, adata.slice(i, i + 4))))
        }
        bi = adata.slice(i);
        if (w.bitLength(bi) < 128) {
            delta = xor(delta, times2(delta));
            bi = w.concat(bi, [0x80000000 | 0, 0, 0, 0])
        }
        checksum = xor(checksum, bi);
        return prp.encrypt(xor(times2(xor(delta, times2(delta))), checksum))
    },
    _times2: function (x) {
        return [x[0] << 1 ^ x[1] >>> 31, x[1] << 1 ^ x[2] >>> 31, x[2] << 1 ^ x[3] >>> 31, x[3] << 1 ^ (x[0] >>> 31) * 0x87]
    }
};
sjcl.mode.ocb2progressive = {
    createEncryptor: function (prp, iv, adata, tlen, premac) {
        if (sjcl.bitArray.bitLength(iv) !== 128) {
            throw new sjcl.exception.invalid("ocb iv must be 128 bits")
        }
        var i, times2 = sjcl.mode.ocb2._times2,
            w = sjcl.bitArray,
            xor = w._xor4,
            checksum = [0, 0, 0, 0],
            delta = times2(prp.encrypt(iv)),
            bi, bl, datacache = [],
            pad;
        adata = adata || [];
        tlen = tlen || 64;
        return {
            process: function (data) {
                var datalen = sjcl.bitArray.bitLength(data);
                if (datalen == 0) {
                    return []
                }
                var output = [];
                datacache = datacache.concat(data);
                for (i = 0; i + 4 < datacache.length; i += 4) {
                    bi = datacache.slice(i, i + 4);
                    checksum = xor(checksum, bi);
                    output = output.concat(xor(delta, prp.encrypt(xor(delta, bi))));
                    delta = times2(delta)
                }
                datacache = datacache.slice(i);
                return output
            },
            finalize: function () {
                bi = datacache;
                bl = w.bitLength(bi);
                pad = prp.encrypt(xor(delta, [0, 0, 0, bl]));
                bi = w.clamp(xor(bi.concat([0, 0, 0]), pad), bl);
                checksum = xor(checksum, xor(bi.concat([0, 0, 0]), pad));
                checksum = prp.encrypt(xor(checksum, xor(delta, times2(delta))));
                if (adata.length) {
                    checksum = xor(checksum, premac ? adata : sjcl.mode.ocb2.pmac(prp, adata))
                }
                return w.concat(bi, w.clamp(checksum, tlen))
            }
        }
    },
    createDecryptor: function (prp, iv, adata, tlen, premac) {
        if (sjcl.bitArray.bitLength(iv) !== 128) {
            throw new sjcl.exception.invalid("ocb iv must be 128 bits")
        }
        tlen = tlen || 64;
        var i, times2 = sjcl.mode.ocb2._times2,
            w = sjcl.bitArray,
            xor = w._xor4,
            checksum = [0, 0, 0, 0],
            delta = times2(prp.encrypt(iv)),
            bi, bl, datacache = [],
            pad;
        adata = adata || [];
        return {
            process: function (data) {
                if (data.length == 0) {
                    return []
                }
                var output = [];
                datacache = datacache.concat(data);
                var cachelen = sjcl.bitArray.bitLength(datacache);
                for (i = 0; i + 4 < (cachelen - tlen) / 32; i += 4) {
                    bi = xor(delta, prp.decrypt(xor(delta, datacache.slice(i, i + 4))));
                    checksum = xor(checksum, bi);
                    output = output.concat(bi);
                    delta = times2(delta)
                }
                datacache = datacache.slice(i);
                return output
            },
            finalize: function () {
                bl = sjcl.bitArray.bitLength(datacache) - tlen;
                pad = prp.encrypt(xor(delta, [0, 0, 0, bl]));
                bi = xor(pad, w.clamp(datacache, bl).concat([0, 0, 0]));
                checksum = xor(checksum, bi);
                checksum = prp.encrypt(xor(checksum, xor(delta, times2(delta))));
                if (adata.length) {
                    checksum = xor(checksum, premac ? adata : sjcl.mode.ocb2.pmac(prp, adata))
                }
                if (!w.equal(w.clamp(checksum, tlen), w.bitSlice(datacache, bl))) {
                    throw new sjcl.exception.corrupt("ocb: tag doesn't match")
                }
                return w.clamp(bi, bl)
            }
        }
    }
};
sjcl.mode.gcm = {
    name: "gcm",
    encrypt: function (prf, plaintext, iv, adata, tlen) {
        var out, data = plaintext.slice(0),
            w = sjcl.bitArray;
        tlen = tlen || 128;
        adata = adata || [];
        out = sjcl.mode.gcm._ctrMode(!0, prf, data, adata, iv, tlen);
        return w.concat(out.data, out.tag)
    },
    decrypt: function (prf, ciphertext, iv, adata, tlen) {
        var out, data = ciphertext.slice(0),
            tag, w = sjcl.bitArray,
            l = w.bitLength(data);
        tlen = tlen || 128;
        adata = adata || [];
        if (tlen <= l) {
            tag = w.bitSlice(data, l - tlen);
            data = w.bitSlice(data, 0, l - tlen)
        } else {
            tag = data;
            data = []
        }
        out = sjcl.mode.gcm._ctrMode(!1, prf, data, adata, iv, tlen);
        if (!w.equal(out.tag, tag)) {
            throw new sjcl.exception.corrupt("gcm: tag doesn't match")
        }
        return out.data
    },
    _galoisMultiply: function (x, y) {
        var i, j, xi, Zi, Vi, lsb_Vi, w = sjcl.bitArray,
            xor = w._xor4;
        Zi = [0, 0, 0, 0];
        Vi = y.slice(0);
        for (i = 0; i < 128; i++) {
            xi = (x[Math.floor(i / 32)] & (1 << (31 - i % 32))) !== 0;
            if (xi) {
                Zi = xor(Zi, Vi)
            }
            lsb_Vi = (Vi[3] & 1) !== 0;
            for (j = 3; j > 0; j--) {
                Vi[j] = (Vi[j] >>> 1) | ((Vi[j - 1] & 1) << 31)
            }
            Vi[0] = Vi[0] >>> 1;
            if (lsb_Vi) {
                Vi[0] = Vi[0] ^ (0xe1 << 24)
            }
        }
        return Zi
    },
    _ghash: function (H, Y0, data) {
        var Yi, i, l = data.length;
        Yi = Y0.slice(0);
        for (i = 0; i < l; i += 4) {
            Yi[0] ^= 0xffffffff & data[i];
            Yi[1] ^= 0xffffffff & data[i + 1];
            Yi[2] ^= 0xffffffff & data[i + 2];
            Yi[3] ^= 0xffffffff & data[i + 3];
            Yi = sjcl.mode.gcm._galoisMultiply(Yi, H)
        }
        return Yi
    },
    _ctrMode: function (encrypt, prf, data, adata, iv, tlen) {
        var H, J0, S0, enc, i, ctr, tag, last, l, bl, abl, ivbl, w = sjcl.bitArray;
        l = data.length;
        bl = w.bitLength(data);
        abl = w.bitLength(adata);
        ivbl = w.bitLength(iv);
        H = prf.encrypt([0, 0, 0, 0]);
        if (ivbl === 96) {
            J0 = iv.slice(0);
            J0 = w.concat(J0, [1])
        } else {
            J0 = sjcl.mode.gcm._ghash(H, [0, 0, 0, 0], iv);
            J0 = sjcl.mode.gcm._ghash(H, J0, [0, 0, Math.floor(ivbl / 0x100000000), ivbl & 0xffffffff])
        }
        S0 = sjcl.mode.gcm._ghash(H, [0, 0, 0, 0], adata);
        ctr = J0.slice(0);
        tag = S0.slice(0);
        if (!encrypt) {
            tag = sjcl.mode.gcm._ghash(H, S0, data)
        }
        for (i = 0; i < l; i += 4) {
            ctr[3]++;
            enc = prf.encrypt(ctr);
            data[i] ^= enc[0];
            data[i + 1] ^= enc[1];
            data[i + 2] ^= enc[2];
            data[i + 3] ^= enc[3]
        }
        data = w.clamp(data, bl);
        if (encrypt) {
            tag = sjcl.mode.gcm._ghash(H, S0, data)
        }
        last = [Math.floor(abl / 0x100000000), abl & 0xffffffff, Math.floor(bl / 0x100000000), bl & 0xffffffff];
        tag = sjcl.mode.gcm._ghash(H, tag, last);
        enc = prf.encrypt(J0);
        tag[0] ^= enc[0];
        tag[1] ^= enc[1];
        tag[2] ^= enc[2];
        tag[3] ^= enc[3];
        return {
            tag: w.bitSlice(tag, 0, tlen),
            data: data
        }
    }
};
sjcl.misc.hmac = function (key, Hash) {
    this._hash = Hash = Hash || sjcl.hash.sha256;
    var exKey = [
        [],
        []
    ],
        i, bs = Hash.prototype.blockSize / 32;
    this._baseHash = [new Hash(), new Hash()];
    if (key.length > bs) {
        key = Hash.hash(key)
    }
    for (i = 0; i < bs; i++) {
        exKey[0][i] = key[i] ^ 0x36363636;
        exKey[1][i] = key[i] ^ 0x5C5C5C5C
    }
    this._baseHash[0].update(exKey[0]);
    this._baseHash[1].update(exKey[1]);
    this._resultHash = new Hash(this._baseHash[0])
};
sjcl.misc.hmac.prototype.encrypt = sjcl.misc.hmac.prototype.mac = function (data) {
    if (!this._updated) {
        this.update(data);
        return this.digest(data)
    } else {
        throw new sjcl.exception.invalid("encrypt on already updated hmac called!")
    }
};
sjcl.misc.hmac.prototype.reset = function () {
    this._resultHash = new this._hash(this._baseHash[0]);
    this._updated = !1
};
sjcl.misc.hmac.prototype.update = function (data) {
    this._updated = !0;
    this._resultHash.update(data)
};
sjcl.misc.hmac.prototype.digest = function () {
    var w = this._resultHash.finalize(),
        result = new (this._hash)(this._baseHash[1]).update(w).finalize();
    this.reset();
    return result
};
sjcl.misc.pbkdf2 = function (password, salt, count, length, Prff) {
    count = count || 10000;
    if (length < 0 || count < 0) {
        throw new sjcl.exception.invalid("invalid params to pbkdf2")
    }
    if (typeof password === "string") {
        password = sjcl.codec.utf8String.toBits(password)
    }
    if (typeof salt === "string") {
        salt = sjcl.codec.utf8String.toBits(salt)
    }
    Prff = Prff || sjcl.misc.hmac;
    var prf = new Prff(password),
        u, ui, i, j, k, out = [],
        b = sjcl.bitArray;
    for (k = 1; 32 * out.length < (length || 1); k++) {
        u = ui = prf.encrypt(b.concat(salt, [k]));
        for (i = 1; i < count; i++) {
            ui = prf.encrypt(ui);
            for (j = 0; j < ui.length; j++) {
                u[j] ^= ui[j]
            }
        }
        out = out.concat(u)
    }
    if (length) {
        out = b.clamp(out, length)
    }
    return out
};
sjcl.misc.scrypt = function (password, salt, N, r, p, length, Prff) {
    var SIZE_MAX = Math.pow(2, 32) - 1,
        self = sjcl.misc.scrypt;
    N = N || 16384;
    r = r || 8;
    p = p || 1;
    if (r * p >= Math.pow(2, 30)) {
        throw sjcl.exception.invalid("The parameters r, p must satisfy r * p < 2^30")
    }
    if ((N < 2) || (N & (N - 1) != 0)) {
        throw sjcl.exception.invalid("The parameter N must be a power of 2.")
    }
    if (N > SIZE_MAX / 128 / r) {
        throw sjcl.exception.invalid("N too big.")
    }
    if (r > SIZE_MAX / 128 / p) {
        throw sjcl.exception.invalid("r too big.")
    }
    var blocks = sjcl.misc.pbkdf2(password, salt, 1, p * 128 * r * 8, Prff),
        len = blocks.length / p;
    self.reverse(blocks);
    for (var i = 0; i < p; i++) {
        var block = blocks.slice(i * len, (i + 1) * len);
        self.blockcopy(self.ROMix(block, N), 0, blocks, i * len)
    }
    self.reverse(blocks);
    return sjcl.misc.pbkdf2(password, blocks, 1, length, Prff)
};
sjcl.misc.scrypt.salsa20Core = function (word, rounds) {
    var R = function (a, b) {
        return (a << b) | (a >>> (32 - b))
    };
    var x = word.slice(0);
    for (var i = rounds; i > 0; i -= 2) {
        x[4] ^= R(x[0] + x[12], 7);
        x[8] ^= R(x[4] + x[0], 9);
        x[12] ^= R(x[8] + x[4], 13);
        x[0] ^= R(x[12] + x[8], 18);
        x[9] ^= R(x[5] + x[1], 7);
        x[13] ^= R(x[9] + x[5], 9);
        x[1] ^= R(x[13] + x[9], 13);
        x[5] ^= R(x[1] + x[13], 18);
        x[14] ^= R(x[10] + x[6], 7);
        x[2] ^= R(x[14] + x[10], 9);
        x[6] ^= R(x[2] + x[14], 13);
        x[10] ^= R(x[6] + x[2], 18);
        x[3] ^= R(x[15] + x[11], 7);
        x[7] ^= R(x[3] + x[15], 9);
        x[11] ^= R(x[7] + x[3], 13);
        x[15] ^= R(x[11] + x[7], 18);
        x[1] ^= R(x[0] + x[3], 7);
        x[2] ^= R(x[1] + x[0], 9);
        x[3] ^= R(x[2] + x[1], 13);
        x[0] ^= R(x[3] + x[2], 18);
        x[6] ^= R(x[5] + x[4], 7);
        x[7] ^= R(x[6] + x[5], 9);
        x[4] ^= R(x[7] + x[6], 13);
        x[5] ^= R(x[4] + x[7], 18);
        x[11] ^= R(x[10] + x[9], 7);
        x[8] ^= R(x[11] + x[10], 9);
        x[9] ^= R(x[8] + x[11], 13);
        x[10] ^= R(x[9] + x[8], 18);
        x[12] ^= R(x[15] + x[14], 7);
        x[13] ^= R(x[12] + x[15], 9);
        x[14] ^= R(x[13] + x[12], 13);
        x[15] ^= R(x[14] + x[13], 18)
    }
    for (i = 0; i < 16; i++) word[i] = x[i] + word[i]
};
sjcl.misc.scrypt.blockMix = function (blocks) {
    var X = blocks.slice(-16),
        out = [],
        len = blocks.length / 16,
        self = sjcl.misc.scrypt;
    for (var i = 0; i < len; i++) {
        self.blockxor(blocks, 16 * i, X, 0, 16);
        self.salsa20Core(X, 8);
        if ((i & 1) == 0) {
            self.blockcopy(X, 0, out, 8 * i)
        } else {
            self.blockcopy(X, 0, out, 8 * (i ^ 1 + len))
        }
    }
    return out
};
sjcl.misc.scrypt.ROMix = function (block, N) {
    var X = block.slice(0),
        V = [],
        self = sjcl.misc.scrypt;
    for (var i = 0; i < N; i++) {
        V.push(X.slice(0));
        X = self.blockMix(X)
    }
    for (i = 0; i < N; i++) {
        var j = X[X.length - 16] & (N - 1);
        self.blockxor(V[j], 0, X, 0);
        X = self.blockMix(X)
    }
    return X
};
sjcl.misc.scrypt.reverse = function (words) {
    for (var i in words) {
        var out = words[i] & 0xFF;
        out = (out << 8) | (words[i] >>> 8) & 0xFF;
        out = (out << 8) | (words[i] >>> 16) & 0xFF;
        out = (out << 8) | (words[i] >>> 24) & 0xFF;
        words[i] = out
    }
};
sjcl.misc.scrypt.blockcopy = function (S, Si, D, Di, len) {
    var i;
    len = len || (S.length - Si);
    for (i = 0; i < len; i++) D[Di + i] = S[Si + i] | 0
};
sjcl.misc.scrypt.blockxor = function (S, Si, D, Di, len) {
    var i;
    len = len || (S.length - Si);
    for (i = 0; i < len; i++) D[Di + i] = (D[Di + i] ^ S[Si + i]) | 0
};
sjcl.prng = function (defaultParanoia) {
    this._pools = [new sjcl.hash.sha256()];
    this._poolEntropy = [0];
    this._reseedCount = 0;
    this._robins = {};
    this._eventId = 0;
    this._collectorIds = {};
    this._collectorIdNext = 0;
    this._strength = 0;
    this._poolStrength = 0;
    this._nextReseed = 0;
    this._key = [0, 0, 0, 0, 0, 0, 0, 0];
    this._counter = [0, 0, 0, 0];
    this._cipher = undefined;
    this._defaultParanoia = defaultParanoia;
    this._collectorsStarted = !1;
    this._callbacks = {
        progress: {},
        seeded: {}
    };
    this._callbackI = 0;
    this._NOT_READY = 0;
    this._READY = 1;
    this._REQUIRES_RESEED = 2;
    this._MAX_WORDS_PER_BURST = 65536;
    this._PARANOIA_LEVELS = [0, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024];
    this._MILLISECONDS_PER_RESEED = 30000;
    this._BITS_PER_RESEED = 80
};
sjcl.prng.prototype = {
    randomWords: function (nwords, paranoia) {
        var out = [],
            i, readiness = this.isReady(paranoia),
            g;
        if (readiness === this._NOT_READY) {
            throw new sjcl.exception.notReady("generator isn't seeded")
        } else if (readiness & this._REQUIRES_RESEED) {
            this._reseedFromPools(!(readiness & this._READY))
        }
        for (i = 0; i < nwords; i += 4) {
            if ((i + 1) % this._MAX_WORDS_PER_BURST === 0) {
                this._gate()
            }
            g = this._gen4words();
            out.push(g[0], g[1], g[2], g[3])
        }
        this._gate();
        return out.slice(0, nwords)
    },
    setDefaultParanoia: function (paranoia, allowZeroParanoia) {
        if (paranoia === 0 && allowZeroParanoia !== "Setting paranoia=0 will ruin your security; use it only for testing") {
            throw new sjcl.exception.invalid("Setting paranoia=0 will ruin your security; use it only for testing")
        }
        this._defaultParanoia = paranoia
    },
    addEntropy: function (data, estimatedEntropy, source) {
        source = source || "user";
        var id, i, tmp, t = (new Date()).valueOf(),
            robin = this._robins[source],
            oldReady = this.isReady(),
            err = 0,
            objName;
        id = this._collectorIds[source];
        if (id === undefined) {
            id = this._collectorIds[source] = this._collectorIdNext++
        }
        if (robin === undefined) {
            robin = this._robins[source] = 0
        }
        this._robins[source] = (this._robins[source] + 1) % this._pools.length;
        switch (typeof (data)) {
            case "number":
                if (estimatedEntropy === undefined) {
                    estimatedEntropy = 1
                }
                this._pools[robin].update([id, this._eventId++, 1, estimatedEntropy, t, 1, data | 0]);
                break;
            case "object":
                objName = Object.prototype.toString.call(data);
                if (objName === "[object Uint32Array]") {
                    tmp = [];
                    for (i = 0; i < data.length; i++) {
                        tmp.push(data[i])
                    }
                    data = tmp
                } else {
                    if (objName !== "[object Array]") {
                        err = 1
                    }
                    for (i = 0; i < data.length && !err; i++) {
                        if (typeof (data[i]) !== "number") {
                            err = 1
                        }
                    }
                }
                if (!err) {
                    if (estimatedEntropy === undefined) {
                        estimatedEntropy = 0;
                        for (i = 0; i < data.length; i++) {
                            tmp = data[i];
                            while (tmp > 0) {
                                estimatedEntropy++;
                                tmp = tmp >>> 1
                            }
                        }
                    }
                    this._pools[robin].update([id, this._eventId++, 2, estimatedEntropy, t, data.length].concat(data))
                }
                break;
            case "string":
                if (estimatedEntropy === undefined) {
                    estimatedEntropy = data.length
                }
                this._pools[robin].update([id, this._eventId++, 3, estimatedEntropy, t, data.length]);
                this._pools[robin].update(data);
                break;
            default:
                err = 1
        }
        if (err) {
            throw new sjcl.exception.bug("random: addEntropy only supports number, array of numbers or string")
        }
        this._poolEntropy[robin] += estimatedEntropy;
        this._poolStrength += estimatedEntropy;
        if (oldReady === this._NOT_READY) {
            if (this.isReady() !== this._NOT_READY) {
                this._fireEvent("seeded", Math.max(this._strength, this._poolStrength))
            }
            this._fireEvent("progress", this.getProgress())
        }
    },
    isReady: function (paranoia) {
        var entropyRequired = this._PARANOIA_LEVELS[(paranoia !== undefined) ? paranoia : this._defaultParanoia];
        if (this._strength && this._strength >= entropyRequired) {
            return (this._poolEntropy[0] > this._BITS_PER_RESEED && (new Date()).valueOf() > this._nextReseed) ? this._REQUIRES_RESEED | this._READY : this._READY
        } else {
            return (this._poolStrength >= entropyRequired) ? this._REQUIRES_RESEED | this._NOT_READY : this._NOT_READY
        }
    },
    getProgress: function (paranoia) {
        var entropyRequired = this._PARANOIA_LEVELS[paranoia ? paranoia : this._defaultParanoia];
        if (this._strength >= entropyRequired) {
            return 1.0
        } else {
            return (this._poolStrength > entropyRequired) ? 1.0 : this._poolStrength / entropyRequired
        }
    },
    startCollectors: function () {
        if (this._collectorsStarted) {
            return
        }
        this._eventListener = {
            loadTimeCollector: this._bind(this._loadTimeCollector),
            mouseCollector: this._bind(this._mouseCollector),
            keyboardCollector: this._bind(this._keyboardCollector),
            accelerometerCollector: this._bind(this._accelerometerCollector),
            touchCollector: this._bind(this._touchCollector)
        };
        if (window.addEventListener) {
            window.addEventListener("load", this._eventListener.loadTimeCollector, !1);
            window.addEventListener("mousemove", this._eventListener.mouseCollector, !1);
            window.addEventListener("keypress", this._eventListener.keyboardCollector, !1);
            window.addEventListener("devicemotion", this._eventListener.accelerometerCollector, !1);
            window.addEventListener("touchmove", this._eventListener.touchCollector, !1)
        } else if (document.attachEvent) {
            document.attachEvent("onload", this._eventListener.loadTimeCollector);
            document.attachEvent("onmousemove", this._eventListener.mouseCollector);
            document.attachEvent("keypress", this._eventListener.keyboardCollector)
        } else {
            throw new sjcl.exception.bug("can't attach event")
        }
        this._collectorsStarted = !0
    },
    stopCollectors: function () {
        if (!this._collectorsStarted) {
            return
        }
        if (window.removeEventListener) {
            window.removeEventListener("load", this._eventListener.loadTimeCollector, !1);
            window.removeEventListener("mousemove", this._eventListener.mouseCollector, !1);
            window.removeEventListener("keypress", this._eventListener.keyboardCollector, !1);
            window.removeEventListener("devicemotion", this._eventListener.accelerometerCollector, !1);
            window.removeEventListener("touchmove", this._eventListener.touchCollector, !1)
        } else if (document.detachEvent) {
            document.detachEvent("onload", this._eventListener.loadTimeCollector);
            document.detachEvent("onmousemove", this._eventListener.mouseCollector);
            document.detachEvent("keypress", this._eventListener.keyboardCollector)
        }
        this._collectorsStarted = !1
    },
    addEventListener: function (name, callback) {
        this._callbacks[name][this._callbackI++] = callback
    },
    removeEventListener: function (name, cb) {
        var i, j, cbs = this._callbacks[name],
            jsTemp = [];
        for (j in cbs) {
            if (cbs.hasOwnProperty(j) && cbs[j] === cb) {
                jsTemp.push(j)
            }
        }
        for (i = 0; i < jsTemp.length; i++) {
            j = jsTemp[i];
            delete cbs[j]
        }
    },
    _bind: function (func) {
        var that = this;
        return function () {
            func.apply(that, arguments)
        }
    },
    _gen4words: function () {
        for (var i = 0; i < 4; i++) {
            this._counter[i] = this._counter[i] + 1 | 0;
            if (this._counter[i]) {
                break
            }
        }
        return this._cipher.encrypt(this._counter)
    },
    _gate: function () {
        this._key = this._gen4words().concat(this._gen4words());
        this._cipher = new sjcl.cipher.aes(this._key)
    },
    _reseed: function (seedWords) {
        this._key = sjcl.hash.sha256.hash(this._key.concat(seedWords));
        this._cipher = new sjcl.cipher.aes(this._key);
        for (var i = 0; i < 4; i++) {
            this._counter[i] = this._counter[i] + 1 | 0;
            if (this._counter[i]) {
                break
            }
        }
    },
    _reseedFromPools: function (full) {
        var reseedData = [],
            strength = 0,
            i;
        this._nextReseed = reseedData[0] = (new Date()).valueOf() + this._MILLISECONDS_PER_RESEED;
        for (i = 0; i < 16; i++) {
            reseedData.push(Math.random() * 0x100000000 | 0)
        }
        for (i = 0; i < this._pools.length; i++) {
            reseedData = reseedData.concat(this._pools[i].finalize());
            strength += this._poolEntropy[i];
            this._poolEntropy[i] = 0;
            if (!full && (this._reseedCount & (1 << i))) {
                break
            }
        }
        if (this._reseedCount >= 1 << this._pools.length) {
            this._pools.push(new sjcl.hash.sha256());
            this._poolEntropy.push(0)
        }
        this._poolStrength -= strength;
        if (strength > this._strength) {
            this._strength = strength
        }
        this._reseedCount++;
        this._reseed(reseedData)
    },
    _keyboardCollector: function () {
        this._addCurrentTimeToEntropy(1)
    },
    _mouseCollector: function (ev) {
        var x, y;
        try {
            x = ev.x || ev.clientX || ev.offsetX || 0;
            y = ev.y || ev.clientY || ev.offsetY || 0
        } catch (err) {
            x = 0;
            y = 0
        }
        if (x != 0 && y != 0) {
            this.addEntropy([x, y], 2, "mouse")
        }
        this._addCurrentTimeToEntropy(0)
    },
    _touchCollector: function (ev) {
        var touch = ev.touches[0] || ev.changedTouches[0];
        var x = touch.pageX || touch.clientX,
            y = touch.pageY || touch.clientY;
        this.addEntropy([x, y], 1, "touch");
        this._addCurrentTimeToEntropy(0)
    },
    _loadTimeCollector: function () {
        this._addCurrentTimeToEntropy(2)
    },
    _addCurrentTimeToEntropy: function (estimatedEntropy) {
        if (typeof window !== 'undefined' && window.performance && typeof window.performance.now === "function") {
            this.addEntropy(window.performance.now(), estimatedEntropy, "loadtime")
        } else {
            this.addEntropy((new Date()).valueOf(), estimatedEntropy, "loadtime")
        }
    },
    _accelerometerCollector: function (ev) {
        var ac = ev.accelerationIncludingGravity.x || ev.accelerationIncludingGravity.y || ev.accelerationIncludingGravity.z;
        if (window.orientation) {
            var or = window.orientation;
            if (typeof or === "number") {
                this.addEntropy(or, 1, "accelerometer")
            }
        }
        if (ac) {
            this.addEntropy(ac, 2, "accelerometer")
        }
        this._addCurrentTimeToEntropy(0)
    },
    _fireEvent: function (name, arg) {
        var j, cbs = sjcl.random._callbacks[name],
            cbsTemp = [];
        for (j in cbs) {
            if (cbs.hasOwnProperty(j)) {
                cbsTemp.push(cbs[j])
            }
        }
        for (j = 0; j < cbsTemp.length; j++) {
            cbsTemp[j](arg)
        }
    }
};
sjcl.random = new sjcl.prng(6);
(function () {
    function getCryptoModule() {
        try {
            return require('crypto')
        } catch (e) {
            return null
        }
    }
    try {
        var buf, crypt, ab;
        if (typeof module !== 'undefined' && module.exports && (crypt = getCryptoModule()) && crypt.randomBytes) {
            buf = crypt.randomBytes(1024 / 8);
            buf = new Uint32Array(new Uint8Array(buf).buffer);
            sjcl.random.addEntropy(buf, 1024, "crypto.randomBytes")
        } else if (typeof window !== 'undefined' && typeof Uint32Array !== 'undefined') {
            ab = new Uint32Array(32);
            if (window.crypto && window.crypto.getRandomValues) {
                window.crypto.getRandomValues(ab)
            } else if (window.msCrypto && window.msCrypto.getRandomValues) {
                window.msCrypto.getRandomValues(ab)
            } else {
                return
            }
            sjcl.random.addEntropy(ab, 1024, "crypto.getRandomValues")
        } else { }
    } catch (e) {
        if (typeof window !== 'undefined' && window.console) {
            console.log("There was an error collecting entropy from the browser:");
            console.log(e)
        }
    }
}());
sjcl.json = {
    defaults: {
        v: 1,
        iter: 10000,
        ks: 128,
        ts: 64,
        mode: "ccm",
        adata: "",
        cipher: "aes"
    },
    _encrypt: function (password, plaintext, params, rp) {
        params = params || {};
        rp = rp || {};
        var j = sjcl.json,
            p = j._add({
                iv: sjcl.random.randomWords(4, 0)
            }, j.defaults),
            tmp, prp, adata;
        j._add(p, params);
        adata = p.adata;
        if (typeof p.salt === "string") {
            p.salt = sjcl.codec.base64.toBits(p.salt)
        }
        if (typeof p.iv === "string") {
            p.iv = sjcl.codec.base64.toBits(p.iv)
        }
        if (!sjcl.mode[p.mode] || !sjcl.cipher[p.cipher] || (typeof password === "string" && p.iter <= 100) || (p.ts !== 64 && p.ts !== 96 && p.ts !== 128) || (p.ks !== 128 && p.ks !== 192 && p.ks !== 256) || (p.iv.length < 2 || p.iv.length > 4)) {
            throw new sjcl.exception.invalid("json encrypt: invalid parameters")
        }
        if (typeof password === "string") {
            tmp = sjcl.misc.cachedPbkdf2(password, p);
            password = tmp.key.slice(0, p.ks / 32);
            p.salt = tmp.salt
        } else if (sjcl.ecc && password instanceof sjcl.ecc.elGamal.publicKey) {
            tmp = password.kem();
            p.kemtag = tmp.tag;
            password = tmp.key.slice(0, p.ks / 32)
        }
        if (typeof plaintext === "string") {
            plaintext = sjcl.codec.utf8String.toBits(plaintext)
        }
        if (typeof adata === "string") {
            p.adata = adata = sjcl.codec.utf8String.toBits(adata)
        }
        prp = new sjcl.cipher[p.cipher](password);
        j._add(rp, p);
        rp.key = password;
        if (p.mode === "ccm" && sjcl.arrayBuffer && sjcl.arrayBuffer.ccm && plaintext instanceof ArrayBuffer) {
            p.ct = sjcl.arrayBuffer.ccm.encrypt(prp, plaintext, p.iv, adata, p.ts)
        } else {
            p.ct = sjcl.mode[p.mode].encrypt(prp, plaintext, p.iv, adata, p.ts)
        }
        return p
    },
    encrypt: function (password, plaintext, params, rp) {
        var j = sjcl.json,
            p = j._encrypt.apply(j, arguments);
        return j.encode(p)
    },
    _decrypt: function (password, ciphertext, params, rp) {
        params = params || {};
        rp = rp || {};
        var j = sjcl.json,
            p = j._add(j._add(j._add({}, j.defaults), ciphertext), params, !0),
            ct, tmp, prp, adata = p.adata;
        if (typeof p.salt === "string") {
            p.salt = sjcl.codec.base64.toBits(p.salt)
        }
        if (typeof p.iv === "string") {
            p.iv = sjcl.codec.base64.toBits(p.iv)
        }
        if (!sjcl.mode[p.mode] || !sjcl.cipher[p.cipher] || (typeof password === "string" && p.iter <= 100) || (p.ts !== 64 && p.ts !== 96 && p.ts !== 128) || (p.ks !== 128 && p.ks !== 192 && p.ks !== 256) || (!p.iv) || (p.iv.length < 2 || p.iv.length > 4)) {
            throw new sjcl.exception.invalid("json decrypt: invalid parameters")
        }
        if (typeof password === "string") {
            tmp = sjcl.misc.cachedPbkdf2(password, p);
            password = tmp.key.slice(0, p.ks / 32);
            p.salt = tmp.salt
        } else if (sjcl.ecc && password instanceof sjcl.ecc.elGamal.secretKey) {
            password = password.unkem(sjcl.codec.base64.toBits(p.kemtag)).slice(0, p.ks / 32)
        }
        if (typeof adata === "string") {
            adata = sjcl.codec.utf8String.toBits(adata)
        }
        prp = new sjcl.cipher[p.cipher](password);
        if (p.mode === "ccm" && sjcl.arrayBuffer && sjcl.arrayBuffer.ccm && p.ct instanceof ArrayBuffer) {
            ct = sjcl.arrayBuffer.ccm.decrypt(prp, p.ct, p.iv, p.tag, adata, p.ts)
        } else {
            ct = sjcl.mode[p.mode].decrypt(prp, p.ct, p.iv, adata, p.ts)
        }
        j._add(rp, p);
        rp.key = password;
        if (params.raw === 1) {
            return ct
        } else {
            return sjcl.codec.utf8String.fromBits(ct)
        }
    },
    decrypt: function (password, ciphertext, params, rp) {
        var j = sjcl.json;
        return j._decrypt(password, j.decode(ciphertext), params, rp)
    },
    encode: function (obj) {
        var i, out = '{',
            comma = '';
        for (i in obj) {
            if (obj.hasOwnProperty(i)) {
                if (!i.match(/^[a-z0-9]+$/i)) {
                    throw new sjcl.exception.invalid("json encode: invalid property name")
                }
                out += comma + '"' + i + '":';
                comma = ',';
                switch (typeof obj[i]) {
                    case 'number':
                    case 'boolean':
                        out += obj[i];
                        break;
                    case 'string':
                        out += '"' + escape(obj[i]) + '"';
                        break;
                    case 'object':
                        out += '"' + sjcl.codec.base64.fromBits(obj[i], 0) + '"';
                        break;
                    default:
                        throw new sjcl.exception.bug("json encode: unsupported type")
                }
            }
        }
        return out + '}'
    },
    decode: function (str) {
        str = (/\s/g, '');
        if (!str.match(/^\{.*\}$/)) {
            throw new sjcl.exception.invalid("json decode: this isn't json!")
        }
        var a = (/^\{|\}$/g, '')(/,/),
            out = {},
            i, m;
        for (i = 0; i < a.length; i++) {
            if (!(m = a[i].match(/^\s*(?:(["']?)([a-z][a-z0-9]*)\1)\s*:\s*(?:(-?\d+)|"([a-z0-9+\/%*_.@=\-]*)"|(true|false))$/i))) {
                throw new sjcl.exception.invalid("json decode: this isn't json!")
            }
            if (m[3] != null) {
                out[m[2]] = parseInt(m[3], 10)
            } else if (m[4] != null) {
                out[m[2]] = m[2].match(/^(ct|adata|salt|iv)$/) ? sjcl.codec.base64.toBits(m[4]) : unescape(m[4])
            } else if (m[5] != null) {
                out[m[2]] = m[5] === 'true'
            }
        }
        return out
    },
    _add: function (target, src, requireSame) {
        if (target === undefined) {
            target = {}
        }
        if (src === undefined) {
            return target
        }
        var i;
        for (i in src) {
            if (src.hasOwnProperty(i)) {
                if (requireSame && target[i] !== undefined && target[i] !== src[i]) {
                    throw new sjcl.exception.invalid("required parameter overridden")
                }
                target[i] = src[i]
            }
        }
        return target
    },
    _subtract: function (plus, minus) {
        var out = {},
            i;
        for (i in plus) {
            if (plus.hasOwnProperty(i) && plus[i] !== minus[i]) {
                out[i] = plus[i]
            }
        }
        return out
    },
    _filter: function (src, filter) {
        var out = {},
            i;
        for (i = 0; i < filter.length; i++) {
            if (src[filter[i]] !== undefined) {
                out[filter[i]] = src[filter[i]]
            }
        }
        return out
    }
};
sjcl.encrypt = sjcl.json.encrypt;
sjcl.decrypt = sjcl.json.decrypt;
sjcl.misc._pbkdf2Cache = {};
sjcl.misc.cachedPbkdf2 = function (password, obj) {
    var cache = sjcl.misc._pbkdf2Cache,
        c, cp, str, salt, iter;
    obj = obj || {};
    iter = obj.iter || 1000;
    cp = cache[password] = cache[password] || {};
    c = cp[iter] = cp[iter] || {
        firstSalt: (obj.salt && obj.salt.length) ? obj.salt.slice(0) : sjcl.random.randomWords(2, 0)
    };
    salt = (obj.salt === undefined) ? c.firstSalt : obj.salt;
    c[salt] = c[salt] || sjcl.misc.pbkdf2(password, salt, obj.iter);
    return {
        key: c[salt].slice(0),
        salt: salt.slice(0)
    }
};
sjcl.bn = function (it) {
    this.initWith(it)
};
sjcl.bn.prototype = {
    radix: 24,
    maxMul: 8,
    _class: sjcl.bn,
    copy: function () {
        return new this._class(this)
    },
    initWith: function (it) {
        var i = 0,
            k;
        switch (typeof it) {
            case "object":
                this.limbs = it.limbs.slice(0);
                break;
            case "number":
                this.limbs = [it];
                this.normalize();
                break;
            case "string":
                it = (/^0x/, '');
                this.limbs = [];
                k = this.radix / 4;
                for (i = 0; i < it.length; i += k) {
                    this.limbs.push(parseInt(it.substring(Math.max(it.length - i - k, 0), it.length - i), 16))
                }
                break;
            default:
                this.limbs = [0]
        }
        return this
    },
    equals: function (that) {
        if (typeof that === "number") {
            that = new this._class(that)
        }
        var difference = 0,
            i;
        this.fullReduce();
        that.fullReduce();
        for (i = 0; i < this.limbs.length || i < that.limbs.length; i++) {
            difference |= this.getLimb(i) ^ that.getLimb(i)
        }
        return (difference === 0)
    },
    getLimb: function (i) {
        return (i >= this.limbs.length) ? 0 : this.limbs[i]
    },
    greaterEquals: function (that) {
        if (typeof that === "number") {
            that = new this._class(that)
        }
        var less = 0,
            greater = 0,
            i, a, b;
        i = Math.max(this.limbs.length, that.limbs.length) - 1;
        for (; i >= 0; i--) {
            a = this.getLimb(i);
            b = that.getLimb(i);
            greater |= (b - a) & ~less;
            less |= (a - b) & ~greater
        }
        return (greater | ~less) >>> 31
    },
    toString: function () {
        this.fullReduce();
        var out = "",
            i, s, l = this.limbs;
        for (i = 0; i < this.limbs.length; i++) {
            s = l[i].toString(16);
            while (i < this.limbs.length - 1 && s.length < 6) {
                s = "0" + s
            }
            out = s + out
        }
        return "0x" + out
    },
    addM: function (that) {
        if (typeof (that) !== "object") {
            that = new this._class(that)
        }
        var i, l = this.limbs,
            ll = that.limbs;
        for (i = l.length; i < ll.length; i++) {
            l[i] = 0
        }
        for (i = 0; i < ll.length; i++) {
            l[i] += ll[i]
        }
        return this
    },
    doubleM: function () {
        var i, carry = 0,
            tmp, r = this.radix,
            m = this.radixMask,
            l = this.limbs;
        for (i = 0; i < l.length; i++) {
            tmp = l[i];
            tmp = tmp + tmp + carry;
            l[i] = tmp & m;
            carry = tmp >> r
        }
        if (carry) {
            l.push(carry)
        }
        return this
    },
    halveM: function () {
        var i, carry = 0,
            tmp, r = this.radix,
            l = this.limbs;
        for (i = l.length - 1; i >= 0; i--) {
            tmp = l[i];
            l[i] = (tmp + carry) >> 1;
            carry = (tmp & 1) << r
        }
        if (!l[l.length - 1]) {
            l.pop()
        }
        return this
    },
    subM: function (that) {
        if (typeof (that) !== "object") {
            that = new this._class(that)
        }
        var i, l = this.limbs,
            ll = that.limbs;
        for (i = l.length; i < ll.length; i++) {
            l[i] = 0
        }
        for (i = 0; i < ll.length; i++) {
            l[i] -= ll[i]
        }
        return this
    },
    mod: function (that) {
        var neg = !this.greaterEquals(new sjcl.bn(0));
        that = new sjcl.bn(that).normalize();
        var out = new sjcl.bn(this).normalize(),
            ci = 0;
        if (neg) out = (new sjcl.bn(0)).subM(out).normalize();
        for (; out.greaterEquals(that); ci++) {
            that.doubleM()
        }
        if (neg) out = that.sub(out).normalize();
        for (; ci > 0; ci--) {
            that.halveM();
            if (out.greaterEquals(that)) {
                out.subM(that).normalize()
            }
        }
        return out.trim()
    },
    inverseMod: function (p) {
        var a = new sjcl.bn(1),
            b = new sjcl.bn(0),
            x = new sjcl.bn(this),
            y = new sjcl.bn(p),
            tmp, i, nz = 1;
        if (!(p.limbs[0] & 1)) {
            throw (new sjcl.exception.invalid("inverseMod: p must be odd"))
        }
        do {
            if (x.limbs[0] & 1) {
                if (!x.greaterEquals(y)) {
                    tmp = x;
                    x = y;
                    y = tmp;
                    tmp = a;
                    a = b;
                    b = tmp
                }
                x.subM(y);
                x.normalize();
                if (!a.greaterEquals(b)) {
                    a.addM(p)
                }
                a.subM(b)
            }
            x.halveM();
            if (a.limbs[0] & 1) {
                a.addM(p)
            }
            a.normalize();
            a.halveM();
            for (i = nz = 0; i < x.limbs.length; i++) {
                nz |= x.limbs[i]
            }
        } while (nz);
        if (!y.equals(1)) {
            throw (new sjcl.exception.invalid("inverseMod: p and x must be relatively prime"))
        }
        return b
    },
    add: function (that) {
        return this.copy().addM(that)
    },
    sub: function (that) {
        return this.copy().subM(that)
    },
    mul: function (that) {
        if (typeof (that) === "number") {
            that = new this._class(that)
        }
        var i, j, a = this.limbs,
            b = that.limbs,
            al = a.length,
            bl = b.length,
            out = new this._class(),
            c = out.limbs,
            ai, ii = this.maxMul;
        for (i = 0; i < this.limbs.length + that.limbs.length + 1; i++) {
            c[i] = 0
        }
        for (i = 0; i < al; i++) {
            ai = a[i];
            for (j = 0; j < bl; j++) {
                c[i + j] += ai * b[j]
            }
            if (!--ii) {
                ii = this.maxMul;
                out.cnormalize()
            }
        }
        return out.cnormalize().reduce()
    },
    square: function () {
        return this.mul(this)
    },
    power: function (l) {
        l = new sjcl.bn(l).normalize().trim().limbs;
        var i, j, out = new this._class(1),
            pow = this;
        for (i = 0; i < l.length; i++) {
            for (j = 0; j < this.radix; j++) {
                if (l[i] & (1 << j)) {
                    out = out.mul(pow)
                }
                if (i == (l.length - 1) && l[i] >> (j + 1) == 0) {
                    break
                }
                pow = pow.square()
            }
        }
        return out
    },
    mulmod: function (that, N) {
        return this.mod(N).mul(that.mod(N)).mod(N)
    },
    powermod: function (x, N) {
        x = new sjcl.bn(x);
        N = new sjcl.bn(N);
        if ((N.limbs[0] & 1) == 1) {
            var montOut = this.montpowermod(x, N);
            if (montOut != !1) {
                return montOut
            }
        }
        var i, j, l = x.normalize().trim().limbs,
            out = new this._class(1),
            pow = this;
        for (i = 0; i < l.length; i++) {
            for (j = 0; j < this.radix; j++) {
                if (l[i] & (1 << j)) {
                    out = out.mulmod(pow, N)
                }
                if (i == (l.length - 1) && l[i] >> (j + 1) == 0) {
                    break
                }
                pow = pow.mulmod(pow, N)
            }
        }
        return out
    },
    montpowermod: function (x, N) {
        x = new sjcl.bn(x).normalize().trim();
        N = new sjcl.bn(N);
        var i, j, radix = this.radix,
            out = new this._class(1),
            pow = this.copy();
        var R, s, wind, bitsize = x.bitLength();
        R = new sjcl.bn({
            limbs: N.copy().normalize().trim().limbs.map(function () {
                return 0
            })
        });
        for (s = this.radix; s > 0; s--) {
            if (((N.limbs[N.limbs.length - 1] >> s) & 1) == 1) {
                R.limbs[R.limbs.length - 1] = 1 << s;
                break
            }
        }
        if (bitsize == 0) {
            return this
        } else if (bitsize < 18) {
            wind = 1
        } else if (bitsize < 48) {
            wind = 3
        } else if (bitsize < 144) {
            wind = 4
        } else if (bitsize < 768) {
            wind = 5
        } else {
            wind = 6
        }
        var RR = R.copy(),
            NN = N.copy(),
            RP = new sjcl.bn(1),
            NP = new sjcl.bn(0),
            RT = R.copy();
        while (RT.greaterEquals(1)) {
            RT.halveM();
            if ((RP.limbs[0] & 1) == 0) {
                RP.halveM();
                NP.halveM()
            } else {
                RP.addM(NN);
                RP.halveM();
                NP.halveM();
                NP.addM(RR)
            }
        }
        RP = RP.normalize();
        NP = NP.normalize();
        RR.doubleM();
        var R2 = RR.mulmod(RR, N);
        if (!RR.mul(RP).sub(N.mul(NP)).equals(1)) {
            return !1
        }
        var montIn = function (c) {
            return montMul(c, R2)
        },
            montMul = function (a, b) {
                var k, carry, ab, right, abBar, mask = (1 << (s + 1)) - 1;
                ab = a.mul(b);
                right = ab.mul(NP);
                right.limbs = right.limbs.slice(0, R.limbs.length);
                if (right.limbs.length == R.limbs.length) {
                    right.limbs[R.limbs.length - 1] &= mask
                }
                right = right.mul(N);
                abBar = ab.add(right).normalize().trim();
                abBar.limbs = abBar.limbs.slice(R.limbs.length - 1);
                for (k = 0; k < abBar.limbs.length; k++) {
                    if (k > 0) {
                        abBar.limbs[k - 1] |= (abBar.limbs[k] & mask) << (radix - s - 1)
                    }
                    abBar.limbs[k] = abBar.limbs[k] >> (s + 1)
                }
                if (abBar.greaterEquals(N)) {
                    abBar.subM(N)
                }
                return abBar
            },
            montOut = function (c) {
                return montMul(c, 1)
            };
        pow = montIn(pow);
        out = montIn(out);
        var h, precomp = {},
            cap = (1 << (wind - 1)) - 1;
        precomp[1] = pow.copy();
        precomp[2] = montMul(pow, pow);
        for (h = 1; h <= cap; h++) {
            precomp[(2 * h) + 1] = montMul(precomp[(2 * h) - 1], precomp[2])
        }
        var getBit = function (exp, i) {
            var off = i % exp.radix;
            return (exp.limbs[Math.floor(i / exp.radix)] & (1 << off)) >> off
        };
        for (i = x.bitLength() - 1; i >= 0;) {
            if (getBit(x, i) == 0) {
                out = montMul(out, out);
                i = i - 1
            } else {
                var l = i - wind + 1;
                while (getBit(x, l) == 0) {
                    l++
                }
                var indx = 0;
                for (j = l; j <= i; j++) {
                    indx += getBit(x, j) << (j - l);
                    out = montMul(out, out)
                }
                out = montMul(out, precomp[indx]);
                i = l - 1
            }
        }
        return montOut(out)
    },
    trim: function () {
        var l = this.limbs,
            p;
        do {
            p = l.pop()
        } while (l.length && p === 0);
        l.push(p);
        return this
    },
    reduce: function () {
        return this
    },
    fullReduce: function () {
        return this.normalize()
    },
    normalize: function () {
        var carry = 0,
            i, pv = this.placeVal,
            ipv = this.ipv,
            l, m, limbs = this.limbs,
            ll = limbs.length,
            mask = this.radixMask;
        for (i = 0; i < ll || (carry !== 0 && carry !== -1); i++) {
            l = (limbs[i] || 0) + carry;
            m = limbs[i] = l & mask;
            carry = (l - m) * ipv
        }
        if (carry === -1) {
            limbs[i - 1] -= pv
        }
        this.trim();
        return this
    },
    cnormalize: function () {
        var carry = 0,
            i, ipv = this.ipv,
            l, m, limbs = this.limbs,
            ll = limbs.length,
            mask = this.radixMask;
        for (i = 0; i < ll - 1; i++) {
            l = limbs[i] + carry;
            m = limbs[i] = l & mask;
            carry = (l - m) * ipv
        }
        limbs[i] += carry;
        return this
    },
    toBits: function (len) {
        this.fullReduce();
        len = len || this.exponent || this.bitLength();
        var i = Math.floor((len - 1) / 24),
            w = sjcl.bitArray,
            e = (len + 7 & -8) % this.radix || this.radix,
            out = [w.partial(e, this.getLimb(i))];
        for (i--; i >= 0; i--) {
            out = w.concat(out, [w.partial(Math.min(this.radix, len), this.getLimb(i))]);
            len -= this.radix
        }
        return out
    },
    bitLength: function () {
        this.fullReduce();
        var out = this.radix * (this.limbs.length - 1),
            b = this.limbs[this.limbs.length - 1];
        for (; b; b >>>= 1) {
            out++
        }
        return out + 7 & -8
    }
};
sjcl.bn.fromBits = function (bits) {
    var Class = this,
        out = new Class(),
        words = [],
        w = sjcl.bitArray,
        t = this.prototype,
        l = Math.min(this.bitLength || 0x100000000, w.bitLength(bits)),
        e = l % t.radix || t.radix;
    words[0] = w.extract(bits, 0, e);
    for (; e < l; e += t.radix) {
        words.unshift(w.extract(bits, e, t.radix))
    }
    out.limbs = words;
    return out
};
sjcl.bn.prototype.ipv = 1 / (sjcl.bn.prototype.placeVal = Math.pow(2, sjcl.bn.prototype.radix));
sjcl.bn.prototype.radixMask = (1 << sjcl.bn.prototype.radix) - 1;
sjcl.bn.pseudoMersennePrime = function (exponent, coeff) {
    function p(it) {
        this.initWith(it)
    }
    var ppr = p.prototype = new sjcl.bn(),
        i, tmp, mo;
    mo = ppr.modOffset = Math.ceil(tmp = exponent / ppr.radix);
    ppr.exponent = exponent;
    ppr.offset = [];
    ppr.factor = [];
    ppr.minOffset = mo;
    ppr.fullMask = 0;
    ppr.fullOffset = [];
    ppr.fullFactor = [];
    ppr.modulus = p.modulus = new sjcl.bn(Math.pow(2, exponent));
    ppr.fullMask = 0 | -Math.pow(2, exponent % ppr.radix);
    for (i = 0; i < coeff.length; i++) {
        ppr.offset[i] = Math.floor(coeff[i][0] / ppr.radix - tmp);
        ppr.fullOffset[i] = Math.ceil(coeff[i][0] / ppr.radix - tmp);
        ppr.factor[i] = coeff[i][1] * Math.pow(1 / 2, exponent - coeff[i][0] + ppr.offset[i] * ppr.radix);
        ppr.fullFactor[i] = coeff[i][1] * Math.pow(1 / 2, exponent - coeff[i][0] + ppr.fullOffset[i] * ppr.radix);
        ppr.modulus.addM(new sjcl.bn(Math.pow(2, coeff[i][0]) * coeff[i][1]));
        ppr.minOffset = Math.min(ppr.minOffset, -ppr.offset[i])
    }
    ppr._class = p;
    ppr.modulus.cnormalize();
    ppr.reduce = function () {
        var i, k, l, mo = this.modOffset,
            limbs = this.limbs,
            off = this.offset,
            ol = this.offset.length,
            fac = this.factor,
            ll;
        i = this.minOffset;
        while (limbs.length > mo) {
            l = limbs.pop();
            ll = limbs.length;
            for (k = 0; k < ol; k++) {
                limbs[ll + off[k]] -= fac[k] * l
            }
            i--;
            if (!i) {
                limbs.push(0);
                this.cnormalize();
                i = this.minOffset
            }
        }
        this.cnormalize();
        return this
    };
    ppr._strongReduce = (ppr.fullMask === -1) ? ppr.reduce : function () {
        var limbs = this.limbs,
            i = limbs.length - 1,
            k, l;
        this.reduce();
        if (i === this.modOffset - 1) {
            l = limbs[i] & this.fullMask;
            limbs[i] -= l;
            for (k = 0; k < this.fullOffset.length; k++) {
                limbs[i + this.fullOffset[k]] -= this.fullFactor[k] * l
            }
            this.normalize()
        }
    };
    ppr.fullReduce = function () {
        var greater, i;
        this._strongReduce();
        this.addM(this.modulus);
        this.addM(this.modulus);
        this.normalize();
        this._strongReduce();
        for (i = this.limbs.length; i < this.modOffset; i++) {
            this.limbs[i] = 0
        }
        greater = this.greaterEquals(this.modulus);
        for (i = 0; i < this.limbs.length; i++) {
            this.limbs[i] -= this.modulus.limbs[i] * greater
        }
        this.cnormalize();
        return this
    };
    ppr.inverse = function () {
        return (this.power(this.modulus.sub(2)))
    };
    p.fromBits = sjcl.bn.fromBits;
    return p
};
var sbp = sjcl.bn.pseudoMersennePrime;
sjcl.bn.prime = {
    p127: sbp(127, [
        [0, -1]
    ]),
    p25519: sbp(255, [
        [0, -19]
    ]),
    p192k: sbp(192, [
        [32, -1],
        [12, -1],
        [8, -1],
        [7, -1],
        [6, -1],
        [3, -1],
        [0, -1]
    ]),
    p224k: sbp(224, [
        [32, -1],
        [12, -1],
        [11, -1],
        [9, -1],
        [7, -1],
        [4, -1],
        [1, -1],
        [0, -1]
    ]),
    p256k: sbp(256, [
        [32, -1],
        [9, -1],
        [8, -1],
        [7, -1],
        [6, -1],
        [4, -1],
        [0, -1]
    ]),
    p192: sbp(192, [
        [0, -1],
        [64, -1]
    ]),
    p224: sbp(224, [
        [0, 1],
        [96, -1]
    ]),
    p256: sbp(256, [
        [0, -1],
        [96, 1],
        [192, 1],
        [224, -1]
    ]),
    p384: sbp(384, [
        [0, -1],
        [32, 1],
        [96, -1],
        [128, -1]
    ]),
    p521: sbp(521, [
        [0, -1]
    ])
};
sjcl.bn.random = function (modulus, paranoia) {
    if (typeof modulus !== "object") {
        modulus = new sjcl.bn(modulus)
    }
    var words, i, l = modulus.limbs.length,
        m = modulus.limbs[l - 1] + 1,
        out = new sjcl.bn();
    while (!0) {
        do {
            words = sjcl.random.randomWords(l, paranoia);
            if (words[l - 1] < 0) {
                words[l - 1] += 0x100000000
            }
        } while (Math.floor(words[l - 1] / m) === Math.floor(0x100000000 / m));
        words[l - 1] %= m;
        for (i = 0; i < l - 1; i++) {
            words[i] &= modulus.radixMask
        }
        out.limbs = words;
        if (!out.greaterEquals(modulus)) {
            return out
        }
    }
};
sjcl.ecc = {};
sjcl.ecc.point = function (curve, x, y) {
    if (x === undefined) {
        this.isIdentity = !0
    } else {
        if (x instanceof sjcl.bn) {
            x = new curve.field(x)
        }
        if (y instanceof sjcl.bn) {
            y = new curve.field(y)
        }
        this.x = x;
        this.y = y;
        this.isIdentity = !1
    }
    this.curve = curve
};
sjcl.ecc.point.prototype = {
    toJac: function () {
        return new sjcl.ecc.pointJac(this.curve, this.x, this.y, new this.curve.field(1))
    },
    mult: function (k) {
        return this.toJac().mult(k, this).toAffine()
    },
    mult2: function (k, k2, affine2) {
        return this.toJac().mult2(k, this, k2, affine2).toAffine()
    },
    multiples: function () {
        var m, i, j;
        if (this._multiples === undefined) {
            j = this.toJac().doubl();
            m = this._multiples = [new sjcl.ecc.point(this.curve), this, j.toAffine()];
            for (i = 3; i < 16; i++) {
                j = j.add(this);
                m.push(j.toAffine())
            }
        }
        return this._multiples
    },
    negate: function () {
        var newY = new this.curve.field(0).sub(this.y).normalize().reduce();
        return new sjcl.ecc.point(this.curve, this.x, newY)
    },
    isValid: function () {
        return this.y.square().equals(this.curve.b.add(this.x.mul(this.curve.a.add(this.x.square()))))
    },
    toBits: function () {
        return sjcl.bitArray.concat(this.x.toBits(), this.y.toBits())
    }
};
sjcl.ecc.pointJac = function (curve, x, y, z) {
    if (x === undefined) {
        this.isIdentity = !0
    } else {
        this.x = x;
        this.y = y;
        this.z = z;
        this.isIdentity = !1
    }
    this.curve = curve
};
sjcl.ecc.pointJac.prototype = {
    add: function (T) {
        var S = this,
            sz2, c, d, c2, x1, x2, x, y1, y2, y, z;
        if (S.curve !== T.curve) {
            throw new sjcl.exception.invalid("sjcl.ecc.add(): Points must be on the same curve to add them!")
        }
        if (S.isIdentity) {
            return T.toJac()
        } else if (T.isIdentity) {
            return S
        }
        sz2 = S.z.square();
        c = T.x.mul(sz2).subM(S.x);
        if (c.equals(0)) {
            if (S.y.equals(T.y.mul(sz2.mul(S.z)))) {
                return S.doubl()
            } else {
                return new sjcl.ecc.pointJac(S.curve)
            }
        }
        d = T.y.mul(sz2.mul(S.z)).subM(S.y);
        c2 = c.square();
        x1 = d.square();
        x2 = c.square().mul(c).addM(S.x.add(S.x).mul(c2));
        x = x1.subM(x2);
        y1 = S.x.mul(c2).subM(x).mul(d);
        y2 = S.y.mul(c.square().mul(c));
        y = y1.subM(y2);
        z = S.z.mul(c);
        return new sjcl.ecc.pointJac(this.curve, x, y, z)
    },
    doubl: function () {
        if (this.isIdentity) {
            return this
        }
        var y2 = this.y.square(),
            a = y2.mul(this.x.mul(4)),
            b = y2.square().mul(8),
            z2 = this.z.square(),
            c = this.curve.a.toString() == (new sjcl.bn(-3)).toString() ? this.x.sub(z2).mul(3).mul(this.x.add(z2)) : this.x.square().mul(3).add(z2.square().mul(this.curve.a)),
            x = c.square().subM(a).subM(a),
            y = a.sub(x).mul(c).subM(b),
            z = this.y.add(this.y).mul(this.z);
        return new sjcl.ecc.pointJac(this.curve, x, y, z)
    },
    toAffine: function () {
        if (this.isIdentity || this.z.equals(0)) {
            return new sjcl.ecc.point(this.curve)
        }
        var zi = this.z.inverse(),
            zi2 = zi.square();
        return new sjcl.ecc.point(this.curve, this.x.mul(zi2).fullReduce(), this.y.mul(zi2.mul(zi)).fullReduce())
    },
    mult: function (k, affine) {
        if (typeof (k) === "number") {
            k = [k]
        } else if (k.limbs !== undefined) {
            k = k.normalize().limbs
        }
        var i, j, out = new sjcl.ecc.point(this.curve).toJac(),
            multiples = affine.multiples();
        for (i = k.length - 1; i >= 0; i--) {
            for (j = sjcl.bn.prototype.radix - 4; j >= 0; j -= 4) {
                out = out.doubl().doubl().doubl().doubl().add(multiples[k[i] >> j & 0xF])
            }
        }
        return out
    },
    mult2: function (k1, affine, k2, affine2) {
        if (typeof (k1) === "number") {
            k1 = [k1]
        } else if (k1.limbs !== undefined) {
            k1 = k1.normalize().limbs
        }
        if (typeof (k2) === "number") {
            k2 = [k2]
        } else if (k2.limbs !== undefined) {
            k2 = k2.normalize().limbs
        }
        var i, j, out = new sjcl.ecc.point(this.curve).toJac(),
            m1 = affine.multiples(),
            m2 = affine2.multiples(),
            l1, l2;
        for (i = Math.max(k1.length, k2.length) - 1; i >= 0; i--) {
            l1 = k1[i] | 0;
            l2 = k2[i] | 0;
            for (j = sjcl.bn.prototype.radix - 4; j >= 0; j -= 4) {
                out = out.doubl().doubl().doubl().doubl().add(m1[l1 >> j & 0xF]).add(m2[l2 >> j & 0xF])
            }
        }
        return out
    },
    negate: function () {
        return this.toAffine().negate().toJac()
    },
    isValid: function () {
        var z2 = this.z.square(),
            z4 = z2.square(),
            z6 = z4.mul(z2);
        return this.y.square().equals(this.curve.b.mul(z6).add(this.x.mul(this.curve.a.mul(z4).add(this.x.square()))))
    }
};
sjcl.ecc.curve = function (Field, r, a, b, x, y) {
    this.field = Field;
    this.r = new sjcl.bn(r);
    this.a = new Field(a);
    this.b = new Field(b);
    this.G = new sjcl.ecc.point(this, new Field(x), new Field(y))
};
sjcl.ecc.curve.prototype.fromBits = function (bits) {
    var w = sjcl.bitArray,
        l = this.field.prototype.exponent + 7 & -8,
        p = new sjcl.ecc.point(this, this.field.fromBits(w.bitSlice(bits, 0, l)), this.field.fromBits(w.bitSlice(bits, l, 2 * l)));
    if (!p.isValid()) {
        throw new sjcl.exception.corrupt("not on the curve!")
    }
    return p
};
sjcl.ecc.curves = {
    c192: new sjcl.ecc.curve(sjcl.bn.prime.p192, "0xffffffffffffffffffffffff99def836146bc9b1b4d22831", -3, "0x64210519e59c80e70fa7e9ab72243049feb8deecc146b9b1", "0x188da80eb03090f67cbf20eb43a18800f4ff0afd82ff1012", "0x07192b95ffc8da78631011ed6b24cdd573f977a11e794811"),
    c224: new sjcl.ecc.curve(sjcl.bn.prime.p224, "0xffffffffffffffffffffffffffff16a2e0b8f03e13dd29455c5c2a3d", -3, "0xb4050a850c04b3abf54132565044b0b7d7bfd8ba270b39432355ffb4", "0xb70e0cbd6bb4bf7f321390b94a03c1d356c21122343280d6115c1d21", "0xbd376388b5f723fb4c22dfe6cd4375a05a07476444d5819985007e34"),
    c256: new sjcl.ecc.curve(sjcl.bn.prime.p256, "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", -3, "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b", "0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296", "0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),
    c384: new sjcl.ecc.curve(sjcl.bn.prime.p384, "0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973", -3, "0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef", "0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7", "0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f"),
    c521: new sjcl.ecc.curve(sjcl.bn.prime.p521, "0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFA51868783BF2F966B7FCC0148F709A5D03BB5C9B8899C47AEBB6FB71E91386409", -3, "0x051953EB9618E1C9A1F929A21A0B68540EEA2DA725B99B315F3B8B489918EF109E156193951EC7E937B1652C0BD3BB1BF073573DF883D2C34F1EF451FD46B503F00", "0xC6858E06B70404E9CD9E3ECB662395B4429C648139053FB521F828AF606B4D3DBAA14B5E77EFE75928FE1DC127A2FFA8DE3348B3C1856A429BF97E7E31C2E5BD66", "0x11839296A789A3BC0045C8A5FB42C7D1BD998F54449579B446817AFBD17273E662C97EE72995EF42640C550B9013FAD0761353C7086A272C24088BE94769FD16650"),
    k192: new sjcl.ecc.curve(sjcl.bn.prime.p192k, "0xfffffffffffffffffffffffe26f2fc170f69466a74defd8d", 0, 3, "0xdb4ff10ec057e9ae26b07d0280b7f4341da5d1b1eae06c7d", "0x9b2f2f6d9c5628a7844163d015be86344082aa88d95e2f9d"),
    k224: new sjcl.ecc.curve(sjcl.bn.prime.p224k, "0x010000000000000000000000000001dce8d2ec6184caf0a971769fb1f7", 0, 5, "0xa1455b334df099df30fc28a169a467e9e47075a90f7e650eb6b7a45c", "0x7e089fed7fba344282cafbd6f7e319f7c0b0bd59e2ca4bdb556d61a5"),
    k256: new sjcl.ecc.curve(sjcl.bn.prime.p256k, "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141", 0, 7, "0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798", "0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
sjcl.ecc.curveName = function (curve) {
    var curcurve;
    for (curcurve in sjcl.ecc.curves) {
        if (sjcl.ecc.curves.hasOwnProperty(curcurve)) {
            if (sjcl.ecc.curves[curcurve] === curve) {
                return curcurve
            }
        }
    }
    throw new sjcl.exception.invalid("no such curve")
};
sjcl.ecc.deserialize = function (key) {
    var types = ["elGamal", "ecdsa"];
    if (!key || !key.curve || !sjcl.ecc.curves[key.curve]) {
        throw new sjcl.exception.invalid("invalid serialization")
    }
    if (types.indexOf(key.type) === -1) {
        throw new sjcl.exception.invalid("invalid type")
    }
    var curve = sjcl.ecc.curves[key.curve];
    if (key.secretKey) {
        if (!key.exponent) {
            throw new sjcl.exception.invalid("invalid exponent")
        }
        var exponent = new sjcl.bn(key.exponent);
        return new sjcl.ecc[key.type].secretKey(curve, exponent)
    } else {
        if (!key.point) {
            throw new sjcl.exception.invalid("invalid point")
        }
        var point = curve.fromBits(sjcl.codec.hex.toBits(key.point));
        return new sjcl.ecc[key.type].publicKey(curve, point)
    }
};
sjcl.ecc.basicKey = {
    publicKey: function (curve, point) {
        this._curve = curve;
        this._curveBitLength = curve.r.bitLength();
        if (point instanceof Array) {
            this._point = curve.fromBits(point)
        } else {
            this._point = point
        }
        this.serialize = function () {
            var curveName = sjcl.ecc.curveName(curve);
            return {
                type: this.getType(),
                secretKey: !1,
                point: sjcl.codec.hex.fromBits(this._point.toBits()),
                curve: curveName
            }
        };
        this.get = function () {
            var pointbits = this._point.toBits();
            var len = sjcl.bitArray.bitLength(pointbits);
            var x = sjcl.bitArray.bitSlice(pointbits, 0, len / 2);
            var y = sjcl.bitArray.bitSlice(pointbits, len / 2);
            return {
                x: x,
                y: y
            }
        }
    },
    secretKey: function (curve, exponent) {
        this._curve = curve;
        this._curveBitLength = curve.r.bitLength();
        this._exponent = exponent;
        this.serialize = function () {
            var exponent = this.get();
            var curveName = sjcl.ecc.curveName(curve);
            return {
                type: this.getType(),
                secretKey: !0,
                exponent: sjcl.codec.hex.fromBits(exponent),
                curve: curveName
            }
        };
        this.get = function () {
            return this._exponent.toBits()
        }
    }
};
sjcl.ecc.basicKey.generateKeys = function (cn) {
    return function generateKeys(curve, paranoia, sec) {
        curve = curve || 256;
        if (typeof curve === "number") {
            curve = sjcl.ecc.curves['c' + curve];
            if (curve === undefined) {
                throw new sjcl.exception.invalid("no such curve")
            }
        }
        sec = sec || sjcl.bn.random(curve.r, paranoia);
        var pub = curve.G.mult(sec);
        return {
            pub: new sjcl.ecc[cn].publicKey(curve, pub),
            sec: new sjcl.ecc[cn].secretKey(curve, sec)
        }
    }
};
sjcl.ecc.elGamal = {
    generateKeys: sjcl.ecc.basicKey.generateKeys("elGamal"),
    publicKey: function (curve, point) {
        sjcl.ecc.basicKey.publicKey.apply(this, arguments)
    },
    secretKey: function (curve, exponent) {
        sjcl.ecc.basicKey.secretKey.apply(this, arguments)
    }
};
sjcl.ecc.elGamal.publicKey.prototype = {
    kem: function (paranoia) {
        var sec = sjcl.bn.random(this._curve.r, paranoia),
            tag = this._curve.G.mult(sec).toBits(),
            key = sjcl.hash.sha256.hash(this._point.mult(sec).toBits());
        return {
            key: key,
            tag: tag
        }
    },
    getType: function () {
        return "elGamal"
    }
};
sjcl.ecc.elGamal.secretKey.prototype = {
    unkem: function (tag) {
        return sjcl.hash.sha256.hash(this._curve.fromBits(tag).mult(this._exponent).toBits())
    },
    dh: function (pk) {
        return sjcl.hash.sha256.hash(pk._point.mult(this._exponent).toBits())
    },
    dhJavaEc: function (pk) {
        return pk._point.mult(this._exponent).x.toBits()
    },
    getType: function () {
        return "elGamal"
    }
};
sjcl.ecc.ecdsa = {
    generateKeys: sjcl.ecc.basicKey.generateKeys("ecdsa")
};
sjcl.ecc.ecdsa.publicKey = function (curve, point) {
    sjcl.ecc.basicKey.publicKey.apply(this, arguments)
};
sjcl.ecc.ecdsa.publicKey.prototype = {
    verify: function (hash, rs, fakeLegacyVersion) {
        if (sjcl.bitArray.bitLength(hash) > this._curveBitLength) {
            hash = sjcl.bitArray.clamp(hash, this._curveBitLength)
        }
        var w = sjcl.bitArray,
            R = this._curve.r,
            l = this._curveBitLength,
            r = sjcl.bn.fromBits(w.bitSlice(rs, 0, l)),
            ss = sjcl.bn.fromBits(w.bitSlice(rs, l, 2 * l)),
            s = fakeLegacyVersion ? ss : ss.inverseMod(R),
            hG = sjcl.bn.fromBits(hash).mul(s).mod(R),
            hA = r.mul(s).mod(R),
            r2 = this._curve.G.mult2(hG, hA, this._point).x;
        if (r.equals(0) || ss.equals(0) || r.greaterEquals(R) || ss.greaterEquals(R) || !r2.equals(r)) {
            if (fakeLegacyVersion === undefined) {
                return this.verify(hash, rs, !0)
            } else {
                throw (new sjcl.exception.corrupt("signature didn't check out"))
            }
        }
        return !0
    },
    getType: function () {
        return "ecdsa"
    }
};
sjcl.ecc.ecdsa.secretKey = function (curve, exponent) {
    sjcl.ecc.basicKey.secretKey.apply(this, arguments)
};
sjcl.ecc.ecdsa.secretKey.prototype = {
    sign: function (hash, paranoia, fakeLegacyVersion, fixedKForTesting) {
        if (sjcl.bitArray.bitLength(hash) > this._curveBitLength) {
            hash = sjcl.bitArray.clamp(hash, this._curveBitLength)
        }
        var R = this._curve.r,
            l = R.bitLength(),
            k = fixedKForTesting || sjcl.bn.random(R.sub(1), paranoia).add(1),
            r = this._curve.G.mult(k).x.mod(R),
            ss = sjcl.bn.fromBits(hash).add(r.mul(this._exponent)),
            s = fakeLegacyVersion ? ss.inverseMod(R).mul(k).mod(R) : ss.mul(k.inverseMod(R)).mod(R);
        return sjcl.bitArray.concat(r.toBits(l), s.toBits(l))
    },
    getType: function () {
        return "ecdsa"
    }
};
sjcl.keyexchange.srp = {
    makeVerifier: function (I, P, s, group) {
        var x;
        x = sjcl.keyexchange.srp.makeX(I, P, s);
        x = sjcl.bn.fromBits(x);
        return group.g.powermod(x, group.N)
    },
    makeX: function (I, P, s) {
        var inner = sjcl.hash.sha1.hash(I + ':' + P);
        return sjcl.hash.sha1.hash(sjcl.bitArray.concat(s, inner))
    },
    knownGroup: function (i) {
        if (typeof i !== "string") {
            i = i.toString()
        }
        if (!sjcl.keyexchange.srp._didInitKnownGroups) {
            sjcl.keyexchange.srp._initKnownGroups()
        }
        return sjcl.keyexchange.srp._knownGroups[i]
    },
    _didInitKnownGroups: !1,
    _initKnownGroups: function () {
        var i, size, group;
        for (i = 0; i < sjcl.keyexchange.srp._knownGroupSizes.length; i++) {
            size = sjcl.keyexchange.srp._knownGroupSizes[i].toString();
            group = sjcl.keyexchange.srp._knownGroups[size];
            group.N = new sjcl.bn(group.N);
            group.g = new sjcl.bn(group.g)
        }
        sjcl.keyexchange.srp._didInitKnownGroups = !0
    },
    _knownGroupSizes: [1024, 1536, 2048, 3072, 4096, 6144, 8192],
    _knownGroups: {
        1024: {
            N: "EEAF0AB9ADB38DD69C33F80AFA8FC5E86072618775FF3C0B9EA2314C" + "9C256576D674DF7496EA81D3383B4813D692C6E0E0D5D8E250B98BE4" + "8E495C1D6089DAD15DC7D7B46154D6B6CE8EF4AD69B15D4982559B29" + "7BCF1885C529F566660E57EC68EDBC3C05726CC02FD4CBF4976EAA9A" + "FD5138FE8376435B9FC61D2FC0EB06E3",
            g: 2
        },
        1536: {
            N: "9DEF3CAFB939277AB1F12A8617A47BBBDBA51DF499AC4C80BEEEA961" + "4B19CC4D5F4F5F556E27CBDE51C6A94BE4607A291558903BA0D0F843" + "80B655BB9A22E8DCDF028A7CEC67F0D08134B1C8B97989149B609E0B" + "E3BAB63D47548381DBC5B1FC764E3F4B53DD9DA1158BFD3E2B9C8CF5" + "6EDF019539349627DB2FD53D24B7C48665772E437D6C7F8CE442734A" + "F7CCB7AE837C264AE3A9BEB87F8A2FE9B8B5292E5A021FFF5E91479E" + "8CE7A28C2442C6F315180F93499A234DCF76E3FED135F9BB",
            g: 2
        },
        2048: {
            N: "AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC319294" + "3DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310D" + "CD7F48A9DA04FD50E8083969EDB767B0CF6095179A163AB3661A05FB" + "D5FAAAE82918A9962F0B93B855F97993EC975EEAA80D740ADBF4FF74" + "7359D041D5C33EA71D281E446B14773BCA97B43A23FB801676BD207A" + "436C6481F1D2B9078717461A5B9D32E688F87748544523B524B0D57D" + "5EA77A2775D2ECFA032CFBDBF52FB3786160279004E57AE6AF874E73" + "03CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8E9DBFBB6" + "94B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F" + "9E4AFF73",
            g: 2
        },
        3072: {
            N: "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08" + "8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B" + "302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9" + "A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE6" + "49286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8" + "FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D" + "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C" + "180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718" + "3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D" + "04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7D" + "B3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D226" + "1AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C" + "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFC" + "E0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF",
            g: 5
        },
        4096: {
            N: "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08" + "8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B" + "302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9" + "A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE6" + "49286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8" + "FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D" + "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C" + "180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718" + "3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D" + "04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7D" + "B3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D226" + "1AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C" + "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFC" + "E0FD108E4B82D120A92108011A723C12A787E6D788719A10BDBA5B26" + "99C327186AF4E23C1A946834B6150BDA2583E9CA2AD44CE8DBBBC2DB" + "04DE8EF92E8EFC141FBECAA6287C59474E6BC05D99B2964FA090C3A2" + "233BA186515BE7ED1F612970CEE2D7AFB81BDD762170481CD0069127" + "D5B05AA993B4EA988D8FDDC186FFB7DC90A6C08F4DF435C934063199" + "FFFFFFFFFFFFFFFF",
            g: 5
        },
        6144: {
            N: "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08" + "8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B" + "302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9" + "A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE6" + "49286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8" + "FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D" + "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C" + "180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718" + "3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D" + "04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7D" + "B3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D226" + "1AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C" + "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFC" + "E0FD108E4B82D120A92108011A723C12A787E6D788719A10BDBA5B26" + "99C327186AF4E23C1A946834B6150BDA2583E9CA2AD44CE8DBBBC2DB" + "04DE8EF92E8EFC141FBECAA6287C59474E6BC05D99B2964FA090C3A2" + "233BA186515BE7ED1F612970CEE2D7AFB81BDD762170481CD0069127" + "D5B05AA993B4EA988D8FDDC186FFB7DC90A6C08F4DF435C934028492" + "36C3FAB4D27C7026C1D4DCB2602646DEC9751E763DBA37BDF8FF9406" + "AD9E530EE5DB382F413001AEB06A53ED9027D831179727B0865A8918" + "DA3EDBEBCF9B14ED44CE6CBACED4BB1BDB7F1447E6CC254B33205151" + "2BD7AF426FB8F401378CD2BF5983CA01C64B92ECF032EA15D1721D03" + "F482D7CE6E74FEF6D55E702F46980C82B5A84031900B1C9E59E7C97F" + "BEC7E8F323A97A7E36CC88BE0F1D45B7FF585AC54BD407B22B4154AA" + "CC8F6D7EBF48E1D814CC5ED20F8037E0A79715EEF29BE32806A1D58B" + "B7C5DA76F550AA3D8A1FBFF0EB19CCB1A313D55CDA56C9EC2EF29632" + "387FE8D76E3C0468043E8F663F4860EE12BF2D5B0B7474D6E694F91E" + "6DCC4024FFFFFFFFFFFFFFFF",
            g: 5
        },
        8192: {
            N: "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08" + "8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B" + "302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9" + "A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE6" + "49286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8" + "FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D" + "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C" + "180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718" + "3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D" + "04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7D" + "B3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D226" + "1AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C" + "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFC" + "E0FD108E4B82D120A92108011A723C12A787E6D788719A10BDBA5B26" + "99C327186AF4E23C1A946834B6150BDA2583E9CA2AD44CE8DBBBC2DB" + "04DE8EF92E8EFC141FBECAA6287C59474E6BC05D99B2964FA090C3A2" + "233BA186515BE7ED1F612970CEE2D7AFB81BDD762170481CD0069127" + "D5B05AA993B4EA988D8FDDC186FFB7DC90A6C08F4DF435C934028492" + "36C3FAB4D27C7026C1D4DCB2602646DEC9751E763DBA37BDF8FF9406" + "AD9E530EE5DB382F413001AEB06A53ED9027D831179727B0865A8918" + "DA3EDBEBCF9B14ED44CE6CBACED4BB1BDB7F1447E6CC254B33205151" + "2BD7AF426FB8F401378CD2BF5983CA01C64B92ECF032EA15D1721D03" + "F482D7CE6E74FEF6D55E702F46980C82B5A84031900B1C9E59E7C97F" + "BEC7E8F323A97A7E36CC88BE0F1D45B7FF585AC54BD407B22B4154AA" + "CC8F6D7EBF48E1D814CC5ED20F8037E0A79715EEF29BE32806A1D58B" + "B7C5DA76F550AA3D8A1FBFF0EB19CCB1A313D55CDA56C9EC2EF29632" + "387FE8D76E3C0468043E8F663F4860EE12BF2D5B0B7474D6E694F91E" + "6DBE115974A3926F12FEE5E438777CB6A932DF8CD8BEC4D073B931BA" + "3BC832B68D9DD300741FA7BF8AFC47ED2576F6936BA424663AAB639C" + "5AE4F5683423B4742BF1C978238F16CBE39D652DE3FDB8BEFC848AD9" + "22222E04A4037C0713EB57A81A23F0C73473FC646CEA306B4BCBC886" + "2F8385DDFA9D4B7FA2C087E879683303ED5BDD3A062B3CF5B3A278A6" + "6D2A13F83F44F82DDF310EE074AB6A364597E899A0255DC164F31CC5" + "0846851DF9AB48195DED7EA1B1D510BD7EE74D73FAF36BC31ECFA268" + "359046F4EB879F924009438B481C6CD7889A002ED5EE382BC9190DA6" + "FC026E479558E4475677E9AA9E3050E2765694DFC81F56E880B96E71" + "60C980DD98EDD3DFFFFFFFFFFFFFFFFF",
            g: 19
        }
    }
};
sjcl.arrayBuffer = sjcl.arrayBuffer || {};
if (typeof (ArrayBuffer) === 'undefined') {
    (function (globals) {
        "use strict";
        globals.ArrayBuffer = function () { };
        globals.DataView = function () { }
    }(this))
}
sjcl.arrayBuffer.ccm = {
    mode: "ccm",
    defaults: {
        tlen: 128
    },
    compat_encrypt: function (prf, plaintext, iv, adata, tlen) {
        var plaintext_buffer = sjcl.codec.arrayBuffer.fromBits(plaintext, !0, 16),
            ol = sjcl.bitArray.bitLength(plaintext) / 8,
            encrypted_obj, ct, tag;
        tlen = tlen || 64;
        adata = adata || [];
        encrypted_obj = sjcl.arrayBuffer.ccm.encrypt(prf, plaintext_buffer, iv, adata, tlen, ol);
        ct = sjcl.codec.arrayBuffer.toBits(encrypted_obj.ciphertext_buffer);
        ct = sjcl.bitArray.clamp(ct, ol * 8);
        return sjcl.bitArray.concat(ct, encrypted_obj.tag)
    },
    compat_decrypt: function (prf, ciphertext, iv, adata, tlen) {
        tlen = tlen || 64;
        adata = adata || [];
        var L, i, w = sjcl.bitArray,
            ol = w.bitLength(ciphertext),
            out = w.clamp(ciphertext, ol - tlen),
            tag = w.bitSlice(ciphertext, ol - tlen),
            tag2, ciphertext_buffer = sjcl.codec.arrayBuffer.fromBits(out, !0, 16);
        var plaintext_buffer = sjcl.arrayBuffer.ccm.decrypt(prf, ciphertext_buffer, iv, tag, adata, tlen, (ol - tlen) / 8);
        return sjcl.bitArray.clamp(sjcl.codec.arrayBuffer.toBits(plaintext_buffer), ol - tlen)
    },
    encrypt: function (prf, plaintext_buffer, iv, adata, tlen, ol) {
        var auth_blocks, mac, L, w = sjcl.bitArray,
            ivl = w.bitLength(iv) / 8;
        adata = adata || [];
        tlen = tlen || sjcl.arrayBuffer.ccm.defaults.tlen;
        ol = ol || plaintext_buffer.byteLength;
        tlen = Math.ceil(tlen / 8);
        for (L = 2; L < 4 && ol >>> 8 * L; L++) { }
        if (L < 15 - ivl) {
            L = 15 - ivl
        }
        iv = w.clamp(iv, 8 * (15 - L));
        mac = sjcl.arrayBuffer.ccm._computeTag(prf, plaintext_buffer, iv, adata, tlen, ol, L);
        mac = sjcl.arrayBuffer.ccm._ctrMode(prf, plaintext_buffer, iv, mac, tlen, L);
        return {
            'ciphertext_buffer': plaintext_buffer,
            'tag': mac
        }
    },
    decrypt: function (prf, ciphertext_buffer, iv, tag, adata, tlen, ol) {
        var mac, mac2, i, L, w = sjcl.bitArray,
            ivl = w.bitLength(iv) / 8;
        adata = adata || [];
        tlen = tlen || sjcl.arrayBuffer.ccm.defaults.tlen;
        ol = ol || ciphertext_buffer.byteLength;
        tlen = Math.ceil(tlen / 8);
        for (L = 2; L < 4 && ol >>> 8 * L; L++) { }
        if (L < 15 - ivl) {
            L = 15 - ivl
        }
        iv = w.clamp(iv, 8 * (15 - L));
        mac = sjcl.arrayBuffer.ccm._ctrMode(prf, ciphertext_buffer, iv, tag, tlen, L);
        mac2 = sjcl.arrayBuffer.ccm._computeTag(prf, ciphertext_buffer, iv, adata, tlen, ol, L);
        if (!sjcl.bitArray.equal(mac, mac2)) {
            throw new sjcl.exception.corrupt("ccm: tag doesn't match")
        }
        return ciphertext_buffer
    },
    _computeTag: function (prf, data_buffer, iv, adata, tlen, ol, L) {
        var i, plaintext, mac, data, data_blocks_size, data_blocks, w = sjcl.bitArray,
            tmp, macData;
        mac = sjcl.mode.ccm._macAdditionalData(prf, adata, iv, tlen, ol, L);
        if (data_buffer.byteLength !== 0) {
            data = new DataView(data_buffer);
            for (i = ol; i < data_buffer.byteLength; i++) {
                data.setUint8(i, 0)
            }
            for (i = 0; i < data.byteLength; i += 16) {
                mac[0] ^= data.getUint32(i);
                mac[1] ^= data.getUint32(i + 4);
                mac[2] ^= data.getUint32(i + 8);
                mac[3] ^= data.getUint32(i + 12);
                mac = prf.encrypt(mac)
            }
        }
        return sjcl.bitArray.clamp(mac, tlen * 8)
    },
    _ctrMode: function (prf, data_buffer, iv, mac, tlen, L) {
        var data, ctr, word0, word1, word2, word3, keyblock, i, w = sjcl.bitArray,
            xor = w._xor4,
            n = data_buffer.byteLength / 50,
            p = n;
        ctr = new DataView(new ArrayBuffer(16));
        ctr = w.concat([w.partial(8, L - 1)], iv).concat([0, 0, 0]).slice(0, 4);
        mac = w.bitSlice(xor(mac, prf.encrypt(ctr)), 0, tlen * 8);
        ctr[3]++;
        if (ctr[3] === 0) ctr[2]++;
        if (data_buffer.byteLength !== 0) {
            data = new DataView(data_buffer);
            for (i = 0; i < data.byteLength; i += 16) {
                if (i > n) {
                    sjcl.mode.ccm._callProgressListener(i / data_buffer.byteLength);
                    n += p
                }
                keyblock = prf.encrypt(ctr);
                word0 = data.getUint32(i);
                word1 = data.getUint32(i + 4);
                word2 = data.getUint32(i + 8);
                word3 = data.getUint32(i + 12);
                data.setUint32(i, word0 ^ keyblock[0]);
                data.setUint32(i + 4, word1 ^ keyblock[1]);
                data.setUint32(i + 8, word2 ^ keyblock[2]);
                data.setUint32(i + 12, word3 ^ keyblock[3]);
                ctr[3]++;
                if (ctr[3] === 0) ctr[2]++
            }
        }
        return mac
    }
};
if (typeof (ArrayBuffer) === 'undefined') {
    (function (globals) {
        "use strict";
        globals.ArrayBuffer = function () { };
        globals.DataView = function () { }
    }(this))
}
sjcl.codec.arrayBuffer = {
    fromBits: function (arr, padding, padding_count) {
        var out, i, ol, tmp, smallest;
        padding = padding == undefined ? !0 : padding;
        padding_count = padding_count || 8;
        if (arr.length === 0) {
            return new ArrayBuffer(0)
        }
        ol = sjcl.bitArray.bitLength(arr) / 8;
        if (sjcl.bitArray.bitLength(arr) % 8 !== 0) {
            throw new sjcl.exception.invalid("Invalid bit size, must be divisble by 8 to fit in an arraybuffer correctly")
        }
        if (padding && ol % padding_count !== 0) {
            ol += padding_count - (ol % padding_count)
        }
        tmp = new DataView(new ArrayBuffer(arr.length * 4));
        for (i = 0; i < arr.length; i++) {
            tmp.setUint32(i * 4, (arr[i] << 32))
        }
        out = new DataView(new ArrayBuffer(ol));
        if (out.byteLength === tmp.byteLength) {
            return tmp.buffer
        }
        smallest = tmp.byteLength < out.byteLength ? tmp.byteLength : out.byteLength;
        for (i = 0; i < smallest; i++) {
            out.setUint8(i, tmp.getUint8(i))
        }
        return out.buffer
    },
    toBits: function (buffer) {
        var i, out = [],
            len, inView, tmp;
        if (buffer.byteLength === 0) {
            return []
        }
        inView = new DataView(buffer);
        len = inView.byteLength - inView.byteLength % 4;
        for (var i = 0; i < len; i += 4) {
            out.push(inView.getUint32(i))
        }
        if (inView.byteLength % 4 != 0) {
            tmp = new DataView(new ArrayBuffer(4));
            for (var i = 0, l = inView.byteLength % 4; i < l; i++) {
                tmp.setUint8(i + 4 - l, inView.getUint8(len + i))
            }
            out.push(sjcl.bitArray.partial((inView.byteLength % 4) * 8, tmp.getUint32(0)))
        }
        return out
    },
    hexDumpBuffer: function (buffer) {
        var stringBufferView = new DataView(buffer);
        var string = '';
        var pad = function (n, width) {
            n = n + '';
            return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n
        };
        for (var i = 0; i < stringBufferView.byteLength; i += 2) {
            if (i % 16 == 0) string += ('\n' + (i).toString(16) + '\t');
            string += (pad(stringBufferView.getUint16(i).toString(16), 4) + ' ')
        }
        if (typeof console === undefined) {
            console = console || {
                log: function () { }
            }
        }
        console.log(string.toUpperCase())
    }
};
(function () {
    sjcl.hash.ripemd160 = function (hash) {
        if (hash) {
            this._h = hash._h.slice(0);
            this._buffer = hash._buffer.slice(0);
            this._length = hash._length
        } else {
            this.reset()
        }
    };
    sjcl.hash.ripemd160.hash = function (data) {
        return (new sjcl.hash.ripemd160()).update(data).finalize()
    };
    sjcl.hash.ripemd160.prototype = {
        reset: function () {
            this._h = _h0.slice(0);
            this._buffer = [];
            this._length = 0;
            return this
        },
        update: function (data) {
            if (typeof data === "string")
                data = sjcl.codec.utf8String.toBits(data);
            var i, b = this._buffer = sjcl.bitArray.concat(this._buffer, data),
                ol = this._length,
                nl = this._length = ol + sjcl.bitArray.bitLength(data);
            if (nl > 9007199254740991) {
                throw new sjcl.exception.invalid("Cannot hash more than 2^53 - 1 bits")
            }
            for (i = 512 + ol - ((512 + ol) & 511); i <= nl; i += 512) {
                var words = b.splice(0, 16);
                for (var w = 0; w < 16; ++w)
                    words[w] = _cvt(words[w]);
                _block.call(this, words)
            }
            return this
        },
        finalize: function () {
            var b = sjcl.bitArray.concat(this._buffer, [sjcl.bitArray.partial(1, 1)]),
                l = (this._length + 1) % 512,
                z = (l > 448 ? 512 : 448) - l % 448,
                zp = z % 32;
            if (zp > 0)
                b = sjcl.bitArray.concat(b, [sjcl.bitArray.partial(zp, 0)]);
            for (; z >= 32; z -= 32)
                b.push(0);
            b.push(_cvt(this._length | 0));
            b.push(_cvt(Math.floor(this._length / 0x100000000)));
            while (b.length) {
                var words = b.splice(0, 16);
                for (var w = 0; w < 16; ++w)
                    words[w] = _cvt(words[w]);
                _block.call(this, words)
            }
            var h = this._h;
            this.reset();
            for (var w = 0; w < 5; ++w)
                h[w] = _cvt(h[w]);
            return h
        }
    };
    var _h0 = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    var _k1 = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
    var _k2 = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
    for (var i = 4; i >= 0; --i) {
        for (var j = 1; j < 16; ++j) {
            _k1.splice(i, 0, _k1[i]);
            _k2.splice(i, 0, _k2[i])
        }
    }
    var _r1 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13];
    var _r2 = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11];
    var _s1 = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6];
    var _s2 = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11];

    function _f0(x, y, z) {
        return x ^ y ^ z
    }

    function _f1(x, y, z) {
        return (x & y) | (~x & z)
    }

    function _f2(x, y, z) {
        return (x | ~y) ^ z
    }

    function _f3(x, y, z) {
        return (x & z) | (y & ~z)
    }

    function _f4(x, y, z) {
        return x ^ (y | ~z)
    }

    function _rol(n, l) {
        return (n << l) | (n >>> (32 - l))
    }

    function _cvt(n) {
        return ((n & 0xff << 0) << 24) | ((n & 0xff << 8) << 8) | ((n & 0xff << 16) >>> 8) | ((n & 0xff << 24) >>> 24)
    }

    function _block(X) {
        var A1 = this._h[0],
            B1 = this._h[1],
            C1 = this._h[2],
            D1 = this._h[3],
            E1 = this._h[4],
            A2 = this._h[0],
            B2 = this._h[1],
            C2 = this._h[2],
            D2 = this._h[3],
            E2 = this._h[4];
        var j = 0,
            T;
        for (; j < 16; ++j) {
            T = _rol(A1 + _f0(B1, C1, D1) + X[_r1[j]] + _k1[j], _s1[j]) + E1;
            A1 = E1;
            E1 = D1;
            D1 = _rol(C1, 10);
            C1 = B1;
            B1 = T;
            T = _rol(A2 + _f4(B2, C2, D2) + X[_r2[j]] + _k2[j], _s2[j]) + E2;
            A2 = E2;
            E2 = D2;
            D2 = _rol(C2, 10);
            C2 = B2;
            B2 = T
        }
        for (; j < 32; ++j) {
            T = _rol(A1 + _f1(B1, C1, D1) + X[_r1[j]] + _k1[j], _s1[j]) + E1;
            A1 = E1;
            E1 = D1;
            D1 = _rol(C1, 10);
            C1 = B1;
            B1 = T;
            T = _rol(A2 + _f3(B2, C2, D2) + X[_r2[j]] + _k2[j], _s2[j]) + E2;
            A2 = E2;
            E2 = D2;
            D2 = _rol(C2, 10);
            C2 = B2;
            B2 = T
        }
        for (; j < 48; ++j) {
            T = _rol(A1 + _f2(B1, C1, D1) + X[_r1[j]] + _k1[j], _s1[j]) + E1;
            A1 = E1;
            E1 = D1;
            D1 = _rol(C1, 10);
            C1 = B1;
            B1 = T;
            T = _rol(A2 + _f2(B2, C2, D2) + X[_r2[j]] + _k2[j], _s2[j]) + E2;
            A2 = E2;
            E2 = D2;
            D2 = _rol(C2, 10);
            C2 = B2;
            B2 = T
        }
        for (; j < 64; ++j) {
            T = _rol(A1 + _f3(B1, C1, D1) + X[_r1[j]] + _k1[j], _s1[j]) + E1;
            A1 = E1;
            E1 = D1;
            D1 = _rol(C1, 10);
            C1 = B1;
            B1 = T;
            T = _rol(A2 + _f1(B2, C2, D2) + X[_r2[j]] + _k2[j], _s2[j]) + E2;
            A2 = E2;
            E2 = D2;
            D2 = _rol(C2, 10);
            C2 = B2;
            B2 = T
        }
        for (; j < 80; ++j) {
            T = _rol(A1 + _f4(B1, C1, D1) + X[_r1[j]] + _k1[j], _s1[j]) + E1;
            A1 = E1;
            E1 = D1;
            D1 = _rol(C1, 10);
            C1 = B1;
            B1 = T;
            T = _rol(A2 + _f0(B2, C2, D2) + X[_r2[j]] + _k2[j], _s2[j]) + E2;
            A2 = E2;
            E2 = D2;
            D2 = _rol(C2, 10);
            C2 = B2;
            B2 = T
        }
        T = this._h[1] + C1 + D2;
        this._h[1] = this._h[2] + D1 + E2;
        this._h[2] = this._h[3] + E1 + A2;
        this._h[3] = this._h[4] + A1 + B2;
        this._h[4] = this._h[0] + B1 + C2;
        this._h[0] = T
    }
})();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = sjcl
}
if (typeof define === "function") {
    define([], function () {
        return sjcl
    })
}
/*
 * This implements a 2HashDH-based token scheme using the SJCL ecc package.
 *
 * @author: George Tankersley
 */

/*global sjcl*/
/* exported CreateBlindToken */
/* exported checkRequestBinding */
/* exported compressPoint */
/* exported decodeStorablePoint */
/* exported deriveKey */
/* exported encodeStorablePoint */
/* exported sec1DecodePoint */
/* exported signPoint */
/* exported unblindPoint */
/* exported verifyBatchProof */
"use strict";

var p256 = sjcl.ecc.curves.c256;
const P256_NAME = "c256";
const BATCH_PROOF_PREFIX = "batch-proof=";
const NO_COMMITMENTS_ERR = "[privacy-pass]: Batch proof does not contain commitments";
const INCORRECT_POINT_SETS_ERR = "[privacy-pass]: Point sets for batch proof are incorrect";
const COMMITMENT_MISMATCH_ERR = "[privacy-pass]: Mismatch between stored and received commitments";
const DLEQ_PROOF_INCOMPLETE = "[privacy-pass]: DLEQ proof has components that are not defined";
const INCORRECT_CURVE_ERR = "[privacy-pass]: Curve is incorrect for one or more points in proof";
const DIGEST_INEQUALITY_ERR = "[privacy-pass]: Recomputed digest does not equal received digest";
const PARSE_ERR = "[privacy-pass]: Error parsing proof";
const INCONSISTENT_BATCH_PROOF_ERR = "[privacy-pass]: Tokens/signatures are inconsistent with batch proof";
const INCONSISTENT_DLEQ_PROOF_ERR = "[privacy-pass]: Tokens/signatures are inconsistent with underlying DLEQ proof";
const DevCommitmentConfig = {
    "G": "BIpWWWWFtDRODAHEzZlvjKyDwQAdh72mYKMAsGrtwsG7XmMxsy89gfiOFbX3RZ9Ik6jEYWyJB0TmnWNVeeZBt5Y=",
    "H": "BKjGppSCZCsL08YlF4MJcml6YkCglMvr56WlUOFjn9hOKXNa0iB9t8OHXW7lARIfYO0CZE/t1SlPA1mXdi/Rcjo="
}

const ProdCommitmentConfig = {
    "G": "BOidEuO9HSJsMZYE/Pfc5D+0ELn0bqhjEef2O0u+KAw3fPMHHXtVlEBvYjE5I/ONf9SyTFSkH3mLNHkS06Du6hQ=",
    "H": "BHOPNAWXRi4r/NEptOiLOp8MSwcX0vHrVDRXv16Jnowc1eXXo5xFFKIOI6mUp8k9/eca5VY07dBhAe8QfR/FSRY="
}
let activeCommConfig = ProdCommitmentConfig;
function btoa(a) {
    return Buffer.from(a).toString('base64');
}
// Performs the scalar multiplication k*P
//
// Inputs:
//  k: bigInt scalar (not field element or bits!)
//  P: sjcl Point
// Returns:
//  sjcl Point
function _scalarMult(k, P) {
    const Q = P.mult(k);
    return Q;
}

// blindPoint generates a random scalar blinding factor, multiplies the
// supplied point by it, and returns both values.
function blindPoint(P) {
    const bF = sjcl.bn.random(p256.r, 10);
    const bP = _scalarMult(bF, P);
    return { point: bP, blind: bF };
}

// unblindPoint takes an assumed-to-be blinded point Q and an accompanying
// blinding scalar b, then returns the point (1/b)*Q.
//
// inputs:
//  b: bigint scalar (not field element or bits!)
//  q: sjcl point
// returns:
//  sjcl point
function unblindPoint(b, Q) {
    const binv = b.inverseMod(p256.r);
    return _scalarMult(binv, Q);
}

// multiplies the point by the secret scalar "key"
//
// inputs:
//  key: bigint scalar (not field element or bits!)
//  P: sjcl point
// returns:
//  sjcl point
function signPoint(key, P) {
    return _scalarMult(key, P);
}

// Derives the shared key used for redemption MACs
//
// Inputs:
//  N: sjcl Point
//  token: bytes
// Returns:
//  bytes
function deriveKey(N, token) {
    // the exact bits of the string "hash_derive_key"
    const tagBits = sjcl.codec.hex.toBits("686173685f6465726976655f6b6579");
    const h = new sjcl.misc.hmac(tagBits, sjcl.hash.sha256);

    const encodedPoint = sec1EncodePoint(N);
    const tokenBits = sjcl.codec.bytes.toBits(token);
    const pointBits = sjcl.codec.bytes.toBits(encodedPoint);

    h.update(tokenBits);
    h.update(pointBits);

    const keyBytes = sjcl.codec.bytes.fromBits(h.digest());
    return keyBytes;
}

// Generates the HMAC used to bind request data to a particular token redemption.
//
// Inputs:
//  key: raw key bytes as returned by deriveKey
//  data: array of data as bytes
// Returns:
//  bytes
function createRequestBinding(key, data) {
    // the exact bits of the string "hash_request_binding"
    const tagBits = sjcl.codec.utf8String.toBits("hash_request_binding");
    const keyBits = sjcl.codec.bytes.toBits(key);

    const h = new sjcl.misc.hmac(keyBits, sjcl.hash.sha256);
    h.update(tagBits);

    let dataBits = null;
    for (var i = 0; i < data.length; i++) {
        dataBits = sjcl.codec.bytes.toBits(data[i]);
        h.update(dataBits);
    }

    const digestBytes = sjcl.codec.bytes.fromBits(h.digest());
    return digestBytes;
}

// Checks an HMAC generated by createRequestBinding
//
// Inputs:
//  key: key bytes as returned by deriveKey
//  data: data bytes
//  mac: bytes of the MAC to check
// Returns:
//  true if valid, false otherwise
function checkRequestBinding(key, data, mac) {
    const macBits = sjcl.codec.bytes.toBits(mac);
    const observedMAC = createRequestBinding(key, data);
    const observedBits = sjcl.codec.bytes.toBits(observedMAC);

    return sjcl.bitArray.equal(macBits, observedBits);
}

// Creates
// Inputs:
//  none
// Returns:
//  token bytes
//  T sjcl point
//  r blinding factor, sjcl bignum
function CreateBlindToken() {
    let t = newRandomPoint();
    let bpt = blindPoint(t.point);
    return { token: t.token, point: bpt.point, blind: bpt.blind };
}

function newRandomPoint() {
    const byteLength = 32;
    const wordLength = byteLength / 4; // SJCL 4 bytes to a word

    // TODO Use webcrypto instead. This is JavaScript Fortuna from 2010.
    var random = sjcl.random.randomWords(wordLength, 10); // paranoia 10
    var point = hashToCurve(random);
    return { token: sjcl.codec.bytes.fromBits(random), point: point };
}

// input: bits
// output: point
function hashToCurve(seed) {
    const h = new sjcl.hash.sha256();

    // Need to match the Go curve hash, so we decode the exact bytes of the
    // string "1.2.840.100045.3.1.7 point generation seed" instead of relying
    // on the utf8 codec that didn't match.
    const separator = sjcl.codec.hex.toBits("312e322e3834302e31303034352e332e312e3720706f696e742067656e65726174696f6e2073656564");

    h.update(separator);

    let i = 0;
    for (i = 0; i < 10; i++) {
        // little endian uint32
        let ctr = new Uint8Array(4);
        // typecast hack: number -> Uint32, bitwise Uint8
        ctr[0] = (i >>> 0) & 0xFF;
        let ctrBits = sjcl.codec.bytes.toBits(ctr);

        // H(s||ctr)
        h.update(seed);
        h.update(ctrBits);

        const digestBits = h.finalize();

        let point = decompressPoint(digestBits, 0x02);
        if (point !== null) {
            return point;
        }

        point = decompressPoint(digestBits, 0x03);
        if (point !== null) {
            return point;
        }

        seed = digestBits;
        h.reset();
    }

    return null;
}

// Attempts to decompress the bytes into a curve point following SEC1 and
// assuming it's a Weierstrass curve with a = -3 and p = 3 mod 4 (true for the
// main three NIST curves).
// input: bits of an x coordinate, the even/odd tag
// output: point
function decompressPoint(xbits, tag) {
    const x = p256.field.fromBits(xbits).normalize();
    const sign = tag & 1;

    // y^2 = x^3 - 3x + b (mod p)
    let rh = x.power(3);
    let threeTimesX = x.mul(3);
    rh = rh.sub(threeTimesX).add(p256.b).mod(p256.field.modulus); // mod() normalizes

    // modsqrt(z) for p = 3 mod 4 is z^(p+1/4)
    const sqrt = p256.field.modulus.add(1).normalize().halveM().halveM();
    let y = rh.powermod(sqrt, p256.field.modulus);

    let parity = y.limbs[0] & 1;

    if (parity != sign) {
        y = p256.field.modulus.sub(y).normalize();
    }

    let point = new sjcl.ecc.point(p256, x, y);
    if (!point.isValid()) {
        return null;
    }
    return point;
}

// Compresses a point according to SEC1.
// input: point
// output: base64-encoded bytes
function compressPoint(p) {
    const xBytes = sjcl.codec.bytes.fromBits(p.x.toBits());
    const sign = p.y.limbs[0] & 1 ? 0x03 : 0x02;
    const taggedBytes = [sign].concat(xBytes);
    return sjcl.codec.base64.fromBits(sjcl.codec.bytes.toBits(taggedBytes));
}

// This has to match Go's elliptic.Marshal, which follows SEC1 2.3.3 for
// uncompressed points.  SJCL's native point encoding is a concatenation of the
// x and y coordinates, so it's *almost* SEC1 but lacks the tag for
// uncompressed point encoding.
//
// Inputs:
//  P: sjcl Point
// Returns:
//  bytes
function sec1EncodePoint(P) {
    const pointBits = P.toBits();
    const xyBytes = sjcl.codec.bytes.fromBits(pointBits);
    return [0x04].concat(xyBytes);
}

// input: base64-encoded bytes
// output: point
function sec1DecodePoint(p) {
    const sec1Bits = sjcl.codec.base64.toBits(p);
    const sec1Bytes = sjcl.codec.bytes.fromBits(sec1Bits);
    if (sec1Bytes[0] != 0x04) {
        throw new Error("[privacy-pass]: attempted sec1DecodePoint with incorrect tag: " + p);
    }
    const coordinates = sec1Bytes.slice(1); // remove "uncompressed" tag
    const pointBits = sjcl.codec.bytes.toBits(coordinates);
    return p256.fromBits(pointBits);
}

// Marshals a point in an SJCL-internal format that can be used with
// JSON.stringify for localStorage.
//
// input: point
// output: base64 string
function encodeStorablePoint(p) {
    const bits = p.toBits();
    return sjcl.codec.base64.fromBits(bits);
}

// Renders a point from SJCL-internal base64.
//
// input: base64 string
// ouput: point
function decodeStorablePoint(s) {
    const bits = sjcl.codec.base64.toBits(s);
    return p256.fromBits(bits);
}


/**
 * DLEQ proof verification logic
 */

// Verifies the DLEQ proof that is returned when tokens are signed
// 
// input: marshaled JSON DLEQ proof
// output: bool
function verifyBatchProof(proof, tokens, signatures) {
    let batchProofM = getMarshaledBatchProof(proof);
    let bp = unmarshalBatchProof(batchProofM);
    if (!bp) {
        // Error has probably occurred
        return false;
    }
    const chkM = tokens;
    const chkZ = signatures;
    if (!isBatchProofCompleteAndSane(bp, chkM, chkZ)) {
        return false;
    }
    return verifyDleq(bp, chkM, chkZ);
}

// Verify the NIZK DLEQ proof
function verifyDleq(bp, chkM, chkZ) {
    // Check sanity of proof
    let dleq = bp.P;
    if (!isDleqCompleteAndSane(dleq, chkM, chkZ, bp.C)) {
        return false;
    }

    let cH = _scalarMult(dleq.C, dleq.H);
    let rG = _scalarMult(dleq.R, dleq.G);
    const A = cH.toJac().add(rG).toAffine();

    let cZ = _scalarMult(dleq.C, dleq.Z);
    let rM = _scalarMult(dleq.R, dleq.M);
    const B = cZ.toJac().add(rM).toAffine();

    // Recalculate C' and check if C =?= C'
    let h = new sjcl.hash.sha256();
    h.update(sjcl.codec.bytes.toBits(sec1EncodePoint(dleq.G)));
    h.update(sjcl.codec.bytes.toBits(sec1EncodePoint(dleq.H)));
    h.update(sjcl.codec.bytes.toBits(sec1EncodePoint(dleq.M)));
    h.update(sjcl.codec.bytes.toBits(sec1EncodePoint(dleq.Z)));
    h.update(sjcl.codec.bytes.toBits(sec1EncodePoint(A)));
    h.update(sjcl.codec.bytes.toBits(sec1EncodePoint(B)));
    const digestBits = h.finalize();
    const receivedDigestBits = dleq.C.toBits();
    if (!sjcl.bitArray.equal(digestBits, receivedDigestBits)) {
        console.error(DIGEST_INEQUALITY_ERR);
        console.error("Computed digest: " + digestBits.toString());
        console.error("Received digest: " + receivedDigestBits.toString());
        return false;
    }
    return true;
}

// Check that the underlying DLEQ proof is well-defined
function isDleqCompleteAndSane(dleq, chkM, chkZ, proofC) {
    if (!dleq.M || !dleq.Z || !dleq.R || !dleq.C) {
        console.error(DLEQ_PROOF_INCOMPLETE);
        return false;
    }

    // Check that all points are on the same curve
    let curveG = dleq.G.curve;
    let curveH = dleq.H.curve;
    let curveM = dleq.M.curve;
    let curveZ = dleq.Z.curve;
    if (sjcl.ecc.curveName(curveG) != sjcl.ecc.curveName(curveH) ||
        sjcl.ecc.curveName(curveH) != sjcl.ecc.curveName(curveM) ||
        sjcl.ecc.curveName(curveM) != sjcl.ecc.curveName(curveZ) ||
        sjcl.ecc.curveName(curveG) != P256_NAME) {
        console.error(INCORRECT_CURVE_ERR);
        return false;
    }

    let chkMPoint;
    let chkZPoint;
    for (let i = 0; i < chkM.length; i++) {
        let cMi = _scalarMult(proofC[i], chkM[i].point);
        let cZi = _scalarMult(proofC[i], chkZ[i]);

        if (!chkMPoint && !chkZPoint) {
            chkMPoint = cMi;
            chkZPoint = cZi;
        } else {
            chkMPoint = chkMPoint.toJac().add(cMi).toAffine();
            chkZPoint = chkZPoint.toJac().add(cZi).toAffine();
        }
    }
    if (!sjcl.bitArray.equal(dleq.M.toBits(), chkMPoint.toBits()) || !sjcl.bitArray.equal(dleq.Z.toBits(), chkZPoint.toBits())) {
        console.error(INCONSISTENT_DLEQ_PROOF_ERR);
        return false;
    }
    return true;
}

// Checks that the batch proof is well-defined
function isBatchProofCompleteAndSane(bp, chkM, chkZ) {
    // Check commitments are present
    let G = bp.P.G;
    let H = bp.P.H;
    if (!G || !H) {
        console.error(NO_COMMITMENTS_ERR);
        return false;
    }
    // Check that point sets are present and correct
    let lenM = bp.M.length;
    let lenZ = bp.Z.length;
    if (!bp.M || !bp.Z || lenM == 0 || lenZ == 0 || lenM !== lenZ || chkM.length !== lenM || chkZ.length !== lenZ) {
        console.error(INCORRECT_POINT_SETS_ERR);
        return false;
    }
    // Check that the curve is correct and that the values of M, Z are consistent
    for (let i = 0; i < lenM; i++) {
        if (sjcl.ecc.curveName(bp.M[i].curve) != sjcl.ecc.curveName(G.curve) ||
            sjcl.ecc.curveName(bp.Z[i].curve) != sjcl.ecc.curveName(G.curve) ||
            sjcl.ecc.curveName(bp.M[i].curve) != P256_NAME) {
            console.error(INCORRECT_CURVE_ERR);
            return false;
        }
        // If the values of M and Z are consistent then we can use dleq.M and 
        // dleq.Z to verify the proof later
        if (!sjcl.bitArray.equal(bp.M[i].toBits(), chkM[i].point.toBits()) ||
            !sjcl.bitArray.equal(bp.Z[i].toBits(), chkZ[i].toBits())) {
            console.error(INCONSISTENT_BATCH_PROOF_ERR);
            return false;
        }
    }
    return true;
}

// Returns a decoded batch proof as a map
function unmarshalBatchProof(batchProofM) {
    let bp = new Map();
    let dleqProof;
    try {
        dleqProof = parseDleqProof(atob(batchProofM.P));
    } catch (e) {
        console.error(PARSE_ERR);
        return;
    }

    bp.P = dleqProof;
    bp.M = batchDecodePoints(batchProofM.M);
    bp.Z = batchDecodePoints(batchProofM.Z);
    let encC = batchProofM.C;
    let decC = [];
    for (let i = 0; i < encC.length; i++) {
        decC[i] = getBigNumFromB64(encC[i]);
    }
    bp.C = decC;

    return bp;
}

// Batch decode a number of points
// 
// input: Array of sec1-encoded points
// output: Array of sec1-decoded points
function batchDecodePoints(pointArr) {
    let decPointArr = [];
    for (let i = 0; i < pointArr.length; i++) {
        decPointArr.push(sec1DecodePoint(pointArr[i]));
    }
    return decPointArr;
}

// Decode proof string and remove prefix
function getMarshaledBatchProof(proof) {
    let proofStr = atob(proof);
    if (proofStr.indexOf(BATCH_PROOF_PREFIX) === 0) {
        proofStr = proofStr.substring(BATCH_PROOF_PREFIX.length);
    }
    return JSON.parse(proofStr);
}

// Decode the proof that is sent into a map
// 
// input: Marshaled proof string
// output: DLEQ proof
function parseDleqProof(proofStr) {
    const dleqProofM = JSON.parse(proofStr);
    let dleqProof = new Map();

    // if we do not have the same commitments then something is wrong
    if (!validateConsistentCommitments(dleqProofM.G, dleqProofM.H)) {
        throw new Error(COMMITMENT_MISMATCH_ERR);
    }

    dleqProof.G = sec1DecodePoint(dleqProofM.G);
    dleqProof.M = sec1DecodePoint(dleqProofM.M);
    dleqProof.H = sec1DecodePoint(dleqProofM.H);
    dleqProof.Z = sec1DecodePoint(dleqProofM.Z);
    dleqProof.R = getBigNumFromB64(dleqProofM.R);
    dleqProof.C = getBigNumFromB64(dleqProofM.C);
    return dleqProof;
}

// Check that the commitments on the proof match the commitments
// in the extension
function validateConsistentCommitments(G, H) {
    if (G != activeCommConfig.G || H != activeCommConfig.H) {
        return false;
    }
    return true;
}

// Return a byte array from a base-64 encoded string
function getBigNumFromB64(b64Str) {
    let bits = sjcl.codec.base64.toBits(b64Str)
    return sjcl.bn.fromBits(bits);
}

function decompressPoint(xbits, tag) {
    const x = sjcl.ecc.curves.c256.field.fromBits(xbits).normalize();
    const sign = tag & 1;
    let rh = x.power(3);
    let threeTimesX = x.mul(3);
    rh = rh.sub(threeTimesX).add(sjcl.ecc.curves.c256.b).mod(sjcl.ecc.curves.c256.field.modulus);
    const sqrt = sjcl.ecc.curves.c256.field.modulus.add(1).normalize().halveM().halveM();
    let y = rh.powermod(sqrt, sjcl.ecc.curves.c256.field.modulus);
    let parity = y.limbs[0] & 1;
    if (parity != sign) {
        y = sjcl.ecc.curves.c256.field.modulus.sub(y).normalize()
    }
    let point = new sjcl.ecc.point(sjcl.ecc.curves.c256, x, y);
    if (!point.isValid()) {
        return null
    }
    return point
}

function hashToCurve(seed) {
    const h = new sjcl.hash.sha256();
    const separator = sjcl.codec.hex.toBits("312e322e3834302e31303034352e332e312e3720706f696e742067656e65726174696f6e2073656564");
    h.update(separator);
    let i = 0;
    for (i = 0; i < 10; i++) {
        let ctr = new Uint8Array(4);
        ctr[0] = (i >>> 0) & 0xFF;
        let bytes = ctr;
        var out = [],
            d, tmp = 0;
        for (d = 0; d < bytes.length; d++) {
            tmp = tmp << 8 | bytes[d];
            if ((d & 3) === 3) {
                out.push(tmp);
                tmp = 0
            }
        }
        if (d & 3) {
            out.push(sjcl.bitArray.partial(8 * (d & 3), tmp))
        }
        ctrBits = out;
        h.update(seed);
        h.update(ctrBits);
        const digestBits = h.finalize();
        let point = decompressPoint(digestBits, 0x02);
        if (point !== null) {
            return point
        }
        point = decompressPoint(digestBits, 0x03);
        if (point !== null) {
            return point
        }
        seed = digestBits;
        h.reset()
    }
    return null
}

function newRandomPoint() {
    const byteLength = 32;
    const wordLength = byteLength / 4;
    var random = sjcl.random.randomWords(wordLength, 10);
    var point = hashToCurve(random);
    return {
        token: sjcl.codec.bytes.fromBits(random),
        point: point
    }
}

function blindPoint(P) {
    const bF = sjcl.bn.random(sjcl.ecc.curves.c256.r, 10);
    const bP = _scalarMult(bF, P);
    return {
        point: bP,
        blind: bF
    }
}

function CreateBlindToken() {
    let t = newRandomPoint();
    let bpt = blindPoint(t.point);
    return {
        token: t.token,
        point: bpt.point,
        blind: bpt.blind
    }
}

function _scalarMult(k, P) {
    const Q = P.mult(k);
    return Q
}

function decodeStorablePoint(s) {
    const bits = sjcl.codec.base64.toBits(s);
    return sjcl.ecc.curves.c256.fromBits(bits)
}

function loadToken(token) {
    let t = token;
    let usablePoint = decodeStorablePoint(t.point);
    let usableBlind = new sjcl.bn(t.blind);
    usableToken = {
        token: t.token,
        point: usablePoint,
        blind: usableBlind
    };
    return usableToken
}

function sec1EncodePoint(P) {
    const pointBits = P.toBits();
    const xyBytes = sjcl.codec.bytes.fromBits(pointBits);
    return [0x04].concat(xyBytes)
}

function deriveKey(N, token) {
    const tagBits = sjcl.codec.hex.toBits("686173685f6465726976655f6b6579");
    const h = new sjcl.misc.hmac(tagBits, sjcl.hash.sha256);
    const encodedPoint = sec1EncodePoint(N);
    const tokenBits = sjcl.codec.bytes.toBits(token);
    const pointBits = sjcl.codec.bytes.toBits(encodedPoint);
    h.update(tokenBits);
    h.update(pointBits);
    const keyBytes = sjcl.codec.bytes.fromBits(h.digest());
    return keyBytes
}

function unblindPoint(b, Q) {
    const binv = b.inverseMod(sjcl.ecc.curves.c256.r);
    return Q.mult(binv)
}

function createRequestBinding(key, data) {
    const tagBits = sjcl.codec.utf8String.toBits("hash_request_binding");
    const keyBits = sjcl.codec.bytes.toBits(key);
    const h = new sjcl.misc.hmac(keyBits, sjcl.hash.sha256);
    h.update(tagBits);
    let dataBits = null;
    for (var i = 0; i < data.length; i++) {
        dataBits = sjcl.codec.bytes.toBits(data[i]);
        h.update(dataBits);
    }
    const digestBytes = sjcl.codec.bytes.fromBits(h.digest());
    return digestBytes;
}

function BuildRedeemHeader(token, host, path) {
    const sharedPoint = unblindPoint(token.blind, token.point);
    const derivedKey = deriveKey(sharedPoint, token.token);
    const hostBits = sjcl.codec.utf8String.toBits(host);
    const hostBytes = sjcl.codec.bytes.fromBits(hostBits);
    const pathBits = sjcl.codec.utf8String.toBits(path);
    const pathBytes = sjcl.codec.bytes.fromBits(pathBits);
    const binding = createRequestBinding(derivedKey, [hostBytes, pathBytes]);
    let contents = [];
    contents.push(token.token);
    contents.push(binding);
    return Buffer.from(JSON.stringify({
        type: "Redeem",
        contents: contents
    })).toString('base64');
}


function GenerateNewTokens(n) {
    let i = 0;
    let tokens = new Array(n);
    for (i = 0; i < tokens.length; i++) {
        tokens[i] = CreateBlindToken();
    }
    return tokens;
}

function BuildIssueRequest(tokens) {
    let contents = [];
    for (var i = 0; i < tokens.length; i++) {
        const encodedPoint = compressPoint(tokens[i].point);
        contents.push(encodedPoint);
    }
    return btoa(JSON.stringify({ type: "Issue", contents: contents }));
}
function parseIssueResponse(data, tokens) {
    const split = data.split("signatures=", 2);
    if (split.length != 2) {
        throw new Error("[privacy-pass]: signature response invalid or in unexpected format, got response: " + data);
    }
    // decodes base-64
    const signaturesJSON = atob(split[1]);
    // parses into JSON
    const issueResp = JSON.parse(signaturesJSON);
    let batchProof = issueResp[issueResp.length - 1];
    let signatures = issueResp.slice(0, issueResp.length - 1);
    if (!batchProof) {
        throw new Error("[privacy-pass]: No batch proof provided");
    }

    let usablePoints = [];
    signatures.forEach(function (signature) {
        let usablePoint = sec1DecodePoint(signature);
        if (usablePoint == null) {
            throw new Error("[privacy-pass]: unable to decode point " + signature + " in " + JSON.stringify(signatures));
        }
        usablePoints.push(usablePoint);
    })

    // Verify the DLEQ batch proof before handing back the usable points
    if (!verifyBatchProof(batchProof, tokens, usablePoints)) {
        throw new Error("[privacy-pass]: Unable to verify DLEQ proof.")
    }

    return usablePoints;
}

function getTokenEncoding(t, curvePoint) {
    let storablePoint = encodeStorablePoint(curvePoint);
    let storableBlind = t.blind.toString();
    return { token: t.token, point: storablePoint, blind: storableBlind };
}

function storeNewTokens(tokens, signedPoints) {
    let storableTokens = [];
    for (var i = 0; i < tokens.length; i++) {
        let t = tokens[i];
        storableTokens[i] = getTokenEncoding(t, signedPoints[i]);
    }
    return JSON.stringify(storableTokens);
}

function loadToken(token) {
    let t = token;
    let usablePoint = decodeStorablePoint(t.point);
    let usableBlind = new sjcl.bn(t.blind);
    usableToken = { token: t.token, point: usablePoint, blind: usableBlind };
    return usableToken;
}

const yeetToken = loadToken(yeetTokens[~~(Math.random() * yeetTokens.length)]);

module.exports = function (target) {
    var host = url.parse(target).host;
    var path = "GET " + url.parse(target).path;
    return BuildRedeemHeader(yeetToken, host, path);
}