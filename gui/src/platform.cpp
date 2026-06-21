#include "platform.h"
#include <filesystem>
#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#endif
namespace fs = std::filesystem;

std::string exe_path()
{
    char buf[4096];
#ifdef _WIN32
    GetModuleFileNameA(nullptr, buf, sizeof(buf));
    return buf;
#elif __APPLE__
    uint32_t size = sizeof(buf);
    if (_NSGetExecutablePath(buf, &size) == 0)
        return buf;
    return {};
#else
    ssize_t len = readlink("/proc/self/exe", buf, sizeof(buf) - 1);
    if (len > 0)
    {
        buf[len] = '\0';
        return buf;
    }
    return {};
#endif
}

std::string default_editor_root()
{
    auto dir = fs::path(exe_path()).parent_path();

    for (const auto &candidate : {dir / ".." / "editor", dir / "editor"})
    {
        auto norm = candidate.lexically_normal();
        if (fs::exists(norm) && fs::is_directory(norm))
            return norm.string();
    }

#ifdef _WIN32
    return "C:/Program Files/predoc/editor";
#else
    return "/opt/predoc/editor";
#endif
}
