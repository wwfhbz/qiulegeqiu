#!/usr/bin/env bash
# Execute only AFTER deployment approval. Never replaces /usr/bin/node or any other application's runtime.
set -euo pipefail
[[ ${1:-} = --apply ]] || { echo '用法：sudo bash install-runtime.sh --apply'; exit 1; }
glibc=$(getconf GNU_LIBC_VERSION | awk '{print $2}')
[[ $(printf '%s\n' 2.28 "$glibc" | sort -V | head -n 1) = 2.28 ]] || { echo '现有glibc不支持固定Node24，停止；不升级共享服务器操作系统';exit 1; }
base=/opt/qiulegeqiu-api
[[ ! -L "$base" && ! -L "$base/node" ]]
if [[ -x "$base/node/bin/node" ]]; then
 [[ $("$base/node/bin/node" --version) = v24.19.0 ]] || { echo '已有独立Node版本不同，需先审核升级'; exit 1; }
 exit 0
fi
[[ ! -e "$base/node" ]] || { echo '独立runtime目录非空，停止'; exit 1; }
case $(uname -m) in x86_64) arch=x64;expected=14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647;; aarch64) arch=arm64;expected=01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc;; *) echo '不支持的架构';exit 1;; esac
stage=$(mktemp -d)
archive="node-v24.19.0-linux-$arch.tar.xz"
curl --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v24.19.0/$archive" -o "$stage/$archive"
curl --fail --location --proto '=https' --tlsv1.2 https://nodejs.org/dist/v24.19.0/SHASUMS256.txt -o "$stage/SHASUMS256.txt"
[[ $(sha256sum "$stage/$archive" | awk '{print $1}') = "$expected" ]]
(cd "$stage" && awk -v file="$archive" '$2==file' SHASUMS256.txt | sha256sum --check --status)
[[ $(awk -v file="$archive" '$2==file {print $1}' "$stage/SHASUMS256.txt" | wc -c) -eq 65 ]]
tar -xJf "$stage/$archive" -C "$stage"
install -d -m 755 "$base"
mv "$stage/node-v24.19.0-linux-$arch" "$base/node"
"$base/node/bin/node" -e 'const {DatabaseSync}=require("node:sqlite"); const db=new DatabaseSync(":memory:"); console.log(db.prepare("SELECT sqlite_version() AS sqlite").get());db.close()'
