#pragma once

#include <string>
#include <ostream>

namespace json {
    // Append s to out as a quoted, escaped JSON string literal.
    void writeEscapedString(std::ostream& out, const std::string& s);

    // Format a double for JSON (fixed notation, handles edge cases).
    std::string formatNumber(double value);
}
