#include "JsonWriter.h"
#include <iomanip>
#include <sstream>
#include <cmath>

namespace json {

void writeEscapedString(std::ostream& out, const std::string& s) {
    out << '"';
    for (char c : s) {
        switch (c) {
            case '"':  out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\b': out << "\\b";  break;
            case '\f': out << "\\f";  break;
            case '\n': out << "\\n";  break;
            case '\r': out << "\\r";  break;
            case '\t': out << "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    std::ostringstream oss;
                    oss << "\\u" << std::hex << std::setfill('0') << std::setw(4)
                        << static_cast<int>(static_cast<unsigned char>(c));
                    out << oss.str();
                } else {
                    out << c;
                }
        }
    }
    out << '"';
}

std::string formatNumber(double value) {
    if (std::isnan(value)) return "null";
    if (std::isinf(value)) return "null";

    // 6 decimals then trim trailing zeros: setprecision(1) used to round
    // small ratios away entirely (overlapRatio 0.036 was written as 0.0).
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(6) << value;
    std::string s = oss.str();
    size_t last = s.find_last_not_of('0');
    if (s[last] == '.') ++last; // keep one decimal: "90.0", not "90."
    s.erase(last + 1);
    return s;
}

}
