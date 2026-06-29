#pragma once
#include "config.h"
#include <string>
#include <map>
#include <saucer/scheme.hpp>

/// Decode percent-encoded URL component (e.g. %20 -> space).
std::string url_decode(const std::string &s);

saucer::scheme::response handle_serve_image(
    const config &cfg,
    const std::string &rel_path);

saucer::scheme::response handle_upload_image(
    const config &cfg,
    const std::string &body,
    const std::map<std::string, std::string> &headers);

saucer::scheme::response handle_list_images(
    const config &cfg,
    const std::string &query_str);

saucer::scheme::response handle_delete_image(
    const config &cfg,
    const std::string &name,
    const std::string &query_str);

/// Remove image files in the image/ directory adjacent to doc_rel_path
/// that are not referenced by any .md file in the content tree.
/// Cleans up empty image/ directories and empty parent dirs.
void remove_orphaned_images(
    const config &cfg,
    const std::string &doc_rel_path);
