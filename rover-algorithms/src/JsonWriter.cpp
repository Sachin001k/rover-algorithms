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

    std::ostringstream oss;
    oss << std::fixed << std::setprecision(1) << value;
    return oss.str();
}

}
