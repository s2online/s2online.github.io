// Translation of src/util/JSON.as and src/util/ReadStream.as.

function scratchParseJSON(s) {
    var src = (function(s) {
        var src = s;
        var i = 0;

        return {
            atEnd() {
                return i >= src.length;
            },

            next() {
                if (i >= src.length) return '';
                return src.charAt(i++);
            },

            peek() {
                return (i < src.length) ? src.charAt(i) : '';
            },

            peek2() {
                return ((i + 1) < src.length) ? src.charAt(i + 1) : '';
            },

            peekString(n) {
                return src.slice(i, i + n);
            },

            nextString(n) {
                i += n;
                return src.slice(i - n, i);
            },

            pos() {
                return i;
            },

            setPos(newPos) {
                i = newPos;
            },

            skip(count) {
                i += count;
            },

            skipWhiteSpace() {
                while ((i < src.length) && (src.charCodeAt(i) <= 32)) i++;
            }
        };
    })(s);

    function readValue() {
        skipWhiteSpaceAndComments();
        var ch = src.peek();
        if (("0" <= ch) && (ch <= "9")) return readNumber(); // common case

        switch(ch) {
            case '"': return readString();
            case "[": return readArray();
            case "{": return readObject();
            case "t":
                if (src.nextString(4) == "true") return true;
                else error("Expected 'true'");
            case "f":
                if (src.nextString(5) == "false") return false;
                else error("Expected 'false'");
            case "n":
                if (src.nextString(4) == "null") return null;
                else error("Expected 'null'");
            case "-":
                if (src.peekString(9) == "-Infinity") {
                    src.skip(9);
                    return Number.NEGATIVE_INFINITY;
                } else return readNumber();
            case "I":
                if (src.nextString(8) == "Infinity") return Number.POSITIVE_INFINITY;
                else error("Expected 'Infinity'");
            case "N":
                if (src.nextString(3) == "NaN") return NaN;
                else error("Expected 'NaN'");
            case "":
                error("Incomplete JSON data");
            default:
                error("Bad character: " + ch);
        }
        return null;
    }

    function readArray() {
        var result = [];
        src.skip(1); // skip "["
        while (true) {
            if (src.atEnd()) return error("Incomplete array");
            skipWhiteSpaceAndComments();
            if (src.peek() == "]") break;
            result.push(readValue());
            skipWhiteSpaceAndComments();
            if (src.peek() == ",") {
                src.skip(1);
                continue;
            }
            if (src.peek() == "]") break;
            else error("Bad array syntax");
        }
        src.skip(1); // skip "]"
        return result;
    }

    function readObject() {
        var result = {};
        src.skip(1); // skip "{"
        while (true) {
            if (src.atEnd()) return error("Incomplete object");
            skipWhiteSpaceAndComments();
            if (src.peek() == "}") break;
            if (src.peek() != '"') error("Bad object syntax");
            var key = readString();
            skipWhiteSpaceAndComments();
            if (src.next() != ":") error("Bad object syntax");
            skipWhiteSpaceAndComments();
            var value = readValue();
            result[key] = value;
            skipWhiteSpaceAndComments();
            if (src.peek() == ",") {
                src.skip(1);
                continue;
            }
            if (src.peek() == "}") break;
            else error("Bad object syntax");
        }
        src.skip(1); // skip "}"
        return result;
    }

    function readNumber() {
        var numStr = "";
        var ch = src.peek();

        if ((ch == "0") && (src.peek2() == "x")) { // hex number
            numStr = src.nextString(2) + readHexDigits();
            return Number(numStr);
        }

        if (ch == "-") numStr += src.next();
        numStr += readDigits();
        if ((numStr == "") || (numStr == "-")) error("At least one digit expected");
        if (src.peek() == ".") numStr += src.next() + readDigits();
        ch = src.peek();
        if ((ch == "e") || (ch == "E")) {
            numStr += src.next();
            ch = src.peek();
            if ((ch == "+") || (ch == "-")) numStr += src.next();
            numStr += readDigits();
        }
        return Number(numStr);
    }

    function readDigits() {
        var result = "";
        while (true) {
            var ch = src.next();
            if (("0" <= ch) && (ch <= "9")) result += ch;
            else {
                if (ch != "") src.skip(-1);
                break;
            }
        }
        return result;
    }

    function readHexDigits() {
        var result = "";
        while (true) {
            var ch = src.next();
            if (("0" <= ch) && (ch <= "9")) result += ch;
            else if (("a" <= ch) && (ch <= "f")) result += ch;
            else if (("A" <= ch) && (ch <= "F")) result += ch;
            else {
                if (!src.atEnd()) src.skip(-1);
                break;
            }
        }
        return result;
    }

    function readString() {
        var result = "";
        src.skip(1); // skip opening quote
        var ch;
        while ((ch = src.next()) != '"') {
            if (ch == "") return error("Incomplete string");
            if (ch == "\\") result += readEscapedChar();
            else result += ch;
        }
        return result;
    }

    function readEscapedChar() {
        var ch = src.next();
        switch(ch) {
            case "b": return "\b";
            case "f": return "\f";
            case "n": return "\n";
            case "r": return "\r";
            case "t": return "\t";
            case "u": return String.fromCharCode(int("0x" + src.nextString(4)));
        }
        return ch;
    }

    function skipWhiteSpaceAndComments() {
        while (true) {
            // skip comments and white space until the stream position does not change
            var lastPos = src.pos();
            src.skipWhiteSpace();
            skipComment();
            if (src.pos() == lastPos) break; // done
        }
    }

    function skipComment() {
        var ch;
        if ((src.peek() == "/") && (src.peek2() == "/")) {
            src.skip(2);
            while ((ch = src.next()) != "\n") { // comments goes until the end of the line
                if (ch == "") return; // end of stream
            }
        }
        if ((src.peek() == "/") && (src.peek2() == "*")) {
            src.skip(2);
            var lastWasAsterisk = false;
            while (true) {
                ch = src.next();
                if (ch == "") return; // end of stream
                if (lastWasAsterisk && (ch == "/")) return; // end of comment
                if (ch == "*") lastWasAsterisk = true;
            }
        }
    }

    return readValue();
}

/*
if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    console.log(scratchParseJSON('{"hi":"lol\nthere"}'));
}
*/
