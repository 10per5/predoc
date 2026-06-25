# predoc-gui linux builder
#
# Produces: /build/bin/predoc-gui  (Linux x86_64, Qt6 WebEngine backend)
#
# Usage:
#   docker build -t predoc-gui:linux -f images/linux.Dockerfile .
#   docker create --name tmp predoc-gui:linux
#   docker cp tmp:/build/bin/predoc-gui ./bin/
#   docker rm tmp

FROM debian:trixie-slim AS builder

# ── Layer 1: system dependencies (stable) ──────────────────────────────
RUN apt-get update && apt-get install -y \
    build-essential \
    ninja-build \
    git \
    pkg-config \
    wget \
    qt6-base-dev \
    qt6-webengine-dev \
    libgtk-4-dev \
    libadwaita-1-dev \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && ldconfig

# ── Layer 2: g++-15 from sid (stable compiler pin) ────────────────────
RUN echo "deb http://deb.debian.org/debian sid main" > /etc/apt/sources.list.d/sid.list \
    && printf 'Package: *\nPin: release a=sid\nPin-Priority: 100\n' > /etc/apt/preferences.d/sid.pref \
    && apt-get update \
    && apt-get install -y -t sid g++-15 \
    && rm -rf /var/lib/apt/lists/*

ENV CC=gcc-15 CXX=g++-15 \
    CXXFLAGS="-mno-direct-extern-access"

# ── Layer 3: CMake 4.4.0-rc1 (required by Saucer 8.2.0) ───────────────
RUN wget -qO- \
    "https://github.com/Kitware/CMake/releases/download/v4.4.0-rc1/cmake-4.4.0-rc1-linux-x86_64.tar.gz" \
    | tar xz --strip-components=1 -C /usr/local

# ── Layer 4: premake5 (not in trixie repos) ───────────────────────────
RUN wget -qO- \
    "https://github.com/premake/premake-core/releases/download/v5.0.0-beta8/premake-5.0.0-beta8-linux.tar.gz" \
    | tar xz -C /usr/local/bin premake5 \
    && chmod +x /usr/local/bin/premake5

# ── Layer 5: Saucer + dependencies (busts on commit change) ───────────
WORKDIR /deps
RUN --mount=type=cache,target=/deps/saucer/build \
    if [ ! -d /deps/saucer-src/.git ]; then \
    git clone https://github.com/saucer/saucer.git /deps/saucer-src; \
    fi && \
    cd /deps/saucer-src && \
    git fetch --depth 1 origin 811cd2f8ee7044d7143fc8d36b9ceaaef878de39 && \
    git checkout 811cd2f8ee7044d7143fc8d36b9ceaaef878de39 && \
    sed -i 's|value_or({native::id\.data()})|value_or(decltype(native::argv){native::id.data()})|' src/qt.app.cpp && \
    grep -q 'decltype(native::argv){native::id.data()}' src/qt.app.cpp && \
    sed -i 's|return from({std::from_range, data()});|return from(vec(data().begin(), data().end()));|' src/stash.cpp && \
    grep -q 'return from(vec(data().begin(), data().end()));' src/stash.cpp && \
    cmake -B /deps/saucer/build -G Ninja -S . \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DCMAKE_CXX_FLAGS="-mno-direct-extern-access" \
    -DSAUCER_USE_QTWEBENGINE=ON \
    -Dsaucer_backend=Qt && \
    cmake --build /deps/saucer/build -j"$(nproc)" && \
    cp -v /deps/saucer/build/libsaucer.a /deps/saucer/build/_deps/coco-build/libcoco.a /usr/local/lib/ && \
    cmake --install /deps/saucer/build && \
    for d in /deps/saucer/build/_deps/*/include/; do \
    [ -d "$d" ] || continue; \
    cp -r "$d"/* /usr/local/include/ 2>/dev/null; \
    done && \
    for d in /usr/local/include/*-*/; do \
    base="${d%%-*}"; \
    base="${base%/}"; \
    base="${base##*/}"; \
    ln -sf "$d" "/usr/local/include/$base" 2>/dev/null; \
    done

# ── Layer 6: predep (stage-resolver for vendor deps) ──────────────────
RUN curl -sL \
    https://github.com/10per5/predep/releases/download/v0.0.1/predep-linux-x86_64.tar.gz \
    -o /tmp/predep.tar.gz \
    && tar xzf /tmp/predep.tar.gz -C /usr/local/bin \
    && predep --help > /dev/null

# ── Layer 7: vendor deps (busts only on predep.toml changes) ──────────
WORKDIR /build
COPY predep.toml ./
RUN predep vendor --privileged 540eeb513dc74a7b2aa7bbe014264b6e3a6e8855629300ae72cba3defb91d1b3 

# ── Layer 8: predoc-gui binary (busts on premake5.lua or src/ changes) ──
COPY premake5.lua ./
COPY src/ src/
ENV CXXFLAGS="-std=c++23 -mno-direct-extern-access" \
    LD_LIBRARY_PATH=/usr/lib/x86_64-linux-gnu
RUN premake5 gmake && make config=redist -j"$(nproc)" CXX=g++-15

# ── Output stage ──────────────────────────────────────────────────────
FROM scratch
COPY --from=builder /build /build
CMD ["true"]
