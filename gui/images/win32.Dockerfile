# predoc-gui win32 cross-builder
#
# Produces: /build/bin/predoc-gui.exe  (Windows x86_64)
#
# Uses MinGW cross-compilation from Debian.  Saucer is built with the
# WebView2 backend (native Windows backend).  The WebView2 NuGet SDK
# is downloaded manually since NuGet.exe is not available on Linux.
#
# Known limitation: Saucer's own CMakeLists.txt warns that
# "WebView2 requires certain headers that are not provided by MinGW".
# If the Saucer static lib build fails, fall back to a native Windows
# Docker image or MSVC toolchain.
#
# Usage:
#   docker build -t predoc-gui:win32 -f images/win32.Dockerfile .
#   docker create --name tmp predoc-gui:win32
#   docker cp tmp:/build/bin/predoc-gui.exe ./bin/
#   docker rm tmp

FROM debian:trixie-slim AS builder

# ── Layer 1: cross-compilation toolchain ──────────────────────────────
RUN apt-get update && apt-get install -y \
    g++-mingw-w64-x86-64 \
    ninja-build \
    cmake \
    wget \
    curl \
    ca-certificates \
    unzip \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

ENV CC=x86_64-w64-mingw32-gcc \
    CXX=x86_64-w64-mingw32-g++

# ── Layer 2: premake5 (not in trixie repos) ───────────────────────────
RUN wget -qO- \
    "https://github.com/premake/premake-core/releases/download/v5.0.0-beta8/premake-5.0.0-beta8-linux.tar.gz" \
    | tar xz -C /usr/local/bin premake5 \
    && chmod +x /usr/local/bin/premake5

# ── Layer 3: WebView2 SDK (NuGet package, manually extracted) ────────
RUN wget -q \
    "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.3650.58" \
    -O /tmp/wv2.zip \
    && unzip -q /tmp/wv2.zip -d /tmp/wv2 \
    && cp -r /tmp/wv2/build/native/include/* /usr/x86_64-w64-mingw32/include/ \
    && cp /tmp/wv2/build/native/x64/WebView2LoaderStatic.lib \
    /usr/x86_64-w64-mingw32/lib/ \
    && rm -rf /tmp/wv2*

# ── Layer 4: Saucer for Windows (WebView2 backend) ────────────────────
#
# Builds Saucer as a static lib for Windows using MinGW.  The NuGet
# CMake module is replaced with a no-op so the manually-extracted SDK
# at the MinGW sysroot is used instead.
#
# Note: the two sed patches from the Linux build are Qt-specific and
# not needed here.  The stash.cpp patch is applied since coco is shared.
WORKDIR /deps
RUN if [ ! -d /deps/saucer-src/.git ]; then \
    git clone https://github.com/saucer/saucer.git /deps/saucer-src; \
    fi && \
    cd /deps/saucer-src && \
    git fetch --depth 1 origin 811cd2f8ee7044d7143fc8d36b9ceaaef878de39 && \
    git checkout 811cd2f8ee7044d7143fc8d36b9ceaaef878de39 && \
    sed -i 's|return from({std::from_range, data()});|return from(vec(data().begin(), data().end()));|' src/stash.cpp || true && \
    cmake -B /deps/saucer/build -G Ninja -S . \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/x86_64-w64-mingw32 \
    -DCMAKE_SYSTEM_NAME=Windows \
    -DCMAKE_CXX_COMPILER=x86_64-w64-mingw32-g++ \
    -DCMAKE_C_COMPILER=x86_64-w64-mingw32-gcc \
    -Dsaucer_backend=WebView2 \
    -Dsaucer_no_compiler_version_check=ON \
    -Dsaucer_no_sdk_version_check=ON \
    -Dsaucer_webview2_arch=x64 \
    -Dsaucer_prefer_remote=OFF \
    -Dsaucer_static=ON \
    2>&1 || echo "Saucer CMake configuration failed — see above for MinGW header issues" && \
    if [ -f /deps/saucer/build/build.ninja ]; then \
    cmake --build /deps/saucer/build -j"$(nproc)" 2>&1 || \
    echo "Saucer build failed — WebView2 MinGW headers may be incomplete"; \
    fi && \
    if [ -f /deps/saucer/build/libsaucer.a ]; then \
    cp -v /deps/saucer/build/libsaucer.a /usr/x86_64-w64-mingw32/lib/ && \
    cmake --install /deps/saucer/build 2>/dev/null; \
    for d in /deps/saucer/build/_deps/*/include/; do \
    [ -d "$d" ] || continue; \
    cp -r "$d"/* /usr/x86_64-w64-mingw32/include/ 2>/dev/null; \
    done; \
    fi

# ── Layer 5: predep (stage-resolver for vendor deps) ──────────────────
RUN curl -sL \
    https://github.com/10per5/predep/releases/download/v0.0.1/predep-linux-x86_64.tar.gz \
    -o /tmp/predep.tar.gz \
    && tar xzf /tmp/predep.tar.gz -C /usr/local/bin \
    && predep --help > /dev/null

# ── Layer 6: vendor deps (busts only on predep.toml changes) ──────────
WORKDIR /build
COPY predep.toml ./
RUN predep vendor --privileged 540eeb513dc74a7b2aa7bbe014264b6e3a6e8855629300ae72cba3defb91d1b3 

# ── Layer 7: predoc-gui.exe (busts on premake5.lua or src/ changes) ───
COPY premake5.lua ./
COPY src/ src/
RUN premake5 gmake --os=windows \
    && make config=redist -j"$(nproc)" \
    CC=x86_64-w64-mingw32-gcc \
    CXX=x86_64-w64-mingw32-g++ \
    CXXFLAGS="-std=c++23 -I/usr/x86_64-w64-mingw32/include" \
    LDFLAGS="-L/usr/x86_64-w64-mingw32/lib -static-libgcc -static-libstdc++" \
    LIBS="-lsaucer -lcoco -lWebView2LoaderStatic -lCoreMessaging -lRuntimeObject -lWininet -lShlwapi -lgdiplus -lole32 -loleaut32 -lcomctl32 -luuid"

# ── Output stage ──────────────────────────────────────────────────────
FROM scratch
COPY --from=builder /build /build
CMD ["true"]
