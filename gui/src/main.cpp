#include <saucer/smartview.hpp>
#include <saucer/icon.hpp>
#include <saucer/webview.hpp>
#include <saucer/navigation.hpp>
#include <cstdlib>
#include <iostream>
#include <fstream>
#include <sstream>
#include <print>
#include <string>
#include <span>
#include <optional>
#include <vector>
#include <filesystem>
#include <sys/stat.h>
namespace fs = std::filesystem;

static bool g_debug = false;

#define debug(...)                                                             \
    do                                                                         \
    {                                                                          \
        if (g_debug)                                                           \
            std::println(std::cerr, "  [debug] " __VA_ARGS__);                 \
    } while (0)

static std::string g_editor_url;
static std::string g_live_url;
static std::string g_favicon;
static bool g_disable_gpu = false;

static std::string g_editor_root;
static std::string g_content_root;
static std::string g_live_host = "127.0.0.1";
static std::size_t g_live_port = 5000;

static saucer::smartview *g_webview = nullptr;

// -- navigation --------------------------------------------------------------

static bool is_internal(const std::string &scheme,
                        const std::optional<std::string> &host,
                        const std::optional<std::size_t> &port)
{
    if (scheme == "app")
        return true;
    if (!host.has_value())
        return true;
    if (host->empty())
        return true;
    if (!port.has_value())
        return false;

    return (*host == "localhost" || *host == "127.0.0.1") &&
           (*port == g_live_port);
}

static void show_toast(const std::string &msg)
{
    std::string escaped;
    for (char c : msg)
    {
        if (c == '\'')
            escaped += "\\'";
        else if (c == '\\')
            escaped += "\\\\";
        else if (c == '\n')
            escaped += "\\n";
        else if (c == '\r')
            escaped += "\\r";
        else
            escaped += c;
    }
    auto js = "predocUI.showToast('" + escaped + "')";
    static_cast<saucer::webview *>(g_webview)->execute(js.c_str());
}

static saucer::policy on_navigate(const saucer::navigation &nav)
{
    auto url_str = nav.url().string();
    auto scheme = nav.url().scheme();
    auto host = nav.url().host();
    auto port = nav.url().port();

    debug("navigate: url={}, scheme={}, host={}, port={}\n", url_str,
          scheme,
          host.value_or("(null)"),
          port.has_value() ? std::to_string(*port) : "(null)");

    if (is_internal(scheme, host, port))
    {
        if (nav.new_window())
        {
            debug("  -> redirect to existing view\n");
            g_webview->set_url(nav.url());
            return saucer::policy::block;
        }
        debug("  -> allow\n");
        return saucer::policy::allow;
    }

    debug("  -> block (external)\n");
    show_toast("This website is external, open it in your navigator\n" + url_str);
    return saucer::policy::block;
}

// -- scheme handler (app://) -------------------------------------------------

static saucer::stash stash_from_file(const std::string &path)
{
    std::ifstream f(path, std::ios::binary | std::ios::ate);
    if (!f)
        return saucer::stash::empty();
    auto sz = f.tellg();
    if (sz <= 0)
        return saucer::stash::empty();
    f.seekg(0);
    std::string content(static_cast<std::size_t>(sz), '\0');
    f.read(content.data(), sz);
    return saucer::stash::from_str(content);
}

static std::string guess_mime(const std::string &path)
{
    auto dot = path.rfind('.');
    if (dot == std::string::npos)
        return "application/octet-stream";
    auto ext = path.substr(dot);

    if (ext == ".html" || ext == ".htm")
        return "text/html";
    if (ext == ".js")
        return "application/javascript";
    if (ext == ".css")
        return "text/css";
    if (ext == ".json")
        return "application/json";
    if (ext == ".md")
        return "text/markdown";
    if (ext == ".png")
        return "image/png";
    if (ext == ".jpg" || ext == ".jpeg")
        return "image/jpeg";
    if (ext == ".svg")
        return "image/svg+xml";
    if (ext == ".ico")
        return "image/x-icon";
    if (ext == ".woff2")
        return "font/woff2";
    if (ext == ".woff")
        return "font/woff";
    if (ext == ".ttf")
        return "font/ttf";
    if (ext == ".map")
        return "application/json";
    return "application/octet-stream";
}

static void build_tree(const fs::path &dir, std::ostringstream &out,
                       const std::string &prefix)
{
    std::vector<fs::path> entries;
    for (auto &e : fs::directory_iterator(dir))
        entries.push_back(e.path());
    std::sort(entries.begin(), entries.end());

    bool first = true;
    for (auto &p : entries)
    {
        auto name = p.filename().string();

        if (!first)
            out << ",\n";
        first = false;

        out << prefix << "  ";

        if (fs::is_directory(p))
        {
            out << "\"" << name << "\": {\n";
            build_tree(p, out, prefix + "  ");
            out << "\n" << prefix << "  }";
        }
        else
            out << "\"" << name << "\": null";
    }
}

static saucer::scheme::response handle_app_request(const saucer::scheme::request &req)
{
    auto method = req.method();
    auto req_url = req.url();

    std::string path = req_url.path().string();  // "/index.html", "/assets/app.js", etc.
    if (!path.empty() && path[0] == '/')
        path = path.substr(1);  // strip leading slash

    // For the root URL (app://_/), path will be "." — treat as empty
    if (path == ".")
        path.clear();

    debug("scheme: method={}, url={}, scheme={}, host={}, path={}\n",
          method, req_url.string(), req_url.scheme(),
          req_url.host().value_or("(null)"),
          path.empty() ? "(root)" : path);

    // -- API: tree --

    if (path == "api/tree" && method == "GET")
    {
        if (!fs::exists(g_content_root))
            return {.data = saucer::stash::from_str("{}"),
                    .mime = "application/json", .status = 200};

        std::ostringstream out;
        out << "{\n";
        build_tree(g_content_root, out, "");
        out << "\n}\n";

        return {.data = saucer::stash::from_str(out.str()),
                .mime = "application/json", .status = 200};
    }

    // -- API: move --

    if (path == "api/move" && method == "POST")
    {
        std::string body(req.content().str());

        auto find_val = [&](const std::string &key) -> std::string
        {
            auto pos = body.find("\"" + key + "\"");
            if (pos == std::string::npos)
                return "";
            pos = body.find('"', pos + key.size() + 3);
            if (pos == std::string::npos)
                return "";
            auto end = body.find('"', pos + 1);
            if (end == std::string::npos)
                return "";
            return std::string(body.substr(pos + 1, end - pos - 1));
        };

        auto from = find_val("from");
        auto to = find_val("to");

        if (from.empty() || to.empty())
            return {.data = saucer::stash::from_str("Missing from/to"),
                    .mime = "text/plain", .status = 400};

        if (from[0] == '/')
            from = from.substr(1);
        if (to[0] == '/')
            to = to.substr(1);

        if (from.find("..") != std::string::npos ||
            to.find("..") != std::string::npos)
            return {.data = saucer::stash::from_str("Invalid path"),
                    .mime = "text/plain", .status = 400};

        auto src = fs::path(g_content_root) / from;
        auto dst = fs::path(g_content_root) / to;

        if (!fs::exists(src))
            return {.data = saucer::stash::from_str("Source not found"),
                    .mime = "text/plain", .status = 404};

        if (fs::exists(dst))
            return {.data = saucer::stash::from_str("Destination exists"),
                    .mime = "text/plain", .status = 409};

        fs::create_directories(dst.parent_path());
        fs::rename(src, dst);

        auto parent = src.parent_path();
        while (parent != fs::path(g_content_root) && fs::is_empty(parent))
        {
            fs::remove(parent);
            parent = parent.parent_path();
        }

        return {.data = saucer::stash::from_str("ok"),
                .mime = "text/plain", .status = 200};
    }

    // -- Content API: /content/{path} --

    const std::string content_prefix = "content/";
    if (path.size() > content_prefix.size() &&
        path.substr(0, content_prefix.size()) == content_prefix)
    {
        auto spath = path.substr(content_prefix.size());
        auto qm = spath.find('?');
        if (qm != std::string::npos)
            spath = spath.substr(0, qm);

        auto fpath = fs::path(g_content_root) / spath;

        if (method == "GET")
        {
            if (!fs::exists(fpath) || fs::is_directory(fpath))
                return {.data = saucer::stash::from_str(""),
                        .mime = "text/markdown", .status = 404};

            return {.data = stash_from_file(fpath.string()),
                    .mime = "text/markdown; charset=utf-8", .status = 200};
        }

        if (method == "HEAD")
        {
            struct stat st;
            if (::stat(fpath.c_str(), &st) != 0 || S_ISDIR(st.st_mode))
                return {.data = saucer::stash::from_str(""),
                        .mime = "text/markdown", .status = 404};

            return {.data = saucer::stash::from_str(""),
                    .mime = "text/markdown; charset=utf-8", .status = 200};
        }

        if (method == "PUT")
        {
            std::string body(req.content().str());
            if (fpath.string().find("..") != std::string::npos)
                return {.data = saucer::stash::from_str("Invalid path"),
                        .mime = "text/plain", .status = 400};

            fs::create_directories(fpath.parent_path());
            std::ofstream f(fpath, std::ios::binary);
            if (!f)
                return {.data = saucer::stash::from_str("Write failed"),
                        .mime = "text/plain", .status = 500};
            f << body;
            f.close();

            return {.data = saucer::stash::from_str("ok"),
                    .mime = "text/plain", .status = 200};
        }

        if (method == "DELETE")
        {
            if (!fs::exists(fpath))
                return {.data = saucer::stash::from_str("Not found"),
                        .mime = "text/plain", .status = 404};

            fs::remove(fpath);

            auto parent = fpath.parent_path();
            while (parent != fs::path(g_content_root) && fs::is_empty(parent))
            {
                fs::remove(parent);
                parent = parent.parent_path();
            }

            return {.data = saucer::stash::from_str("ok"),
                    .mime = "text/plain", .status = 200};
        }

        return {.data = saucer::stash::from_str("Method not allowed"),
                .mime = "text/plain", .status = 405};
    }

    // -- Static files --

    std::string file_path;
    if (path.empty() || path == "index.html")
        file_path = g_editor_root + "/public/index.html";
    else
        file_path = g_editor_root + "/public/" + path;

    if (file_path.find("..") != std::string::npos)
        return {.data = saucer::stash::from_str("Forbidden"),
                .mime = "text/plain", .status = 403};

    struct stat st;
    if (::stat(file_path.c_str(), &st) != 0 || S_ISDIR(st.st_mode))
        return {.data = saucer::stash::from_str("Not Found"),
                .mime = "text/plain", .status = 404};

    return {.data = stash_from_file(file_path),
            .mime = guess_mime(file_path), .status = 200};
}

// -- application -------------------------------------------------------------

coco::stray start(saucer::application *app)
{
    auto window = saucer::window::create(app).value();
    saucer::smartview::options opts{.window = window};
    if (g_disable_gpu)
    {
        opts.hardware_acceleration = false;
        opts.browser_flags = {"--disable-gpu"};
    }
    auto webview = saucer::smartview::create(opts).value();
    g_webview = &webview;

    if (!g_favicon.empty())
        if (auto ico = saucer::icon::from(g_favicon))
            window->set_icon(*ico);

    window->set_title("predoc");
    window->set_size({.w = 1200, .h = 800});

    webview.handle_scheme("app", handle_app_request);

    webview.on<saucer::webview::event::navigate>(on_navigate);

    webview.expose("navigateToEditor", [&]()
    {
        debug("JS callback: navigateToEditor -> {}\n", g_editor_url);
        webview.set_url(g_editor_url);
    });

    webview.expose("navigateToPreview", [&](const std::string &path)
    {
        auto url = g_live_url + path;
        debug("JS callback: navigateToPreview({}) -> {}\n", path, url);
        webview.set_url(url);
    });

    webview.expose("handleExternalNav", [&](const std::string &url)
    {
        debug("JS callback: handleExternalNav({})\n", url);
        auto parsed = saucer::url::parse(url);
        if (!parsed)
        {
            show_toast("Could not open link");
            return;
        }
        auto scheme = parsed->scheme();
        auto host = parsed->host();
        auto port = parsed->port();

        if (is_internal(scheme, host, port))
            webview.set_url(url);
        else
            show_toast("This website is external, open it in your navigator\n" + url);
    });

    debug("initial URL: {}\n", g_editor_url);
    webview.set_url(g_editor_url);
    window->show();

    co_await app->finish();
}

int main(int argc, char **argv)
{
    std::span args(argv, argc);

    for (size_t i = 1; i < args.size(); i++)
    {
        std::string arg(args[i]);

        if (arg == "--port" && i + 1 < args.size())
        {
            g_editor_url = "http://127.0.0.1:" + std::string(args[++i]);
            debug("--port: url={}\n", g_editor_url);
        }
        else if (arg == "--live-port" && i + 1 < args.size())
        {
            g_live_url = "http://127.0.0.1:" + std::string(args[++i]);
            debug("--live-port: url={}\n", g_live_url);
        }
        else if (arg == "--editor-root" && i + 1 < args.size())
        {
            g_editor_root = std::string(args[++i]);
            debug("--editor-root: {}\n", g_editor_root);
        }
        else if (arg == "--content-root" && i + 1 < args.size())
        {
            g_content_root = std::string(args[++i]);
            debug("--content-root: {}\n", g_content_root);
        }
        else if (arg == "--favicon" && i + 1 < args.size())
        {
            g_favicon = args[++i];
            debug("--favicon: {}\n", g_favicon);
        }
        else if (arg == "--disable-gpu")
        {
            g_disable_gpu = true;
            debug("--disable-gpu\n");
        }
        else if (arg == "--debug")
        {
            g_debug = true;
            debug("--debug: enabled\n");
        }
    }

    if (!g_editor_root.empty())
    {
        saucer::webview::register_scheme("app");

        if (g_content_root.empty())
            g_content_root = g_editor_root + "/../content";

        g_editor_url = "app://_/";
        debug("using app:// scheme (editor={}, content={})\n",
              g_editor_root, g_content_root);
    }

    if (g_editor_url.empty())
    {
        g_editor_url = "http://127.0.0.1:3000";
        debug("defaulting to editor URL: {}\n", g_editor_url);
    }

    debug("final config:\n");
    debug("  editor_url  = {}\n", g_editor_url);
    debug("  live_url    = {}\n", g_live_url);
    debug("  favicon     = {}\n", g_favicon.empty() ? "(none)" : g_favicon);
    debug("  disable_gpu = {}\n", g_disable_gpu);

    return saucer::application::create({.id = "predoc"})->run(start);
}
