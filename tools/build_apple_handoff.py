"""Export source changes from the two existing repos; never apply or commit them."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile


def git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "--no-pager", "-c", "color.ui=false", *args], cwd=root, stderr=subprocess.PIPE)


def excluded(path: str) -> bool:
    parts = Path(path).parts
    name = Path(path).name.lower()
    return (
        bool(set(parts) & {".git", ".local", "node_modules", ".expo", "Pods", "xcuserdata", "__pycache__"})
        or parts[0] in {"ios", "android"}
        or (name.startswith(".env") and name != ".env.example")
        or name == "credentials.json"
        or Path(name).suffix in {".p8", ".p12", ".pem", ".key", ".mobileprovision", ".xcuserstate", ".log"}
    )


def sanitize(data: bytes, path: str) -> bytes:
    # Redact configuration/evidence, never source-code string fixtures.
    name = Path(path).name.lower()
    if not (name.endswith((".pbxproj", ".md", ".txt")) or name.startswith("apple-ai-probe-")):
        return data
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    data = re.sub(rb'(DEVELOPMENT_TEAM\s*=\s*)"?[A-Z0-9]{10}"?', rb'\1""', data)
    data = re.sub(rb'(DevelopmentTeam\s*=\s*)"?[A-Z0-9]{10}"?', rb'\1""', data)
    data = re.sub(rb'\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{16}\b', b"YOUR_IPHONE_UDID", data)
    return re.sub(rb'Apple Development:\s*[^\r\n(]+\([A-Z0-9]{10}\)',
                  b"Apple Development: YOUR_APPLE_ACCOUNT (YOUR_CERTIFICATE_ID)", data)


def sanitize_patch(data: bytes) -> bytes:
    path = ""
    result = []
    for line in data.splitlines(keepends=True):
        if line.startswith(b"diff --git "):
            path = line.decode().strip().rsplit(" ", 1)[-1].strip('"')
        result.append(sanitize(line, path))
    return b"".join(result)


def repo_changes(root: Path, ignored: tuple[Path, ...] = ()) -> tuple[dict, dict[str, bytes], bytes]:
    if Path(git(root, "rev-parse", "--show-toplevel").decode().strip()).resolve() != root.resolve():
        raise ValueError(f"Expected a repository root: {root}")
    records = git(root, "diff", "--no-ext-diff", "--no-textconv", "--find-renames", "--name-status", "-z", "HEAD").split(b"\0")
    tracked_paths: set[str] = set()
    files: set[str] = set()
    deleted: set[str] = set()
    skipped: set[str] = set()
    index = 0
    while index < len(records) and records[index]:
        status = records[index].decode()
        index += 1
        old = records[index].decode()
        index += 1
        new = old
        if status.startswith(("R", "C")):
            new = records[index].decode()
            index += 1
        if status.startswith("U"):
            raise ValueError("Resolve unmerged files before exporting a handoff.")
        paths = {old, new}
        if any(excluded(path) or (root / path).is_symlink() or (root / path).resolve() in ignored for path in paths):
            skipped.update(paths)
            continue
        if not status.startswith("D") and (not (root / new).is_file() or not (root / new).resolve().is_relative_to(root.resolve())):
            skipped.update(paths)
            continue
        tracked_paths.update(paths)
        if status.startswith("D"):
            deleted.add(old)
        else:
            files.add(new)
            if status.startswith("R"):
                deleted.add(old)
    for item in git(root, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0"):
        if not item:
            continue
        path = item.decode()
        if excluded(path) or (root / path).is_symlink() or (root / path).resolve() in ignored:
            skipped.add(path)
        else:
            files.add(path)
    contents: dict[str, bytes] = {}
    for path in sorted(files):
        source = root / path
        if not source.is_file() or not source.resolve().is_relative_to(root.resolve()):
            skipped.add(path)
            tracked_paths.discard(path)
            continue
        contents[path] = sanitize(source.read_bytes(), path)
    patch = git(root, "diff", "--no-ext-diff", "--no-textconv", "--find-renames", "--binary", "HEAD", "--", *sorted(tracked_paths)) if tracked_paths else b""
    info = {
        "branch": git(root, "branch", "--show-current").decode().strip(),
        "head": git(root, "rev-parse", "HEAD").decode().strip(),
        "exported_files": sorted(contents),
        "deleted_files": sorted(deleted),
        "excluded_files": sorted(skipped),
    }
    return info, contents, sanitize_patch(patch)


def build_handoff(app: Path, backend: Path, output: Path, *, overwrite: bool = False, include_probe_fixtures: bool = False) -> dict:
    app, backend, output = app.resolve(), backend.resolve(), output.resolve()
    if output.exists() and not overwrite:
        raise ValueError("Output exists; use --overwrite to replace this handoff archive.")
    entries: dict[str, bytes] = {}
    repos = {}
    ignored = (output, output.with_suffix(output.suffix + ".sha256"), output.with_suffix(output.suffix + ".tmp"))
    for name, root in (("app", app), ("backend", backend)):
        repos[name], files, patch = repo_changes(root, ignored)
        entries[f"patches/{name}-tracked.patch"] = patch
        for path, data in files.items():
            entries[f"overlay/{name}/{path}"] = data
    if include_probe_fixtures:
        for version in ("baseline", "v2"):
            for kind in ("report", "analysis"):
                name = f"apple-ai-probe-{version}-{kind}.json"
                path = backend / ".local" / name
                if path.is_file() and not path.is_symlink():
                    entries[f"synthetic-evidence/{name}"] = sanitize(path.read_bytes(), name)
    entries["README.txt"] = (
        "Apple AI Windows source handoff\n\n"
        "This is an overlay of changed files, not complete repositories.\n"
        "Compare branch/HEAD in MANIFEST.json and preserve Windows uncommitted work before merging.\n"
        "Review patches and deleted_files; do not blindly overwrite either repository.\n"
        "Read overlay/app/docs/APPLE_INTAKE.md for current checks and device acceptance status.\n"
        "No env credentials, signing files, generated iOS projects or build dependencies are included.\n"
        "Team values/device UDIDs are sanitized in exported copies; originals remain unchanged.\n"
        "synthetic-evidence, when present, is only the earlier fixed Probe fixtures.\n"
    ).encode()
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "repos": repos,
        "files": {name: {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)} for name, data in entries.items()},
    }
    entries["MANIFEST.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    try:
        with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, data in entries.items():
                archive.writestr(name, data)
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise ValueError("ZIP verification failed.")
            for name, info in manifest["files"].items():
                if hashlib.sha256(archive.read(name)).hexdigest() != info["sha256"]:
                    raise ValueError(f"Checksum mismatch: {name}")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    checksum = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(f"{checksum}  {output.name}\n")
    return {"path": str(output), "bytes": output.stat().st_size, "files": len(entries), "sha256": checksum}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--backend", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--include-probe-fixtures", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build_handoff(args.app.resolve(), args.backend.resolve(), args.output.resolve(), overwrite=args.overwrite,
                                  include_probe_fixtures=args.include_probe_fixtures), ensure_ascii=False))


if __name__ == "__main__":
    main()
